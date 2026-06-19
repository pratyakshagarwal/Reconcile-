from app.schemas import MatchResult

def assess_risk(invoice: dict, match_result: MatchResult, vendor_history: dict) -> dict:
    score = 0
    reasons = []

    if any(i.severity == "critical" for i in match_result.issues):
        score += 40
        reasons.append("Critical matching mismatch")

    if vendor_history.get("is_new_vendor"):
        score += 20
        reasons.append("New/unseen vendor")

    avg_amount = vendor_history.get("avg_invoice_amount")
    if avg_amount and invoice["total_amount"] > avg_amount * 1.5:
        score += 15
        reasons.append("Amount 50%+ above vendor average")

    tier = "high" if score >= 50 else "medium" if score >= 20 else "low"
    return {"score": score, "tier": tier, "reasons": reasons}