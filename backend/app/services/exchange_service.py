from decimal import Decimal
import httpx
from redis.asyncio import Redis

from app.core.config import settings


async def get_rate(base: str, target: str, redis: Redis) -> tuple[Decimal, bool]:
    if base == target:
        return Decimal("1"), True

    key = f"wiseclone:rates:{base}:{target}"
    cached = await redis.get(key)
    if cached:
        return Decimal(cached), True

    rate = await _fetch_rate(base, target)
    await redis.setex(key, settings.RATE_CACHE_TTL_SECONDS, str(rate))
    return rate, False


async def get_all_rates(base: str, redis: Redis) -> tuple[dict[str, float], bool, int]:
    key = f"wiseclone:rates:{base}:all"
    cached_json = await redis.get(key)
    if cached_json:
        import json
        ttl = await redis.ttl(key)
        return json.loads(cached_json), True, max(ttl, 0)

    rates = await _fetch_all_rates(base)
    import json
    await redis.setex(key, settings.RATE_CACHE_TTL_SECONDS, json.dumps(rates))
    return rates, False, settings.RATE_CACHE_TTL_SECONDS


async def _fetch_rate(base: str, target: str) -> Decimal:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.FRANKFURTER_BASE_URL}/latest",
            params={"from": base, "to": target},
        )
        resp.raise_for_status()
        data = resp.json()
        return Decimal(str(data["rates"][target]))


async def _fetch_all_rates(base: str) -> dict[str, float]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.FRANKFURTER_BASE_URL}/latest",
            params={"from": base},
        )
        resp.raise_for_status()
        data = resp.json()
        rates = data["rates"]
        rates[base] = 1.0
        return rates
