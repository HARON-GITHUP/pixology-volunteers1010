// tasks.js
import { auth, db } from "./firebase.js";
import { toast, setLoading, throttleAction } from "./ui.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const TASKS_COL = "tasks";
const NOTI_COL = "notifications";

const taskFilter = document.getElementById("taskFilter");
const taskSearch = document.getElementById("taskSearch");
const btnRefreshTasks = document.getElementById("btnRefreshTasks");
const tasksList = document.getElementById("tasksList");

let currentUid = null;
let timers = [];

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

function clearTimers(){
  timers.forEach(t=>clearInterval(t));
  timers = [];
}

function norm(s){ return String(s||"").trim().toLowerCase(); }

function mapStatus(raw){
  const st = String(raw || "pending");
  if (st === "open") return "pending";
  return st;
}

function badge(st){
  if (st === "accepted") return "✅ جارية";
  if (st === "completed") return "🏁 مكتملة";
  if (st === "expired") return "⛔ منتهية";
  return "⏳ معلّقة";
}

async function markTaskAccepted(id){
  if (!currentUid) return;
  if (!throttleAction("accept-"+id, 2000)) return;

  setLoading(true);
  try{
    const ref = doc(db, TASKS_COL, id);
    const snap = await getDoc(ref);
    const t = snap.data() || {};
    const hours = Number(t.durationHours || 0);
    const due = Timestamp.fromMillis(Date.now() + Math.max(1,hours)*3600*1000);

    await updateDoc(ref, {
      status: "accepted",
      acceptedAt: serverTimestamp(),
      dueAt: due,
    });

    await addDoc(collection(db, NOTI_COL), {
      uid: currentUid,
      title: "تم بدء المهمة ✅",
      message: `تم قبول المهمة: ${t.title || "مهمة"} — الوقت بدأ الآن.`,
      type: "task_accepted",
      read: false,
      readAt: null,
      createdAt: serverTimestamp(),
      taskId: id,
    });

    toast("تم بدء المهمة ✅", "success");
    await loadTasks();
  }catch(e){
    console.error(e);
    toast("تعذر قبول المهمة.", "error");
  }finally{
    setLoading(false);
  }
}

async function markTaskCompleted(id){
  if (!currentUid) return;
  if (!throttleAction("complete-"+id, 2000)) return;

  setLoading(true);
  try{
    const ref = doc(db, TASKS_COL, id);
    await updateDoc(ref, {
      status: "completed",
      completedAt: serverTimestamp(),
      active: false,
    });

    await addDoc(collection(db, NOTI_COL), {
      uid: currentUid,
      title: "تم إنهاء المهمة 🏁",
      message: "تم إنهاء المهمة بنجاح.",
      type: "task_completed",
      read: false,
      readAt: null,
      createdAt: serverTimestamp(),
      taskId: id,
    });

    toast("تم إنهاء المهمة ✅", "success");
    await loadTasks();
  }catch(e){
    console.error(e);
    toast("تعذر إنهاء المهمة.", "error");
  }finally{
    setLoading(false);
  }
}

async function loadTasks(){
  if (!tasksList) return;
  tasksList.innerHTML = '<div style="color:#64748b">تحميل...</div>';
  clearTimers();

  if (!currentUid) return;

  try{
    const qy = query(collection(db, TASKS_COL), where("assignedTo","==",currentUid), orderBy("createdAt","desc"), limit(50));
    const snap = await getDocs(qy);

    const filter = String(taskFilter?.value || "");
    const q = norm(taskSearch?.value || "");

    const tasks = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const filtered = tasks.filter(t=>{
      const st = mapStatus(t.status);
      const okSt = filter ? st === filter : true;
      const okQ = q ? (norm(t.title).includes(q) || norm(t.details).includes(q)) : true;
      return okSt && okQ;
    });

    if (!filtered.length){
      tasksList.innerHTML = '<div style="color:#64748b">لا يوجد مهام مطابقة.</div>';
      return;
    }

    tasksList.innerHTML = filtered.map(t=>{
      const st = mapStatus(t.status);
      const dur = Number(t.durationHours || 0);
      return `
        <article class="card" style="padding:14px;border-radius:16px">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <div style="font-weight:900">${t.title || "مهمة"}</div>
            <div style="color:#64748b;font-size:13px">${badge(st)}</div>
          </div>
          ${t.details ? `<div style="margin-top:8px;line-height:1.9;color:#334155">${t.details}</div>` : ""}
          <div style="margin-top:8px;color:#64748b;line-height:1.9">
            المدة: <b>${dur}</b> ساعة
            <div id="timer-${t.id}" style="margin-top:6px; font-weight:800"></div>
          </div>

          <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap">
            ${st === "pending" ? `<button class="btn btn--solid" data-accept="${t.id}" type="button">موافقة وبدء العداد</button>` : ""}
            ${st === "accepted" ? `<button class="btn btn--solid" data-complete="${t.id}" type="button">تم التنفيذ ✅</button>` : ""}
          </div>
        </article>
      `;
    }).join("");

    tasksList.querySelectorAll("[data-accept]").forEach(btn=>{
      btn.addEventListener("click", ()=> markTaskAccepted(btn.getAttribute("data-accept")));
    });
    tasksList.querySelectorAll("[data-complete]").forEach(btn=>{
      btn.addEventListener("click", ()=> markTaskCompleted(btn.getAttribute("data-complete")));
    });

    // Timers
    filtered.forEach(t=>{
      const st = mapStatus(t.status);
      const el = document.getElementById("timer-"+t.id);
      if (!el) return;

      if (st === "pending") {
        el.textContent = "ابدأ بالضغط على (موافقة) لبدء الوقت.";
        el.style.color = "#b45309";
        return;
      }
      if (st === "completed") {
        el.textContent = "مكتملة ✅";
        el.style.color = "#065f46";
        return;
      }
      if (st === "expired") {
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
        const left = dueMs - Date.now();
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
      timers.push(timer);
    });

  }catch(e){
    console.error(e);
    tasksList.innerHTML = '<div style="color:#64748b">تعذر تحميل المهام.</div>';
    toast("تعذر تحميل المهام.", "error");
  }
}

btnRefreshTasks?.addEventListener("click", loadTasks);
taskFilter?.addEventListener("change", loadTasks);
taskSearch?.addEventListener("input", loadTasks);

// Auth
onAuthStateChanged(auth, (user)=>{
  if (!user){
    toast("لازم تسجّل دخول الأول.", "warn");
    setTimeout(()=> location.href="register.html", 500);
    return;
  }
  currentUid = user.uid;
  loadTasks();
});
