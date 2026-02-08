// my-profile.js (FULL CLEAN VERSION)
import { auth, db } from "./firebase.js";
window.authRef = auth;
import { toast, setLoading, guardAuth } from "./ui.js";

guardAuth({ redirectTo: "index.html", message: "سجّل دخول عشان تفتح ملفك الشخصي." });

import {
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ROLE_KEY = "pix_role";

/** ================== DOM ================== */
const pPhoto = document.getElementById("pPhoto");
const pName = document.getElementById("pName");
const pEmail = document.getElementById("pEmail");
const pUid = document.getElementById("pUid");
const pLast = document.getElementById("pLast");
const pRole = document.getElementById("pRole");
const pActive = document.getElementById("pActive");
const pPublicLink = document.getElementById("pPublicLink");
const btnResetRole = document.getElementById("btnResetRole");
const btnLogout = document.getElementById("btnLogout");
const msg = document.getElementById("msg");

// نقاط + مستوى
const pPoints = document.getElementById("pPoints");
const pLevel = document.getElementById("pLevel");
const pBar = document.getElementById("pBar");
const pNext = document.getElementById("pNext");
const b1 = document.getElementById("b1");
const b2 = document.getElementById("b2");
const b3 = document.getElementById("b3");

// الإحصائيات
const sHours = document.getElementById("sHours");
const sEvents = document.getElementById("sEvents");
const sJoin = document.getElementById("sJoin");
const sUpdate = document.getElementById("sUpdate");

// الإشعارات
const notifyList = document.getElementById("notifyList");

// التاسكات
const taskList = document.getElementById("taskList");

// أزرار
const btnCopyUid = document.getElementById("btnCopyUid");
const btnCopyPublic = document.getElementById("btnCopyPublic");
const btnClearDevice = document.getElementById("btnClearDevice");
const btnPDF = document.getElementById("btnPDF");

// هنخزن داتا للـ PDF هنا
let currentUserDataForPdf = null;

/** ================== Auth Helpers ================== */
async function requireLogin() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

/** ================== UI Helpers ================== */
function showMsg(text) {
  if (!msg) return;
  msg.textContent = text;
  msg.style.display = "block";
}

function renderAvatar(user) {
  if (!pPhoto) return;

  const photo = user.photoURL || "";
  const name = user.displayName || user.email || "U";
  const letter = (name.trim()[0] || "U").toUpperCase();

  if (photo) {
    pPhoto.innerHTML = "";
    pPhoto.style.background = `url('${photo}') center/cover no-repeat`;
    pPhoto.textContent = "";
  } else {
    pPhoto.style.background = "#0b2230";
    pPhoto.textContent = letter;
  }
}

function roleLabel(role) {
  if (role === "volunteer") return "متطوع";
  if (role === "org") return "مؤسسة";
  if (role === "admin") return "Admin";
  if (role === "superadmin" || role === "super_admin") return "Super Admin";
  return role || "—";
}

function fmtDateAny(v) {
  try {
    if (!v) return "—";
    if (typeof v.toDate === "function")
      return v.toDate().toLocaleString("ar-EG");
    if (typeof v === "string") return new Date(v).toLocaleString("ar-EG");
    if (v instanceof Date) return v.toLocaleString("ar-EG");
    return "—";
  } catch {
    return "—";
  }
}

function basePathUrl(fileName) {
  return `${location.origin}${location.pathname.replace(/\/[^/]*$/, "/")}${fileName}`;
}

/** ================== Points System ================== */
function levelFromPoints(points) {
  if (points >= 1000) return { name: "أسطوري", min: 1000, next: 1500 };
  if (points >= 500) return { name: "خبير", min: 500, next: 1000 };
  if (points >= 200) return { name: "مميز", min: 200, next: 500 };
  if (points >= 50) return { name: "نشيط", min: 50, next: 200 };
  return { name: "مبتدئ", min: 0, next: 50 };
}

function renderPointsUI(points) {
  const p = Number(points || 0);

  if (pPoints) pPoints.textContent = String(p);

  const lv = levelFromPoints(p);
  if (pLevel) pLevel.textContent = lv.name;

  const span = lv.next - lv.min;
  const progress = span > 0 ? ((p - lv.min) / span) * 100 : 0;
  if (pBar) pBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;

  if (pNext) {
    const left = Math.max(0, lv.next - p);
    pNext.textContent = left
      ? `متبقي ${left} نقطة للوصول للمستوى التالي`
      : `أنت في أعلى مستوى حاليًا ✅`;
  }

  if (b1) b1.style.display = p >= 50 ? "inline-flex" : "none";
  if (b2) b2.style.display = p >= 200 ? "inline-flex" : "none";
  if (b3) b3.style.display = p >= 500 ? "inline-flex" : "none";
}

/** ================== Stats ================== */
function renderStatsUI({
  hours = 0,
  eventsCount = 0,
  createdAt = null,
  updatedAt = null,
}) {
  if (sHours) sHours.textContent = String(Number(hours || 0));
  if (sEvents) sEvents.textContent = String(Number(eventsCount || 0));
  if (sJoin) sJoin.textContent = fmtDateAny(createdAt);
  if (sUpdate) sUpdate.textContent = fmtDateAny(updatedAt);
}

/** ✅ ساعات التطوع fallback (يطابق حقول الأدمن) */
async function getVolunteerHoursFallback(uidOrVolunteerId) {
  // 1) volunteerId == X
  try {
    const q1 = query(
      collection(db, "pixology_volunteers"),
      where("volunteerId", "==", uidOrVolunteerId),
    );
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return Number(snap1.docs[0].data().hours || 0);
  } catch {}

  // 2) userUid == UID (ده اللي بتخزنه في admin.js)
  try {
    const q2 = query(
      collection(db, "pixology_volunteers"),
      where("userUid", "==", uidOrVolunteerId),
    );
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return Number(snap2.docs[0].data().hours || 0);
  } catch {}

  // 3) uid == UID (احتياط)
  try {
    const q3 = query(
      collection(db, "pixology_volunteers"),
      where("uid", "==", uidOrVolunteerId),
    );
    const snap3 = await getDocs(q3);
    if (!snap3.empty) return Number(snap3.docs[0].data().hours || 0);
  } catch {}

  return 0;
}

/** ================== Copy ================== */
async function copyText(text) {
  try {
    if (!text) return false;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

/** ================== PDF (Print) ================== */
function openPrintReport(data) {
  const w = window.open("", "_blank");
  if (!w) {
    toast("النافذة المنبثقة اتقفلت. فعّل Pop-ups وجرب تاني.");
    return;
  }

  w.document.open();
  w.document.write(`
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>تقرير الملف الشخصي</title>
<style>
  body{font-family: Arial, sans-serif; margin: 24px; color:#111;}
  .wrap{max-width: 760px; margin: 0 auto;}
  .head{display:flex; justify-content:space-between; align-items:center; gap:12px;}
  .brand{font-weight:900; font-size:20px;}
  .card{border:1px solid #ddd; border-radius:14px; padding:16px; margin-top:14px;}
  .grid{display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:10px;}
  .muted{color:#666;}
  .big{font-size:24px; font-weight:900;}
  .row{display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;}
  a{color:#0b4f73; word-break:break-all;}
  @media print{button{display:none;}}
</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div class="brand">Pixology — تقرير الملف الشخصي</div>
      <div class="muted">${new Date().toLocaleString("ar-EG")}</div>
    </div>

    <div class="card">
      <div class="row">
        <div>
          <div class="muted">الاسم</div>
          <div style="font-weight:900">${data.name || "—"}</div>
        </div>
        <div>
          <div class="muted">البريد</div>
          <div style="font-weight:900">${data.email || "—"}</div>
        </div>
      </div>
      <div style="margin-top:10px">
        <div class="muted">UID</div>
        <div style="font-weight:900">${data.uid || "—"}</div>
      </div>
      <div style="margin-top:10px" class="grid">
        <div><span class="muted">النوع:</span> <b>${data.roleText || "—"}</b></div>
        <div><span class="muted">الحالة:</span> <b>${data.activeText || "—"}</b></div>
      </div>
    </div>

    <div class="card">
      <div class="grid">
        <div><div class="muted">النقاط</div><div class="big">${data.points ?? 0}</div></div>
        <div><div class="muted">المستوى</div><div class="big" style="font-size:20px">${data.level || "—"}</div></div>
        <div><div class="muted">الساعات</div><div class="big">${data.hours ?? 0}</div></div>
        <div><div class="muted">المشاركات</div><div class="big">${data.eventsCount ?? 0}</div></div>
      </div>

      <div style="margin-top:12px" class="grid">
        <div><span class="muted">تاريخ الانضمام:</span> <b>${data.joinText || "—"}</b></div>
        <div><span class="muted">آخر تحديث:</span> <b>${data.updateText || "—"}</b></div>
      </div>

      <div style="margin-top:12px">
        <div class="muted">رابط الملف العام</div>
        <div>${data.publicUrl ? `<a href="${data.publicUrl}">${data.publicUrl}</a>` : "—"}</div>
      </div>

      <div style="margin-top:14px">
        <button onclick="window.print()">طباعة / حفظ PDF</button>
      </div>
    </div>
  </div>
</body>
</html>
  `);
  w.document.close();
}

/** ================== Notifications ==================
    ✅ لتفادي Index: نجيب آخر 30 إشعار بدون orderBy+where مع بعض
*/
async function loadNotifications(uid) {
  if (!notifyList) return;

  notifyList.innerHTML = `<p class="muted">جاري تحميل الإشعارات...</p>`;

  try {
    const qy = query(collection(db, "notifications"), where("assignedTo","==",uid));
    const snap = await getDocs(qy);

    if (snap.empty) {
      notifyList.innerHTML = `<p class="muted">لا يوجد إشعارات</p>`;
      return;
    }

    // رتب محليًا حسب createdAt
    const docs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      })
      .slice(0, 30);

    // ✅ علّم غير المقروء كمقروء
    const unread = docs.filter((d) => d.read === false);
    for (const n of unread) {
      try {
        await updateDoc(doc(db, "notifications", n.id), {
          read: true,
          readAt: serverTimestamp(),
        });
      } catch {}
    }

    notifyList.innerHTML = docs
      .map((n) => {
        const icon =
          n.type === "success" ? "✅" : n.type === "warning" ? "⚠️" : "ℹ️";
        const title = n.title || "إشعار";
        const message = n.message || "";
        const time = fmtDateAny(n.createdAt);

        return `
          <div style="padding:12px; border-radius:14px; border:1px solid var(--border); background:var(--card);">
            <div style="font-weight:900">${icon} ${title}</div>
            <div class="muted" style="margin-top:4px">${message}</div>
            <div class="muted" style="margin-top:6px; font-size: 12px">${time}</div>
          </div>
        `;
      })
      .join("");
  } catch (e) {
    console.log(e);
    notifyList.innerHTML = `<p class="muted">حدث خطأ في تحميل الإشعارات</p>`;
  }
}

/** ================== Tasks ==================
    ✅ لتفادي Index: نجيب tasks بـ where فقط ونرتب محليًا
*/
function renderTasks(tasks) {
  if (!taskList) return;

  if (!tasks.length) {
    taskList.innerHTML = `<p class="muted">لا توجد تاسكات</p>`;
    return;
  }

  taskList.innerHTML = tasks
    .map((t) => {
      const pr =
        t.priority === "high"
          ? "🔥 عالية"
          : t.priority === "low"
          ? "هادية"
          : "عادية";

      const st = t.status === "done" ? "✅ تم" : "⏳ مفتوحة";
      const seen = t.seen ? `👁️ اتشاف: ${fmtDateAny(t.readAt)}` : "🔴 جديدة";
      const created = fmtDateAny(t.createdAt);
      const due = t.dueAt ? `📅 موعد: ${fmtDateAny(t.dueAt)}` : "";

      return `
        <div style="padding:12px; border-radius:14px; border:1px solid var(--border); background:var(--card);">
          <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <div style="font-weight:900">🧩 ${t.title || "Task"}</div>
            <div class="muted" style="font-size:12px">${pr} • ${st}</div>
          </div>

          ${t.details ? `<div class="muted" style="margin-top:6px">${t.details}</div>` : ""}

          <div class="muted" style="margin-top:8px; font-size:12px">
            ${seen} • 🕒 ${created} ${due ? ` • ${due}` : ""}
          </div>

          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            ${
              t.status !== "done"
                ? `<button class="btn btn--outline" data-action="doneTask" data-id="${t.id}">تم التنفيذ</button>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

async function loadTasksAndMarkSeen(uid) {
  if (!taskList) return;

  taskList.innerHTML = `<p class="muted">جاري تحميل التاسكات...</p>`;

  try {
    const qy = query(collection(db, "tasks"), where("assignedTo", "==", uid));
    const snap = await getDocs(qy);

    if (snap.empty) {
      taskList.innerHTML = `<p class="muted">لا توجد تاسكات</p>`;
      return;
    }

    // رتب محليًا
    const tasks = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      })
      .slice(0, 30);

    // ✅ علّم غير المتشاف Seen
    const unseen = tasks.filter((t) => t.seen === false);
    for (const t of unseen) {
      try {
        await updateDoc(doc(db, "tasks", t.id), {
          read: true,
          readAt: serverTimestamp(),
        });
        t.seen = true;
        t.readAt = { toDate: () => new Date() };
      } catch {}
    }

    renderTasks(tasks);
  } catch (e) {
    console.log(e);
    taskList.innerHTML = `<p class="muted">حدث خطأ في تحميل التاسكات</p>`;
  }
}

taskList?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action='doneTask']");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  btn.disabled = true;
  btn.textContent = "جارٍ...";

  try {
    await updateDoc(doc(db, "tasks", id), {
      status: "done",
      doneAt: serverTimestamp(),
    });

    if (auth.currentUser) await loadTasksAndMarkSeen(auth.currentUser.uid);
  } catch (err) {
    console.log(err);
    toast("فشل تحديث التاسك");
  } finally {
    btn.disabled = false;
    btn.textContent = "تم التنفيذ";
  }
});

