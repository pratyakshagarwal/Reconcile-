/* ============================================================
   AUTH — login, signup, token storage, authenticated fetch
   Depends on: nothing (loads before everything else that uses authFetch)
   ============================================================ */

// const API_BASE = "https://pratyakshagarwal-ledger.hf.space";
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
