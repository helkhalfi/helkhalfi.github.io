from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.transfer import TransferStatus
from app.schemas.account import VALID_CURRENCIES


class TransferCreate(BaseModel):
    recipient_name: str = Field(min_length=1, max_length=255)
    recipient_email: Optional[EmailStr] = None
    source_currency: str = Field(min_length=3, max_length=3)
    target_currency: str = Field(min_length=3, max_length=3)
    source_amount: Decimal = Field(gt=0)

    @field_validator("source_currency", "target_currency", mode="before")
    @classmethod
    def upper_currency(cls, v: str) -> str:
        return v.upper()

    @field_validator("source_currency", "target_currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v not in VALID_CURRENCIES:
            raise ValueError(f"Unsupported currency: {v}")
        return v

    @field_validator("recipient_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class TransferRead(BaseModel):
    id: str
    reference: str
    status: TransferStatus
    source_currency: str
    target_currency: str
    source_amount: Decimal
    target_amount: Decimal
    exchange_rate: Decimal
    fee_amount: Decimal
    recipient_name: str
    recipient_email: Optional[str]
    estimated_arrival: Optional[datetime]
    completed_at: Optional[datetime]
    failure_reason: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class TransferListResponse(BaseModel):
    items: list[TransferRead]
    total: int
    page: int
    page_size: int
