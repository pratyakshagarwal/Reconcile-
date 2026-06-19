from datetime import datetime 
from app.schemas import MatchResult

def generate_report(invoice: dict, validation: tuple, match_result: MatchResult, classification: dict, risk: dict, approval: dict) -> dict:
    is_valid, validation_errors = validation
    return {
        "invoice_number": invoice.get("invoice_number"),
        "vendor_name": invoice.get("vendor_name"),
        "total_amount": invoice.get("total_amount"),
        "stages": {
            "validation": {"passed": is_valid, "errors": validation_errors},
            "matching": {"matched": match_result.matched, "issues": [i.model_dump() for i in match_result.issues]},
            "classification": classification,
            "risk": risk,
            "approval": approval,
        },
        "generated_at": datetime.now().isoformat(),
    }