/** ================== Main ================== */
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      toast("لازم تسجل دخول بحسابك الأول ✅");
      await requireLogin();
      return;
    }

    renderAvatar(user);
    if (pName) pName.textContent = user.displayName || "—";
    if (pEmail) pEmail.textContent = user.email || "—";
    if (pUid) pUid.textContent = user.uid || "—";

    const last = user.metadata?.lastSignInTime;
    if (pLast) pLast.textContent = last ? new Date(last).toLocaleString("ar-EG") : "—";

    if (btnLogout) btnLogout.style.display = "inline-flex";

    // ✅ إشعارات + تاسكات
    loadNotifications(user.uid);
    loadTasksAndMarkSeen(user.uid);

    // Firestore user doc
    const uref = doc(db, "users", user.uid);
    const usnap = await getDoc(uref);

    if (!usnap.exists()) {
      showMsg("ملاحظة: لم يتم العثور على ملفك في قاعدة البيانات. افتح الصفحة الرئيسية واختر (متطوع/مؤسسة) مرة واحدة.");
      if (pRole) pRole.textContent = "—";
      if (pActive) pActive.textContent = "—";
      renderPointsUI(0);
      renderStatsUI({ hours: 0, eventsCount: 0, createdAt: null, updatedAt: null });
      if (btnResetRole) btnResetRole.style.display = "inline-flex";
      return;
    }

    const u = usnap.data() || {};
    const role = u.role || "";
    const active = u.active === true;

    if (pRole) pRole.textContent = roleLabel(role);
    if (pActive) pActive.textContent = active ? "مفعل ✅" : "غير مفعل ⛔";

    if (role) localStorage.setItem(ROLE_KEY, role);

    // رابط الملف العام
    let publicUrl = "";
    if (role === "volunteer") {
      const vid = u.volunteerId || user.uid;
      publicUrl = basePathUrl(`volunteer.html?id=${encodeURIComponent(vid)}`);
      if (pPublicLink) {
        pPublicLink.href = `volunteer.html?id=${encodeURIComponent(vid)}`;
        pPublicLink.style.display = "inline-flex";
        pPublicLink.textContent = "فتح ملفي كمتطوع";
      }
    } else if (role === "org") {
      publicUrl = basePathUrl("index.html");
      if (pPublicLink) {
        pPublicLink.href = "index.html";
        pPublicLink.style.display = "inline-flex";
        pPublicLink.textContent = "فتح صفحة المؤسسة";
      }
    } else if (role === "admin" || role === "super_admin" || role === "superadmin") {
      if (pPublicLink) {
        pPublicLink.href = "admin.html";
        pPublicLink.style.display = "inline-flex";
        pPublicLink.textContent = "لوحة التحكم";
      }
    } else {
      if (pPublicLink) pPublicLink.style.display = "none";
    }

    if (btnCopyPublic) btnCopyPublic.style.display = publicUrl ? "inline-flex" : "none";

    // نقاط
    let points = u.points;
    if (points == null) {
      const hours0 = Number(u.hours || 0);
      points = hours0 * 5;
    }
    renderPointsUI(points);

    // إحصائيات
    let hours = Number(u.hours || 0);
    const eventsCount = Number(u.eventsCount || 0);

    if (role === "volunteer" && u.hours == null) {
      hours = await getVolunteerHoursFallback(user.uid);
    }

    const createdAt = u.createdAt || null;
    const updatedAt = u.updatedAt || null;
    renderStatsUI({ hours, eventsCount, createdAt, updatedAt });

    // تجهيز PDF
    currentUserDataForPdf = {
      name: user.displayName || "",
      email: user.email || "",
      assignedTo: user.uid || "",
      roleText: roleLabel(role),
      activeText: active ? "مفعل ✅" : "غير مفعل ⛔",
      points: Number(points || 0),
      level: levelFromPoints(Number(points || 0)).name,
      hours: Number(hours || 0),
      eventsCount: Number(eventsCount || 0),
      joinText: fmtDateAny(createdAt),
      updateText: fmtDateAny(updatedAt),
      publicUrl,
    };

    if (btnResetRole) btnResetRole.style.display = "inline-flex";
  } catch (e) {
    console.log(e);
    showMsg("حصل خطأ أثناء تحميل الملف الشخصي. جرّب تحديث الصفحة.");
    renderPointsUI(0);
    renderStatsUI({ hours: 0, eventsCount: 0, createdAt: null, updatedAt: null });
    if (notifyList) notifyList.innerHTML = `<p class="muted">حدث خطأ في تحميل الإشعارات</p>`;
    if (taskList) taskList.innerHTML = `<p class="muted">حدث خطأ في تحميل التاسكات</p>`;
  }
});

