(function(){
"use strict";

const params=new URLSearchParams(location.search);
const liveId=params.get("live")||"";
const account=(()=>{try{return JSON.parse(localStorage.getItem("apsan_account")||"{}")}catch(_){return {}}})();
const role=account.type||localStorage.getItem("apsan_user_type")||"";
const phone=String(account.phone||localStorage.getItem("apsan_phone")||"").replace(/\D/g,"");
if(!liveId || !["professor","aluno"].includes(role)) return;

const board=document.querySelector(".board");
const canvas=document.getElementById("whiteboardCanvas");
const ctx=canvas&&canvas.getContext("2d");
if(!board||!canvas||!ctx) return;

const peerKey=phone||("peer_"+Math.random().toString(36).slice(2));
const mediaRoot="appData/apsan_live_media/"+liveId;
const presenceRoot=mediaRoot+"/presence";
const peerRoot=mediaRoot+"/peers/"+peerKey;
const boardRoot="appData/apsan_live_board_"+liveId;
const objectsRoot="appData/apsan_board_objects_"+liveId;
const studentBoardRoot="appData/apsan_live_student_boards/"+liveId;
const pointerRoot="appData/apsan_live_pointer_"+liveId;
const controlRoot="appData/apsan_live_controls/"+liveId;

const RTC_CONFIG={
  iceServers:[
    {urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]},
    {urls:["stun:stun.cloudflare.com:3478"]}
  ]
};

let cameraStream=null;
let micStream=null;
let cameraOn=false;
let micOn=false;
let handRaised=false;
let indicatorMode=false;
let magnifyMode=false;
let localDrawing=false;
let localDrawMode="write";
let lastPoint=null;
let drawSnapshot=null;
let pointerTimer=null;
let pointerVisible=false;
let remotePointerEl=null;
let remoteTeacherVideo=null;
let studentRemoteAudio=null;
let peerConnections={};
let seenCandidates={};
let mediaListeners=[];
let boardListeners=[];
let lastRemoteBoard="";
let lastRemoteObjects="";
let applyingRemote=false;
let boardSyncTimer=null;
let remoteStrokeCanvas=null;
let studentPeerListeners={};
let liveChatListener=null;
let networkState="connecting";
let classActive=true;

function cloud(){
  return window.apsanCloud&&typeof window.apsanCloud.set==="function" ? window.apsanCloud : null;
}
function normalize(v){return String(v||"").replace(/\D/g,"").slice(-9);}
function key(v){return normalize(v)||String(v||"peer").replace(/[^a-zA-Z0-9_-]/g,"_");}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function readJsonStorage(k,f){try{const v=JSON.parse(localStorage.getItem(k)||"null");return v==null?f:v}catch(_){return f}}
function liveBoardKey(){return "apsan_live_board_"+liveId}
function liveObjectsKey(){return "apsan_board_objects_"+liveId}
function toast(msg){const el=document.getElementById("toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove("show"),2400)}

function addStyle(){
  if(document.getElementById("liveRoomRuntimeStyle"))return;
  const s=document.createElement("style");s.id="liveRoomRuntimeStyle";
  s.textContent=`
    body.live-student-mode .classroom-side,
    body.live-student-mode .classroom-right,
    body.live-student-mode .classroom-top-actions,
    body.live-student-mode .board-toolbar{display:none!important}
    body.live-student-mode .classroom-body{grid-template-columns:minmax(0,1fr)!important}
    body.live-student-mode .classroom-main{width:100%}
    body.live-student-mode .classroom-bottom{height:auto;min-height:70px;flex-wrap:wrap;padding:7px 10px}
    body.live-student-mode .classroom-bottom #recordClass,
    body.live-student-mode .classroom-bottom #openChat,
    body.live-student-mode .classroom-bottom #openParticipants,
    body.live-student-mode .classroom-bottom #endClass{display:none!important}
    .live-student-tools{display:none;gap:7px;align-items:center;justify-content:center;flex-wrap:wrap;width:100%}
    body.live-student-mode .live-student-tools{display:flex}
    .live-student-tools button,.live-teacher-pointer-tools button{border:0;border-radius:11px;background:#172d4c;color:#fff;padding:9px 11px;font-weight:900;cursor:pointer}
    .live-student-tools button.active,.live-teacher-pointer-tools button.active{background:#b91c1c}
    .live-student-tools button.write.active{background:#1769e0}
    .live-board-pointer{position:absolute;z-index:60;width:18px;height:18px;border-radius:50%;background:#ef233c;border:3px solid #fff;box-shadow:0 0 0 3px rgba(239,35,60,.35),0 3px 12px rgba(0,0,0,.3);pointer-events:none;transform:translate(-50%,-50%);display:none}
    .live-board-pointer.show{display:block}
    .live-board-pointer.magnify{width:0;height:0;border:0;border-top:10px solid transparent;border-bottom:10px solid transparent;border-left:20px solid #ffd400;border-radius:0;background:transparent;box-shadow:2px 2px 7px rgba(0,0,0,.35);transform:translate(-4px,-4px) rotate(-18deg)}
    .live-board-pointer.arrow{width:0;height:0;border:0;border-top:10px solid transparent;border-bottom:10px solid transparent;border-left:20px solid #ffd400;border-radius:0;background:transparent;box-shadow:2px 2px 7px rgba(0,0,0,.35);transform:translate(-4px,-4px) rotate(-18deg)}
    .live-teacher-board-layer{position:absolute;inset:0;z-index:20;pointer-events:none}
    .live-teacher-board-layer canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
    body.live-student-mode #whiteboardCanvas{position:relative;z-index:30;background:transparent!important}
    .live-local-camera{position:absolute;left:14px;bottom:14px;z-index:42;width:150px;padding:5px;border-radius:10px;background:#0d1d38;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.16);display:none}
    .live-local-camera.show{display:block}
    .live-local-camera video{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:7px;background:#020b18}
    .live-local-camera small{display:block;padding:4px 2px 0;color:#b9c7d8;font-size:9px}
    .live-remote-camera{position:absolute;right:14px;top:14px;z-index:41;width:180px;padding:5px;border-radius:10px;background:#0d1d38;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.16);display:none}
    .live-remote-camera.show{display:block}
    .live-remote-camera video{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:7px;background:#020b18}
    .live-remote-camera small{display:block;padding:4px 2px 0;color:#b9c7d8;font-size:9px}
    .live-status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:5px}
    .live-status-dot.on{background:#22c55e}
    .live-status-dot.weak{background:#f59e0b}
    .live-status-dot.off{background:#ef4444}
    .live-participant-actions{display:flex;gap:4px;margin-top:5px;flex-wrap:wrap}
    .live-participant-actions button{border:0;border-radius:7px;padding:4px 7px;background:#eef3f8;color:#17304f;font-size:10px;font-weight:900;cursor:pointer}
    /* O painel de participantes fica fechado até o professor o solicitar. */
    body:not(.live-student-mode) #rightPanel{display:none!important}
    body:not(.live-student-mode) #rightPanel.open{display:flex!important}
    .live-teacher-self-tile{order:-1}
    .live-teacher-self-tile video{display:block;width:100%;height:100%;object-fit:cover}
    .live-participant-placeholder{font-size:22px;opacity:.9}
    .live-participant-actions button.active{background:#fee2e2;color:#991b1b}
    .live-teacher-pointer-tools{display:flex;gap:5px;margin:8px 0 10px;flex-wrap:wrap}
    .live-student-mode #cameraDock{display:none!important}
    .live-student-mode .board-wrap{padding:8px}
    .live-student-mode .board{min-height:calc(100dvh - 150px)}
    .live-student-mode .board-objects{pointer-events:none!important}
    .live-student-mode .board-object{pointer-events:none!important}
    .live-student-participant-grid{position:absolute;right:12px;bottom:12px;z-index:44;display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;max-width:min(58%,420px);pointer-events:none}
    .live-student-participant-tile{width:128px;padding:4px;border-radius:9px;background:#0d1d38;color:#fff;box-shadow:0 7px 18px rgba(0,0,0,.24);border:1px solid rgba(255,255,255,.16)}
    .live-student-participant-tile video{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:#020b18}
    .live-student-participant-tile small{display:block;padding:3px 2px 0;font-size:9px;color:#d6e1ef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .live-student-board-layer{position:absolute;inset:0;z-index:35;pointer-events:none}
    .live-student-board-layer canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    .live-student-board-label{position:absolute;top:6px;left:6px;z-index:2;background:rgba(13,29,56,.9);color:#fff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900}
    .live-chat-actions{display:flex;gap:4px;margin-top:4px}
    .live-chat-actions button{border:0;border-radius:6px;padding:3px 6px;font-size:9px;font-weight:800;cursor:pointer}
    @media(max-width:700px){
      .live-local-camera{width:118px;left:8px;bottom:8px}
      .live-remote-camera{width:132px;right:8px;top:8px}
      .live-student-tools button{padding:8px 9px;font-size:10px}
    }`;
  document.head.appendChild(s);
}

function makeStudentTools(){
  if(role!=="aluno")return;
  document.body.classList.add("live-student-mode");
  const bar=document.querySelector(".classroom-bottom");
  if(!bar)return;
  const wrap=document.createElement("div");wrap.className="live-student-tools";wrap.id="liveStudentTools";
  wrap.innerHTML=
    '<button type="button" id="studentWrite" class="write active">🖊 Escrever</button>'+
    '<button type="button" id="studentErase">⌫ Apagar</button>'+
    '<button type="button" id="studentMagnify">➡️ Lupa</button>'+
    '<button type="button" id="studentPointer">🖱 Indicador</button>'+
    '<button type="button" id="studentLeaveClass" class="danger">↩ Sair da aula</button>';
  bar.appendChild(wrap);
  document.getElementById("studentWrite").onclick=()=>{localDrawMode="write";setToolActive("studentWrite");};
  document.getElementById("studentErase").onclick=()=>{localDrawMode="erase";setToolActive("studentErase");};
  document.getElementById("studentMagnify").onclick=()=>toggleMagnify();
  document.getElementById("studentPointer").onclick=()=>toggleIndicator();
  document.getElementById("studentLeaveClass").onclick=()=>leaveLiveClassAsStudent();
}

function setToolActive(id){
  ["studentWrite","studentErase"].forEach(x=>document.getElementById(x)?.classList.toggle("active",x===id));
}
function makeTeacherPointerTools(){
  if(role!=="professor")return;
  const toolbar=document.querySelector(".board-toolbar");if(!toolbar)return;
  const lupa=document.getElementById("teacherMagnify");
  if(lupa){lupa.onclick=()=>toggleMagnify();lupa.classList.toggle("active",magnifyMode);}
  let wrap=document.getElementById("teacherPointerTools");
  if(!wrap){
    wrap=document.createElement("div");wrap.className="live-teacher-pointer-tools";wrap.id="teacherPointerTools";
    const pointer=document.createElement("button");pointer.type="button";pointer.id="teacherPointer";pointer.textContent="🖱 Indicador";wrap.appendChild(pointer);
    toolbar.appendChild(wrap);
  }
  document.getElementById("teacherPointer")?.addEventListener("click",()=>toggleIndicator(),{once:true});
}
function ensurePointerEl(){
  if(remotePointerEl)return remotePointerEl;
  remotePointerEl=document.createElement("div");remotePointerEl.className="live-board-pointer";remotePointerEl.id="liveBoardRemotePointer";board.appendChild(remotePointerEl);
  return remotePointerEl;
}
function applyPointerStyle(mode,color){
  const el=ensurePointerEl();el.classList.remove("magnify","arrow");el.classList.add("arrow");
  el.style.background="transparent";el.style.borderColor=color||"#ffd400";
}
function toggleMagnify(){magnifyMode=!magnifyMode;if(magnifyMode)indicatorMode=false;applyLocalPointerButtons();publishPresence();toast(magnifyMode?"Lupa ativa no quadro.":"Lupa desligada.");}
function toggleIndicator(){indicatorMode=!indicatorMode;if(indicatorMode)magnifyMode=false;applyLocalPointerButtons();publishPresence();toast(indicatorMode?"Indicador ativo no quadro.":"Indicador desligado.");}
function applyLocalPointerButtons(){
  document.getElementById("studentMagnify")?.classList.toggle("active",magnifyMode);
  document.getElementById("studentPointer")?.classList.toggle("active",indicatorMode);
  document.getElementById("teacherMagnify")?.classList.toggle("active",magnifyMode);
  document.getElementById("teacherPointer")?.classList.toggle("active",indicatorMode);
}
async function publishPointer(x,y,visible){
  const c=cloud();if(!c)return;
  if(pointerTimer)clearTimeout(pointerTimer);
  pointerTimer=setTimeout(()=>c.set(pointerRoot+"/"+peerKey,{x,y,visible:!!visible,mode:magnifyMode?"magnify":indicatorMode?"indicator":"dot",color:magnifyMode?"#ef233c":indicatorMode?"#ffd400":"#ef233c",at:Date.now(),role,name:account.name||"Utilizador"}).catch(()=>{}),35);
}
function localPointer(e){
  if(!indicatorMode&&!magnifyMode)return;
  const r=board.getBoundingClientRect();const x=Math.max(0,Math.min(r.width,e.clientX-r.left)),y=Math.max(0,Math.min(r.height,e.clientY-r.top));
  publishPointer(x/r.width,y/r.height,true);
}
function hideLocalPointer(){
  if(!indicatorMode&&!magnifyMode)return;
  publishPointer(0,0,false);
}
function listenPointers(){
  const c=cloud();if(!c)return;
  mediaListeners.push(c.listen(pointerRoot,(all)=>{
    if(!all||typeof all!=="object")return;
    Object.keys(all).forEach(k=>{
      if(k===peerKey)return;
      const p=all[k];if(!p)return;
      const el=ensurePointerEl();el.classList.toggle("show",p.visible!==false);if(p.visible===false)return;
      applyPointerStyle(p.mode,p.color);
      const r=board.getBoundingClientRect();el.style.left=(Math.max(0,Math.min(1,Number(p.x)||0))*r.width)+"px";el.style.top=(Math.max(0,Math.min(1,Number(p.y)||0))*r.height)+"px";
    });
  }));
}
function bindPointerTracking(){
  board.addEventListener("pointermove",localPointer,{passive:true});
  board.addEventListener("pointerleave",hideLocalPointer,{passive:true});
}

async function publishPresence(){
  const c=cloud();if(!c)return;
  const data={phone,name:account.name||"Utilizador",role,cameraOn,micOn,handRaised,
    indicator:indicatorMode,magnify:magnifyMode,network:networkState,connection:networkState,
    state:classActive?"connected":"ended",updatedAt:Date.now()};
  await c.set(presenceRoot+"/"+peerKey,data).catch(()=>{});
  try{
    const f=window.apsanFirebase;
    if(f&&f.db)f.db.ref(presenceRoot+"/"+peerKey).onDisconnect().set(Object.assign({},data,{state:"disconnected",connection:"disconnected",updatedAt:Date.now()}));
  }catch(_){}
}
function ensureTeacherSelfTile(){
  if(role!=="professor")return null;
  const grid=document.getElementById("participantVideoGrid");if(!grid)return null;
  let tile=grid.querySelector('[data-live-video="__teacher__"]');
  if(!tile){
    tile=document.createElement("div");tile.className="participant-video-tile live-teacher-self-tile";tile.dataset.liveVideo="__teacher__";
    tile.innerHTML='<div class="live-participant-placeholder">🎥</div><span>'+esc(account.name||"Professor")+' · sua câmara</span>';
    grid.prepend(tile);
  }else if(grid.firstElementChild!==tile)grid.prepend(tile);
  const v=tile.querySelector("video");
  if(cameraStream&&cameraOn){
    if(!v){const video=document.createElement("video");video.autoplay=true;video.muted=true;video.playsInline=true;tile.insertBefore(video,tile.firstChild)}
    const video=tile.querySelector("video");video.srcObject=cameraStream;video.play().catch(()=>{});
  }else if(v){v.remove()}
  return tile;
}
function ensureStudentVideoTile(k,p){
  if(role!=="professor")return null;
  const grid=document.getElementById("participantVideoGrid");if(!grid)return null;
  let tile=grid.querySelector('[data-live-video="'+CSS.escape(k)+'"]');
  if(!tile){
    tile=document.createElement("div");tile.className="participant-video-tile";tile.dataset.liveVideo=k;
    tile.innerHTML='<div class="live-participant-placeholder">👤</div><span>'+esc(p&&p.name||"Aluno")+' · câmara desligada</span>';
    grid.appendChild(tile);
  }
  return tile;
}
function renderConnectedParticipant(k,p){
  if(role!=="professor")return null;
  const list=document.getElementById("participantList");if(!list)return null;
  let item=list.querySelector('[data-live-participant="'+CSS.escape(k)+'"]');
  if(!item){
    item=document.createElement("div");item.className="participant";item.dataset.liveParticipant=k;
    const accounts=readJsonStorage("apsan_accounts",[]);
    const a=Array.isArray(accounts)?accounts.find(x=>x&&normalize(x.phone)===normalize(k))||{}:{};
    item.innerHTML='<div class="participant-avatar">'+(a.photo?'<img src="'+esc(a.photo)+'">':esc(String(a.name||p.name||"A").charAt(0)))+'</div><div><strong>'+esc(a.name||p.name||"Aluno")+'</strong><small class="live-participant-status"><span class="live-status-dot on"></span>A participar na aula</small></div>';
    list.appendChild(item);
  }
  ensureStudentVideoTile(k,p);
  ensureTeacherSelfTile();
  return item;
}
function removeDisconnectedParticipant(k){
  if(role!=="professor")return;
  document.querySelector('[data-live-participant="'+CSS.escape(k)+'"]')?.remove();
  document.querySelector('[data-live-video="'+CSS.escape(k)+'"]')?.remove();
  updateParticipantSummary();
}
function updateParticipantSummary(){
  if(role!=="professor")return;
  const ids=[...new Set([...document.querySelectorAll("[data-live-participant]")].map(x=>x.dataset.liveParticipant).filter(Boolean))];
  const summary=document.getElementById("participantSummary");if(summary)summary.textContent="Participantes ("+(ids.length+1)+")";
}
function listenPresence(){
  const c=cloud();if(!c)return;
  mediaListeners.push(c.listen(presenceRoot,(all)=>{
    if(!all||typeof all!=="object")return;
    if(role==="professor")ensureTeacherSelfTile();
    Object.keys(all).forEach(k=>{
      if(k===peerKey)return;
      const p=all[k]||{};
      const connected=p.role==="aluno"&&p.state==="connected";
      const item=(role==="professor"&&connected)?renderConnectedParticipant(k,p):document.querySelector('[data-live-participant="'+CSS.escape(k)+'"]');
      if(item){
        const status=item.querySelector(".live-participant-status");
        const ns=p.network==="weak"?"weak":(p.state==="disconnected"||p.network==="offline"?"off":"on");
        if(status)status.innerHTML='<span class="live-status-dot '+ns+'"></span>'+ (p.state==="disconnected"?"Saiu da aula":p.network==="weak"?"Rede fraca":p.cameraOn?"Câmara ligada":"Câmara desligada")+(p.handRaised?" · ✋ mão levantada":"");
        item.dataset.network=p.network||"";
        const tile=document.querySelector('[data-live-video="'+CSS.escape(k)+'"]');
        if(tile){
          const v=tile.querySelector("video");
          const placeholder=tile.querySelector(".live-participant-placeholder");
          if(p.cameraOn&&p.state==="connected"){
            if(v)v.style.display="block";
            if(placeholder)placeholder.style.display="none";
          }else{
            if(v)v.style.display="none";
            if(placeholder)placeholder.style.display="grid";
          }
        }
      }else if(role==="professor"&&(p.state==="disconnected"||p.state==="ended"||!connected)){
        removeDisconnectedParticipant(k);
        const tile=document.querySelector('[data-live-video="'+CSS.escape(k)+'"]');if(tile)tile.remove();
      }
    });
  }));
}

function createLocalCameraBox(){
  let box=document.getElementById("liveLocalCamera");
  if(box)return box;
  box=document.createElement("div");box.className="live-local-camera";box.id="liveLocalCamera";
  box.innerHTML='<video autoplay playsinline muted></video><small id="liveLocalCameraLabel">A sua câmara</small>';
  board.appendChild(box);
  return box;
}
function showLocalCamera(){
  const box=createLocalCameraBox();const video=box.querySelector("video");
  video.srcObject=cameraStream||null;box.classList.toggle("show",!!cameraStream&&cameraOn);
}
function createRemoteTeacherBox(){
  if(role!=="aluno")return null;
  let box=document.getElementById("liveRemoteTeacherCamera");
  if(box)return box;
  box=document.createElement("div");box.className="live-remote-camera";box.id="liveRemoteTeacherCamera";
  box.innerHTML='<video autoplay playsinline></video><small id="liveRemoteTeacherLabel">Professor</small>';
  board.appendChild(box);
  return box;
}
function ensureStudentParticipantGrid(){
  if(role!=="aluno")return null;
  let grid=document.getElementById("liveStudentParticipantGrid");
  if(grid)return grid;
  grid=document.createElement("div");grid.id="liveStudentParticipantGrid";grid.className="live-student-participant-grid";board.appendChild(grid);
  return grid;
}
function attachRemoteStudentVideo(student,stream){
  const grid=role==="professor"?document.getElementById("participantVideoGrid"):ensureStudentParticipantGrid();if(!grid)return;
  let tile=grid.querySelector('[data-live-video="'+CSS.escape(student)+'"]');
  if(!tile){
    tile=document.createElement("div");tile.className=role==="professor"?"participant-video-tile":"live-student-participant-tile";tile.dataset.liveVideo=student;
    tile.innerHTML='<video autoplay playsinline></video><small>'+esc(student)+'</small>';
    grid.prepend(tile);
  }
  const video=tile.querySelector("video");video.srcObject=stream;video.play().catch(()=>{});
}
function attachRemoteTeacherVideo(stream,name){
  const box=createRemoteTeacherBox();if(!box)return;
  const video=box.querySelector("video");video.srcObject=stream;box.querySelector("small").textContent=(name||"Professor")+" · ao vivo";box.classList.add("show");video.play().catch(()=>{});
}

async function getMedia(kind){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error("media");
  if(kind==="video" && !cameraStream) cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}},audio:false});
  if(kind==="audio" && !micStream) micStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
}
function stopMedia(kind){
  const s=kind==="video"?cameraStream:micStream;if(!s)return;
  s.getTracks().forEach(t=>t.stop());
  if(kind==="video")cameraStream=null;else micStream=null;
}
function senderFor(pc,kind){const arr=pc._apsanSenders||{};return arr[kind]||null}
async function replaceAllSenders(kind,track){
  await Promise.all(Object.keys(peerConnections).map(async k=>{
    const pc=peerConnections[k];const sender=senderFor(pc,kind);if(sender)try{await sender.replaceTrack(track||null)}catch(_){}
  }));
}
async function setCamera(on){
  try{
    if(on){
      await getMedia("video");cameraOn=true;
      const track=cameraStream.getVideoTracks()[0];await replaceAllSenders("video",track);
    }else{stopMedia("video");cameraOn=false;await replaceAllSenders("video",null)}
    const v=document.getElementById("localCamera");if(v)v.srcObject=cameraStream||null;
    if(v&&cameraStream)v.play().catch(()=>{});
    showLocalCamera();
    if(role==="professor")ensureTeacherSelfTile();
    updateButton("toggleCamera",cameraOn?"<span>▣</span>Desligar câmara":"<span>▣</span>Ligar câmara");
    await publishPresence();toast(cameraOn?"Câmara ligada e partilhada na aula.":"Câmara desligada.");
  }catch(e){toast("Não foi possível ativar a câmara. Verifique a permissão do navegador.");}
}
async function setMic(on){
  try{
    if(on){await getMedia("audio");micOn=true;await replaceAllSenders("audio",micStream.getAudioTracks()[0]);}
    else{stopMedia("audio");micOn=false;await replaceAllSenders("audio",null)}
    updateButton("toggleMic",micOn?"<span>🎙</span>Desligar microfone":"<span>🎙</span>Microfone");
    await publishPresence();toast(micOn?"Microfone ligado e partilhado na aula.":"Microfone desligado.");
  }catch(_){toast("Não foi possível ativar o microfone.");}
}
function updateButton(id,html){const b=document.getElementById(id);if(b)b.innerHTML=html}
async function sendStudentControl(student,kind,enabled){
  if(role!=="professor")return;
  const c=cloud();if(!c)return;
  await c.set(controlRoot+"/"+normalize(student)+"/"+kind,{enabled:!!enabled,at:Date.now(),by:peerKey}).catch(()=>{});
}
function addTeacherControls(){
  if(role!=="professor")return;
  document.querySelectorAll("[data-live-participant]").forEach(item=>{
    const student=item.getAttribute("data-live-participant"); if(!student||item.querySelector(".live-participant-actions"))return;
    const actions=document.createElement("div");actions.className="live-participant-actions";
    actions.innerHTML='<button type="button" data-control="mic">🎙 '+ "Microfone"+'</button><button type="button" data-control="camera">▣ Câmara</button>';
    item.appendChild(actions);
    actions.querySelector('[data-control="mic"]').onclick=async()=>{const p=(readJsonStorage("apsan_live_controls_state_"+student,{mic:true}));p.mic=!p.mic;localStorage.setItem("apsan_live_controls_state_"+student,JSON.stringify(p));await sendStudentControl(student,"mic",p.mic);};
    actions.querySelector('[data-control="camera"]').onclick=async()=>{const p=(readJsonStorage("apsan_live_controls_state_"+student,{camera:true}));p.camera=!p.camera;localStorage.setItem("apsan_live_controls_state_"+student,JSON.stringify(p));await sendStudentControl(student,"camera",p.camera);};
  });
}
function listenStudentControls(){
  if(role!=="aluno")return;
  const c=cloud();if(!c)return;
  mediaListeners.push(c.listen(controlRoot+"/"+peerKey,(data)=>{
    const d=data||{};
    if(d.mic&&typeof d.mic.enabled==="boolean"&&d.mic.enabled!==micOn)setMic(!!d.mic.enabled);
    if(d.camera&&typeof d.camera.enabled==="boolean"&&d.camera.enabled!==cameraOn)setCamera(!!d.camera.enabled);
  }));
}
function leaveLiveClassAsStudent(){
  if(role!=="aluno")return;
  try{classActive=false;publishPresence();cleanupPeers();}catch(_){}
  clearEndedSession();
  location.href="aluno.html#classroom";
}
async function measureNetwork(){
  const pc=peerConnections.teacher;if(role!=="aluno"||!pc)return;
  try{
    const stats=await pc.getStats();let rtt=0,lost=0,recv=0;
    stats.forEach(x=>{if(x.type==="candidate-pair"&&x.state==="succeeded"){rtt=Number(x.currentRoundTripTime||0);};if(x.type==="inbound-rtp"&&x.kind==="video"){lost+=Number(x.packetsLost||0);recv+=Number(x.packetsReceived||0)}});
    const loss=recv+lost?lost/(recv+lost):0;
    networkState=(rtt>0.45||loss>0.08)?"weak":"good";
    publishPresence();
  }catch(_){}
}
function clearEndedSession(){
  try{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    localStorage.removeItem(liveBoardKey());
    localStorage.removeItem(liveObjectsKey());
    localStorage.removeItem("apsan_board_documents_"+liveId);
    document.getElementById("boardEmpty")?.classList.remove("hidden");
    document.getElementById("participantList")?.replaceChildren();
    document.getElementById("participantVideoGrid")?.replaceChildren();
    document.getElementById("liveStudentBoardLayers")?.remove();
    document.getElementById("liveTeacherBoardLayer")?.remove();
  }catch(_){}
}
function markClassEnded(){
  classActive=false;networkState="offline";
  try{stopMedia("video");stopMedia("audio")}catch(_){}
  cleanupPeers();
  clearEndedSession();
  publishPresence();
  document.querySelectorAll(".classroom-bottom button").forEach(b=>{if(b.id!=="leaveClass")b.disabled=true});
}
function listenLiveEnd(){
  const c=cloud();if(!c||!liveId)return;
  mediaListeners.push(c.listen("appData/apsan_live_classes",data=>{
    const item=Array.isArray(data)?data.find(x=>x&&x.id===liveId):(data&&data[liveId]);
    if(item&&item.active===false&&!classActive)return;
    if(!item||item.active!==true){
      if(classActive){
        markClassEnded();
        if(role==="aluno"){
          toast("Aula encerrada pelo professor.");
          setTimeout(()=>{location.href="aluno.html#classroom"},900);
        }
      }
    }
  }));
}
async function ensureClassIsActive(){
  try{
    const c=cloud();if(!c)return true;
    const raw=await c.get("appData/apsan_live_classes");const item=Array.isArray(raw)?raw.find(x=>x&&x.id===liveId):(raw&&raw[liveId]);
    if(item&&item.active===false){markClassEnded();return false}
  }catch(_){}
  return true;
}
function bindMediaButtons(){
  const cam=document.getElementById("toggleCamera");if(cam)cam.onclick=()=>setCamera(!cameraOn);
  const mic=document.getElementById("toggleMic");if(mic)mic.onclick=()=>setMic(!micOn);
  const hand=document.getElementById("raiseHand");if(hand)hand.onclick=async()=>{handRaised=!handRaised;hand.innerHTML=handRaised?"<span>✋</span>Baixar mão":"<span>✋</span>Levantar mão";await publishPresence();toast(handRaised?"Mão levantada.":"Mão baixada.")};
}
function wireTransceivers(pc){
  const senders={};
  const vt=pc.addTransceiver("video",{direction:"sendrecv"});const at=pc.addTransceiver("audio",{direction:"sendrecv"});
  senders.video=vt.sender;senders.audio=at.sender;pc._apsanSenders=senders;
  if(cameraStream)vt.sender.replaceTrack(cameraStream.getVideoTracks()[0]).catch(()=>{});
  if(micStream)at.sender.replaceTrack(micStream.getAudioTracks()[0]).catch(()=>{});
}
function candidateSeen(peer,side,k){const id=peer+":"+side+":"+k;if(seenCandidates[id])return true;seenCandidates[id]=true;return false}
async function writeCandidate(side,peer,cand){
  const c=cloud();if(!c)return;
  await c.push(mediaRoot+"/peers/"+peer+"/"+side+"Candidates",cand).catch(()=>{});
}
function watchCandidates(pc,peer,side){
  const c=cloud();if(!c)return;
  const path=mediaRoot+"/peers/"+peer+"/"+side+"Candidates";
  const off=c.listen(path,async all=>{
    if(!all||typeof all!=="object")return;
    for(const id of Object.keys(all)){
      if(candidateSeen(peer,side,id))continue;
      try{await pc.addIceCandidate(new RTCIceCandidate(all[id]))}catch(_){}
    }
  });
  mediaListeners.push(off);
}
function setupPcHandlers(pc,remoteRole,remoteName){
  pc.onicecandidate=e=>{if(e.candidate)pc._apsanSendCandidate(e.candidate)};
  pc.onconnectionstatechange=()=>{
    if(role==="aluno"&&pc===peerConnections.teacher){
      networkState=pc.connectionState==="connected"?"good":(pc.connectionState==="disconnected"||pc.connectionState==="failed"?"offline":"connecting");
      publishPresence();
    }
    if(["failed","disconnected"].includes(pc.connectionState)){
      setTimeout(async()=>{if(pc.connectionState==="failed"||pc.connectionState==="disconnected"){try{pc.restartIce?.();if(role==="aluno"&&pc===peerConnections.teacher)await renegotiateStudent(pc,true)}catch(_){}}},1200);
    }
  };
  pc.ontrack=e=>{
    const stream=e.streams&&e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
    if(remoteRole==="aluno")attachRemoteStudentVideo(pc._apsanPeer,stream);
    else attachRemoteTeacherVideo(stream,remoteName||"Professor");
  };
}
async function makeStudentPeer(){
  const c=cloud();if(!c)return;
  if(peerConnections.teacher)return peerConnections.teacher;
  const pc=new RTCPeerConnection(RTC_CONFIG);peerConnections.teacher=pc;
  wireTransceivers(pc);
  pc._apsanPeer=peerKey;pc._apsanSendCandidate=cand=>writeCandidate("student",peerKey,cand);
  setupPcHandlers(pc,"professor","Professor");
  watchCandidates(pc,peerKey,"teacher");
  await renegotiateStudent(pc,false,"professor","");
  mediaListeners.push(c.listen(peerRoot,async data=>{
    if(!data||!data.answer)return;
    try{
      const nextSdp=String(data.answer.sdp||"");
      if(!nextSdp||nextSdp===pc._apsanLastAnswer)return;
      if(pc.signalingState!=="stable"&&pc.signalingState!=="have-local-offer")return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      pc._apsanLastAnswer=nextSdp;
    }catch(_){}
  }));
  return pc;
}
async function makeStudentPeerToStudent(remote,data){
  const c=cloud();if(!c||!data)return;
  const p=normalize(remote);if(!p||p===peerKey)return;
  const id="student:"+p;
  if(peerConnections[id])return;
  const pc=new RTCPeerConnection(RTC_CONFIG);peerConnections[id]=pc;pc._apsanPeer=p;
  wireTransceivers(pc);
  pc._apsanSendCandidate=cand=>writeCandidate("student",peerKey+"__"+p,cand);
  setupPcHandlers(pc,"aluno",data.name||p);
  watchCandidates(pc,peerKey+"__"+p,"studentPeer");
  try{
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    await c.set(mediaRoot+"/peers/"+peerKey+"__"+p+"/offer",{type:offer.type,sdp:offer.sdp,at:Date.now(),name:account.name||"Aluno",phone,from:peerKey,target:p,targetRole:"aluno"});
    mediaListeners.push(c.listen(mediaRoot+"/peers/"+peerKey+"__"+p+"/answer",async ans=>{
      if(!ans||!ans.sdp)return;
      try{
        const s=String(ans.sdp||"");if(!s||s===pc._apsanLastAnswer)return;
        if(pc.signalingState!=="have-local-offer"&&pc.signalingState!=="stable")return;
        await pc.setRemoteDescription(new RTCSessionDescription(ans));pc._apsanLastAnswer=s;
      }catch(_){}
    }));
  }catch(_){}
}
function listenStudentPeers(){
  const c=cloud();if(!c||role!=="aluno")return;
  mediaListeners.push(c.listen(presenceRoot,all=>{
    if(!all||typeof all!=="object")return;
    Object.keys(all).forEach(p=>{
      if(p===peerKey)return;
      const info=all[p]||{};
      if(info.role==="aluno"&&info.state!=="disconnected"&&info.state!=="ended") makeStudentPeerToStudent(p,info).catch(()=>{});
    });
  }));
  mediaListeners.push(c.listen(mediaRoot+"/peers",async all=>{
    if(!all||typeof all!=="object")return;
    for(const pathKey of Object.keys(all)){
      const d=all[pathKey];
      if(!d||!d.offer||d.targetRole!=="aluno"||d.target!==peerKey)continue;
      if(studentPeerListeners[pathKey])continue;
      studentPeerListeners[pathKey]=true;
      const pc=new RTCPeerConnection(RTC_CONFIG);
      const id="incoming:"+d.from;peerConnections[id]=pc;pc._apsanPeer=d.from;
      wireTransceivers(pc);
      pc._apsanSendCandidate=cand=>writeCandidate("student",pathKey,"incoming");
      setupPcHandlers(pc,"aluno",d.name||d.from);
      watchCandidates(pc,pathKey,"student");
      try{
        await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
        const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
        await c.set(mediaRoot+"/peers/"+pathKey+"/answer",{type:answer.type,sdp:answer.sdp,at:Date.now(),name:account.name||"Aluno"});
      }catch(_){}
    }
  }));
}

