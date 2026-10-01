"""Pydantic schemas for booking endpoints"""
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from app.schemas.listing import ListingSummary


class BookingCreate(BaseModel):
    listing_id: int
    check_in: date
    check_out: date
    guests: int = Field(ge=1, le=20)


class BookingResponse(BaseModel):
    id: int
    listing_id: int
    listing: ListingSummary
    check_in: date
    check_out: date
    guests: int
    nights: int
    subtotal: Decimal
    cleaning_fee: Decimal
    service_fee: Decimal
    total: Decimal
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BookingListResponse(BaseModel):
    items: list[BookingResponse]
    total: int