/** ================== Buttons ================== */
btnLogout?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    toast("تم تسجيل الخروج ✅");
    location.href = "index.html";
  } catch {
    toast("فشل تسجيل الخروج");
  }
});

btnResetRole?.addEventListener("click", () => {
  localStorage.removeItem(ROLE_KEY);
  toast("تم مسح النوع. ارجع للصفحة الرئيسية واختر (متطوع/مؤسسة) من جديد ✅");
  location.href = "index.html";
});

btnCopyUid?.addEventListener("click", async () => {
  const ok = await copyText(pUid?.textContent?.trim() || "");
  toast(ok ? "تم نسخ UID ✅" : "فشل النسخ ⛔");
});

btnCopyPublic?.addEventListener("click", async () => {
  const url = currentUserDataForPdf?.publicUrl || "";
  const ok = await copyText(url);
  toast(ok ? "تم نسخ الرابط ✅" : "فشل النسخ ⛔");
});

btnClearDevice?.addEventListener("click", () => {
  localStorage.removeItem(ROLE_KEY);
  toast("تم مسح بيانات الجهاز (localStorage) ✅");
});

btnPDF?.addEventListener("click", () => {
  if (!currentUserDataForPdf) {
    toast("استنى لحظة… البيانات لسه بتتحمل.");
    return;
  }
  openPrintReport(currentUserDataForPdf);
});