async function renegotiateStudent(pc,iceRestart,targetRole,target){
  const c=cloud();if(!c||!pc)return;
  try{
    const offer=await pc.createOffer(iceRestart?{iceRestart:true}:undefined);
    await pc.setLocalDescription(offer);
    await c.set(peerRoot+"/offer",{type:offer.type,sdp:offer.sdp,at:Date.now(),name:account.name||"Aluno",phone,targetRole:targetRole||"professor",target:target||""});
  }catch(_){}
}
async function makeTeacherPeer(student,data){
  const c=cloud();if(!c||!data||!data.offer)return;
  const p=normalize(student);if(!p)return;
  if(peerConnections[p])return;
  const pc=new RTCPeerConnection(RTC_CONFIG);peerConnections[p]=pc;pc._apsanPeer=p;
  wireTransceivers(pc);
  pc._apsanSendCandidate=cand=>writeCandidate("teacher",p,cand);
  setupPcHandlers(pc,"aluno",data.name||p);
  watchCandidates(pc,p,"student");
  try{
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    pc._apsanLastOffer=String(data.offer.sdp||"");
    const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
    await c.set(mediaRoot+"/peers/"+p+"/answer",{type:answer.type,sdp:answer.sdp,at:Date.now(),teacher:account.name||"Professor"});
  }catch(e){console.warn("WebRTC professor:",e)}
}
function bindLiveChat(){
  const c=cloud();if(!c||!liveId)return;
  const root="appData/apsan_live_chat/"+liveId;
  const box=document.getElementById("chatList"),input=document.getElementById("chatInput"),send=document.getElementById("sendChat");
  if(!box||!input||!send)return;
  const escText=v=>esc(v).replace(/\n/g,"<br>");
  const render=data=>{
    const arr=Array.isArray(data)?data:Object.values(data||{});
    arr.sort((a,b)=>(Number(a.at)||0)-(Number(b.at)||0));
    box.innerHTML=arr.slice(-150).map(m=>{
      const mine=normalize(m.phone)===normalize(phone);
      const actions=mine?'<div class="live-chat-actions"><button data-edit="'+esc(m.id)+'">Editar</button><button data-delete="'+esc(m.id)+'">Apagar</button></div>':'';
      return '<div class="chat-msg" data-live-chat-id="'+esc(m.id)+'"><strong>'+esc(m.name||"Utilizador")+'</strong><p>'+escText(m.text||"")+'</p>'+actions+'</div>';
    }).join("")||'<div class="empty-state">O chat da aula aparecerá aqui.</div>';
    box.scrollTop=box.scrollHeight;
    box.querySelectorAll("[data-edit]").forEach(b=>b.onclick=async()=>{
      const id=b.dataset.edit,all=await c.get(root).catch(()=>null),arr2=Array.isArray(all)?all:(all?Object.values(all):[]),m=arr2.find(x=>String(x.id)===String(id));
      if(!m||normalize(m.phone)!==normalize(phone))return;
      const next=prompt("Editar mensagem:",m.text||"");if(next==null||!next.trim())return;
      await c.set(root+"/"+id,Object.assign({},m,{text:next.trim(),editedAt:Date.now()})).catch(()=>{});
    });
    box.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{
      const id=b.dataset.delete,all=await c.get(root).catch(()=>null),arr2=Array.isArray(all)?all:(all?Object.values(all):[]),m=arr2.find(x=>String(x.id)===String(id));
      if(!m||normalize(m.phone)!==normalize(phone))return;
      await c.set(root+"/"+id,null).catch(()=>{});
    });
  };
  if(liveChatListener)try{liveChatListener()}catch(_){}
  liveChatListener=c.listen(root,render);
  const sendNow=async()=>{
    const text=String(input.value||"").trim();if(!text)return;
    const id=phone+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
    await c.set(root+"/"+id,{id,text,name:account.name||"Utilizador",phone,role,at:Date.now()}).catch(()=>{});
    input.value="";
  };
  send.onclick=sendNow;
  input.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();sendNow();}};
}
function listenTeacherPeers(){
  const c=cloud();if(!c)return;
  mediaListeners.push(c.listen(mediaRoot+"/peers",async all=>{
    if(!all||typeof all!=="object")return;
    for(const p of Object.keys(all)){
      if(p===peerKey)continue;
      const d=all[p];if(!d||!d.offer||d.targetRole==="aluno")continue;
      if(!peerConnections[p]){makeTeacherPeer(p,d);continue}
      const pc=peerConnections[p];
      const nextSdp=String(d.offer.sdp||"");
      if(!nextSdp||nextSdp===pc._apsanLastOffer)continue;
      try{
        if(pc.signalingState!=="stable"&&pc.signalingState!=="have-remote-offer")continue;
        await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
        pc._apsanLastOffer=nextSdp;
        const answer=await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await c.set(mediaRoot+"/peers/"+p+"/answer",{type:answer.type,sdp:answer.sdp,at:Date.now(),teacher:account.name||"Professor"});
      }catch(_){}
    }
  }));
}
function cleanupPeers(){
  Object.keys(peerConnections).forEach(k=>{try{peerConnections[k].close()}catch(_){}});
  peerConnections={};
}

