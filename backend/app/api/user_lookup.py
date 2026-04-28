"""Exact-match user lookup for group invites.

Deliberately does NOT support listing or partial search — that would
leak the user table's email column to any authenticated client. The
caller must already know the exact email of the person they want to
link to a group.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.database import get_async_session
from app.models.user import User

router = APIRouter(prefix="/api/users", tags=["users"])


class UserLookupResult(BaseModel):
    id: uuid.UUID
    email: EmailStr

    model_config = ConfigDict(from_attributes=True)


@router.get("/lookup", response_model=UserLookupResult)
async def lookup_user_by_email(
    email: EmailStr = Query(..., description="Exact email to look up"),
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(current_active_user),
):
    result = await session.execute(
        select(User).where(func.lower(User.email) == email.lower())
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