/* =========================
   NOTIFICATIONS + TASKS (Volunteer)
========================= */
const notifList = document.getElementById("notifList");
const btnMarkNotifs = document.getElementById("btnMarkNotifs");
const myTasksList = document.getElementById("myTasksList");
const btnRefreshMyTasks = document.getElementById("btnRefreshMyTasks");

function tsToMs(ts){
  try{
    if (!ts) return null;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (ts.seconds) return (ts.seconds*1000) + Math.floor((ts.nanoseconds||0)/1e6);
  }catch(e){}
  return null;
}

function fmtRemaining(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  return `${h}س ${m}د ${sec}ث`;
}

async function loadNotifications(uid){
  if (!notifList) return;
  notifList.innerHTML = '<div style="color:#64748b">تحميل...</div>';

  try{
    const qy = query(collection(db, "notifications"), where("assignedTo","==",uid), orderBy("createdAt","desc"), limit(12));
    const snap = await getDocs(qy);

    if (!snap.size){
      notifList.innerHTML = '<div style="color:#64748b">لا يوجد إشعارات.</div>';
      return;
    }

    notifList.innerHTML = snap.docs.map(d=>{
      const n = d.data() || {};
      const seen = !!(n.read ?? n.seen);
      return `
        <article class="card" style="padding:14px;border-radius:16px; border: ${seen ? "1px solid rgba(148,163,184,.35)" : "2px solid rgba(245,158,11,.45)"}">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <div style="font-weight:800">${seen ? "📩" : "🔔"} إشعار</div>
            <button class="btn" type="button" data-notif-seen="${d.id}">${seen ? "مقروء" : "تحديد كمقروء"}</button>
          </div>
          <div style="margin-top:8px;line-height:1.9;color:#334155">${(n.title ? ("<b>"+n.title+"</b><br/>") : "") + (n.message || n.text || "")}</div>
        </article>
      `;
    }).join("");

    notifList.querySelectorAll("[data-notif-seen]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-notif-seen");
        try{
          await updateDoc(doc(db,"notifications",id), { read:true });
          loadNotifications(uid);
        }catch(e){
          console.error(e);
          toast("تعذر تحديث الإشعار.", "error");
        }
      });
    });

  }catch(e){
    console.error(e);
    notifList.innerHTML = '<div style="color:#64748b">تعذر تحميل الإشعارات.</div>';
  }
}

