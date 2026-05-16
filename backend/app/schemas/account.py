from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

VALID_CURRENCIES = {
    "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "SGD", "HKD", "NOK",
    "SEK", "DKK", "NZD", "MXN", "BRL", "INR", "PLN", "CZK", "HUF", "ZAR",
    "TRY", "THB", "MYR", "IDR", "PHP", "RON", "BGN", "ISK", "ILS",
}


class AccountCreate(BaseModel):
    currency: str = Field(min_length=3, max_length=3)

    def model_post_init(self, __context):
        self.currency = self.currency.upper()
        if self.currency not in VALID_CURRENCIES:
            raise ValueError(f"Unsupported currency: {self.currency}")


class AccountRead(BaseModel):
    id: str
    currency: str
    balance: Decimal
    is_primary: bool
    created_at: datetime

    model_config = {"from_attributes": True}
