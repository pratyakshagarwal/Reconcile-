---

title: Ledger
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Ledger Backend

AI-powered finance backend.

# Reconcile

An agentic accounts-payable automation system for invoice extraction, validation, 3-way matching, anomaly detection, risk scoring, and approval orchestration.

Built with LangGraph, FastAPI, Gemini, Supabase, and a live streaming frontend.

---

## Live Demo

Frontend: https://reconcile-kqsc.vercel.app/

### Demo Video

[Watch the demo](https://github.com/user-attachments/assets/1da1f596-7577-42e4-a270-081f3ea4aa21)

### Final Processed Invoice UI

---

# What Reconcile Does

Reconcile simulates how real AP teams verify invoices before payment.

The system processes invoices through a multi-agent workflow that:

1. Extracts structured data from invoices, purchase orders, and goods receipts
2. Validates invoice integrity
3. Detects duplicates
4. Performs 3-way matching
5. Classifies expenses
6. Scores invoice risk
7. Detects vendor-level anomalies
8. Routes invoices through approval workflows
9. Generates human-readable audit explanations
10. Maintains a complete audit trail

Every stage runs inside a LangGraph workflow and streams live updates to the frontend via Server-Sent Events (SSE).

The system is designed around operational auditability rather than a single opaque AI response.

---

# v1.1 Improvements

Reconcile v1.1 focuses on trust, reviewability, and human-in-the-loop workflows.

### Confidence-Aware Extraction

Extraction confidence now propagates through downstream stages, allowing uncertain OCR/extraction outputs to influence risk scoring.

### Vendor Anomaly History

Risk analysis now considers historical vendor behavior and detects abnormal invoice patterns or amount deviations.

### Human Review Dashboard

Flagged invoices can now be reviewed, approved, or rejected through a dedicated review workflow.

### AI-Generated Audit Explanations

The pipeline generates concise natural-language explanations for flagged invoices.

Example:

> "Flagged because the invoice amount is significantly higher than historical vendor averages and multiple billed items are missing from the goods receipt."

---

# Pipeline

Upload Invoice (+ optional PO / GR)
        │
        ▼
1. Extraction
        │
        ▼
2. Validation
        │
        ▼
3. Duplicate Detection
        │
        ▼
4. 3-Way Matching
        │
        ▼
5. Classification
        │
        ▼
6. Risk Scoring (incorporates vendor anomaly analysis)
        │
        ▼
7. Approval Routing
        │
        ▼
8. Audit Report + AI Explanation
        │
        ▼
   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
   Human Review (async, post-completion)
   Flagged reports can be approved or
   rejected from the dashboard at any
   time after the run finishes.
---

# Core Features

## Structured Multimodal Extraction

Uses Gemini multimodal extraction with schema-constrained outputs for:

* Invoices
* Purchase Orders
* Goods Receipts

---

## 3-Way Matching

Compares:

* Invoice
* Purchase Order
* Goods Receipt

Line-by-line with configurable tolerances and severity-tagged discrepancies.

---

## Confidence-Aware Risk Analysis

Risk scoring incorporates:

* Extraction confidence
* Matching failures
* Duplicate signals
* Vendor anomalies
* Validation errors

---

## Vendor-Aware Anomaly Detection

Detects abnormal vendor behavior using historical invoice patterns and amount deviations.

---

## Human Review Workflow

Flagged invoices route into a review dashboard where reviewers can approve or reject invoices.

---

## AI Audit Explanations

Transforms raw risk signals into concise audit-readable explanations for AP reviewers.

---

## Live Streaming Pipeline

Each workflow node streams results in real time to the frontend using SSE.

---

## Auditability

Every pipeline stage produces inspectable structured outputs instead of opaque model responses.

---

# Tech Stack

| Layer            | Tech                         |
| ---------------- | ---------------------------- |
| Orchestration    | LangGraph                    |
| LLM / Extraction | Gemini + LangChain           |
| Backend          | FastAPI                      |
| Streaming        | Server-Sent Events           |
| Database         | Supabase (PostgreSQL)        |
| Auth             | JWT + bcrypt                 |
| Frontend         | HTML / CSS / JavaScript      |
| Deployment       | Hugging Face Spaces + Vercel |

---

# Architecture

```text
Frontend (Vercel)
        │
        ▼
FastAPI Backend (HF Spaces)
        │
        ├── LangGraph Workflow
        ├── Gemini Extraction
        ├── Matching + Risk Engine
        ├── Vendor Anomaly Analysis
        ├── AI Explanation Layer
        └── SSE Streaming
                │
                ▼
        Supabase PostgreSQL
```

---

# Project Structure

```text
backend/
  app/
    main.py
    agent.py
    auth.py
    auth_db.py
    db.py
    extracter.py
    validator.py
    matching.py
    classify.py
    risk_analysis.py
    approval.py
    report.py
    anomaly_exp.py

frontend/
  index.html
  style.css
  js/
```

---

# Running Locally

## Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Create a `.env` file:

```env
API_KEY=your_gemini_api_key
MODEL_NAME=gemini-2.5-flash
DB_URL=your_supabase_postgres_url
JWT_SECRET=your_secret
```

---

## Frontend

```bash
cd frontend
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

---

# Current Limitations

Reconcile is still a portfolio / research-style system rather than a production AP platform.

Current limitations include:

* Rules-based expense classification
* Limited historical anomaly baselines
* No ERP integrations
* Synchronous workflow execution
* Limited reviewer collaboration tooling
* Matching optimized for relatively structured invoices
* No continuous learning from reviewer feedback

---

# Why This Project Exists

Most invoice AI demos stop at OCR extraction.

The harder operational problem is determining whether an invoice should actually be paid.

Reconcile focuses on the workflow layer:
validation, reconciliation, anomaly detection, auditability, escalation, and approval orchestration.

---

# Future Improvements

* Async/concurrent workflow execution
* Reviewer feedback learning loops
* Adaptive approval policies
* ERP integrations
* Multi-user review collaboration
* Better anomaly baselines
* Evaluation + observability tooling
* Advanced handling for noisy enterprise scans
* Analytics dashboards
* Policy-based workflow configuration

