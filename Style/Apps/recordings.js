/* APSAN Academy — Arquivo de aulas gravadas
 * Guarda a gravação online no Firebase Storage e os metadados no Realtime Database.
 * Também mantém uma cópia local quando o armazenamento online não estiver disponível.
 */
(function(){
  "use strict";
  const cleanPhone=v=>{const d=String(v||"").replace(/\D/g,"");return d.length>9?d.slice(-9):d};
  const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  async function cloudReady(){if(window.apsanCloud)await window.apsanCloud.ready();if(!window.apsanFirebase)throw new Error("Firebase indisponível");return window.apsanFirebase}
  async function save(blob,meta){
    const id=meta.id||("rec_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7));
    const createdAt=meta.createdAt||new Date().toISOString();
    let videoUrl="";
    let online=false;
    try{
      const f=await cloudReady();
      if(!f.storage)throw new Error("Storage indisponível");
      const path="recordings/"+cleanPhone(meta.teacherPhone)+"/"+String(meta.liveId||id)+"/"+id+".webm";
      const snap=await f.storage.ref(path).put(blob,{contentType:blob.type||"video/webm",customMetadata:{liveId:String(meta.liveId||""),teacherPhone:cleanPhone(meta.teacherPhone)}});
      videoUrl=await snap.ref.getDownloadURL();
      const record={id,liveId:meta.liveId||"",title:meta.title||"Aula gravada",course:meta.course||"Curso",teacherPhone:cleanPhone(meta.teacherPhone),teacherName:meta.teacherName||"Professor",studentPhones:(meta.studentPhones||[]).map(cleanPhone).filter(Boolean),createdAt,size:Number(blob.size)||0,mimeType:blob.type||"video/webm",videoUrl,storagePath:path};
      await f.db.ref("recordedClasses/"+id).set(record);
      online=true;
    }catch(error){console.warn("Arquivo online de aula:",error)}
    try{
      const key="apsan_recordings_local";
      const current=JSON.parse(localStorage.getItem(key)||"[]");
      const localMeta={id,liveId:meta.liveId||"",title:meta.title||"Aula gravada",course:meta.course||"Curso",teacherPhone:cleanPhone(meta.teacherPhone),teacherName:meta.teacherName||"Professor",studentPhones:(meta.studentPhones||[]).map(cleanPhone).filter(Boolean),createdAt,size:Number(blob.size)||0,videoUrl,online};
      current.unshift(localMeta);
      localStorage.setItem(key,JSON.stringify(current.slice(0,30)));
      if(window.indexedDB){
        const db=await new Promise((res,rej)=>{const q=indexedDB.open("apsanAcademyRecordings",2);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains("recordings"))q.result.createObjectStore("recordings",{keyPath:"id"})};q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
        await new Promise((res,rej)=>{const tx=db.transaction("recordings","readwrite");tx.objectStore("recordings").put({id,liveId:meta.liveId||"",name:"Aula_"+id+".webm",blob,createdAt,size:blob.size,videoUrl});tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});
        db.close();
      }
    }catch(error){console.warn("Cópia local da aula:",error)}
    return {id,videoUrl,online};
  }
  async function listOnline(){
    try{
      const f=await cloudReady();
      const snap=await f.db.ref("recordedClasses").once("value");
      const raw=snap.exists()?snap.val():{};
      return Object.keys(raw||{}).map(k=>Object.assign({id:k},raw[k]||{})).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    }catch(_){return []}
  }
  function accessible(record,account){
    const phone=cleanPhone(account&&account.phone);
    if(!phone)return false;
    if(String(record.teacherPhone||"")===phone)return true;
    return Array.isArray(record.studentPhones)&&record.studentPhones.map(cleanPhone).includes(phone);
  }
  function formatDate(v){try{return new Date(v).toLocaleString("pt-PT")}catch(_){return v||""}}
  async function renderProfessor(targetId){
    const box=document.getElementById(targetId);if(!box)return;
    const account=(()=>{try{return JSON.parse(localStorage.getItem("apsan_account")||"{}")}catch(_){return {}}})();
    const items=await listOnline();
    const mine=items.filter(x=>accessible(x,account)&&String(x.teacherPhone)===cleanPhone(account.phone));
    if(!mine.length){box.innerHTML='<div class="recording-archive-empty">Nenhuma aula gravada arquivada ainda. Quando terminar uma gravação, ela ficará guardada aqui.</div>';return}
    box.innerHTML=mine.map(item=>'<article class="recording-archive-card"><div class="recording-archive-info"><span>🎥 AULA GRAVADA</span><h3>'+esc(item.title||"Aula gravada")+'</h3><p>📚 '+esc(item.course||"Curso")+' · '+formatDate(item.createdAt)+'</p><small>Alunos da aula: '+((item.studentPhones||[]).length)+'</small></div><button type="button" class="recording-watch-button" data-recording-url="'+esc(item.videoUrl||"")+'">▶ Assistir aula</button></article>').join("");
    box.querySelectorAll("[data-recording-url]").forEach(btn=>btn.onclick=()=>window.APSANRecordings.open(btn.getAttribute("data-recording-url"),"Aula gravada"));
  }
  async function renderStudent(targetId){
    const box=document.getElementById(targetId);if(!box)return;
    const account=(()=>{try{return JSON.parse(localStorage.getItem("apsan_account")||"{}")}catch(_){return {}}})();
    const items=(await listOnline()).filter(x=>accessible(x,account));
    if(!items.length){box.innerHTML='<div class="recording-archive-empty"><strong>Nenhuma aula passada disponível.</strong><p>Quando uma aula for gravada pelos seus professores, e você fizer parte da aula, ela aparecerá aqui.</p></div>';return}
    box.innerHTML=items.map(item=>'<article class="recording-archive-card student-recording-card"><div class="recording-archive-info"><span>🎥 AULA PASSADA</span><h3>'+esc(item.title||"Aula gravada")+'</h3><p>👨‍🏫 '+esc(item.teacherName||"Professor")+' · 📚 '+esc(item.course||"Curso")+'</p><small>'+formatDate(item.createdAt)+'</small></div><button type="button" class="recording-watch-button" data-recording-url="'+esc(item.videoUrl||"")+'">▶ Assistir aula passada</button></article>').join("");
    box.querySelectorAll("[data-recording-url]").forEach(btn=>btn.onclick=()=>window.APSANRecordings.open(btn.getAttribute("data-recording-url"),"Aula passada"));
  }
  function open(url,title){
    const safe=String(url||"");
    if(!safe){alert("O vídeo desta aula ainda não está disponível online.");return}
    let overlay=document.getElementById("apsanRecordingPlayer");
    if(!overlay){
      overlay=document.createElement("div");overlay.id="apsanRecordingPlayer";overlay.className="recording-player-overlay";
      overlay.innerHTML='<div class="recording-player-card"><div class="recording-player-head"><strong id="apsanRecordingPlayerTitle">Aula gravada</strong><button type="button" id="apsanRecordingPlayerClose">×</button></div><video id="apsanRecordingPlayerVideo" controls playsinline preload="metadata"></video></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
      overlay.querySelector("#apsanRecordingPlayerClose").onclick=close;
    }
    document.getElementById("apsanRecordingPlayerTitle").textContent=title||"Aula gravada";
    const video=document.getElementById("apsanRecordingPlayerVideo");video.src=safe;overlay.classList.add("open");video.play().catch(()=>{});
  }
  function close(){const o=document.getElementById("apsanRecordingPlayer");if(!o)return;o.classList.remove("open");const v=document.getElementById("apsanRecordingPlayerVideo");if(v){v.pause();v.removeAttribute("src");v.load()}}
  window.APSANRecordings={save, listOnline, renderProfessor, renderStudent, open, close};
})();