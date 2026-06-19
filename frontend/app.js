const API_BASE = "http://localhost:8000";
const TOKEN_KEY = "ledger_token";
const EMAIL_KEY = "ledger_email";

let authMode = "login"; // or "signup"

const authEls = {
  screen: document.getElementById("authScreen"),
  form: document.getElementById("authForm"),
  email: document.getElementById("authEmail"),
  password: document.getElementById("authPassword"),
  submitBtn: document.getElementById("authSubmitBtn"),
  error: document.getElementById("authError"),
  sub: document.getElementById("authSub"),
  toggleBtn: document.getElementById("authToggleBtn"),
};

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setSession(token, email) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

/* Wrapper around fetch that attaches the auth token and handles 401s
   by bouncing back to the login screen — every protected call should use this. */
async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    showAuthScreen();
    throw new Error("Session expired — please sign in again.");
  }
  return res;
}

authEls.toggleBtn.addEventListener("click", () => {
  authMode = authMode === "login" ? "signup" : "login";
  authEls.submitBtn.textContent = authMode === "login" ? "Sign in" : "Create account";
  authEls.sub.textContent = authMode === "login"
    ? "Sign in to view your processed invoices."
    : "Create an account to start processing invoices.";
  authEls.toggleBtn.textContent = authMode === "login"
    ? "Don't have an account? Sign up"
    : "Already have an account? Sign in";
  authEls.error.textContent = "";
});

authEls.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  authEls.error.textContent = "";
  authEls.submitBtn.disabled = true;

  const email = authEls.email.value.trim();
  const password = authEls.password.value;

  try {
    if (authMode === "signup") {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Could not create account.");
      }
      const data = await res.json();
      setSession(data.access_token, email);
    } else {
      // Login endpoint expects form-encoded username/password (OAuth2PasswordRequestForm)
      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", password);

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Incorrect email or password.");
      }
      const data = await res.json();
      setSession(data.access_token, email);
    }

    enterApp();
  } catch (err) {
    authEls.error.textContent = err.message;
  } finally {
    authEls.submitBtn.disabled = false;
  }
});

function showAuthScreen() {
  authEls.screen.hidden = false;
  document.getElementById("app").hidden = true;
  authEls.password.value = "";
}

function enterApp() {
  authEls.screen.hidden = true;
  document.getElementById("app").hidden = false;
  document.getElementById("ledgerUserEmail").textContent = localStorage.getItem(EMAIL_KEY) || "";
  loadHistory();
  showView("upload");
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  clearSession();
  showAuthScreen();
});

const NODE_SEQUENCE = [
  { key: "extraction", label: "Extracting document fields" },
  { key: "validation", label: "Validating extracted data" },
  { key: "duplicate_detect", label: "Checking for duplicates" },
  { key: "3_way_matching", label: "Matching invoice against PO/GR" },
  { key: "classify", label: "Classifying expense category" },
  { key: "risk_analysis", label: "Assessing risk" },
  { key: "approval", label: "Routing for approval" },
  { key: "report_gen", label: "Generating report" },
];

const els = {
  viewUpload: document.getElementById("viewUpload"),
  viewPipeline: document.getElementById("viewPipeline"),
  viewReport: document.getElementById("viewReport"),
  uploadForm: document.getElementById("uploadForm"),
  submitBtn: document.getElementById("submitBtn"),
  formNote: document.getElementById("formNote"),
  stageList: document.getElementById("stageList"),
  pipelineTitle: document.getElementById("pipelineTitle"),
  ledgerList: document.getElementById("ledgerList"),
  ledgerEmpty: document.getElementById("ledgerEmpty"),
  statTotal: document.getElementById("statTotal"),
  statFlagged: document.getElementById("statFlagged"),
  statApproved: document.getElementById("statApproved"),
  newInvoiceBtn: document.getElementById("newInvoiceBtn"),
  backToUploadBtn: document.getElementById("backToUploadBtn"),
  searchInput: document.getElementById("searchInput"),
};

let history = []; // cached invoice list for search/filter

/* ============================================================
   VIEW SWITCHING
   ============================================================ */
