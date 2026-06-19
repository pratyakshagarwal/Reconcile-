from app.schemas import MatchIssue, MatchResult

def match_invoice(invoice: dict, po: dict, gr: dict, price_tolerance_pct: float = 2.0) -> MatchResult:
    issues = []

    if not po.get("po_number"):
        return MatchResult(
            matched=False,
            issues=[MatchIssue(field="po_number", expected="present", actual="missing", severity="warning")]
        )

    po_items = {i["description"].strip().lower(): i for i in po.get("line_items", []) if i.get("description")}
    gr_items = {i["description"].strip().lower(): i for i in gr.get("line_items", []) if i.get("description")}

    expected_total = 0.0

    for desc, po_item in po_items.items():
        gr_item = gr_items.get(desc)
        if not gr_item:
            issues.append(MatchIssue(field=f"line_item:{desc}", expected="present in GR", actual="missing", severity="critical"))
            continue

        po_qty = po_item.get("quantity") or 0
        gr_qty = gr_item.get("quantity_received") or 0
        unit_price = po_item.get("unit_price") or 0

        if po_qty != gr_qty:
            issues.append(MatchIssue(
                field=f"quantity:{desc}",
                expected=str(po_qty),
                actual=str(gr_qty),
                severity="critical"
            ))

        # Use whichever was actually delivered (GR) to compute the "should be billed" amount
        expected_total += unit_price * gr_qty

    inv_total = invoice.get("total_amount") or 0
    tolerance = expected_total * (price_tolerance_pct / 100)

    # Invoice total includes tax; PO/GR amounts don't — compare against the pre-tax subtotal.
    inv_subtotal = inv_total - (invoice.get("tax_amount") or 0)

    if abs(inv_subtotal - expected_total) > tolerance:
        issues.append(MatchIssue(
            field="total_amount",
            expected=f"~{expected_total:.2f}",
            actual=str(inv_subtotal),
            severity="critical"
        ))

    matched = not any(i.severity == "critical" for i in issues)
    return MatchResult(matched=matched, issues=issues)