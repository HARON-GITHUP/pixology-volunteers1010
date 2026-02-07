// achievements.js
import { db } from "./firebase.js";
import { toast, setLoading } from "./ui.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const statVol = document.getElementById("statVol");
const statReq = document.getElementById("statReq");
const statHours = document.getElementById("statHours");
const topList = document.getElementById("topList");

function num(n){ return Number(n||0); }

async function loadStats(){
  setLoading(true);
  try{
    // Volunteers
    const volSnap = await getDocs(collection(db, "pixology_volunteers"));
    const vols = volSnap.docs.map(d => d.data());
    const totalVol = vols.length;
    const totalHours = vols.reduce((a,v)=> a + num(v.hours), 0);

    // Requests
    const reqSnap = await getDocs(collection(db, "volunteer_requests"));
    const totalReq = reqSnap.size;

    statVol.textContent = totalVol.toLocaleString("ar-EG");
    statReq.textContent = totalReq.toLocaleString("ar-EG");
    statHours.textContent = totalHours.toLocaleString("ar-EG");

    // Top active volunteers (by points then hours)
    const top = vols
      .map(v => ({...v, points:num(v.points), hours:num(v.hours)}))
      .sort((a,b)=> (b.points - a.points) || (b.hours - a.hours))
      .slice(0, 8);

    topList.innerHTML = top.map(v => `
      <article class="card" style="padding:14px;border-radius:16px">
        <div style="font-weight:800">${v.name || "متطوع"}</div>
        <div style="color:#64748b;margin-top:6px;line-height:1.8">
          نقاط: <b>${num(v.points)}</b> • ساعات: <b>${num(v.hours)}</b>
        </div>
      </article>
    `).join("") || '<div style="color:#64748b">لا يوجد بيانات بعد.</div>';
  }catch(e){
    console.error(e);
    toast("تعذر تحميل الإحصائيات.", "error");
  }finally{
    setLoading(false);
  }
}

loadStats();
