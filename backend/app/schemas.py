from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class LineItem(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None


class Invoice(BaseModel):
    invoice_number: Optional[str] = None
    vendor_name: Optional[str] = None
    invoice_date: Optional[str] = None
    po_number: Optional[str] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    tax_amount: Optional[float] = None
    line_items: list[LineItem] = []

    @field_validator("invoice_date")
    @classmethod
    def normalize_date(cls, v):
        if v is None:
            return v
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%B %d, %Y", "%b %d, %Y"):
            try:
                return datetime.strptime(v, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return v  # leave as-is if unparseable — Validation Agent will flag it


class PurchaseOrder(BaseModel):
    po_number: Optional[str] = None
    vendor_name: Optional[str] = None
    currency: Optional[str] = None
    line_items: list[LineItem] = []


class GoodsReceiptItem(BaseModel):
    description: Optional[str] = None
    quantity_received: Optional[float] = None


class GoodsReceipt(BaseModel):
    po_number: Optional[str] = None
    received_date: Optional[str] = None
    line_items: list[GoodsReceiptItem] = []

class MatchIssue(BaseModel):
    field: str
    expected: str
    actual: str
    severity: str  # "critical" or "warning"


class MatchResult(BaseModel):
    matched: bool
    issues: list[MatchIssue] = []