// debug-overlay.js
// يظهر الأخطاء بدل ما الصفحة تبقى بيضا (مفيد جدًا على الموبايل)
(function () {
  // شغّال فقط على localhost أو لو فتحت الرابط بـ ?debug=1
  const allow = location.hostname === "localhost" || location.hostname === "127.0.0.1" || new URLSearchParams(location.search).get("debug") === "1";
  if (!allow) return;

  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;inset:10px;z-index:999999;background:#0b1220;color:#fff;padding:12px;border-radius:14px;font:14px/1.6 system-ui;overflow:auto;display:none;white-space:pre-wrap";
  function mount() {
    try { document.body.appendChild(box); } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  function show(msg) {
    box.style.display = "block";
    box.textContent = "❌ ERROR\n\n" + msg;
  }

  window.addEventListener("error", (e) => {
    show(`${e.message}\n${e.filename}:${e.lineno}:${e.colno}`);
  });

  window.addEventListener("unhandledrejection", (e) => {
    show(String(e.reason || e));
  });
})();
