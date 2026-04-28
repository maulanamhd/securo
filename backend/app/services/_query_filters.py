"""Shared SQLAlchemy filter fragments for report/dashboard queries.

Centralizes the "what counts as real income/expense" definition so every
aggregation site agrees. Changes to the rule (e.g. adding a new exclusion
signal) only need to be made here.
"""
import uuid
from datetime import date

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.transaction import Transaction


def counts_as_pnl():
    """SQL filter: True when a transaction should contribute to income/expense totals.

    Excludes:
      - paired transfers (both legs were matched; already cancel out),
      - transactions in categories flagged `treat_as_transfer` (one-sided
        movements like investment applications where the counterpart is
        an Asset/Holding, not another Account).

    Does NOT exclude `source='opening_balance'` — callers that already
    filter those keep doing so; this helper only handles the transfer-like
    exclusion family so both rules stay visible at each call site.
    """
    return and_(
        Transaction.transfer_pair_id.is_(None),
        # Settlement debits represent paying back a debt that was
        # already booked as an expense via the share that produced it.
        # Including them would double-count.
        Transaction.source != "settlement",
        or_(
            Transaction.category_id.is_(None),
            Transaction.category_id.not_in(
                select(Category.id).where(Category.treat_as_transfer.is_(True))
            ),
        ),
    )


async def viewer_shared_pnl(
    session: AsyncSession,
    user_id: uuid.UUID,
    month_start: date,
    month_end: date,
    use_effective_date: bool = False,
) -> tuple[float, float]:
    """Return (income, expense) totals contributed by transactions the
    viewer doesn't own but participates in via a group split.

    Concert tickets paid by a friend show up as the viewer's share in
    their own spending picture — without inflating account balances.
    """
    from app.models.group import GroupMember
    from app.models.transaction_split import TransactionSplit

    member_ids = select(GroupMember.id).where(GroupMember.linked_user_id == user_id)
    date_col = Transaction.effective_date if use_effective_date else Transaction.date

    result = await session.execute(
        select(
            func.sum(
                case(
                    (Transaction.type == "credit", TransactionSplit.share_amount),
                    else_=0,
                )
            ),
            func.sum(
                case(
                    (Transaction.type == "debit", TransactionSplit.share_amount),
                    else_=0,
                )
            ),
        )
        .join(Transaction, TransactionSplit.transaction_id == Transaction.id)
        .where(
            TransactionSplit.group_member_id.in_(member_ids),
            # Avoid double-counting if the viewer also owns the parent.
            Transaction.user_id != user_id,
            Transaction.source != "opening_balance",
            date_col >= month_start,
            date_col < month_end,
            counts_as_pnl(),
        )
    )
    row = result.one()
    return float(row[0] or 0), float(row[1] or 0)


async def viewer_shared_spending_by_category(
    session: AsyncSession,
    user_id: uuid.UUID,
    month_start: date,
    month_end: date,
    use_effective_date: bool = False,
) -> dict:
    """Return {category_id (uuid|None): total_share_expense_float} for
    transactions where the viewer participates via a group split."""
    from app.models.group import GroupMember
    from app.models.transaction_split import TransactionSplit

    member_ids = select(GroupMember.id).where(GroupMember.linked_user_id == user_id)
    date_col = Transaction.effective_date if use_effective_date else Transaction.date

    result = await session.execute(
        select(
            Transaction.category_id,
            func.sum(TransactionSplit.share_amount),
        )
        .join(Transaction, TransactionSplit.transaction_id == Transaction.id)
        .where(
            TransactionSplit.group_member_id.in_(member_ids),
            Transaction.user_id != user_id,
            Transaction.type == "debit",
            Transaction.source != "opening_balance",
            date_col >= month_start,
            date_col < month_end,
            counts_as_pnl(),
        )
        .group_by(Transaction.category_id)
    )
    return {row[0]: float(row[1] or 0) for row in result.all()}
