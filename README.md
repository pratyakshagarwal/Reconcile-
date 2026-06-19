---

title: Ledger
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# Ledger Backend

AI-powered finance backend.

# Reconcile

**An agentic invoice processing pipeline** — extraction, validation, 3-way matching, and risk-based approval routing, built with LangGraph and FastAPI.

Reconcile takes an invoice (and optionally its purchase order and goods receipt) and runs it through a sequence of specialized agents that mirror how real accounts-payable teams verify spend before paying it: pull the data out, check it's sane, make sure it's not a duplicate, verify it against what was actually ordered and received, categorize it, score its risk, and route it for approval — all visible in real time as it happens.

This project is modeled on the document-intelligence and invoice-matching workflows used by platforms like Nanonets, scoped down to demonstrate the core pipeline end to end.

---

## What it does

```
Upload Invoice (+ optional PO / GR)
        │
        ▼
  1. Extraction         — pulls structured fields from PDFs via Gemini (multimodal, schema-constrained)
        │
        ▼
  2. Validation          — required fields present, amounts sane, dates and currency normalized
        │
        ▼
  3. Duplicate check       — composite key (vendor + invoice number), enforced at the DB level
        │
        ▼
  4. 3-way matching          — invoice vs. purchase order vs. goods receipt, line-item by line-item,
        │                       with configurable tolerance and severity-tagged issues
        ▼
  5. Classification            — expense category, rules-based with explicit "uncategorized" fallback
        │
        ▼
  6. Risk scoring                 — aggregates signals from every prior stage into a score + tier
        │
        ▼
  7. Approval routing                — auto-approves low-risk matched invoices, routes the rest
        │
        ▼
  8. Report generation                  — a single audit-trail record summarizing every stage's verdict
```

Each stage is a node in a [LangGraph](https://github.com/langchain-ai/langgraph) state machine, so the run can short-circuit early (an invalid or duplicate invoice never reaches matching/risk/approval) and every step's output is inspectable, not just the final result.

## Why these stages, specifically

Most "invoice extraction" projects stop at step 1. The thing that actually matters in accounts payable — and what most toy projects skip — is **3-way matching**: verifying the invoice's claim against independent evidence of what was ordered and what was actually delivered, rather than trusting the invoice alone. That's the core of this project, not an afterthought.

Every matching issue carries a `severity` (`critical` vs `warning`) rather than a flat pass/fail, so downstream agents — and a human reviewer, eventually — get *why* something was flagged, not just *that* it was.

## Live, streaming pipeline

Processing an invoice isn't a black box. The backend streams each agent's result over Server-Sent Events as it completes, and the frontend renders this as a live "stamped ledger" — each stage lights up, then stamps green (passed) or rust-red (flagged) as its verdict arrives.

## Stack

| Layer | Tech |
|---|---|
| Orchestration | LangGraph |
| Extraction | Gemini (multimodal, structured output via LangChain) |
| API | FastAPI, Server-Sent Events for streaming |
| Auth | JWT, bcrypt-hashed passwords |
| Database | PostgreSQL |
| Frontend | Plain HTML/CSS/JS — no framework |

## Project structure

```
backend/
  app/
    main.py          — FastAPI routes, SSE streaming endpoint, auth routes
    agent.py         — LangGraph pipeline definition (nodes + edges)
    auth.py          — password hashing, JWT issuance/verification
    auth_db.py       — users + pipeline_runs tables and queries
    db.py            — invoices/purchase_orders/goods_receipts tables and queries
    extracter.py     — Gemini extraction (invoice / PO / GR)
    validator.py     — field-level validation
    matching.py       — 3-way matching logic
    classify.py        — expense classification
    risk_analysis.py    — risk scoring
    approval.py           — approval routing
    report.py               — audit report assembly

frontend/
  index.html         — upload flow, live pipeline view, report view, auth screen
  style.css           — ledger-themed visual design
  app.js                — SSE consumption, view routing, auth/session handling
```

## Running it locally

**1. Postgres** (Docker):
```bash
docker run --name reconcile-postgres \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=invoices -p 5432:5432 -d postgres:16
```

**2. Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Requires a `.env` file:
```
API_KEY=your_gemini_api_key
MODEL_NAME=gemini-2.5-flash
DB_URL=postgresql://postgres:postgres@localhost:5432/invoices
JWT_SECRET=a_long_random_string
```

**3. Frontend:**
```bash
cd frontend
python -m http.server 8080
```

Open `http://localhost:8080`, sign up, and upload an invoice (PO/GR optional — matching is skipped with a warning if either is missing).

## Honest limitations

This is a portfolio/demonstration project, not a production system — worth being upfront about what's intentionally out of scope rather than overstating it:

- **Classification is rules-based** (keyword matching against a starter category list), not ML-driven — explicit by design, since duplicate/classification logic doesn't need a model, but it means the category list needs to grow with real usage.
- **Risk scoring uses a small, hand-picked set of signals** — a real system would weight far more historical/behavioral data per vendor.
- **No ERP integration** — purchase orders and goods receipts are uploaded as documents in this version. A production system would typically sync these from the buyer's existing ERP/procurement system rather than requiring re-upload.
- **Single-instance, synchronous pipeline execution** — concurrent users processing invoices simultaneously will queue rather than run in parallel, since the LangGraph nodes are currently synchronous.

## Background

Built as a hands-on exploration of agentic AI applied to a real operational workflow, alongside ongoing AI/ML internship search. If you're working on something similar or have feedback, I'd genuinely like to hear it.
