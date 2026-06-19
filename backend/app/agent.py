from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END, START

from backend.app.extracter import extract
from backend.app.validator import validate_invoice
from backend.app.db import check_duplicate, insert_invoice
from backend.app.matching import match_invoice, MatchResult
from backend.app.classify import classify_invoice
from backend.app.risk_analysis import assess_risk
from backend.app.approval import route_approval
from backend.app.report import generate_report


class PipelineState(TypedDict):
    invoice_path: str
    po_path: Optional[str]
    gr_path: Optional[str]
    invoice: Optional[dict]
    po: Optional[dict]
    gr: Optional[dict]
    is_valid: Optional[bool]
    validation_errors: Optional[list]
    is_duplicate: Optional[bool]
    match_result: Optional[dict]
    classification: Optional[dict]
    risk: Optional[dict]
    approval: Optional[dict]
    report: Optional[dict]
    status: Optional[str]  # used to short-circuit on duplicate/invalid


def extraction_node(state: PipelineState) -> PipelineState:
    invoice, po, gr = extract(state["invoice_path"], state["po_path"], state["gr_path"])
    return {
        **state,
        "invoice": invoice.model_dump() if invoice else None,
        "po": po.model_dump() if po else None,
        "gr": gr.model_dump() if gr else None,
    }


def validation_node(state: PipelineState) -> PipelineState:
    is_valid, errors = validate_invoice(state["invoice"])
    if not is_valid:
        return {**state, "is_valid": is_valid, "validation_errors": errors, "status": "rejected_invalid"}
    return {**state, "is_valid": is_valid, "validation_errors": errors}


def duplicate_node(state: PipelineState) -> PipelineState:
    is_dup = check_duplicate(state["invoice"])
    if is_dup:
        return {**state, "is_duplicate": True, "status": "rejected_duplicate"}
    insert_invoice(state['invoice'])
    return {**state, "is_duplicate": False}


def matching_node(state: PipelineState) -> PipelineState:
    if not state.get("po") or not state.get("gr"):
        return {**state, "match_result": {"matched": False, "issues": [{"field": "po/gr", "expected": "present", "actual": "missing", "severity": "warning"}]}}
    result = match_invoice(state["invoice"], state["po"], state["gr"])
    return {**state, "match_result": result.model_dump()}


def classification_node(state: PipelineState) -> PipelineState:
    return {**state, "classification": classify_invoice(state["invoice"])}


def risk_node(state: PipelineState) -> PipelineState:
    match_result = MatchResult(**state["match_result"])
    risk = assess_risk(state["invoice"], match_result, vendor_history={})
    return {**state, "risk": risk}


def approval_node(state: PipelineState) -> PipelineState:
    match_result = MatchResult(**state["match_result"])
    approval = route_approval(state["invoice"], state["risk"], match_result)
    return {**state, "approval": approval}


def report_node(state: PipelineState) -> PipelineState:
    report = generate_report(
        invoice=state["invoice"],
        validation=(state["is_valid"], state["validation_errors"]),
        match_result=MatchResult(**state["match_result"]),
        classification=state["classification"],
        risk=state["risk"],
        approval=state["approval"],
    )
    return {**state, "report": report, "status": state.get("status", "processed")}


# Conditional routing: stop early if invalid or duplicate
def route_after_validation(state: PipelineState) -> str:
    return "duplicate_detect" if state["is_valid"] else END


def route_after_duplicate(state: PipelineState) -> str:
    return "3_way_matching" if not state["is_duplicate"] else END


nodes = [
    ('extraction', extraction_node),
    ('validation', validation_node),
    ('duplicate_detect', duplicate_node),
    ('3_way_matching', matching_node),
    ('classify', classification_node),
    ('risk_analysis', risk_node),
    ('approval', approval_node),
    ('report_gen', report_node)
]

paths = [
    (START, 'extraction'),
    ('extraction', 'validation'),
    ('validation', route_after_validation, 'conditional_routing'),
    ('duplicate_detect', route_after_duplicate, 'conditional_routing'),
    ('3_way_matching', 'classify'),
    ('classify', 'risk_analysis'),
    ('risk_analysis', 'approval'),
    ('approval', 'report_gen'),
    ('report_gen', END)
]


def create_graph(nodes, paths):
    graph = StateGraph(PipelineState)

    for name, fn in nodes:
        graph.add_node(name, fn)

    for path in paths:
        if len(path) == 2:
            strt, dstn = path
            graph.add_edge(strt, dstn)
        else:
            strt, route_fn, _ = path
            graph.add_conditional_edges(strt, route_fn)

    pipeline = graph.compile()
    return pipeline


if __name__ == '__main__':
    pipeline = create_graph(nodes, paths)
    result = pipeline.invoke({
        "invoice_path": "../data/invoices/sample-invoice-template.pdf",
        "po_path": "../data/po/sample-po-match.pdf",
        "gr_path": "../data/gud_recipt/sample-gr-match.pdf",
    })

    if "report" in result:
        print(result["report"])
    else:
        print(f"Pipeline stopped early — status: {result.get('status')}")
        if result.get("status") == "rejected_invalid":
            print("Validation errors:", result.get("validation_errors"))
        elif result.get("status") == "rejected_duplicate":
            print("This invoice already exists in the database.")