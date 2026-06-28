from datetime import datetime 
from backend.app.helper import process_context
from backend.app.schemas import MatchResult
from backend.app.anomaly_exp import explanation


def generate_report(invoice: dict, validation: tuple, match_result: MatchResult, classification: dict,
                     risk: dict, approval: dict, warnings) -> dict:
    
    is_valid, validation_errors = validation
    report =  {
        "invoice_number": invoice.get("invoice_number"),
        "vendor_name": invoice.get("vendor_name"),
        "total_amount": invoice.get("total_amount"),
        "currency": invoice.get("currency"),
        "stages": {
            "validation": {"passed": is_valid, "errors": validation_errors},
            "matching": {"matched": match_result.matched, "issues": [i.model_dump() for i in match_result.issues]},
            "classification": classification,
            "risk": risk,
            "approval": approval,
            "warnings": warnings,
        },
        "generated_at": datetime.now().isoformat(),
    }

    if risk.get("score", 0) > 0:
        context = process_context(report)
        report["explanation"] = explanation(context)
    else:
        report["explanation"] = None

    return report