import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.group import GroupCreate, GroupMemberCreate
from app.schemas.group_settlement import (
    GroupSettlementCreate,
    GroupSettlementUpdate,
)
from app.services import group_service, settlement_service


async def _setup_group(session, user_id):
    group = await group_service.create_group(
        session, user_id, GroupCreate(name=f"S-{uuid.uuid4().hex[:6]}")
    )
    a = await group_service.create_member(
        session, group.id, user_id, GroupMemberCreate(name="Alice")
    )
    b = await group_service.create_member(
        session, group.id, user_id, GroupMemberCreate(name="Bob")
    )
    return group, a, b


@pytest.mark.asyncio
async def test_create_settlement_happy_path(session: AsyncSession, test_user):
    group, a, b = await _setup_group(session, test_user.id)
    s = await settlement_service.create_settlement(
        session,
        group.id,
        test_user.id,
        GroupSettlementCreate(
            from_member_id=a.id,
            to_member_id=b.id,
            amount=Decimal("12.50"),
            currency="USD",
            date=date.today(),
        ),
    )
    assert s is not None
    assert s.amount == Decimal("12.50")
    assert s.currency == "USD"


@pytest.mark.asyncio
async def test_settlement_members_must_belong_to_group(
    session: AsyncSession, test_user
):
    group, a, _b = await _setup_group(session, test_user.id)
    other_group, _x, y = await _setup_group(session, test_user.id)

    with pytest.raises(ValueError, match="must belong to the group"):
        await settlement_service.create_settlement(
            session,
            group.id,
            test_user.id,
            GroupSettlementCreate(
                from_member_id=a.id,
                to_member_id=y.id,  # belongs to other_group
                amount=Decimal("5.00"),
                currency="USD",
                date=date.today(),
            ),
        )


@pytest.mark.asyncio
async def test_settlement_from_to_must_differ_at_creation(
    session: AsyncSession, test_user
):
    group, a, _b = await _setup_group(session, test_user.id)
    # Pydantic-level validation rejects from == to before service runs.
    with pytest.raises(ValueError, match="must differ"):
        GroupSettlementCreate(
            from_member_id=a.id,
            to_member_id=a.id,
            amount=Decimal("5.00"),
            currency="USD",
            date=date.today(),
        )


@pytest.mark.asyncio
async def test_settlement_update_keeps_invariants(session: AsyncSession, test_user):
    group, a, b = await _setup_group(session, test_user.id)
    s = await settlement_service.create_settlement(
        session,
        group.id,
        test_user.id,
        GroupSettlementCreate(
            from_member_id=a.id,
            to_member_id=b.id,
            amount=Decimal("10.00"),
            currency="USD",
            date=date.today(),
        ),
    )

    updated = await settlement_service.update_settlement(
        session,
        group.id,
        s.id,
        test_user.id,
        GroupSettlementUpdate(amount=Decimal("12.00"), notes="adjusted"),
    )
    assert updated.amount == Decimal("12.00")
    assert updated.notes == "adjusted"

    # Updating to set both ends to the same member should fail.
    with pytest.raises(ValueError, match="must differ"):
        await settlement_service.update_settlement(
            session,
            group.id,
            s.id,
            test_user.id,
            GroupSettlementUpdate(to_member_id=a.id),
        )


@pytest.mark.asyncio
async def test_settlement_owner_isolation(session: AsyncSession, test_user):
    group, a, b = await _setup_group(session, test_user.id)
    other_user = uuid.uuid4()
    result = await settlement_service.create_settlement(
        session,
        group.id,
        other_user,
        GroupSettlementCreate(
            from_member_id=a.id,
            to_member_id=b.id,
            amount=Decimal("1.00"),
            currency="USD",
            date=date.today(),
        ),
    )
    assert result is None
