import os
from dotenv import load_dotenv
from backend.app.schemas import MatchResult

load_dotenv()
AUTO_APPROVE_LIMIT = os.getenv("AUTO_APPROVE_LIMIT", 5000)
DIRECTOR_REVIEW_LIMIT = os.getenv("DIRECTOR_REVIEW_LIMIT", 5000)

def route_approval(invoice: dict, risk: dict, match_result: MatchResult) -> dict:
    if risk["tier"] == "high" or not match_result.matched:
        return {"decision": "needs_review", "approver": "AP Manager"}

    if risk["tier"] == "low" and match_result.matched and invoice["total_amount"] < AUTO_APPROVE_LIMIT:
        return {"decision": "auto_approved", "approver": None}

    if invoice["total_amount"] >= DIRECTOR_REVIEW_LIMIT:
        return {"decision": "needs_review", "approver": "Finance Director"}

    return {"decision": "needs_review", "approver": "AP Team"}