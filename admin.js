guardAuth({ redirectTo: 'register.html', message: 'لازم تسجّل دخول كإدمن عشان تفتح لوحة التحكم.' });
// admin.js (FULL CLEAN VERSION)
import { auth, db } from "./firebase.js";
import { toast, setLoading, guardAuth } from "./ui.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  runTransaction,
  deleteDoc,
  setDoc,
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

console.log("PROJECT:", db.app.options.projectId);

/** ========== Collections ========== */
const REQ_COL = "volunteer_requests";
const VOL_COL = "pixology_volunteers";
const COUNTERS_COL = "counters";
const NOTI_COL = "notifications";
const TASKS_COL = "tasks";
const AUDIT_COL = "audit_logs";


/** ========== DOM ========== */
const loginBox = document.getElementById("loginBox");
const dataBox = document.getElementById("dataBox");

const reqRowsEl = document.getElementById("reqRows");
const rowsEl = document.getElementById("rows");

const searchEl = document.getElementById("search");
const filterStatusEl = document.getElementById("filterStage");
const exportBtn = document.getElementById("exportCsv");
const logoutBtn = document.getElementById("logout");

const loginBtn = document.getElementById("login");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginMsg = document.getElementById("loginMsg");

const toastEl = document.getElementById("toast");

const selectAll = document.getElementById("selectAll");
const deleteSelectedBtn = document.getElementById("deleteSelected");
const clearSelectionBtn = document.getElementById("clearSelection");

/** ===== Manual Add (Step 2) DOM ===== */
const mName = document.getElementById("mName");
const mPhone = document.getElementById("mPhone");
const mGender = document.getElementById("mGender");
const mJoinedAt = document.getElementById("mJoinedAt");
const mCountry = document.getElementById("mCountry");
const mNotes = document.getElementById("mNotes");
const mPhoto = document.getElementById("mPhoto");
const mAddBtn = document.getElementById("mAddBtn");
const mMsg = document.getElementById("mMsg");

/** ========== State ========== */
let volunteers = [];
let unsubVols = null;
let unsubReqs = null;

let ADMIN_OK = false;
let CURRENT_ROLE = null;

/** ========== Helpers ========== */
const norm = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

const digitsOnly = (s) => String(s ?? "").replace(/\D/g, "");

function setControlsEnabled(enabled) {
  if (searchEl) searchEl.disabled = !enabled;
  if (filterStatusEl) filterStatusEl.disabled = !enabled;
  if (exportBtn) exportBtn.disabled = !enabled;
  if (logoutBtn) logoutBtn.disabled = !enabled;

  if (selectAll) selectAll.disabled = !enabled;
  if (deleteSelectedBtn) deleteSelectedBtn.disabled = !enabled;
  if (clearSelectionBtn) clearSelectionBtn.disabled = !enabled;

  if (mAddBtn) mAddBtn.disabled = !enabled;
  if (mName) mName.disabled = !enabled;
  if (mPhone) mPhone.disabled = !enabled;
  if (mGender) mGender.disabled = !enabled;
  if (mJoinedAt) mJoinedAt.disabled = !enabled;
  if (mCountry) mCountry.disabled = !enabled;
  if (mNotes) mNotes.disabled = !enabled;
  if (mPhoto) mPhoto.disabled = !enabled;
}

