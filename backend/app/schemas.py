from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class ConfidentField(BaseModel):
    value: Optional[str | float] = None
    confidence: float = 0.0
    
class LineItem(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None


class LineItemWithConfidence(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    confidence: float = 0.0


class Invoice(BaseModel):
    invoice_number: ConfidentField = ConfidentField()
    vendor_name: ConfidentField = ConfidentField()
    invoice_date: ConfidentField = ConfidentField()
    po_number: ConfidentField = ConfidentField()
    total_amount: ConfidentField = ConfidentField()
    currency: ConfidentField = ConfidentField()
    tax_amount: ConfidentField = ConfidentField()
    line_items: list[LineItemWithConfidence] = []

    @model_validator(mode="after")
    def normalize_date(self):
        v = self.invoice_date.value
        if v is None:
            return self
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%B %d, %Y", "%b %d, %Y"):
            try:
                self.invoice_date.value = datetime.strptime(v, fmt).strftime("%Y-%m-%d")
                return self
            except ValueError:
                continue
        return self

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