btnMarkNotifs?.addEventListener("click", async ()=>{
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  try{
    const qy = query(collection(db, "notifications"), where("assignedTo","==",uid), where("read","==",false));
    const snap = await getDocs(qy);
    const promises = snap.docs.map(d=> updateDoc(doc(db,"notifications",d.id), { read:true }));
    await Promise.all(promises);
    toast("تم تحديد الكل كمقروء ✅", "success");
    loadNotifications(uid);
  }catch(e){
    console.error(e);
    toast("تعذر تحديد الكل كمقروء.", "error");
  }
});

let _taskTimers = [];

function clearTaskTimers(){
  _taskTimers.forEach(t=> clearInterval(t));
  _taskTimers = [];
}

async function loadMyTasks(uid){
  if (!myTasksList) return;
  myTasksList.innerHTML = '<div style="color:#64748b">تحميل...</div>';
  clearTaskTimers();

  try{
    const qy = query(collection(db, "tasks"), where("assignedTo","==",uid), orderBy("assignedAt","desc"), limit(20));
    const snap = await getDocs(qy);

    if (!snap.size){
      myTasksList.innerHTML = '<div style="color:#64748b">لا يوجد مهام.</div>';
      return;
    }

    myTasksList.innerHTML = snap.docs.map(d=>{
      const t = d.data() || {};
      const st = String(t.status || "pending");
      const st2 = (st === "open") ? "pending" : st;
      const dur = Number(t.durationHours || 0);
      return `
        <article class="card" style="padding:14px;border-radius:16px">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <div style="font-weight:900">${t.title || "مهمة"}</div>
            <div style="color:#64748b;font-size:13px">${st2 === "pending" ? "⏳ معلّقة" : st2 === "accepted" ? "✅ جارية" : st2 === "completed" ? "🏁 مكتملة" : "⛔ انتهت"}</div>
          </div>
          ${t.details ? `<div style="margin-top:8px;line-height:1.9;color:#334155">${t.details}</div>` : ""}
          <div style="margin-top:8px;color:#64748b;line-height:1.9">
            المدة: <b>${dur}</b> ساعة
            <div id="timer-${d.id}" style="margin-top:6px; font-weight:800"></div>
          </div>

          <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap">
            ${st2 === "pending" ? `<button class="btn btn--solid" data-accept="${d.id}" type="button">موافقة وبدء العداد</button>` : ""}
            ${st2 === "accepted" ? `<button class="btn btn--solid" data-complete="${d.id}" type="button">تم التنفيذ ✅</button>` : ""}
          </div>
        </article>
      `;
    }).join("");

    // Accept
    myTasksList.querySelectorAll("[data-accept]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-accept");
        if (!id) return;
        if (!throttleAction("accept-"+id, 2000)) return;
        setLoading(true);
        try{
          const ref = doc(db,"tasks",id);
          // Read doc to compute dueAt
          const tSnap = await getDoc(ref);
          const t = tSnap.data() || {};
          const hours = Number(t.durationHours || 0);
          const due = Timestamp.fromMillis(Date.now() + Math.max(1,hours)*3600*1000);
          await updateDoc(ref, { status:"accepted", acceptedAt: serverTimestamp(), dueAt: due });

          // notification to volunteer (confirmation)
          await addDoc(collection(db,"notifications"), {
            uid,
            text: `✅ تم قبول المهمة: ${t.title || "مهمة"} — الوقت بدأ الآن.`,
            read:false,
            createdAt: serverTimestamp(),
            taskId: id,
            type:"task_accepted",
          });

          await notifyAdmins("✅ متطوع قبل مهمة", `المتطوع ${uid} قبل مهمة: ${(t.title || "مهمة")}`);
          toast("تم بدء المهمة ✅", "success");
          loadMyTasks(uid);
        }catch(e){
          console.error(e);
          toast("تعذر قبول المهمة.", "error");
        }finally{
          setLoading(false);
        }
      });
    });

    // Complete
    myTasksList.querySelectorAll("[data-complete]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-complete");
        if (!id) return;
        if (!throttleAction("complete-"+id, 2000)) return;
        setLoading(true);
        try{
          const ref = doc(db,"tasks",id);
          await updateDoc(ref, { status:"completed", completedAt: serverTimestamp(), active:false });

          await addDoc(collection(db,"notifications"), {
            uid,
            text: `🏁 تم إنهاء المهمة بنجاح.`,
            read:false,
            createdAt: serverTimestamp(),
            taskId: id,
            type:"task_completed",
          });

          await notifyAdmins("🏁 مهمة اكتملت", `المتطوع ${uid} أنهى مهمة.`);
          toast("تم إنهاء المهمة ✅", "success");
          loadMyTasks(uid);
        }catch(e){
          console.error(e);
          toast("تعذر إنهاء المهمة.", "error");
        }finally{
          setLoading(false);
        }
      });
    });

    // Timers
    snap.docs.forEach(d=>{
      const t = d.data() || {};
      const st = String(t.status || "pending");
      const st2 = (st === "open") ? "pending" : st;
      const el = document.getElementById("timer-"+d.id);
      if (!el) return;

      if (st2 === "pending") {
        el.textContent = "ابدأ بالضغط على (موافقة) لبدء الوقت.";
        el.style.color = "#b45309";
        return;
      }
      if (st2 === "completed") {
        el.textContent = "مكتملة ✅";
        el.style.color = "#065f46";
        return;
      }
      if (st2 === "expired") {
        el.textContent = "انتهت ⛔";
        el.style.color = "#7f1d1d";
        return;
      }

      const dueMs = tsToMs(t.dueAt);
      if (!dueMs){
        el.textContent = "جاري...";
        return;
      }

      const tick = ()=>{
        const now = Date.now();
        const left = dueMs - now;
        if (left <= 0){
          el.textContent = "انتهى الوقت ⛔";
          el.style.color = "#7f1d1d";
        } else {
          el.textContent = "الوقت المتبقي: " + fmtRemaining(left);
          el.style.color = "#0f172a";
        }
      };
      tick();
      const timer = setInterval(tick, 1000);
      _taskTimers.push(timer);
    });

  }catch(e){
    console.error(e);
    myTasksList.innerHTML = '<div style="color:#64748b">تعذر تحميل المهام.</div>';
  }
}

