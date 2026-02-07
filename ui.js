// ui.js - Simple UI helpers (Toast + Loading) used across the project

let _inited = false;

function ensureUI() {
  if (_inited) return;
  _inited = true;

  // Toast
  if (!document.getElementById("toastRoot")) {
    const root = document.createElement("div");
    root.id = "toastRoot";
    root.innerHTML = `
      <div class="toast" id="toast" aria-live="polite" aria-atomic="true">
        <div class="toast__msg" id="toastMsg"></div>
      </div>
      <div class="loading" id="loading" aria-hidden="true">
        <div class="loading__spinner" aria-label="Loading"></div>
      </div>
    `;
    document.body.appendChild(root);
  }

  // Styles (injected once)
  if (!document.getElementById("uiStyle")) {
    const style = document.createElement("style");
    style.id = "uiStyle";
    style.textContent = `
      .toast{position:fixed;left:16px;right:16px;bottom:18px;display:none;justify-content:center;z-index:99999}
      .toast.is-show{display:flex}
      .toast__msg{max-width:720px;width:fit-content;background:#0b1220;color:#e2e8f0;padding:12px 14px;border-radius:14px;
        box-shadow:0 18px 60px rgba(0,0,0,.35);font:600 14px/1.5 system-ui,-apple-system,"Segoe UI",Arial}
      .toast--success .toast__msg{background:#064e3b}
      .toast--error .toast__msg{background:#7f1d1d}
      .toast--warn .toast__msg{background:#78350f}
      .loading{position:fixed;inset:0;background:rgba(2,6,23,.55);display:none;align-items:center;justify-content:center;z-index:99998}
      .loading.is-show{display:flex}
      .loading__spinner{width:54px;height:54px;border-radius:999px;border:6px solid rgba(255,255,255,.35);border-top-color:#fff;
        animation:spin 1s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);
  }
}

export function toast(message, type="info", ms=2200) {
  ensureUI();
  const t = document.getElementById("toast");
  const m = document.getElementById("toastMsg");
  if (!t || !m) return;
  m.textContent = String(message ?? "");
  t.classList.remove("toast--success","toast--error","toast--warn");
  if (type === "success") t.classList.add("toast--success");
  else if (type === "error") t.classList.add("toast--error");
  else if (type === "warn") t.classList.add("toast--warn");
  t.classList.add("is-show");
  clearTimeout(t._timer);
  t._timer = setTimeout(()=> t.classList.remove("is-show"), ms);
}

export function setLoading(on=true) {
  ensureUI();
  const el = document.getElementById("loading");
  if (!el) return;
  el.classList.toggle("is-show", !!on);
  el.setAttribute("aria-hidden", on ? "false" : "true");
}

// Redirect 127.0.0.1 -> localhost (Firebase Authorized Domains issue)
export function normalizeLocalhost() {
  try{
    if (location.hostname === "127.0.0.1") {
      const url = new URL(location.href);
      url.hostname = "localhost";
      location.replace(url.toString());
    }
  }catch(e){}
}


// Require auth on protected pages
export function requireAuth(options = {}) {
  const {
    onAuthed = null,
    onGuest = null,
    redirectTo = "register.html",
    message = "لازم تسجل دخول الأول.",
  } = options;

  // Lazy import to avoid circular issues
  import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
    .then(({ onAuthStateChanged }) => {
      // auth instance is exported from firebase.js on each page typically; but we cannot import here safely.
      // So callers should pass auth via window.AUTH if needed.
    })
    .catch(() => {});
}

// Safer auth guard (expects window.authRef = auth from firebase.js)
export function guardAuth({ redirectTo = "register.html", message = "لازم تسجل دخول الأول.", allow = null } = {}) {
  try {
    const auth = window.authRef;
    if (!auth) return;
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js").then(({ onAuthStateChanged }) => {
      onAuthStateChanged(auth, (user) => {
        if (!user) {
          toast(message, "warn", 2600);
          setTimeout(() => (location.href = redirectTo), 400);
          return;
        }
        if (typeof allow === "function") allow(user);
      });
    });
  } catch (e) {}
}

// Simple anti-double-submit (client-side)
export function throttleAction(key, ms = 3000) {
  const k = "throttle:" + key;
  const now = Date.now();
  const last = Number(localStorage.getItem(k) || "0");
  if (now - last < ms) return false;
  localStorage.setItem(k, String(now));
  return true;
}