function drawRemoteSnapshot(data){
  if(!data||typeof data!=="string"||!data.startsWith("data:image/"))return;
  if(data===lastRemoteBoard)return;
  lastRemoteBoard=data;applyingRemote=true;try{localStorage.setItem(liveBoardKey(),data)}catch(_){}
  const im=new Image();im.onload=()=>{
    const r=canvas.getBoundingClientRect();ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(im,0,0,canvas.width,canvas.height);ctx.restore();applyingRemote=false;
  };im.src=data;
}
function clearStudentTeacherBoard(){
  if(role!=="aluno")return;
  try{ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation="source-over";ctx.clearRect(0,0,canvas.width,canvas.height);ctx.restore()}catch(_){}
  const teacher=document.getElementById("liveTeacherBoardCanvas");if(teacher){const x=teacher.getContext("2d");x.clearRect(0,0,teacher.width,teacher.height)}
  const objects=document.getElementById("boardObjects");if(objects)objects.replaceChildren();
  const docs=document.getElementById("boardDocuments");if(docs)docs.replaceChildren();
}
function studentBoardPublish(){
  if(role!=="aluno"||!liveId||!classActive)return;
  const c=cloud();if(!c)return;
  clearTimeout(studentBoardPublish._t);
  studentBoardPublish._t=setTimeout(()=>{try{c.set(studentBoardRoot+"/"+peerKey,{phone,name:account.name||"Aluno",at:Date.now(),image:canvas.toDataURL("image/png")}).catch(()=>{})}catch(_){}},120);
}
function ensureTeacherStudentBoardLayer(k,name){
  if(role!=="professor")return null;
  let root=document.getElementById("liveStudentBoardLayers");
  if(!root){root=document.createElement("div");root.id="liveStudentBoardLayers";root.className="live-student-board-layer";board.appendChild(root)}
  let layer=root.querySelector("[data-student-board=\""+CSS.escape(k)+"\"]");
  if(!layer){
    layer=document.createElement("div");layer.dataset.studentBoard=k;
    layer.innerHTML='<span class="live-student-board-label">'+esc(name||"Aluno")+' · quadro do aluno</span><canvas></canvas>';
    root.appendChild(layer);
  }
  const cv=layer.querySelector("canvas");cv.width=canvas.width;cv.height=canvas.height;
  return cv;
}
function listenStudentBoards(){
  const c=cloud();if(!c||role!=="professor")return;
  mediaListeners.push(c.listen(studentBoardRoot,all=>{
    if(!all||typeof all!=="object")return;
    Object.keys(all).forEach(k=>{
      const item=all[k];if(!item||!item.image)return;
      const cv=ensureTeacherStudentBoardLayer(k,item.name||k);if(!cv)return;
      const image=new Image();image.onload=()=>{const x=cv.getContext("2d");x.clearRect(0,0,cv.width,cv.height);x.drawImage(image,0,0,cv.width,cv.height)};image.src=item.image;
    });
  }));
}
function drawLocalStudentStroke(e){
  if(role!=="aluno"||!liveId)return;
  const r=canvas.getBoundingClientRect();const p={x:e.clientX-r.left,y:e.clientY-r.top};
  if(!localDrawing)return;
  ctx.lineTo(p.x,p.y);ctx.stroke();
}
function studentBoardDown(e){
  if(role!=="aluno"||!liveId||!e.isPrimary)return;
  if(indicatorMode||magnifyMode)return;
  localDrawing=true;lastPoint=null;drawSnapshot=canvas.toDataURL("image/png");
  const r=canvas.getBoundingClientRect();const p={x:e.clientX-r.left,y:e.clientY-r.top};
  ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineCap="round";ctx.lineJoin="round";
  ctx.globalCompositeOperation=localDrawMode==="erase"?"destination-out":"source-over";
  ctx.strokeStyle=localDrawMode==="erase"?"rgba(0,0,0,1)":"#1769e0";ctx.lineWidth=localDrawMode==="erase"?24:3;
  ctx.lineTo(p.x+.1,p.y+.1);ctx.stroke();
  e.preventDefault();
}
function studentBoardMove(e){if(role!=="aluno"||!localDrawing)return;drawLocalStudentStroke(e)}
async function studentBoardUp(e){
  if(role!=="aluno"||!localDrawing)return;localDrawing=false;ctx.globalCompositeOperation="source-over";
  try{studentBoardPublish()}catch(_){}
}
function bindStudentBoard(){
  canvas.addEventListener("pointerdown",studentBoardDown);
  canvas.addEventListener("pointermove",studentBoardMove);
  canvas.addEventListener("pointerup",studentBoardUp);
  canvas.addEventListener("pointercancel",()=>{localDrawing=false});
}
function ensureTeacherBoardLayer(){
  if(role!=="aluno")return null;
  let layer=document.getElementById("liveTeacherBoardLayer");
  if(!layer){
    layer=document.createElement("div");layer.id="liveTeacherBoardLayer";layer.className="live-teacher-board-layer";
    const cv=document.createElement("canvas");cv.id="liveTeacherBoardCanvas";layer.appendChild(cv);board.appendChild(layer);
  }
  const cv=layer.querySelector("canvas");cv.width=canvas.width;cv.height=canvas.height;return cv;
}
function drawTeacherBoardSnapshot(data){
  if(role!=="aluno"||!data||typeof data!=="string"||!data.startsWith("data:image/"))return;
  const cv=ensureTeacherBoardLayer();if(!cv)return;
  const im=new Image();im.onload=()=>{const x=cv.getContext("2d");x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,cv.width,cv.height);x.drawImage(im,0,0,cv.width,cv.height)};im.src=data;
}
function bindBoardSync(){
  const c=cloud();if(!c)return;
  const off1=c.listen(boardRoot,data=>{if(role==="professor")drawRemoteSnapshot(data);else if(role==="aluno")drawTeacherBoardSnapshot(data)});
  const off2=c.listen(objectsRoot,data=>{
    if(data==null)return;
    const encoded=typeof data==="string"?data:JSON.stringify(data);
    if(encoded===lastRemoteObjects)return;
    lastRemoteObjects=encoded;applyingRemote=true;
    try{localStorage.setItem(liveObjectsKey(),encoded)}catch(_){}
    applyingRemote=false;window.dispatchEvent(new Event("apsan-board-remote"));
  });
  boardListeners.push(off1,off2);
  window.addEventListener("apsan-board-remote",()=>{
    window.dispatchEvent(new Event("resize"));
    if(role==="aluno"&&typeof window.renderBoardObjects==="function")try{window.renderBoardObjects()}catch(_){}
  });
}
function publishBoardSnapshot(){
  if(role!=="professor"&&!localDrawing)return;
  if(applyingRemote)return;
  clearTimeout(boardSyncTimer);
  boardSyncTimer=setTimeout(()=>{
    const c=cloud();if(!c)return;
    try{
      const data=canvas.toDataURL("image/png");
      const objs=localStorage.getItem(liveObjectsKey())||"[]";
      c.set(boardRoot,data).catch(()=>{});
      c.set(objectsRoot,JSON.parse(objs)).catch(()=>{});
    }catch(_){}
  },80);
}
function bindTeacherBoardSync(){
  if(role!=="professor")return;
  ["pointerup","pointercancel"].forEach(ev=>canvas.addEventListener(ev,publishBoardSnapshot));
  let lastBoardPush=0;
  canvas.addEventListener("pointermove",()=>{if(drawing&&Date.now()-lastBoardPush>180){lastBoardPush=Date.now();publishBoardSnapshot();}});
  const originalSet=localStorage.setItem.bind(localStorage);
  window.addEventListener("apsan-cloud-sync",e=>{
    if(e.detail&&e.detail.key===liveObjectsKey())window.dispatchEvent(new Event("apsan-board-remote"));
  });
  setInterval(()=>{if(!applyingRemote)publishBoardSnapshot()},2500);
}

function patchLocalStorageObjectSync(){
  const original=localStorage.setItem;
  if(original.__apsanPatched)return;
  function wrapped(key,value){
    original.call(localStorage,key,value);
    if(key===liveObjectsKey()&&role==="professor"&&!applyingRemote)publishBoardSnapshot();
  }
  wrapped.__apsanPatched=true;localStorage.setItem=wrapped;
}
async function boot(){
  addStyle();makeStudentTools();makeTeacherPointerTools();bindMediaButtons();bindPointerTracking();listenPointers();listenPresence();bindBoardSync();patchLocalStorageObjectSync();
  if(role==="aluno")clearStudentTeacherBoard();
  classActive=await ensureClassIsActive();
  if(!classActive){markClassEnded();return}
  listenLiveEnd();
  bindLiveChat();
  if(role==="aluno"){bindStudentBoard();listenStudentControls();makeStudentPeer().catch(()=>{});listenStudentPeers();}
  else{listenTeacherPeers();listenStudentBoards();addTeacherControls();}
  publishPresence();
  setInterval(measureNetwork,3000);
  setInterval(addTeacherControls,1500);
  window.addEventListener("beforeunload",()=>{try{publishPointer(0,0,false);cleanupPeers();}catch(_){}});
}
boot();
})();