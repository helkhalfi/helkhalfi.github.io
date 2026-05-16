import asyncio
import logging
import random
from datetime import datetime, timezone
from decimal import Decimal

from celery import shared_task

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    name="app.workers.tasks.process_transfer",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    queue="transfers",
)
def process_transfer(self, transfer_id: str) -> dict:
    return _run_async(_process_transfer_async(transfer_id))


async def _process_transfer_async(transfer_id: str) -> dict:
    from sqlalchemy import select, update
    from app.core.database import AsyncSessionLocal
    from app.core.redis import get_redis_client
    from app.models.transfer import Transfer, TransferStatus
    from app.models.account import Account
    from app.models.rate_snapshot import RateSnapshot
    from app.services.exchange_service import get_rate

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Transfer).where(Transfer.id == transfer_id).with_for_update()
        )
        transfer = result.scalar_one_or_none()

        if not transfer:
            logger.error("Transfer %s not found", transfer_id)
            return {"status": "not_found"}

        if transfer.status != TransferStatus.pending:
            logger.info("Transfer %s already %s — skipping", transfer_id, transfer.status)
            return {"status": str(transfer.status)}

        updated = await db.execute(
            update(Transfer)
            .where(Transfer.id == transfer_id, Transfer.status == TransferStatus.pending)
            .values(status=TransferStatus.processing)
            .returning(Transfer.id)
        )
        if not updated.fetchone():
            return {"status": "already_processing"}

        await db.commit()

    try:
        redis = await get_redis_client()
        current_rate, _ = await get_rate(transfer.source_currency, transfer.target_currency, redis)
        locked_rate = transfer.exchange_rate

        drift = abs(current_rate - locked_rate) / locked_rate
        if drift > Decimal("0.02"):
            raise ValueError(f"Rate drifted {drift:.2%} — exceeds 2% threshold")

        await asyncio.sleep(random.uniform(2, 8))

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Transfer)
                .where(Transfer.id == transfer_id)
                .values(
                    status=TransferStatus.completed,
                    completed_at=datetime.now(timezone.utc),
                )
            )
            db.add(RateSnapshot(
                base=transfer.source_currency,
                target=transfer.target_currency,
                rate=transfer.exchange_rate,
                source="transfer_locked",
            ))
            await db.commit()

        logger.info("Transfer %s completed", transfer_id)
        return {"transfer_id": transfer_id, "status": "completed"}

    except Exception as exc:
        logger.error("Transfer %s failed: %s", transfer_id, exc)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Account).where(
                    Account.user_id == transfer.sender_id,
                    Account.currency == transfer.source_currency,
                ).with_for_update()
            )
            account = result.scalar_one_or_none()
            if account:
                account.balance += transfer.source_amount

            await db.execute(
                update(Transfer)
                .where(Transfer.id == transfer_id)
                .values(status=TransferStatus.failed, failure_reason=str(exc))
            )
            await db.commit()

        return {"transfer_id": transfer_id, "status": "failed", "reason": str(exc)}


@celery_app.task(
    name="app.workers.tasks.rate_refresh",
    queue="rates",
)
def rate_refresh(currencies: list[str]) -> dict:
    return _run_async(_rate_refresh_async(currencies))


async def _rate_refresh_async(currencies: list[str]) -> dict:
    import httpx
    import json
    from app.core.config import settings
    from app.core.redis import get_redis_client
    from app.core.database import AsyncSessionLocal
    from app.models.rate_snapshot import RateSnapshot

    redis = await get_redis_client()
    refreshed = 0
    errors = 0

    async with httpx.AsyncClient(timeout=10.0) as client:
        for base in currencies:
            try:
                resp = await client.get(
                    f"{settings.FRANKFURTER_BASE_URL}/latest",
                    params={"from": base},
                )
                resp.raise_for_status()
                data = resp.json()
                rates = data["rates"]
                rates[base] = 1.0

                await redis.setex(
                    f"wiseclone:rates:{base}:all",
                    settings.RATE_CACHE_TTL_SECONDS,
                    json.dumps(rates),
                )

                async with AsyncSessionLocal() as db:
                    for target, rate in rates.items():
                        if target == base:
                            continue
                        await redis.setex(
                            f"wiseclone:rates:{base}:{target}",
                            settings.RATE_CACHE_TTL_SECONDS,
                            str(rate),
                        )
                        db.add(RateSnapshot(base=base, target=target, rate=Decimal(str(rate))))
                    await db.commit()

                refreshed += len(rates)
            except Exception as exc:
                logger.error("Rate refresh failed for %s: %s", base, exc)
                errors += 1

    return {"refreshed": refreshed, "errors": errors, "timestamp": datetime.now(timezone.utc).isoformat()}
