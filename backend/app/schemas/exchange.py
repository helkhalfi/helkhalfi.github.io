from decimal import Decimal
from pydantic import BaseModel


class QuoteResponse(BaseModel):
    from_currency: str
    to_currency: str
    send_amount: Decimal
    fee: Decimal
    amount_after_fee: Decimal
    exchange_rate: Decimal
    recipient_gets: Decimal
    provider: str = "frankfurter"
    cached: bool


class RatesResponse(BaseModel):
    base: str
    rates: dict[str, float]
    cached: bool
    ttl_remaining: int
