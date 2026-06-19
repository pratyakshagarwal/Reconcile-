CLASSIFICATION_RULES = {
    "Professional Services": [
        "consulting", "advisory", "design services", "web design",
        "strategy", "planning session", "audit", "legal"
    ],
    "Marketing": [
        "content creation", "advertising", "campaign", "social media",
        "seo", "branding", "copywriting"
    ],
    "Software": [
        "subscription", "license", "saas", "software", "api access", "cloud"
    ],
    "Office Supplies": [
        "stationery", "furniture", "printer", "office equipment"
    ],
    "Utilities": [
        "electricity", "water bill", "internet service", "telecom"
    ],
    "Travel": [
        "airfare", "hotel", "accommodation", "transportation", "mileage"
    ],
}


def classify_line_item(description: str) -> str:
    desc_lower = description.lower()
    for category, keywords in CLASSIFICATION_RULES.items():
        if any(kw in desc_lower for kw in keywords):
            return category
    return "Uncategorized"  # explicit fallback — never silently misclassify


def classify_invoice(invoice: dict) -> dict:
    """Classify at the invoice level by aggregating line item categories."""
    line_items = invoice.get("line_items", [])
    if not line_items:
        return {"primary_category": "Uncategorized", "category_breakdown": {}}

    breakdown = {}
    for item in line_items:
        cat = classify_line_item(item.get("description", ""))
        breakdown[cat] = breakdown.get(cat, 0) + 1

    primary = max(breakdown, key=breakdown.get)
    return {"primary_category": primary, "category_breakdown": breakdown}