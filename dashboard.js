import { auth, db } from "./firebase.js";
import { toast } from "./ui.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const kpiVol = document.getElementById("kpiVol");
const kpiPoints = document.getElementById("kpiPoints");
const kpiHours = document.getElementById("kpiHours");
const kpiTasks = document.getElementById("kpiTasks");
const topList = document.getElementById("topList");

function badgeFor(points){
  const p = Number(points||0);
  if (p >= 600) return "🥇 Gold";
  if (p >= 300) return "🥈 Silver";
  if (p >= 100) return "🥉 Bronze";
  return "🌱 Starter";
}

async function load(){
  // volunteers
  const vq = query(collection(db,"pixology_volunteers"), where("status","in",["Active","Certified"]));
  const vs = await getDocs(vq);
  const vols = vs.docs.map(d=>d.data()||{});
  if (kpiVol) kpiVol.textContent = String(vols.length);
  if (kpiPoints) kpiPoints.textContent = String(vols.reduce((a,v)=>a+Number(v.points||0),0));
  if (kpiHours) kpiHours.textContent = String(vols.reduce((a,v)=>a+Number(v.hours||0),0));

  // tasks best-effort
  try{
    const tq = query(collection(db,"tasks"), orderBy("createdAt","desc"), limit(200));
    const ts = await getDocs(tq);
    const tasks = ts.docs.map(d=>d.data()||{});
    const p = tasks.filter(t=>String(t.status||"pending")==="pending" || String(t.status||"")==="open").length;
    const a = tasks.filter(t=>String(t.status||"")==="accepted").length;
    const c = tasks.filter(t=>String(t.status||"")==="completed").length;
    if (kpiTasks) kpiTasks.textContent = `${p}/${a}/${c}`;
  }catch(e){
    if (kpiTasks) kpiTasks.textContent = "—";
  }

  const top = vols.sort((a,b)=>Number(b.points||0)-Number(a.points||0)).slice(0,10);
  if (topList){
    topList.innerHTML = top.map((v,i)=>`
      <article class="card" style="padding:14px;border-radius:16px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
          <div style="font-weight:950">#${i+1} ${v.name||"—"}</div>
          <div style="color:#64748b;font-size:13px">${badgeFor(v.points)}</div>
        </div>
        <div style="margin-top:8px;color:#64748b;line-height:1.9">
          ⭐ نقاط: <b>${Number(v.points||0)}</b><br/>⏱️ ساعات: <b>${Number(v.hours||0)}</b>
        </div>
      </article>`).join("");
  }
}

onAuthStateChanged(auth,(u)=>{
  if(!u){ toast("سجّل دخول كأدمن.", "warn"); setTimeout(()=>location.href="register.html", 400); return; }
  load().catch(e=>{ console.error(e); toast("تعذر تحميل الإحصائيات.", "error"); });
});