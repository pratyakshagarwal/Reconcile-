#helper.py
from backend.app.db import get_connection

def unwrap_confident_fields(data: dict) -> dict:
    """Strips ConfidentField wrappers back to plain values, recursively.
    Call this once right after extraction — everything downstream stays
    exactly as it was before confidence scoring existed."""
    result = {}
    for key, val in data.items():
        if isinstance(val, dict) and "value" in val and "confidence" in val:
            result[key] = val["value"]
        elif isinstance(val, list):
            result[key] = [unwrap_confident_fields(item) if isinstance(item, dict) else item for item in val]
        elif isinstance(val, dict):
            result[key] = unwrap_confident_fields(val)
        else:
            result[key] = val
    return result


def extract_confidences(data: dict) -> dict:
    """Pulls out just the confidence scores, separately, before unwrapping."""
    return {
        key: val["confidence"]
        for key, val in data.items()
        if isinstance(val, dict) and "confidence" in val
    }

def get_vendor_history(vendor_name: str) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT AVG(total_amount), COUNT(*) FROM invoices
           WHERE vendor_name = %s""",
        (vendor_name.strip().lower(),)
    )
    avg_amount, count = cur.fetchone()
    cur.close()
    conn.close()
    return {
        "is_new_vendor": count == 0,
        "avg_invoice_amount": float(avg_amount) if avg_amount else None,
        "invoice_count": count,
    }

if __name__ == '__main__':pass