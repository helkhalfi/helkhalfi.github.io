import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountRead

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountRead])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.user_id == current_user.id).order_by(Account.is_primary.desc())
    )
    return result.scalars().all()


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Account).where(Account.user_id == current_user.id, Account.currency == data.currency)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"You already have a {data.currency} account")

    account = Account(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        currency=data.currency,
        balance=0,
        is_primary=False,
    )
    db.add(account)
    await db.flush()
    return account


@router.get("/{account_id}/balance")
async def get_balance(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    return {"account_id": account.id, "currency": account.currency, "balance": str(account.balance)}