btnRefreshMyTasks?.addEventListener("click", ()=>{
  if (auth.currentUser) loadMyTasks(auth.currentUser.uid);
});

// Hook into existing auth init: after onAuthStateChanged sets user, call loads
// We'll patch by calling from onAuthStateChanged handler if possible.


async function notifyAdmins(title, message){
  try{
    // send to all admins found in users collection
    const qy = query(collection(db, "users"), where("role","in",["admin","superadmin","super_admin","superAdmin"]), where("active","==",true));
    const snap = await getDocs(qy);
    const admins = snap.docs.map(d=>({uid:d.id, ...(d.data()||{})})).filter(a=>a.uid);
    await Promise.all(admins.map(a => addDoc(collection(db,"notifications"), {
      uid: a.uid,
      title: title || "تحديث مهام",
      message: message || "",
      type: "admin_task_update",
      read: false,
      readAt: null,
      createdAt: serverTimestamp(),
    })));
  }catch(e){
    console.log("notifyAdmins err", e);
  }
}


const pointsValue = document.getElementById('pointsValue');
const rankValue = document.getElementById('rankValue');


async function loadPointsAndRank(uid){
  try{
    // Find volunteer doc linked to this user
    const qy = query(collection(db, "pixology_volunteers"), where("userUid","==",uid));
    const snap = await getDocs(qy);
    const docSnap = snap.docs[0];
    const v = docSnap ? (docSnap.data()||{}) : {};
    const myPoints = Number(v.points || 0);
    if (pointsValue) pointsValue.textContent = String(myPoints);

    // Rank: compute among Active/Certified volunteers (rules safe via existing filters on public pages; here user is signed in and reading only own doc? Actually rules allow read only Active/Certified on resource, so ranking may fail if user not Active.
    // We'll best-effort: load top volunteers by points from public list; if denied, show —
    try{
      const topQ = query(collection(db,"pixology_volunteers"), where("status","in",["Active","Certified"]), orderBy("points","desc"), limit(200));
      const topSnap = await getDocs(topQ);
      let rank = 1;
      for (const d of topSnap.docs){
        const data = d.data()||{};
        if ((data.userUid||"") === uid){ break; }
        rank++;
      }
      if (rankValue) rankValue.textContent = topSnap.size ? ("#" + rank) : "—";
    }catch(e){
      if (rankValue) rankValue.textContent = "—";
    }
  }catch(e){
    console.log("loadPointsAndRank", e);
    if (pointsValue) pointsValue.textContent = "—";
    if (rankValue) rankValue.textContent = "—";
  }
}
