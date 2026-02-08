import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { toast, setLoading, throttleAction } from "./ui.js";

// ✅ حماية الصفحة: ممنوع الدخول بدون تسجيل
onAuthStateChanged(auth, (user) => {
  if (!user) {
    toast("لازم تسجل دخول بحساب حقيقي الأول ✅");
    window.location.replace("index.html");
  }
});

import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
console.log("REGISTER PROJECT:", db.app.options.projectId);

const form = document.getElementById("regForm");
const msg = document.getElementById("msg");
const submitBtn = document.getElementById("submitBtn");

const successCard = document.getElementById("successCard");
const scName = document.getElementById("scName");
const scPhone = document.getElementById("scPhone");

const photoFileEl = document.getElementById("photoFile");

function setLoading(isLoading) {
  if (!submitBtn) return;
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "جارٍ الإرسال..." : "إرسال الطلب";
}

const norm = (v) => String(v ?? "").trim();
const digitsOnly = (s) => String(s ?? "").replace(/\D/g, "");

function showErr(text) {
  if (msg) msg.textContent = text;
}

/** ✅ تحويل الصورة إلى Base64 بعد تصغيرها لتفادي حد Firestore */
async function fileToSmallDataURL(file, maxSize = 360, quality = 0.7) {
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("❌ لازم تختار صورة (JPG/PNG)");
  }

  const maxOriginalMB = 5;
  if (file.size > maxOriginalMB * 1024 * 1024) {
    throw new Error("❌ الصورة كبيرة جدًا (أقصى 5MB)");
  }

  const url = URL.createObjectURL(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });

    let { width, height } = img;
    const ratio = Math.min(maxSize / width, maxSize / height, 1);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);

    if (dataUrl.length > 650_000) {
      return canvas.toDataURL("image/jpeg", 0.6);
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** ✅ منع تكرار الطلبات عالميًا: نفس (الدولة + الرقم) */
async function checkDuplicateByPhoneKey(phoneKey) {
  const qy = query(
    collection(db, "volunteer_requests"),
    where("phoneKey", "==", phoneKey),
    limit(5),
  );

  const snap = await getDocs(qy);
  if (snap.empty) return { exists: false };

  const found = snap.docs
    .map((d) => d.data() || {})
    .find((d) => ["Pending", "Approved"].includes(d.status));

  if (!found) return { exists: false };
  return { exists: true, status: found.status || "Pending" };
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  
  if (!throttleAction("register-submit", 4000)) { toast("استنى ثواني وجرب تاني.", "warn"); return; }
if (msg) msg.textContent = "";
  if (successCard) successCard.style.display = "none";

  const name = norm(document.getElementById("name")?.value);
  const phoneRaw = norm(document.getElementById("phone")?.value);
  const gender = norm(document.getElementById("gender")?.value);
  const joinedAt = norm(document.getElementById("joinedAt")?.value);
  const countryRaw = norm(document.getElementById("country")?.value);
  const notes = norm(document.getElementById("notes")?.value);

  // ✅ تنظيف الرقم لأي دولة
  const phoneDigits = digitsOnly(phoneRaw);

  // ✅ country key (عشان اختلاف الكتابة ما يعملش duplicates)
  const countryKey = countryRaw
    ? countryRaw.toLowerCase().replace(/\s+/g, " ").trim()
    : "unknown";

  // ✅ مفتاح عالمي لمنع التكرار
  const phoneKey = `${countryKey}:${phoneDigits}`;

  if (!name || !phoneRaw || !gender || !joinedAt) {
    showErr("❌ املأ كل الحقول المطلوبة (*)");
    return;
  }

  // ✅ Validation عالمي (مش مصر)
  // حد أدنى بسيط لأي دولة: 6 أرقام / حد أقصى: 15 (تقريبًا معيار E.164 للأرقام)
  if (phoneDigits.length < 6 || phoneDigits.length > 15) {
    showErr("❌ رقم الهاتف غير صحيح (اكتب رقم صحيح مع كود الدولة لو متاح)");
    return;
  }

  setLoading(true);

  try {
    // ✅ منع التكرار حسب الدولة + الرقم
    const dup = await checkDuplicateByPhoneKey(phoneKey);
    if (dup.exists) {
      if (dup.status === "Approved") {
        showErr(
          "✅ أنت بالفعل متطوع مُعتمد. لا يمكن إرسال طلب جديد بنفس الرقم.",
        );
      } else {
        showErr("✅ تم استلام طلبك بالفعل وهو قيد المراجعة (Pending).");
      }
      return;
    }

    const file = photoFileEl?.files?.[0] || null;
    const photoData = file ? await fileToSmallDataURL(file) : "";

    const user = auth.currentUser;
    const uid = user?.uid || "";
    const email = user?.email || "";
await addDoc(collection(db, "volunteer_requests"), {
      uid,
      email,
      name,

      // ✅ نخزن 3 أشكال
      phoneRaw, // اللي المستخدم كتبه
      phoneDigits, // الرقم بعد التنظيف
      phoneKey, // country+digits (اللي بنمنع بيه التكرار)

      gender,
      joinedAt,
      country: countryRaw,
      countryKey,

      notes,

      photoData,
      photoName: file?.name || "",
      photoType: file?.type || "",

      status: "Pending",
      organization: "Pixology Foundation",
      createdAt: serverTimestamp(),
    });


    // ✅ أنشئ/حدّث ملف المستخدم كـ Pending (لأن القبول عند الأدمن)
    if (uid) {
      await setDoc(doc(db, "users", uid), {
        email,
        displayName: name,
        role: "pending_volunteer",
        active: false,
        pending: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }


    if (msg)
      msg.textContent =
        "✅ تم إرسال الطلب. انتظر موافقة الأدمن لإصدار ID رسمي.";
    if (scName) scName.textContent = name;
    if (scPhone) scPhone.textContent = phoneRaw;
    if (successCard) successCard.style.display = "block";

    form.reset();
  } catch (err) {
    console.error(err);

    // Firestore ممكن يطلب Index بسبب (phoneKey + status in)
    // لو ظهر لك خطأ فيه رابط "Create index" ابعتهولي وهنثبته
    showErr(err?.message || "❌ حصل خطأ أثناء الإرسال (راجع Console)");
  } finally {
    setLoading(false);
  }
});

import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const btnLogout = document.getElementById("btnLogout");
btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("index.html");
});