/* ============================================================
   FORMAT HELPERS
   No dependencies — safe to load first.
   ============================================================ */

function formatCurrency(amount, currency = "USD") {
  if (amount === null || amount === undefined) return "—";
  try {
    // Using undefined instead of "en-US" lets the browser automatically 
    // use the local user's formatting style (commas vs periods etc.)
    return new Intl.NumberFormat(undefined, { 
      style: "currency", 
      currency: currency || "USD" 
    }).format(amount);
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