function showToast(text, sub = "") {
  if (!toastEl) return;
  toastEl.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ""}`;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 4500);
}

function safeAttr(str) {
  return String(str ?? "").replaceAll('"', "&quot;");
}

function getSelectedIds() {
  return Array.from(document.querySelectorAll(".rowCheck:checked"))
    .map((c) => c.dataset.id)
    .filter(Boolean);
}

function setMiniMsg(text = "") {
  if (!mMsg) return;
  mMsg.textContent = text;
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}


/** ✅ Audit Log */
async function auditLog(action, payload = {}) {
  try {
    await addDoc(collection(db, AUDIT_COL), {
      action: String(action || "action"),
      payload: payload || {},
      actorUid: auth.currentUser?.uid || "",
      actorRole: String(CURRENT_ROLE || ""),
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.log("auditLog error:", e);
  }
}

/** ✅ Notification */
async function pushNotification(assignedTo: uid,
      title, message, type = "info") {
  try {
    if (!uid) return;
    await addDoc(collection(db, NOTI_COL), {
      assignedTo: uid,
      title: String(title || "إشعار"),
      message: String(message || ""),
      type: String(type || "info"),
      read: false,
      readAt: null,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.log("pushNotification error:", e);
  }
}

/** ✅ Task */
async function createTaskFor(
  assignedTo: uid,
      title,
  details = "",
  priority = "normal",
  dueAt = null,
) {
  try {
    if (!uid) return;
    await addDoc(collection(db, TASKS_COL), {
      assignedTo: assignedTo: uid,
      title: String(title || "Task"),
      details: String(details || ""),
      priority: String(priority || "normal"),
      status: "open",
      createdBy: auth.currentUser?.uid || "",
      createdAt: serverTimestamp(),
      dueAt: dueAt || null,
      seen: false,
      seenAt: null,
    });
  } catch (e) {
    console.log("createTaskFor error:", e);
  }
}

/** ✅ تحقق Role من users/{uid} */
async function checkAdmin(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return { ok: false, role: null };

    const data = snap.data() || {};
    const role = String(data.role || "").trim();
    const active = data.active === true;

    const allowedRoles = ["admin", "super_admin", "superadmin"];
    const ok = active && allowedRoles.includes(role);

    return { ok, role: ok ? role : null };
  } catch (e) {
    console.error("checkAdmin error:", e);
    return { ok: false, role: null };
  }
}

/** ========== Render Volunteers Table ========== */
function renderVolunteersTable() {
  if (!rowsEl) return;

  const q = norm(searchEl?.value || "");
  const status = (filterStatusEl?.value || "").trim();

  const filtered = volunteers.filter((d) => {
    const hit =
      norm(d.name).includes(q) ||
      norm(d.volunteerId).includes(q) ||
      norm(d.phone).includes(q);

    const statusOk = status ? d.status === status : true;
    return (q ? hit : true) && statusOk;
  });

  if (!filtered.length) {
    rowsEl.innerHTML = `
      <tr>
        <td colspan="12" style="text-align:center; padding:18px; color:#6b7280; font-weight:700;">
          لا توجد بيانات حتى الآن
        </td>
      </tr>`;
    return;
  }

  rowsEl.innerHTML = filtered
    .map(
      (d) => `
      <tr data-docid="${d._docId}">
        <td><input class="rowCheck" type="checkbox" data-id="${d._docId}" /></td>
        <td>${d.createdAtText || ""}</td>

        <td>
          ${
            d.photoData
              ? `<img src="${safeAttr(
                  d.photoData,
                )}" alt="photo" style="width:40px;height:40px;border-radius:12px;object-fit:cover;border:1px solid rgba(0,0,0,.08)" />`
              : `<span style="color:#94a3b8">—</span>`
          }
        </td>

        <td>${d.name || ""}</td>
        <td>${d.volunteerId || ""}</td>
        <td>${d.phone || ""}</td>
        <td>${d.gender || ""}</td>
        <td>${d.joinedAt || ""}</td>

        <td><input class="mini" type="number" min="0" value="${
          d.hours ?? 0
        }" data-field="hours" /></td>

        <td>
          <select class="mini" data-field="status">
            <option value="Active" ${d.status === "Active" ? "selected" : ""}>Active</option>
            <option value="Inactive" ${d.status === "Inactive" ? "selected" : ""}>Inactive</option>
            <option value="Certified" ${d.status === "Certified" ? "selected" : ""}>Certified</option>
          </select>
        </td>

        <td><input class="mini" type="text" value="${safeAttr(
          d.notes || "",
        )}" data-field="notes" /></td>

        <td style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="miniBtn" data-action="save">حفظ</button>
          <button class="miniBtn" data-action="issueCert">إصدار شهادة</button>
          <button class="miniBtn" data-action="task">تاسك</button>
          <a class="miniBtn" style="text-decoration:none; display:inline-block;"
             href="certificate.html?id=${encodeURIComponent(
               d.volunteerId || d._docId,
             )}"
             target="_blank">عرض</a>
        </td>
      </tr>
    `,
    )
    .join("");
}

function toCsv(docs) {
  const headers = [
    "createdAtText",
    "name",
    "volunteerId",
    "phone",
    "gender",
    "joinedAt",
    "hours",
    "status",
    "notes",
    "country",
  ];
  const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = [
    headers.join(","),
    ...docs.map((d) => headers.map((h) => escape(d[h])).join(",")),
  ];
  return lines.join("\n");
}

/** توليد Volunteer ID تلقائي */
async function generateVolunteerId() {
  const counterRef = doc(db, COUNTERS_COL, "volunteers");
  const nextNumber = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().value || 0 : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
  return `VOL-${String(nextNumber).padStart(6, "0")}`;
}

async function generateCertificateId() {
  const counterRef = doc(db, COUNTERS_COL, "certificates");
  const nextNumber = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().value || 0 : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
  return `CERT-${String(nextNumber).padStart(6, "0")}`;
}

/** ✅ إضافة متطوع يدويًا */
mAddBtn?.addEventListener("click", async () => {
  if (!ADMIN_OK) return toast("❌ غير مسموح");

  const name = (mName?.value || "").trim();
  const phone = digitsOnly(mPhone?.value || "");
  const gender = (mGender?.value || "").trim();
  const joinedAt = (mJoinedAt?.value || "").trim();
  const country = (mCountry?.value || "").trim();
  const notes = (mNotes?.value || "").trim();

  if (!name || !phone) {
    setMiniMsg("❌ الاسم ورقم الهاتف مطلوبين");
    return;
  }

  mAddBtn.disabled = true;
  setMiniMsg("جارٍ الإضافة...");

  try {
    let photoData = "";
    const f = mPhoto?.files?.[0];
    if (f) photoData = await fileToDataURL(f);

    const volunteerId = await generateVolunteerId();

    await setDoc(doc(db, VOL_COL, volunteerId), {
      name,
      volunteerId,
      phone,
      gender,
      joinedAt,
      hours: 0,
      status: "Active",
      photoData,
      notes,
      country,
      organization: "Pixology Foundation",
      createdAt: serverTimestamp(),
      addedManually: true,
      addedByUid: auth.currentUser?.uid || "",
      userUid: "",
    });

    showToast("✅ تمت الإضافة", `ID: ${volunteerId}`);
    setMiniMsg(`✅ تم — ${volunteerId}`);

    if (mName) mName.value = "";
    if (mPhone) mPhone.value = "";
    if (mGender) mGender.value = "";
    if (mJoinedAt) mJoinedAt.value = "";
    if (mCountry) mCountry.value = "";
    if (mNotes) mNotes.value = "";
    if (mPhoto) mPhoto.value = "";
  } catch (e) {
    console.error(e);
    setMiniMsg("❌ حصل خطأ أثناء الإضافة");
  } finally {
    mAddBtn.disabled = false;
  }
});

/** ========== Requests Table ========== */
function renderRequests(reqDocs) {
  if (!reqRowsEl) return;

  if (!reqDocs.length) {
    reqRowsEl.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:18px; color:#6b7280; font-weight:700;">
          لا توجد طلبات Pending
        </td>
      </tr>`;
    return;
  }

  reqRowsEl.innerHTML = reqDocs
    .map((r) => {
      const t = r.createdAtText || "";
      const country = r.country || "";
      const safeNotes = String(r.notes || "")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      return `
        <tr data-reqid="${r._docId}">
          <td>${t}</td>
          <td>${r.name || ""}</td>
          <td>${r.phone || ""}</td>
          <td>${r.gender || ""}</td>
          <td>${r.joinedAt || ""}</td>
          <td>${country}</td>
          <td>${safeNotes}</td>
          <td>
            <button class="miniBtn" data-action="approve">موافقة</button>
            <button class="miniBtn" data-action="reject">رفض</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

/** ✅✅ أزرار طلبات التطوع (approve / reject) */
reqRowsEl?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  if (action !== "approve" && action !== "reject") return;

  if (!ADMIN_OK) return toast("❌ غير مسموح");

  const row = btn.closest("tr");
  const reqId = row?.dataset?.reqid;
  if (!reqId) return;

  btn.disabled = true;

  let requestUid = "";
  let requestName = "";
  try {
    const snap = await getDoc(doc(db, REQ_COL, reqId));
    if (snap.exists()) {
      const r = snap.data() || {};
      requestUid = r.uid || r.userUid || "";
      requestName = r.name || "";
    }
  } catch {}

  try {
    if (action === "approve") {
      await runTransaction(db, async (tx) => {
        const reqRef = doc(db, REQ_COL, reqId);
        const reqSnap = await tx.get(reqRef);
        if (!reqSnap.exists()) throw new Error("Request not found");

        const r = reqSnap.data() || {};
        const currentStatus = String(r.status || "Pending").trim();
        if (currentStatus !== "Pending") return;

        const volunteerId = await generateVolunteerId();
        const volRef = doc(db, VOL_COL, volunteerId);

        tx.set(volRef, {
          name: r.name || "",
          volunteerId,
          phone: r.phone || r.phoneRaw || "",
          gender: r.gender || "",
          joinedAt: r.joinedAt || "",
          country: r.country || "مصر",
          notes: r.notes || "",
          photoData: r.photoData || r.photoUrl || "",
          hours: 0,
          status: "Active",
          organization: "Pixology Foundation",
          createdAt: serverTimestamp(),
          createdFromRequest: true,
          requestId: reqId,
          approvedByUid: auth.currentUser?.uid || "",
          userUid: r.uid || r.userUid || "",
        });

        tx.update(reqRef, {
          status: "Approved",
          volunteerId,
          approvedAt: serverTimestamp(),
          approvedByUid: auth.currentUser?.uid || "",
        });
      });

      showToast("✅ تم قبول الطلب");
      await auditLog("request_approved", { reqId, requestUid, requestName });

      if (requestUid) {
        await pushNotification(
          requestUid,
          "تم قبولك ✅",
          `تم قبول طلب التطوع الخاص بك${requestName ? ` يا ${requestName}` : ""}.`,
          "success",
        );

        await createTaskFor(
          requestUid,
          "استكمال بيانات الملف الشخصي",
          "افتح ملفك الشخصي وتأكد من البيانات (الصورة / الاسم / أي معلومات ناقصة).",
          "normal",
        );
      }
    } else {
      await updateDoc(doc(db, REQ_COL, reqId), {
        status: "Rejected",
        rejectedAt: serverTimestamp(),
        rejectedByUid: auth.currentUser?.uid || "",
      });

      showToast("✅ تم رفض الطلب");
      await auditLog("request_rejected", { reqId, requestUid, requestName });

      if (requestUid) {
        await pushNotification(
          requestUid,
          "تم رفض الطلب ❌",
          "تم رفض طلب التطوع الخاص بك. يمكنكم إعادة التقديم مرة أخرى.",
          "warning",
        );
      }
    }
  } catch (err) {
    console.error(err);
    toast("❌ حصل خطأ: " + (err?.message || err));
  } finally {
    btn.disabled = false;
  }
});

/** ✅ أزرار جدول المتطوعين (save / issueCert / task) */
rowsEl?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  const row = btn.closest("tr");
  const docId = row?.dataset?.docid;
  if (!docId) return;

  const vRef = doc(db, VOL_COL, docId);

  if (action === "save") {
    const hoursInput = row.querySelector("input[data-field='hours']");
    const statusSelect = row.querySelector("select[data-field='status']");
    const notesInput = row.querySelector("input[data-field='notes']");

    const newHours = Number(hoursInput?.value || 0);
    const newStatus = (statusSelect?.value || "Active").trim();
    const newNotes = (notesInput?.value || "").trim();

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "جارٍ الحفظ...";

    try {
      let oldHours = null;
      let oldStatus = null;
      let userUid = "";
      let volunteerName = "";
      try {
        const snap = await getDoc(vRef);
        if (snap.exists()) {
          const v = snap.data() || {};
          oldHours = Number(v.hours ?? 0);
          oldStatus = String(v.status || "");
          userUid = v.userUid || v.uid || "";
          volunteerName = v.name || "";
        }
      } catch {}

      await updateDoc(vRef, {
        hours: Number.isFinite(newHours) ? newHours : 0,
        status: newStatus,
        notes: newNotes,
        updatedAt: serverTimestamp(),
      });

      if (userUid) {
        if (oldHours !== null && Number(oldHours) !== Number(newHours)) {
          await pushNotification(
            userUid,
            "تم تحديث ساعاتك ⏱️",
            `تم تحديث ساعات التطوع الخاصة بك${
              volunteerName ? ` (${volunteerName})` : ""
            } إلى: ${Number(newHours)} ساعة.`,
            "info",
          );
        }

        if (oldStatus !== null && String(oldStatus) !== String(newStatus)) {
          await pushNotification(
            userUid,
            "تم تحديث حالتك ✅",
            `تم تغيير حالتك إلى: ${newStatus}`,
            "info",
          );
        }
      }

      await auditLog("volunteer_updated", { docId, newHours, newStatus });

      btn.textContent = "✅ تم";
      setTimeout(() => {
        btn.textContent = old || "حفظ";
        btn.disabled = false;
      }, 700);
    } catch (err) {
      console.error(err);
      btn.textContent = "❌ فشل";
      setTimeout(() => {
        btn.textContent = old || "حفظ";
        btn.disabled = false;
      }, 900);
    }
    return;
  }

  if (action === "issueCert") {
    if (!ADMIN_OK) return toast("❌ غير مسموح");

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "جارٍ الإصدار...";

    try {
      const vSnap = await getDoc(vRef);
      if (!vSnap.exists()) {
        toast("❌ المتطوع غير موجود");
        return;
      }

      const v = vSnap.data() || {};
      const status = String(v.status || "Active")
        .trim()
        .toLowerCase();

      if (status === "inactive") {
        toast("❌ لا يمكن إصدار شهادة لمتطوع Inactive");
        return;
      }

      const certId = await generateCertificateId();

      await setDoc(doc(db, "certificates", certId), {
        certId,
        volunteerDocId: docId,
        volunteerId: v.volunteerId || docId,
        name: v.name || "",
        hoursAtIssue: Number(v.hours || 0),
        statusAtIssue: v.status || "Active",
        joinedAt: v.joinedAt || "",
        country: v.country || "",
        organization: v.organization || "Pixology Foundation",
        issuedAt: serverTimestamp(),
        issuedByUid: auth.currentUser?.uid || "",
      });

      await auditLog("certificate_issued", { docId, certId });
      showToast("✅ تم إصدار شهادة", certId);
      window.open(
        `certificate.html?cert=${encodeURIComponent(certId)}`,
        "_blank",
      );

      const userUid = v.userUid || v.uid || "";
      if (userUid) {
        await pushNotification(
          userUid,
          "تم إصدار شهادتك 🎓",
          `تم إصدار شهادة لك. رقم الشهادة: ${certId}`,
          "success",
        );
      }
    } catch (err) {
      console.error(err);
      toast("❌ حصل خطأ أثناء إصدار الشهادة");
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
    return;
  }

  if (action === "task") {
    if (!ADMIN_OK) return toast("❌ غير مسموح");

    let userUid = "";
    let vName = "";
    let vId = "";
    try {
      const snap = await getDoc(vRef);
      if (snap.exists()) {
        const v = snap.data() || {};
        userUid = v.userUid || v.uid || "";
        vName = v.name || "";
        vId = v.volunteerId || docId;
      }
    } catch {}

    if (!userUid) {
      toast("❌ لا يوجد userUid لهذا المتطوع.");
      return;
    }

    const title = prompt("عنوان التاسك:", "مطلوب تنفيذ مهمة");
    if (!title) return;

    const details = prompt("تفاصيل التاسك:", `متطوع: ${vName} (${vId})`) || "";
    const priority =
      prompt("الأولوية (low / normal / high):", "normal") || "normal";

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "جارٍ...";

    try {
      await createTaskFor(userUid, title, details, priority);

      await pushNotification(
        userUid,
        "لديك مهمة جديدة ✅",
        `${title}${details ? ` — ${details}` : ""}`,
        "info",
      );

      await auditLog("task_created", { assignedTo: userUid, title, priority });
      showToast("✅ تم إنشاء تاسك", vName || "");
    } catch (e) {
      console.log(e);
      toast("❌ فشل إنشاء التاسك");
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }
});

/** ✅ تحديد الكل */
selectAll?.addEventListener("change", () => {
  const checks = document.querySelectorAll(".rowCheck");
  checks.forEach((c) => (c.checked = selectAll.checked));
});

/** ✅ إلغاء التحديد */
clearSelectionBtn?.addEventListener("click", () => {
  document.querySelectorAll(".rowCheck").forEach((c) => (c.checked = false));
  if (selectAll) selectAll.checked = false;
});

/** ✅ مسح المحدد */
deleteSelectedBtn?.addEventListener("click", async () => {
  const ids = getSelectedIds();
  if (!ids.length) return toast("اختار متطوعين الأول ✅");

  const ok = confirm(`تأكيد مسح ${ids.length} متطوع؟`);
  if (!ok) return;

  deleteSelectedBtn.disabled = true;
  deleteSelectedBtn.textContent = "جارٍ المسح...";

  try {
    for (const id of ids) {
      await deleteDoc(doc(db, VOL_COL, id));
    }
    toast("✅ تم مسح المحدد");
  } catch (e) {
    console.error(e);
    toast("❌ حصل خطأ أثناء المسح");
  } finally {
    deleteSelectedBtn.disabled = false;
    deleteSelectedBtn.textContent = "🗑️ مسح المحدد";
  }
});

/** تصدير CSV */
exportBtn?.addEventListener("click", () => {
  const csv = toCsv(volunteers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "pixology_volunteers.csv";
  a.click();
  URL.revokeObjectURL(url);
});

searchEl?.addEventListener("input", renderVolunteersTable);
filterStatusEl?.addEventListener("change", renderVolunteersTable);

passEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn?.click();
});

loginBtn?.addEventListener("click", async () => {
  const email = (emailEl?.value || "").trim();
  const pass = (passEl?.value || "").trim();
  if (loginMsg) loginMsg.textContent = "";

  if (!email || !pass) {
    if (loginMsg) loginMsg.textContent = "❌ اكتب الإيميل والباسورد";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch {
    if (loginMsg) loginMsg.textContent = "❌ بيانات الدخول غلط";
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

/** ========== Listeners control ========== */
function stopListeners() {
  if (unsubReqs) {
    unsubReqs();
    unsubReqs = null;
  }
  if (unsubVols) {
    unsubVols();
    unsubVols = null;
  }
}

function startListeners() {
  // Requests
  const reqQ = query(collection(db, REQ_COL), orderBy("createdAt", "desc"));
  unsubReqs = onSnapshot(reqQ, (snap) => {
    const reqDocs = snap.docs
      .map((s) => {
        const d = s.data() || {};
        const t = d.createdAt?.toDate ? d.createdAt.toDate() : null;
        return {
          _docId: s.id,
          assignedTo: d.uid || d.userUid || "",
          name: d.name || "",
          phone: d.phone || d.phoneRaw || "",
          gender: d.gender || "",
          joinedAt: d.joinedAt || "",
          country: d.country || "",
          notes: d.notes || "",
          status: d.status || "Pending",
          createdAtText: t ? t.toLocaleString("ar-EG") : "",
        };
      })
      .filter((x) => x.status === "Pending");

    renderRequests(reqDocs);
  });

  // Volunteers
  const volQ = query(collection(db, VOL_COL), orderBy("createdAt", "desc"));
  unsubVols = onSnapshot(volQ, (snap) => {
    volunteers = snap.docs.map((docSnap) => {
      const d = docSnap.data() || {};
      const t = d.createdAt?.toDate ? d.createdAt.toDate() : null;

      return {
        _docId: docSnap.id,
        userUid: d.userUid || d.uid || "",
        name: d.name || "",
        volunteerId: d.volunteerId || docSnap.id,
        phone: d.phone || "",
        gender: d.gender || "",
        joinedAt: d.joinedAt || "",
        hours: Number(d.hours || 0),
        status: d.status || "Active",
        notes: d.notes || "",
        country: d.country || "",
        photoData: d.photoData || "",
        createdAtText: t ? t.toLocaleString("ar-EG") : "",
      };
    });

    renderVolunteersTable();
  });
}

/** ========== Auth state ========== */
onAuthStateChanged(auth, async (user) => {
  stopListeners();

  ADMIN_OK = false;
  CURRENT_ROLE = null;

  if (!user) {
    if (loginBox) loginBox.style.display = "block";
    if (dataBox) dataBox.style.display = "none";
    setControlsEnabled(false);

    volunteers = [];
    renderVolunteersTable();
    if (reqRowsEl) reqRowsEl.innerHTML = "";
    setMiniMsg("");
    return;
  }

  const res = await checkAdmin(user);
  ADMIN_OK = res.ok;
  CURRENT_ROLE = res.role;

  localStorage.setItem("role", CURRENT_ROLE || "");

  if (!res.ok) {
    if (loginMsg) loginMsg.textContent = "❌ الحساب ده مش أدمن";
    await signOut(auth);
    return;
  }

  const goSuper = document.getElementById("goSuper");
  const isSuper =
    CURRENT_ROLE === "super_admin" || CURRENT_ROLE === "superadmin";
  if (goSuper) goSuper.style.display = isSuper ? "inline-block" : "none";

  if (loginBox) loginBox.style.display = "none";
  if (dataBox) dataBox.style.display = "block";
  setControlsEnabled(true);

  startListeners();
});

setControlsEnabled(false);
renderVolunteersTable();


/* =========================
   TASKS (Admin assigns to a specific volunteer)
   Collections:
   - volunteer_tasks: each doc = one task assignment to a user
   - notifications: push message to that user
========================= */
const taskVolunteer = document.getElementById("taskVolunteer");
const taskTitle = document.getElementById("taskTitle");
const taskDesc = document.getElementById("taskDesc");
const taskHours = document.getElementById("taskHours");
const btnCreateTask = document.getElementById("btnCreateTask");
const btnRefreshTasks = document.getElementById("btnRefreshTasks");
const adminTasksList = document.getElementById("adminTasksList");

function safeNum(v, d=0){
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

async function loadVolunteersForTasks(){
  if (!taskVolunteer) return;
  taskVolunteer.innerHTML = '<option value="">تحميل المتطوعين...</option>';

  try{
    // Prefer pixology_volunteers collection (approved volunteers)
    const snap = await getDocs(collection(db, "pixology_volunteers"));
    const items = snap.docs.map(d => {
      const data = d.data() || {};
      const uid = data.userUid || data.uid || "";
      const name = data.name || data.fullName || data.email || uid;
      return { assignedTo: uid,
      name, email: data.email || "" };
    }).filter(x => x.uid);

    if (!items.length){
      taskVolunteer.innerHTML = '<option value="">لا يوجد متطوعين بعد</option>';
      return;
    }

    taskVolunteer.innerHTML = '<option value="">— اختار متطوع —</option>' + items
      .sort((a,b)=> String(a.name).localeCompare(String(b.name), "ar"))
      .map(v => `<option value="${v.uid}">${v.name}${v.email ? " • "+v.email : ""}</option>`)
      .join("");
  }catch(e){
    console.error(e);
    taskVolunteer.innerHTML = '<option value="">تعذر تحميل المتطوعين</option>';
    toast("تعذر تحميل قائمة المتطوعين.", "error");
  }
}

async function createTaskForVolunteer(){
  const uid = taskVolunteer?.value?.trim();
  const title = taskTitle?.value?.trim();
  const desc = taskDesc?.value?.trim();
  const hours = safeNum(taskHours?.value, 5);

  if (!uid) return toast("اختار المتطوع.", "warn");
  if (!title) return toast("اكتب عنوان المهمة.", "warn");
  if (hours < 1) return toast("المدة لازم تكون ساعة أو أكثر.", "warn");

  setLoading(true);
  try{
    // Create task assignment
    const taskDoc = {
      assignedTo: uid,
      title,
      description: desc || "",
      durationHours: hours,
      status: "pending",       // pending -> accepted -> completed/expired
      assignedAt: serverTimestamp(),
      acceptedAt: null,
      dueAt: null,
      completedAt: null,
      createdBy: auth?.currentUser?.uid || null,
      active: true,
    };
    const ref = await addDoc(collection(db, "tasks"), taskDoc);

    // Notification to volunteer
    await addDoc(collection(db, "notifications"), {
      assignedTo: uid,
      text: `📌 مهمة جديدة: ${title} (المدة: ${hours} ساعة)`,
      link: `my-profile.html#tasks`,
      seen: false,
      createdAt: serverTimestamp(),
      taskId: ref.id,
      type: "task_assigned",
    });

    toast("تم إرسال المهمة للمتطوع ✅", "success");
    taskTitle.value = "";
    taskDesc.value = "";
    taskHours.value = "5";
    await loadRecentTasks();
  }catch(e){
    console.error(e);
    toast("حصل خطأ أثناء إرسال المهمة.", "error");
  }finally{
    setLoading(false);
  }
}

