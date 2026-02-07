import { auth, db } from "./firebase.js";
import { toast, setLoading } from "./ui.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, query, orderBy, limit, getDocs, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const EVENTS_COL="events";
const REG_COL="event_registrations";
const eventsList=document.getElementById("eventsList");

const evTitle=document.getElementById("evTitle");
const evPlace=document.getElementById("evPlace");
const evDate=document.getElementById("evDate");
const evHours=document.getElementById("evHours");
const evPoints=document.getElementById("evPoints");
const evDesc=document.getElementById("evDesc");
const btnCreateEvent=document.getElementById("btnCreateEvent");

let currentUser=null;

async function isAdmin(uid){
  try{
    const s=await getDoc(doc(db,"users",uid));
    if(!s.exists()) return false;
    const u=s.data()||{};
    const role=String(u.role||"");
    return u.active===true && ["admin","superadmin","super_admin","superAdmin"].includes(role);
  }catch(e){ return false; }
}

async function loadEvents(){
  if(!eventsList) return;
  eventsList.innerHTML='<div style="color:#64748b">تحميل...</div>';
  try{
    const qy=query(collection(db,EVENTS_COL), orderBy("date","asc"), limit(50));
    const snap=await getDocs(qy);
    const events=snap.docs.map(d=>({id:d.id, ...(d.data()||{})}));
    if(!events.length){ eventsList.innerHTML='<div style="color:#64748b">لا يوجد فعاليات الآن.</div>'; return; }
    eventsList.innerHTML=events.map(ev=>`
      <article class="card" style="padding:14px;border-radius:16px">
        <div style="font-weight:950">${ev.title||"فعالية"}</div>
        <div style="margin-top:8px;color:#64748b;line-height:1.9">
          📍 ${ev.place||"—"}<br/>📅 ${ev.date||"—"}<br/>⏱️ ${Number(ev.hours||0)} ساعة — ⭐ ${Number(ev.points||0)} نقطة
        </div>
        ${ev.desc?`<div style="margin-top:8px;line-height:1.9">${ev.desc}</div>`:""}
        <div style="margin-top:10px"><button class="btn btn--solid" data-reg="${ev.id}" type="button">تسجيل حضور</button></div>
        <div style="color:#64748b;margin-top:8px;font-size:13px">* اعتماد النقاط من الأدمن.</div>
      </article>`).join("");
    eventsList.querySelectorAll("[data-reg]").forEach(b=>b.addEventListener("click", ()=>register(b.getAttribute("data-reg"))));
  }catch(e){
    console.error(e);
    eventsList.innerHTML='<div style="color:#64748b">تعذر تحميل الفعاليات.</div>';
  }
}

async function register(eventId){
  if(!currentUser){ toast("سجّل دخول الأول.", "warn"); setTimeout(()=>location.href="register.html", 400); return; }
  setLoading(true);
  try{
    await addDoc(collection(db,REG_COL), { eventId, uid: currentUser.uid, status:"pending", createdAt: serverTimestamp() });
    toast("تم تسجيل حضورك ✅ (بانتظار اعتماد الأدمن)", "success");
  }catch(e){
    console.error(e);
    toast("تعذر تسجيل الحضور.", "error");
  }finally{ setLoading(false); }
}

btnCreateEvent?.addEventListener("click", async ()=>{
  if(!currentUser) return toast("سجّل دخول كأدمن.", "warn");
  if(!(await isAdmin(currentUser.uid))) return toast("الحساب ليس أدمن.", "error");
  const title=String(evTitle?.value||"").trim();
  if(!title) return toast("اكتب عنوان الفعالية.", "warn");
  setLoading(true);
  try{
    await addDoc(collection(db,EVENTS_COL), {
      title,
      place:String(evPlace?.value||"").trim(),
      date:String(evDate?.value||"").trim(),
      hours:Number(evHours?.value||0),
      points:Number(evPoints?.value||0),
      desc:String(evDesc?.value||"").trim(),
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });
    toast("تم إنشاء الفعالية ✅", "success");
    if(evTitle) evTitle.value=""; if(evPlace) evPlace.value=""; if(evDesc) evDesc.value="";
    loadEvents();
  }catch(e){
    console.error(e);
    toast("تعذر إنشاء الفعالية.", "error");
  }finally{ setLoading(false); }
});

onAuthStateChanged(auth, u=>{ currentUser=u||null; });
loadEvents();