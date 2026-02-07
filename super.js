import { auth, db } from "./firebase.js";
import { toast, setLoading, guardAuth } from "./ui.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/** DOM */

guardAuth({ redirectTo: 'register.html', message: 'لازم تسجّل دخول كسوبر أدمن.' });

const logoutBtn = document.getElementById("logout");
const aUid = document.getElementById("aUid");
const aRole = document.getElementById("aRole");
const aActive = document.getElementById("aActive");
const aSave = document.getElementById("aSave");
const aLoad = document.getElementById("aLoad");
const aMsg = document.getElementById("aMsg");
const aRows = document.getElementById("aRows");

function setAdminMsg(t = "") {
  if (aMsg) aMsg.textContent = t;
}

function renderAdminUsers(list) {
  if (!aRows) return;

  if (!list.length) {
    aRows.innerHTML = `
      <tr><td colspan="4" style="text-align:center; padding:14px; opacity:.8;">
        لا يوجد أدمنز
      </td></tr>`;
    return;
  }

  aRows.innerHTML = list
    .map(
      (u) => `
    <tr>
      <td>${u.uid}</td>
      <td>${u.role}</td>
      <td>${String(u.active)}</td>
      <td style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="miniBtn" data-act="fill" data-uid="${u.uid}" data-role="${u.role}" data-active="${u.active}">تعديل</button>
        <button class="miniBtn" data-act="toggle" data-uid="${u.uid}" data-active="${u.active}">${u.active ? "تعطيل" : "تفعيل"}</button>
      </td>
    </tr>
  `,
    )
    .join("");
}

async function checkSuper(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return { ok: false };

  const data = snap.data() || {};
  const role = String(data.role || "").trim();
  const active = data.active === true;

  // ✅ تعديل: نقبل super_admin أو superadmin
  return { ok: active && (role === "super_admin" || role === "superadmin") };
}

async function loadAdmins() {
  setAdminMsg("جارٍ التحميل...");

  try {
    const q1 = query(collection(db, "users"), where("role", "==", "admin"));
    const q2 = query(
      collection(db, "users"),
      where("role", "==", "super_admin"),
    );
    const q3 = query(
      collection(db, "users"),
      where("role", "==", "superadmin"),
    ); // ✅ احتياط

    const [s1, s2, s3] = await Promise.all([
      getDocs(q1),
      getDocs(q2),
      getDocs(q3),
    ]);

    const list = [
      ...s1.docs.map((d) => ({ uid: d.id, ...d.data() })),
      ...s2.docs.map((d) => ({ uid: d.id, ...d.data() })),
      ...s3.docs.map((d) => ({ uid: d.id, ...d.data() })),
    ].map((x) => ({
      uid: x.uid,
      role: x.role || "admin",
      active: x.active === true,
    }));

    const map = new Map();
    list.forEach((x) => map.set(x.uid, x));
    renderAdminUsers(Array.from(map.values()));

    setAdminMsg(`✅ تم التحميل (${map.size})`);
  } catch (e) {
    console.error(e);
    setAdminMsg("❌ فشل التحميل");
  }
}
if (aRole && !aRole.value) aRole.value = "admin";

async function saveAdmin() {
  const uid = (aUid?.value || "").trim();
  const role = (aRole?.value || "admin").trim();
  const active = (aActive?.value || "true") === "true";

  if (!uid) {
    setAdminMsg("❌ اكتب UID");
    return;
  }

  setAdminMsg("جارٍ الحفظ...");

  try {
    await setDoc(doc(db, "users", uid), { role, active }, { merge: true });
    setAdminMsg("✅ تم الحفظ");
    await loadAdmins();
  } catch (e) {
    console.error(e);
    setAdminMsg("❌ فشل الحفظ");
  }
}

aLoad?.addEventListener("click", loadAdmins);
aSave?.addEventListener("click", saveAdmin);

aRows?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-act]");
  if (!btn) return;

  const act = btn.dataset.act;
  const uid = btn.dataset.uid;
  if (!uid) return;

  if (act === "fill") {
    if (aUid) aUid.value = uid;
    if (aRole) aRole.value = btn.dataset.role || "admin";
    if (aActive)
      aActive.value = btn.dataset.active === "true" ? "true" : "false";
    setAdminMsg("✅ تم تحميل بيانات المستخدم في الفورم");
    return;
  }

  if (act === "toggle") {
    const current = btn.dataset.active === "true";
    const next = !current;

    setAdminMsg("جارٍ التحديث...");

    try {
      await updateDoc(doc(db, "users", uid), { active: next });
      setAdminMsg("✅ تم التحديث");
      await loadAdmins();
    } catch (e2) {
      console.error(e2);
      setAdminMsg("❌ فشل التحديث");
    }
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  localStorage.removeItem("role");
  // ✅ تعديل: يرجع للصفحة الرئيسية
  location.href = "index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "admin.html";
    return;
  }

  const ok = await checkSuper(user);
  if (!ok.ok) {
    location.href = "admin.html";
    return;
  }

  // تحميل تلقائي
  loadAdmins();
});