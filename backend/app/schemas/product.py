from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


ALLOWED_PRODUCT_UNITS = {
    "piece", "pack", "box", "dozen", "pair", "set", "bundle",
    "kg", "g", "mg", "quintal", "ton",
    "l", "ml",
    "m", "cm", "mm", "ft", "in",
    "sqft", "sqm",
    "bottle", "can", "jar", "pouch", "bag", "sachet", "strip", "tablet",
    "roll", "sheet", "ream",
    "hour", "day", "service",
}


class ProductVariant(BaseModel):
    name: str
    sku_suffix: Optional[str] = None
    barcode: Optional[str] = None
    selling_price: float
    buying_price: float = 0
    quantity: float = 0
    attributes: Dict[str, Any] = {}


class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category_id: Optional[str] = None
    buying_price: float = 0
    selling_price: float = 0
    quantity: float = 0
    unit: str = "piece"
    tax_rate: float = 0
    images: List[str] = []
    expiry_date: Optional[datetime] = None
    batch_number: Optional[str] = None
    tags: List[str] = []
    variants: List[ProductVariant] = []
    custom_attributes: Dict[str, Any] = {}
    low_stock_threshold: float = 5

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_PRODUCT_UNITS:
            raise ValueError("Unsupported product unit")
        return normalized


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    barcode: Optional[str] = None
    category_id: Optional[str] = None
    buying_price: Optional[float] = None
    selling_price: Optional[float] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    tax_rate: Optional[float] = None
    images: Optional[List[str]] = None
    expiry_date: Optional[datetime] = None
    low_stock_threshold: Optional[float] = None
    is_active: Optional[bool] = None

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip().lower()
        if normalized not in ALLOWED_PRODUCT_UNITS:
            raise ValueError("Unsupported product unit")
        return normalized


class ProductResponse(BaseModel):
    id: str
    name: str
    sku: str
    barcode: Optional[str] = None
    category_id: Optional[str] = None
    buying_price: float
    selling_price: float
    profit_margin: float
    quantity: float
    unit: str
    tax_rate: float
    images: List[str] = []
    low_stock_threshold: float
    is_active: bool = True
    expiry_date: Optional[str] = None
