import { auth, db } from "./firebase.js";
import { toast, setLoading } from "./ui.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/** ====== DOM ====== */
const rowsEl = document.getElementById("rows");
const countEl = document.getElementById("count");
const roleBadge = document.getElementById("roleBadge");

const searchEl = document.getElementById("search");
const filterStatus = document.getElementById("filterStatus");

const exportBtn = document.getElementById("exportCsv");
const logoutBtn = document.getElementById("logout");
const toastEl = document.getElementById("toast");

/** ====== State ====== */
let CERTS = [];
let UNSUB = null;

let ADMIN_OK = false;
let CURRENT_ROLE = null;

/** ====== Helpers ====== */
const norm = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

function showToast(text, sub = "") {
  if (!toastEl) return;
  toastEl.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ""}`;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3500);
}

function safe(str) {
  return String(str ?? "")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** ✅ تحقق Role من users/{uid} (admin + super_admin) */
async function checkAdmin(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return { ok: false, role: null };

    const data = snap.data() || {};
    const role = String(data.role || "").trim();
    const active = data.active === true;

    const allowed = ["admin", "super_admin"];
    const ok = active && allowed.includes(role);

    return { ok, role: ok ? role : null };
  } catch (e) {
    console.error("checkAdmin error:", e);
    return { ok: false, role: null };
  }
}

function setCount(n) {
  if (countEl) countEl.textContent = `${n} شهادة`;
}

function toCsv(docs) {
  const headers = [
    "issuedAtText",
    "certId",
    "name",
    "volunteerId",
    "hoursAtIssue",
    "statusAtIssue",
    "organization",
    "issuedByUid",
  ];
  const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = [
    headers.join(","),
    ...docs.map((d) => headers.map((h) => escape(d[h])).join(",")),
  ];
  return lines.join("\n");
}

function renderTable() {
  if (!rowsEl) return;

  const q = norm(searchEl?.value || "");
  const st = (filterStatus?.value || "").trim();

  const filtered = CERTS.filter((c) => {
    const hit =
      norm(c.certId).includes(q) ||
      norm(c.name).includes(q) ||
      norm(c.volunteerId).includes(q);

    const okStatus = st ? String(c.statusAtIssue || "") === st : true;

    return (q ? hit : true) && okStatus;
  });

  setCount(filtered.length);

  if (!filtered.length) {
    rowsEl.innerHTML = `<tr><td colspan="8" class="empty">لا توجد شهادات</td></tr>`;
    return;
  }

  rowsEl.innerHTML = filtered
    .map(
      (c) => `
    <tr data-cert="${safe(c.certId)}">
      <td>${safe(c.issuedAtText || "")}</td>
      <td><b>${safe(c.certId)}</b></td>
      <td>${safe(c.name)}</td>
      <td>${safe(c.volunteerId)}</td>
      <td>${Number(c.hoursAtIssue || 0)}</td>
      <td>${safe(c.statusAtIssue || "")}</td>
      <td>${safe(c.organization || "")}</td>
      <td style="display:flex; gap:8px; flex-wrap:wrap;">
        <a class="miniBtn primary" href="certificate.html?cert=${encodeURIComponent(
          c.certId,
        )}" target="_blank">عرض</a>
        ${
          CURRENT_ROLE === "super_admin"
            ? `<button class="miniBtn danger" data-action="delete">حذف</button>`
            : ``
        }
      </td>
    </tr>
  `,
    )
    .join("");
}

/** ====== Events ====== */
searchEl?.addEventListener("input", renderTable);
filterStatus?.addEventListener("change", renderTable);

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

exportBtn?.addEventListener("click", () => {
  const csv = toCsv(CERTS);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "pixology_certificates.csv";
  a.click();
  URL.revokeObjectURL(url);
});

rowsEl?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  if (!btn) return;

  if (btn.dataset.action !== "delete") return;

  // حذف مسموح للسوبر أدمن فقط
  if (CURRENT_ROLE !== "super_admin") {
    toast("❌ مسموح للسوبر أدمن فقط");
    return;
  }

  const tr = btn.closest("tr");
  const certId = tr?.dataset?.cert;
  if (!certId) return;

  const ok = confirm(`تأكيد حذف الشهادة: ${certId} ؟`);
  if (!ok) return;

  btn.disabled = true;
  btn.textContent = "جارٍ الحذف...";

  try {
    await deleteDoc(doc(db, "certificates", certId));
    showToast("✅ تم حذف الشهادة", certId);
  } catch (err) {
    console.error(err);
    toast("❌ فشل حذف الشهادة");
  } finally {
    btn.disabled = false;
    btn.textContent = "حذف";
  }
});

/** ====== Auth Gate + Load ====== */
onAuthStateChanged(auth, async (user) => {
  ADMIN_OK = false;
  CURRENT_ROLE = null;

  if (!user) {
    if (UNSUB) {
      UNSUB();
      UNSUB = null;
    }
    CERTS = [];
    renderTable();
    if (roleBadge) roleBadge.textContent = "غير مسجل";
    return;
  }

  const res = await checkAdmin(user);
  ADMIN_OK = res.ok;
  CURRENT_ROLE = res.role;

  if (!ADMIN_OK) {
    toast("❌ الحساب ده مش أدمن");
    await signOut(auth);
    return;
  }

  if (roleBadge) roleBadge.textContent = CURRENT_ROLE;

  // تحميل الشهادات
  const q = query(collection(db, "certificates"), orderBy("issuedAt", "desc"));
  if (UNSUB) UNSUB();

  UNSUB = onSnapshot(q, (snap) => {
    CERTS = snap.docs.map((s) => {
      const d = s.data() || {};
      const t = d.issuedAt?.toDate ? d.issuedAt.toDate() : null;

      return {
        certId: d.certId || s.id,
        name: d.name || "",
        volunteerId: d.volunteerId || "",
        hoursAtIssue: Number(d.hoursAtIssue || 0),
        statusAtIssue: d.statusAtIssue || "",
        organization: d.organization || "",
        issuedByUid: d.issuedByUid || "",
        issuedAtText: t ? t.toLocaleString("ar-EG") : "",
      };
    });

    renderTable();
  });
});

renderTable();