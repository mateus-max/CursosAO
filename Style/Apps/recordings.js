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
      const existing=await f.db.ref("appData/apsan_recorded_classes").once("value");const catalog=existing.exists()?(existing.val()||{}):{};catalog[id]=record;await f.db.ref("appData/apsan_recorded_classes").set(catalog);
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
  async function openLocalDB(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(new Error("indexeddb"));
      const q=indexedDB.open("apsanAcademyRecordings",2);
      q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains("recordings"))q.result.createObjectStore("recordings",{keyPath:"id"})};
      q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
    });
  }
  async function localRecordingItems(){
    try{
      const db=await openLocalDB();
      const all=await new Promise((res,rej)=>{const q=db.transaction("recordings","readonly").objectStore("recordings").getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error)});
      db.close();return all||[];
    }catch(_){return []}
  }
  function getLiveMeta(liveId,account){
    try{
      const classes=JSON.parse(localStorage.getItem("apsan_live_classes")||"[]");
      const found=(Array.isArray(classes)?classes:[]).find(x=>x&&x.id===liveId)||{};
      return {
        title:found.title||"Aula gravada",
        course:found.course||"Curso",
        teacherName:found.teacherName||(account&&account.name)||"Professor",
        teacherPhone:cleanPhone(found.teacherPhone||(account&&account.phone)),
        studentPhones:Array.isArray(found.students)?found.students.map(cleanPhone).filter(Boolean):[]
      };
    }catch(_){
      return {title:"Aula gravada",course:"Curso",teacherName:(account&&account.name)||"Professor",teacherPhone:cleanPhone(account&&account.phone),studentPhones:[]};
    }
  }
  async function migrateLocalRecordings(){
    const account=(()=>{try{return JSON.parse(localStorage.getItem("apsan_account")||"{}")}catch(_){return {}}})();
    const localItems=await localRecordingItems();
    if(!localItems.length)return;
    let online=[];
    try{
      const f=await cloudReady();
      const snap=await f.db.ref("appData/apsan_recorded_classes").once("value");
      const raw=snap.exists()?snap.val():{};
      online=Object.keys(raw||{}).map(k=>Object.assign({id:k},raw[k]||{}));
    }catch(_){}
    const known={};online.forEach(x=>{known[x.id]=x});
    for(const item of localItems){
      if(!item||!item.id||known[item.id]||!item.blob)continue;
      const meta=getLiveMeta(item.liveId,account);
      try{
        const archived=await save(item.blob,{
          id:item.id,
          liveId:item.liveId||"",
          title:meta.title,
          course:meta.course,
          teacherPhone:meta.teacherPhone,
          teacherName:meta.teacherName,
          studentPhones:meta.studentPhones,
          createdAt:item.createdAt||new Date().toISOString()
        });
        if(archived&&archived.online)known[item.id]=archived;
      }catch(error){console.warn("Migração da gravação antiga:",error)}
    }
  }
  async function listOnline(){
    try{
      await migrateLocalRecordings();
      const f=await cloudReady();
      const snap=await f.db.ref("appData/apsan_recorded_classes").once("value");
      const raw=snap.exists()?snap.val():{};
      const online=Object.keys(raw||{}).map(k=>Object.assign({id:k},raw[k]||{}));
      const local=await localRecordingItems();
      const account=(()=>{try{return JSON.parse(localStorage.getItem("apsan_account")||"{}")}catch(_){return {}}})();
      const byId={};online.forEach(x=>{byId[x.id]=x});
      local.forEach(item=>{if(item&&!byId[item.id]){const meta=getLiveMeta(item.liveId,account);byId[item.id]={
        id:item.id,liveId:item.liveId||"",title:meta.title,course:meta.course,teacherPhone:meta.teacherPhone,teacherName:meta.teacherName,studentPhones:meta.studentPhones,createdAt:item.createdAt||"",size:item.size||item.blob?.size||0,videoUrl:item.videoUrl||""
      }}});
      return Object.keys(byId).map(k=>byId[k]).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    }catch(_){
      try{
        const local=await localRecordingItems();
        const account=(()=>{try{return JSON.parse(localStorage.getItem("apsan_account")||"{}")}catch(_){return {}}})();
        return local.map(item=>{const meta=getLiveMeta(item.liveId,account);return Object.assign({},item,{title:item.title||meta.title,course:item.course||meta.course,teacherPhone:item.teacherPhone||meta.teacherPhone,teacherName:item.teacherName||meta.teacherName,studentPhones:item.studentPhones||meta.studentPhones,videoUrl:item.videoUrl||""})}).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
      }catch(__){return []}
    }
  }
  function accessible(record,account){
    const phone=cleanPhone(account&&account.phone);
    if(!phone)return false;
    if(String(record.teacherPhone||"")===phone)return true;
    if(Array.isArray(record.studentPhones)&&record.studentPhones.map(cleanPhone).includes(phone))return true;
    try{
      const enrollments=JSON.parse(localStorage.getItem("apsan_enrollments")||"[]");
      return (Array.isArray(enrollments)?enrollments:[]).some(e=>e&&String(e.status||"") === "official"&&cleanPhone(e.studentPhone)===phone&&cleanPhone(e.teacherPhone)===cleanPhone(record.teacherPhone)&&(String(e.course||"")===String(record.course||"")||!record.course));
    }catch(_){return false}
  }
  function formatDate(v){try{return new Date(v).toLocaleString("pt-PT")}catch(_){return v||""}}
  async function watchRecording(id,url,title){
    if(url){open(url,title);return}
    const local=(await localRecordingItems()).find(x=>x&&x.id===id);
    if(local&&local.blob){const objectUrl=URL.createObjectURL(local.blob);open(objectUrl,title);return}
    alert("O vídeo desta aula ainda não está disponível neste dispositivo.");
  }
  async function renderProfessor(targetId){
    const box=document.getElementById(targetId);if(!box)return;
    const account=(()=>{try{return JSON.parse(localStorage.getItem("apsan_account")||"{}")}catch(_){return {}}})();
    const items=await listOnline();
    const mine=items.filter(x=>accessible(x,account)&&String(x.teacherPhone)===cleanPhone(account.phone));
    if(!mine.length){box.innerHTML='<div class="recording-archive-empty">Nenhuma aula gravada arquivada ainda. Quando terminar uma gravação, ela ficará guardada aqui.</div>';return}
    box.innerHTML=mine.map(item=>'<article class="recording-archive-card"><div class="recording-archive-info"><span>🎥 AULA GRAVADA</span><h3>'+esc(item.title||"Aula gravada")+'</h3><p>📚 '+esc(item.course||"Curso")+' · '+formatDate(item.createdAt)+'</p><small>Alunos da aula: '+((item.studentPhones||[]).length)+'</small></div><button type="button" class="recording-watch-button" data-recording-id="'+esc(item.id||"")+'" data-recording-url="'+esc(item.videoUrl||"")+'">▶ Assistir aula</button></article>').join("");
    box.querySelectorAll("[data-recording-url]").forEach(btn=>btn.onclick=()=>watchRecording(btn.getAttribute("data-recording-id"),btn.getAttribute("data-recording-url"),"Aula gravada"));
  }
  async function renderStudent(targetId){
    const box=document.getElementById(targetId);if(!box)return;
    const account=(()=>{try{return JSON.parse(localStorage.getItem("apsan_account")||"{}")}catch(_){return {}}})();
    const items=(await listOnline()).filter(x=>accessible(x,account));
    if(!items.length){box.innerHTML='<div class="recording-archive-empty"><strong>Nenhuma aula passada disponível.</strong><p>Quando uma aula for gravada pelos seus professores, e você fizer parte da aula, ela aparecerá aqui.</p></div>';return}
    box.innerHTML=items.map(item=>'<article class="recording-archive-card student-recording-card"><div class="recording-archive-info"><span>🎥 AULA PASSADA</span><h3>'+esc(item.title||"Aula gravada")+'</h3><p>👨‍🏫 '+esc(item.teacherName||"Professor")+' · 📚 '+esc(item.course||"Curso")+'</p><small>'+formatDate(item.createdAt)+'</small></div><button type="button" class="recording-watch-button" data-recording-id="'+esc(item.id||"")+'" data-recording-url="'+esc(item.videoUrl||"")+'">▶ Assistir aula passada</button></article>').join("");
    box.querySelectorAll("[data-recording-url]").forEach(btn=>btn.onclick=()=>watchRecording(btn.getAttribute("data-recording-id"),btn.getAttribute("data-recording-url"),"Aula passada"));
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