import { db } from "./firebase.js";
import { toast } from "./ui.js";
import { collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const lbSearch=document.getElementById("lbSearch");
const lbLimit=document.getElementById("lbLimit");
const lbList=document.getElementById("lbList");
let cache=[];

function norm(s){return String(s||"").trim().toLowerCase();}
function badgeFor(points){
  const p=Number(points||0);
  if(p>=600) return "🥇 Gold";
  if(p>=300) return "🥈 Silver";
  if(p>=100) return "🥉 Bronze";
  return "🌱 Starter";
}

async function fetchData(){
  const lim=Number(lbLimit?.value||25);
  const qy=query(collection(db,"pixology_volunteers"), where("status","in",["Active","Certified"]), orderBy("points","desc"), limit(lim));
  const snap=await getDocs(qy);
  cache=snap.docs.map(d=>({id:d.id, ...(d.data()||{})}));
  render();
}

function render(){
  if(!lbList) return;
  const q=norm(lbSearch?.value||"");
  const arr=cache.filter(v=> q ? norm(v.name).includes(q) : true);
  if(!arr.length){ lbList.innerHTML='<div style="color:#64748b">لا يوجد نتائج.</div>'; return; }
  lbList.innerHTML=arr.map((v,i)=>`
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

lbSearch?.addEventListener("input", render);
lbLimit?.addEventListener("change", ()=>fetchData());
fetchData().catch(e=>{console.error(e); toast("تعذر تحميل الترتيب.", "error");});