function taskStatusBadge(status){
  const s = String(status || "pending");
  if (s === "accepted") return "✅ مقبولة";
  if (s === "completed") return "🏁 مكتملة";
  if (s === "expired") return "⛔ انتهت";
  return "⏳ معلّقة";
}

async function loadRecentTasks(){
  if (!adminTasksList) return;
  adminTasksList.innerHTML = '<div style="color:#64748b">تحميل...</div>';

  try{
    const qy = query(collection(db, "tasks"), orderBy("assignedAt", "desc"), limit(12));
    const snap = await getDocs(qy);
    if (!snap.size){
      adminTasksList.innerHTML = '<div style="color:#64748b">لا يوجد مهام بعد.</div>';
      return;
    }

    adminTasksList.innerHTML = snap.docs.map(d => {
      const t = d.data() || {};
      return `
        <article class="card" style="padding:14px;border-radius:16px">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <div style="font-weight:800">${t.title || "مهمة"}</div>
            <div style="color:#64748b;font-size:13px">${taskStatusBadge(t.status)}</div>
          </div>
          <div style="color:#64748b;margin-top:8px;line-height:1.8">
            للمتطوع: <b>${t.assignedTo || "—"}</b><br/>
            مدة: <b>${safeNum(t.durationHours,0)}</b> ساعة
          </div>
          ${t.description ? `<div style="margin-top:8px;line-height:1.8">${t.description}</div>` : ""}
          <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" data-task-del="${d.id}" type="button">إلغاء</button>
          </div>
        </article>
      `;
    }).join("");

    // Delete button (soft cancel)
    adminTasksList.querySelectorAll("[data-task-del]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-task-del");
        if (!id) return;
        try{
          await updateDoc(doc(db, "tasks", id), { active:false, status:"expired" });
          toast("تم إلغاء المهمة.", "success");
          loadRecentTasks();
        }catch(e){
          console.error(e);
          toast("تعذر إلغاء المهمة.", "error");
        }
      });
    });

  }catch(e){
    console.error(e);
    adminTasksList.innerHTML = '<div style="color:#64748b">تعذر تحميل المهام.</div>';
  }
}

btnCreateTask?.addEventListener("click", createTaskForVolunteer);
btnRefreshTasks?.addEventListener("click", loadRecentTasks);

// init (best effort)
loadVolunteersForTasks();
loadRecentTasks();
