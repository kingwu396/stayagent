"""Pydantic schemas for payment endpoints (Block 26)"""
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PaymentCreate(BaseModel):
    booking_id: int
    method: Literal["alipay", "wechat", "card"]


class PaymentResponse(BaseModel):
    id: int
    booking_id: int
    amount: Decimal
    method: str
    status: str
    created_at: datetime
    paid_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