function showView(name) {
  els.viewUpload.hidden = name !== "upload";
  els.viewPipeline.hidden = name !== "pipeline";
  els.viewReport.hidden = name !== "report";
}

els.newInvoiceBtn.addEventListener("click", () => {
  els.uploadForm.reset();
  document.querySelectorAll(".dropzone").forEach(dz => {
    dz.classList.remove("filled");
    dz.querySelector(".dz-filename").textContent = "";
  });
  showView("upload");
});

els.backToUploadBtn.addEventListener("click", () => showView("upload"));

/* ============================================================
   DROPZONE FILE LABELS
   ============================================================ */
document.querySelectorAll(".dropzone input[type=file]").forEach(input => {
  input.addEventListener("change", () => {
    const dz = input.closest(".dropzone");
    const nameEl = dz.querySelector(".dz-filename");
    if (input.files.length) {
      dz.classList.add("filled");
      nameEl.textContent = input.files[0].name;
    } else {
      dz.classList.remove("filled");
      nameEl.textContent = "";
    }
  });
});

/* ============================================================
   UPLOAD + STREAM PIPELINE
   ============================================================ */
els.uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const invoiceFile = document.getElementById("invoiceFile").files[0];
  const poFile = document.getElementById("poFile").files[0];
  const grFile = document.getElementById("grFile").files[0];

  if (!invoiceFile) {
    els.formNote.textContent = "An invoice file is required.";
    return;
  }

  els.formNote.textContent = "";
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Starting…";

  const formData = new FormData();
  formData.append("invoice", invoiceFile);
  if (poFile) formData.append("po", poFile);
  if (grFile) formData.append("gr", grFile);

  buildStageList();
  els.pipelineTitle.textContent = `Processing ${invoiceFile.name}`;
  showView("pipeline");

  try {
    const response = await authFetch("/api/process", {
      method: "POST",
      body: formData,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Server responded ${response.status}`);
    }

    await consumeStream(response.body);

  } catch (err) {
    markPipelineError(err.message);
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Run pipeline";
  }
});

function buildStageList() {
  els.stageList.innerHTML = "";
  NODE_SEQUENCE.forEach((node, i) => {
    const row = document.createElement("div");
    row.className = "stage-row";
    row.id = `stage-${node.key}`;
    row.innerHTML = `
      <span class="stage-num">${String(i + 1).padStart(2, "0")}</span>
      <span class="stage-stamp">✓</span>
      <span class="stage-body">
        <span class="stage-label">${node.label}</span>
        <span class="stage-detail"></span>
      </span>
    `;
    els.stageList.appendChild(row);
  });
}

function markPipelineError(message) {
  els.pipelineTitle.textContent = "Pipeline stopped";
  const note = document.createElement("p");
  note.className = "view-sub";
  note.style.color = "var(--rust)";
  note.textContent = message;
  els.stageList.before(note);
}

/* Parses a fetch ReadableStream as Server-Sent Events and dispatches each. */
async function consumeStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop(); // last chunk may be incomplete — keep for next read

    for (const raw of events) {
      if (!raw.trim()) continue;
      const eventMatch = raw.match(/^event: (.+)$/m);
      const dataMatch = raw.match(/^data: (.+)$/m);
      if (!eventMatch || !dataMatch) continue;

      const eventName = eventMatch[1].trim();
      const data = JSON.parse(dataMatch[1]);
      handleStreamEvent(eventName, data);
    }
  }
}

function handleStreamEvent(eventName, data) {
  if (eventName === "node_start") {
    const row = document.getElementById(`stage-${data.node}`);
    if (row) row.classList.add("active");
  }

  if (eventName === "node_complete") {
    const row = document.getElementById(`stage-${data.node}`);
    if (!row) return;
    row.classList.remove("active");
    row.classList.add("complete");

    const detail = row.querySelector(".stage-detail");
    const summary = summarizeStageDelta(data.node, data.state_delta);
    if (summary.flagged) {
      row.classList.add("flagged");
      detail.classList.add("flagged-text");
    }
    detail.textContent = summary.text;
  }

  if (eventName === "done") {
    setTimeout(() => renderReport(data.report, data.status), 500);
  }

  if (eventName === "error") {
    markPipelineError(`Error: ${data.message}`);
  }
}

/* Produces a one-line human summary for each node's result, shown under the stage label. */
function summarizeStageDelta(node, delta) {
  if (!delta) return { text: "", flagged: false };

  switch (node) {
    case "extraction":
      return { text: delta.invoice ? `${delta.invoice.invoice_number || "unknown"} — ${delta.invoice.vendor_name || "unknown vendor"}` : "extracted", flagged: false };
    case "validation":
      return delta.is_valid
        ? { text: "all required fields present", flagged: false }
        : { text: `${(delta.validation_errors || []).length} issue(s) found`, flagged: true };
    case "duplicate_detect":
      return delta.is_duplicate
        ? { text: "already exists in the ledger", flagged: true }
        : { text: "no prior record found", flagged: false };
    case "3_way_matching":
      return delta.match_result?.matched
        ? { text: "invoice reconciles with PO/GR", flagged: false }
        : { text: `${(delta.match_result?.issues || []).length} mismatch(es)`, flagged: true };
    case "classify":
      return { text: delta.classification?.primary_category || "uncategorized", flagged: false };
    case "risk_analysis":
      return { text: `${delta.risk?.tier || "—"} risk (score ${delta.risk?.score ?? "—"})`, flagged: delta.risk?.tier === "high" };
    case "approval":
      return { text: delta.approval?.decision === "auto_approved" ? "auto-approved" : `routed to ${delta.approval?.approver || "review"}`, flagged: delta.approval?.decision !== "auto_approved" };
    case "report_gen":
      return { text: "report compiled", flagged: false };
    default:
      return { text: "", flagged: false };
  }
}

/* ============================================================
   REPORT RENDERING
   ============================================================ */
function renderReport(report, status) {
  if (!report) {
    els.pipelineTitle.textContent = `Stopped — ${status || "unknown reason"}`;
    return;
  }

  document.getElementById("reportVendor").textContent = report.vendor_name || "Unknown vendor";
  document.getElementById("reportMeta").textContent = `Invoice ${report.invoice_number || "—"} · processed ${formatTimestamp(report.generated_at)}`;

  const decision = report.stages?.approval?.decision;
  const decisionEl = document.getElementById("reportDecision");
  if (decision === "auto_approved") {
    decisionEl.textContent = "Auto-approved";
    decisionEl.className = "report-decision approved";
  } else {
    decisionEl.textContent = `Needs review — ${report.stages?.approval?.approver || ""}`;
    decisionEl.className = "report-decision review";
  }

  document.getElementById("reportAmount").textContent = formatCurrency(report.total_amount);
  document.getElementById("reportAmountSub").textContent = report.invoice_number || "—";

  const v = report.stages?.validation || {};
  setStatus("reportValidation", v.passed ? "Passed" : "Failed", v.passed ? "ok" : "flagged");
  fillList("reportValidationErrors", v.errors || []);

  const m = report.stages?.matching || {};
  setStatus("reportMatching", m.matched ? "Reconciled" : "Discrepancy found", m.matched ? "ok" : "flagged");
  fillList("reportMatchingIssues", (m.issues || []).map(i => `${i.field}: expected ${i.expected}, got ${i.actual}`));

  const c = report.stages?.classification || {};
  setStatus("reportClassification", c.primary_category || "Uncategorized", "ok");
  const tagsEl = document.getElementById("reportClassBreakdown");
  tagsEl.innerHTML = "";
  Object.entries(c.category_breakdown || {}).forEach(([cat, count]) => {
    const tag = document.createElement("span");
    tag.className = "tag-cat";
    tag.textContent = `${cat} × ${count}`;
    tagsEl.appendChild(tag);
  });

  const r = report.stages?.risk || {};
  setStatus("reportRisk", `${capitalize(r.tier || "—")} (score ${r.score ?? "—"})`, r.tier === "high" ? "flagged" : r.tier === "medium" ? "warn" : "ok");
  fillList("reportRiskReasons", r.reasons || []);

  const a = report.stages?.approval || {};
  setStatus("reportApproval", a.decision === "auto_approved" ? "Auto-approved" : `Sent to ${a.approver || "review"}`, a.decision === "auto_approved" ? "ok" : "warn");

  showView("report");
  loadHistory(); // refresh sidebar so the just-completed run appears
}

function setStatus(id, text, cls) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `report-status ${cls}`;
}

function fillList(id, items) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  if (!items.length) {
    el.innerHTML = `<li style="color: var(--ink-faint);">None</li>`;
    return;
  }
  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  });
}

/* ============================================================
   LEDGER HISTORY (sidebar) — backed by this user's pipeline_runs
   ============================================================ */
async function loadHistory() {
  try {
    const res = await authFetch("/api/runs");
    if (!res.ok) return;
    history = await res.json();
    renderLedgerList(history);
    updateStats(history);
  } catch (err) {
    // session expired or backend unreachable — authFetch already handled the redirect if needed
  }
}

function renderLedgerList(items) {
  els.ledgerEmpty.hidden = items.length > 0;
  els.ledgerList.querySelectorAll(".ledger-row").forEach(el => el.remove());

  items.forEach(run => {
    const report = run.report || {};
    const row = document.createElement("button");
    row.className = "ledger-row";
    row.innerHTML = `
      <div class="ledger-row-top">
        <span class="ledger-row-vendor">${report.vendor_name || "Unknown vendor"}</span>
        <span class="ledger-row-amount">${formatCurrency(report.total_amount)}</span>
      </div>
      <div class="ledger-row-bottom">
        <span class="ledger-row-meta">${report.invoice_number || "—"} · ${formatTimestamp(run.created_at)}</span>
        <span class="tag ${tagClassForRun(run)}">${tagLabelForRun(run)}</span>
      </div>
    `;
    row.addEventListener("click", () => loadRunDetail(run.id, row));
    els.ledgerList.appendChild(row);
  });
}

function tagClassForRun(run) {
  if (run.status === "rejected_invalid" || run.status === "rejected_duplicate") return "tag-rejected";
  const decision = run.report?.stages?.approval?.decision;
  return decision === "auto_approved" ? "tag-approved" : "tag-review";
}

function tagLabelForRun(run) {
  if (run.status === "rejected_invalid") return "Invalid";
  if (run.status === "rejected_duplicate") return "Duplicate";
  const decision = run.report?.stages?.approval?.decision;
  return decision === "auto_approved" ? "Approved" : "Review";
}

async function loadRunDetail(runId, rowEl) {
  document.querySelectorAll(".ledger-row").forEach(r => r.classList.remove("active"));
  if (rowEl) rowEl.classList.add("active");

  try {
    const res = await authFetch(`/api/runs/${runId}`);
    if (!res.ok) return;
    const run = await res.json();

    // run.report holds the exact same shape produced by a live run,
    // so we can reuse renderReport() directly — no degraded "archived" view needed.
    renderReport(run.report, run.status);
  } catch (err) {
    // ignore — leave current view as-is
  }
}

function updateStats(items) {
  els.statTotal.textContent = items.length;
  const flagged = items.filter(r => tagClassForRun(r) === "tag-review" || tagClassForRun(r) === "tag-rejected").length;
  const approved = items.filter(r => tagClassForRun(r) === "tag-approved").length;
  els.statFlagged.textContent = flagged;
  els.statApproved.textContent = approved;
}

els.searchInput.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = history.filter(run => {
    const report = run.report || {};
    return (report.vendor_name || "").toLowerCase().includes(q) ||
           (report.invoice_number || "").toLowerCase().includes(q);
  });
  renderLedgerList(filtered);
});

/* ============================================================
   FORMAT HELPERS
   ============================================================ */
function formatCurrency(amount, currency = "USD") {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(amount);
  } catch {
    return `${amount}`;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimestamp(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ============================================================
   INIT
   ============================================================ */
if (getToken()) {
  enterApp();
} else {
  showAuthScreen();
}
