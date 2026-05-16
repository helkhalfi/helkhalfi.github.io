from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from redis.asyncio import Redis

from app.core.config import settings
from app.core.redis import get_redis_client
from app.schemas.exchange import QuoteResponse, RatesResponse
from app.services.exchange_service import get_rate, get_all_rates

router = APIRouter(prefix="/exchange", tags=["exchange"])


async def _get_redis() -> Redis:
    return await get_redis_client()


@router.get("/rates", response_model=RatesResponse)
async def rates(
    base: str = Query(default="USD", min_length=3, max_length=3),
    redis: Redis = Depends(_get_redis),
):
    base = base.upper()
    try:
        rate_map, cached, ttl = await get_all_rates(base, redis)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Exchange rate service unavailable: {e}")

    return RatesResponse(base=base, rates=rate_map, cached=cached, ttl_remaining=ttl)


@router.get("/quote", response_model=QuoteResponse)
async def quote(
    from_currency: str = Query(alias="from", min_length=3, max_length=3),
    to_currency: str = Query(alias="to", min_length=3, max_length=3),
    amount: Decimal = Query(gt=0),
    redis: Redis = Depends(_get_redis),
):
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    try:
        rate, cached = await get_rate(from_currency, to_currency, redis)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Exchange rate service unavailable: {e}")

    fee = (amount * Decimal(str(settings.FEE_PERCENTAGE))).quantize(Decimal("0.0001"))
    amount_after_fee = amount - fee
    recipient_gets = (amount_after_fee * rate).quantize(Decimal("0.0001"))

    return QuoteResponse(
        from_currency=from_currency,
        to_currency=to_currency,
        send_amount=amount,
        fee=fee,
        amount_after_fee=amount_after_fee,
        exchange_rate=rate,
        recipient_gets=recipient_gets,
        cached=cached,
    )
