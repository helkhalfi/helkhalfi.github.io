import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.account import Account
from app.models.transfer import Transfer, TransferStatus
from app.schemas.transfer import TransferCreate


def generate_reference() -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"TRF-{date_part}-{suffix}"


async def create_transfer(
    data: TransferCreate,
    sender_id: str,
    exchange_rate: Decimal,
    db: AsyncSession,
) -> Transfer:
    fee = (data.source_amount * Decimal(str(settings.FEE_PERCENTAGE))).quantize(Decimal("0.0001"))
    amount_after_fee = data.source_amount - fee
    target_amount = (amount_after_fee * exchange_rate).quantize(Decimal("0.0001"))

    result = await db.execute(
        select(Account).where(
            Account.user_id == sender_id,
            Account.currency == data.source_currency,
        ).with_for_update()
    )
    account = result.scalar_one_or_none()

    if not account:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No {data.source_currency} account found",
        )

    if account.balance < data.source_amount:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient balance",
        )

    if data.source_amount < Decimal(str(settings.MIN_TRANSFER_AMOUNT)):
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum transfer amount is {settings.MIN_TRANSFER_AMOUNT}",
        )

    if data.source_amount > Decimal(str(settings.MAX_TRANSFER_AMOUNT)):
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum transfer amount is {settings.MAX_TRANSFER_AMOUNT}",
        )

    account.balance -= data.source_amount

    transfer = Transfer(
        id=str(uuid.uuid4()),
        reference=generate_reference(),
        sender_id=sender_id,
        recipient_name=data.recipient_name,
        recipient_email=str(data.recipient_email) if data.recipient_email else None,
        source_currency=data.source_currency,
        target_currency=data.target_currency,
        source_amount=data.source_amount,
        target_amount=target_amount,
        exchange_rate=exchange_rate,
        fee_amount=fee,
        status=TransferStatus.pending,
        estimated_arrival=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(transfer)
    await db.flush()
    return transfer
