/* ============================================================
   LEDGER HISTORY (sidebar) — backed by this user's pipeline_runs
   Three tabs: Pending / Approved / Declined
   Depends on: authFetch (auth.js), renderReport (report.js)
   ============================================================ */

let history = []; // cached, unfiltered run list
let activeTab = "pending";

async function loadHistory() {
  try {
    const res = await authFetch("/api/runs");
    if (!res.ok) return;
    history = await res.json();
    renderLedgerList(filterByTab(history, activeTab));
    updateStats(history);
  } catch (err) {
    // session expired or backend unreachable — authFetch already handled the redirect if needed
  }
}

/* ============================================================
   CATEGORIZATION — single source of truth for which bucket a run is in
   ============================================================ */
function categorize(run) {
  if (run.human_decision === "rejected") return "declined";
  if (run.human_decision === "approved") return "approved";
  if (run.report?.stages?.approval?.decision === "auto_approved") return "approved";
  return "pending"; // needs_review, no human decision recorded yet
}

function provenanceLabel(run) {
  if (run.human_decision === "approved") return "Approved by you";
  if (run.human_decision === "rejected") return "Declined by you";
  if (run.report?.stages?.approval?.decision === "auto_approved") return "Auto-approved";
  return null;
}

function filterByTab(items, tab) {
  return items.filter(run => categorize(run) === tab);
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */
document.querySelectorAll(".ledger-tab").forEach(tabBtn => {
  tabBtn.addEventListener("click", () => {
    document.querySelectorAll(".ledger-tab").forEach(b => b.classList.remove("active"));
    tabBtn.classList.add("active");
    activeTab = tabBtn.dataset.tab;
    renderLedgerList(filterByTab(history, activeTab));
  });
});

/* ============================================================
   RENDERING
   ============================================================ */
function renderLedgerList(items) {
  els.ledgerEmpty.hidden = items.length > 0;
  els.ledgerList.querySelectorAll(".ledger-row").forEach(el => el.remove());

  items.forEach(run => {
    const report = run.report || {};
    const provenance = provenanceLabel(run);
    const row = document.createElement("button");
    row.className = "ledger-row";
    row.innerHTML = `
      <div class="ledger-row-top">
        <span class="ledger-row-vendor">${report.vendor_name || "Unknown vendor"}</span>
        <span class="ledger-row-amount">${formatCurrency(report.total_amount, report.currency)}</span>
      </div>
      <div class="ledger-row-bottom">
        <span class="ledger-row-meta">${report.invoice_number || "—"} · ${formatTimestamp(run.created_at)}</span>
        <span class="tag ${tagClassForRun(run)}">${tagLabelForRun(run)}</span>
      </div>
      ${provenance ? `<div class="ledger-row-provenance">${provenance}</div>` : ""}
    `;
    row.addEventListener("click", () => loadRunDetail(run.id, row));
    els.ledgerList.appendChild(row);
  });
}

function tagClassForRun(run) {
  if (run.status === "rejected_invalid" || run.status === "rejected_duplicate") return "tag-rejected";
  const cat = categorize(run);
  if (cat === "approved") return "tag-approved";
  if (cat === "declined") return "tag-rejected";
  return "tag-review";
}

function tagLabelForRun(run) {
  if (run.status === "rejected_invalid") return "Invalid";
  if (run.status === "rejected_duplicate") return "Duplicate";
  const cat = categorize(run);
  if (cat === "approved") return "Approved";
  if (cat === "declined") return "Declined";
  return "Pending";
}

async function loadRunDetail(runId, rowEl) {
  document.querySelectorAll(".ledger-row").forEach(r => r.classList.remove("active"));
  if (rowEl) rowEl.classList.add("active");
  currentRunId = runId; // so Approve/Reject (report.js) acts on the correct run

  try {
    const res = await authFetch(`/api/runs/${runId}`);
    if (!res.ok) return;
    const run = await res.json();
    renderReport(run.report, run.status);
  } catch (err) {
    // ignore — leave current view as-is
  }
}

function updateStats(items) {
  els.statTotal.textContent = items.length;
  els.statFlagged.textContent = filterByTab(items, "pending").length;
  els.statApproved.textContent = filterByTab(items, "approved").length;
}

els.searchInput.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = filterByTab(history, activeTab).filter(run => {
    const report = run.report || {};
    return (report.vendor_name || "").toLowerCase().includes(q) ||
           (report.invoice_number || "").toLowerCase().includes(q);
  });
  renderLedgerList(filtered);
});