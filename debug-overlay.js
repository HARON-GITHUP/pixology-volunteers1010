// debug-overlay.js
(function () {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;inset:12px;z-index:999999;background:#0b1220;color:#fff;padding:12px;border-radius:14px;font:14px/1.6 system-ui;overflow:auto;display:none;white-space:pre-wrap";
  document.addEventListener("DOMContentLoaded", () =>
    document.body.appendChild(box),
  );

  function show(msg) {
    box.style.display = "block";
    box.textContent = "❌ ERROR (Mobile)\n\n" + msg;
  }

  window.addEventListener("error", (e) => {
    show(`${e.message}\n${e.filename}:${e.lineno}:${e.colno}`);
  });

  window.addEventListener("unhandledrejection", (e) => {
    show(String(e.reason || e));
  });
})();
