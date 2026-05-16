from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.core.database import get_db
from app.core.redis import get_redis_client
from app.core.security import get_current_user
from app.models.transfer import Transfer, TransferStatus
from app.models.user import User
from app.schemas.transfer import TransferCreate, TransferRead, TransferListResponse
from app.services.exchange_service import get_rate
from app.services.transfer_service import create_transfer

router = APIRouter(prefix="/transfers", tags=["transfers"])


async def _get_redis() -> Redis:
    return await get_redis_client()


@router.post("", response_model=TransferRead, status_code=status.HTTP_201_CREATED)
async def initiate_transfer(
    data: TransferCreate,
    x_idempotency_key: str | None = Header(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(_get_redis),
):
    if x_idempotency_key:
        idem_key = f"wiseclone:idempotency:{x_idempotency_key}"
        existing_id = await redis.get(idem_key)
        if existing_id:
            result = await db.execute(select(Transfer).where(Transfer.id == existing_id))
            transfer = result.scalar_one_or_none()
            if transfer:
                return transfer

    try:
        rate, _ = await get_rate(data.source_currency, data.target_currency, redis)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch exchange rate: {e}")

    transfer = await create_transfer(data, current_user.id, rate, db)

    if x_idempotency_key:
        await redis.setex(f"wiseclone:idempotency:{x_idempotency_key}", 86400, transfer.id)

    await db.flush()

    from app.workers.tasks import process_transfer
    task = process_transfer.delay(transfer.id)
    transfer.celery_task_id = task.id

    return transfer


@router.get("", response_model=TransferListResponse)
async def list_transfers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    transfer_status: TransferStatus | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Transfer).where(Transfer.sender_id == current_user.id)
    if transfer_status:
        q = q.where(Transfer.status == transfer_status)
    q = q.order_by(Transfer.created_at.desc())

    total_result = await db.execute(
        select(func.count()).select_from(q.subquery())
    )
    total = total_result.scalar_one()

    items_result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    items = items_result.scalars().all()

    return TransferListResponse(items=list(items), total=total, page=page, page_size=page_size)


@router.get("/{reference}", response_model=TransferRead)
async def get_transfer(
    reference: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transfer).where(
            Transfer.reference == reference,
            Transfer.sender_id == current_user.id,
        )
    )
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return transfer
