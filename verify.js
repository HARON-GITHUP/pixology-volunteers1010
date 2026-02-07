import { db } from "./firebase.js";
import { toast } from "./ui.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const certInput = document.getElementById("certInput");
const btnVerify = document.getElementById("btnVerify");
const verifyBox = document.getElementById("verifyBox");

function qs(name){
  const u = new URL(location.href);
  return u.searchParams.get(name) || "";
}
function esc(s){ return String(s||"").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

async function verify(certId){
  const id = String(certId||"").trim();
  if (!id) return toast("اكتب رقم الشهادة.", "warn");
  if (verifyBox) verifyBox.innerHTML = '<div style="color:#64748b">تحميل...</div>';
  try{
    const snap = await getDoc(doc(db,"certificates", id));
    if (!snap.exists()){
      if (verifyBox) verifyBox.innerHTML = '<div class="card" style="padding:14px;border-radius:16px;color:#b91c1c;font-weight:900">❌ الشهادة غير موجودة</div>';
      return;
    }
    const c = snap.data()||{};
    if (verifyBox){
      verifyBox.innerHTML = `
        <article class="card" style="padding:14px;border-radius:16px">
          <div style="font-weight:950; font-size:18px">✅ شهادة صحيحة</div>
          <div style="margin-top:8px;color:#64748b;line-height:1.9">
            رقم الشهادة: <b>${esc(id)}</b><br/>
            الاسم: <b>${esc(c.name||"")}</b><br/>
            الساعات: <b>${Number(c.hoursAtIssue||0)}</b><br/>
            الحالة وقت الإصدار: <b>${esc(c.statusAtIssue||"")}</b>
          </div>
        </article>
      `;
    }
  }catch(e){
    console.error(e);
    toast("تعذر التحقق.", "error");
  }
}

btnVerify?.addEventListener("click", ()=>verify(certInput?.value));
certInput?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") btnVerify?.click(); });

const fromUrl = qs("cert");
if (fromUrl){
  if (certInput) certInput.value = fromUrl;
  verify(fromUrl);
}
