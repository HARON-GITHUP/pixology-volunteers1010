// ✅ Fix: Firebase auth domains (open with localhost, not 127.0.0.1)
try{
  if (location.hostname === "127.0.0.1") {
    const u = new URL(location.href);
    u.hostname = "localhost";
    location.replace(u.toString());
  }
}catch(e){}

const body = document.body;

/** ================= Theme Toggle ================= */
const themeBtn = document.getElementById("themeBtn");
themeBtn?.addEventListener("click", () => body.classList.toggle("dark"));

/** ================= Announcement ================= */
const announceClose = document.getElementById("closeAnnounce");
announceClose?.addEventListener("click", () => {
  document.querySelector(".announce")?.remove();
});

/** ================= Search Modal ================= */
const modal = document.getElementById("searchModal");
const openSearch = document.getElementById("openSearch");
const closeOverlay = document.getElementById("closeSearch");
const closeBtn = document.getElementById("closeSearchBtn");

function openModal(m) {
  if (!m) return;
  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");
}
function closeModal(m) {
  if (!m) return;
  m.classList.remove("is-open");
  m.setAttribute("aria-hidden", "true");
}

openSearch?.addEventListener("click", () => openModal(modal));
closeOverlay?.addEventListener("click", () => closeModal(modal));
closeBtn?.addEventListener("click", () => closeModal(modal));

/** ================= Back To Top ================= */
const toTop = document.getElementById("toTop");
window.addEventListener("scroll", () => {
  if (!toTop) return;
  toTop.classList.toggle("show", window.scrollY > 600);
});
toTop?.addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" }),
);

/** ================= Details Modal (اختياري) ================= */
/* ✅ سيبناه موجود لو هتستخدم مودال تفاصيل بعدين */
const courseModal = document.getElementById("courseModal");
const closeCourseOverlay = document.getElementById("closeCourseModal");
const closeCourseBtn = document.getElementById("closeCourseModalBtn");
const cmTitle = document.getElementById("cmTitle");
const cmBody = document.getElementById("cmBody");
const cmJoin = document.getElementById("cmJoin");

function getGradeText(card) {
  const g = card?.querySelector?.(".img-text__small");
  return (g?.textContent || "").trim();
}

function openCourseModal(card) {
  if (!courseModal || !card) return;

  const title = (
    card.querySelector(".course-card__title")?.textContent || ""
  ).trim();
  const desc = (
    card.querySelector(".course-card__desc")?.textContent || ""
  ).trim();
  const price = (card.querySelector(".price-badge")?.textContent || "").trim();
  const gradeTxt = getGradeText(card);
  const teacher = (
    card.querySelector(".teacher-tag")?.textContent || ""
  ).trim();

  if (cmTitle) cmTitle.textContent = title || "تفاصيل";
  if (cmBody) {
    cmBody.innerHTML = `
      <p style="margin:0 0 10px;font-weight:1000">${desc}</p>
      <div style="display:grid;gap:8px;color:var(--muted);font-weight:900">
        <div>👤 الاسم: <b style="color:var(--text)">${teacher}</b></div>
        <div>📌 التصنيف: <b style="color:var(--text)">${gradeTxt || "—"}</b></div>
        <div>⏱️ الساعات: <b style="color:var(--text)">${price || "—"}</b></div>
      </div>
    `;
  }

  const courseParam = encodeURIComponent(title || "");
  if (cmJoin) cmJoin.href = `register.html?course=${courseParam}`;

  openModal(courseModal);
}

function closeCourseModalFn() {
  closeModal(courseModal);
}

closeCourseOverlay?.addEventListener("click", closeCourseModalFn);
closeCourseBtn?.addEventListener("click", closeCourseModalFn);

/** ✅ Escape لإغلاق المودالات */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (modal?.classList.contains("is-open")) closeModal(modal);
    if (courseModal?.classList.contains("is-open")) closeModal(courseModal);
  }
});

/**
 * ✅ فتح مودال التفاصيل فقط لو الزر عليه data-modal="details"
 * (مش بنلمس أي روابط تانية)
 */
document.querySelectorAll('[data-modal="details"]').forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const card = btn.closest(".course-card");
    if (card) openCourseModal(card);
  });
});

// ===== About Modal =====
(function () {
  const aboutBtn = document.getElementById("aboutBtn");
  const modal = document.getElementById("aboutModal");
  const closeBtn = document.getElementById("aboutClose");
  const backdrop = document.getElementById("aboutBackdrop");

  if (!aboutBtn || !modal || !closeBtn || !backdrop) return;

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  aboutBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
})();
