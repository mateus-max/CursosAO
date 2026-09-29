(function(){
"use strict";
const readLocal=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||"null");return v==null?f:v}catch(_){return f}};
const writeLocal=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
const norm=v=>{const d=String(v||"").replace(/\D/g,"");return d.length>9?d.slice(-9):d};
const clean=v=>String(v||"").trim();
function classroomUrl(id){try{return new URL("quadro.html?live="+encodeURIComponent(id),location.href).href}catch(_){return "quadro.html?live="+encodeURIComponent(id)}}
async function cloudGet(key){try{return window.apsanCloud?await window.apsanCloud.get("appData/"+key):null}catch(_){return null}}
async function cloudSet(key,value){try{if(window.apsanCloud)return await window.apsanCloud.set("appData/"+key,value)}catch(e){console.warn("APSAN live cloud set",e)}return null}
async function officialStudents(teacherPhone,course){
 const out=new Set();
 const add=e=>{if(!e||e.status!=="official"||norm(e.teacherPhone)!==norm(teacherPhone))return;if(course&&e.course&&clean(e.course)!==clean(course))return;const p=norm(e.studentPhone||e.phone);if(p)out.add(p)};
 const local=readLocal("apsan_enrollments",[]);(Array.isArray(local)?local:[]).forEach(add);
 const remote=await cloudGet("apsan_enrollments");if(remote)(Array.isArray(remote)?remote:Object.keys(remote).map(k=>remote[k])).forEach(add);
 return [...out];
}
async function publishLive(item){
 item=Object.assign({},item);const students=new Set();
 const addStudent=function(s){const p=norm(typeof s==="object"?(s.phone||s.studentPhone||s.telefone):s);if(p)students.add(p)};
 (Array.isArray(item.students)?item.students:[]).forEach(addStudent);
 (Array.isArray(item.allowedStudents)?item.allowedStudents:[]).forEach(addStudent);
 (await officialStudents(item.teacherPhone,item.course)).forEach(addStudent);
 const recipients=[...students];
 item.allowedStudents=recipients.slice();item.students=[];item.active=true;item.started=true;item.startedAt=item.startedAt||new Date().toISOString();item.joinUrl=classroomUrl(item.id);
 const list=readLocal("apsan_live_classes",[]),arr=Array.isArray(list)?list.slice():[],i=arr.findIndex(x=>x&&x.id===item.id);if(i>=0)arr[i]=item;else arr.push(item);writeLocal("apsan_live_classes",arr);
 await cloudSet("apsan_live_classes",arr);
 const now=item.startedAt||new Date().toISOString();
 const baseCall={id:"livecall_"+item.id,liveId:item.id,teacherPhone:norm(item.teacherPhone),teacherName:item.teacherName||"Professor",title:item.title||"Aula ao vivo",course:item.course||"Curso",createdAt:now,started:true,startedAt:item.startedAt||now,active:true,joinedAt:null,joinUrl:item.joinUrl,readAt:null,allowedStudents:recipients.slice()};
 await cloudSet("apsan_live_calls_global/"+item.id,baseCall);
 await Promise.all(recipients.map(p=>cloudSet("apsan_live_calls/"+p+"/"+item.id,Object.assign({},baseCall,{id:"livecall_"+item.id+"_"+p,recipientPhone:p}))));
 return item;
}
async function endLive(id){
 const list=readLocal("apsan_live_classes",[]),arr=Array.isArray(list)?list.slice():[],item=arr.find(x=>x&&x.id===id),endedAt=new Date().toISOString();
 if(item){item.active=false;item.endedAt=endedAt;writeLocal("apsan_live_classes",arr);await cloudSet("apsan_live_classes",arr)}
 const calls=await cloudGet("apsan_live_calls");if(calls)await Promise.all(Object.keys(calls).map(p=>calls[p]&&calls[p][id]?cloudSet("apsan_live_calls/"+p+"/"+id,Object.assign({},calls[p][id],{active:false,endedAt})):Promise.resolve()));
 await cloudSet("apsan_live_calls_global/"+id,{id:"livecall_"+id,liveId:id,active:false,endedAt});
 // Ao terminar, a sessão do quadro, objetos e sinalização desta aula são descartados.
 await Promise.all([
   cloudSet("apsan_live_board/"+id,null),
   cloudSet("apsan_board_objects/"+id,null),
   cloudSet("apsan_live_chat/"+id,null),
   cloudSet("apsan_live_media/"+id,null)
 ]);
}
async function hydrateLive(id){
 if(!id)return null;
 const local=readLocal("apsan_live_classes",[]).find(x=>x&&x.id===id)||null;
 if(!window.apsanCloud)return local;
 const remote=await cloudGet("apsan_live_classes");
 let live=null;
 if(Array.isArray(remote)) live=remote.find(x=>x&&x.id===id)||null;
 else if(remote&&typeof remote==="object") live=remote[id]||null;
 const arr=readLocal("apsan_live_classes",[]).filter(x=>!x||x.id!==id);
 if(live){arr.push(live);writeLocal("apsan_live_classes",arr)}
 else{writeLocal("apsan_live_classes",arr)}
 return live;
}
const playedCalls={};
const ringingCalls={};

function stopLiveCallSound(liveId){
 const state=ringingCalls[liveId];
 if(!state)return;
 try{clearTimeout(state.voiceTimer)}catch(_){}
 try{clearTimeout(state.stopTimer)}catch(_){}
 try{state.ac&&state.ac.close&&state.ac.close()}catch(_){}
 try{if(state.voicePending&&window.speechSynthesis)window.speechSynthesis.cancel()}catch(_){}
 delete ringingCalls[liveId];
}

function getLocalStudentIdentity(phone){
 const target=norm(phone);
 try{
   const accounts=JSON.parse(localStorage.getItem("apsan_accounts")||"[]");
   const list=Array.isArray(accounts)?accounts:[];
   const account=list.find(a=>a&&norm(a.phone||a.telefone||a.studentPhone)===target);
   if(account){
     return {
       name:clean(account.name||account.fullName||account.nome||"Aluno"),
       gender:clean(account.gender||account.sexo||account.genero||"").toLowerCase()
     };
   }
 }catch(_){}
 return {name:"Aluno",gender:""};
}

function speakLiveStudentGreeting(call){
 if(!call||call.active===false)return;
 try{
   if(!window.speechSynthesis||typeof window.SpeechSynthesisUtterance!=="function")return;
   const identity=getLocalStudentIdentity(call.recipientPhone);
   const name=identity.name||"Aluno";
   const feminine=/^(f|female|feminino|menina|mulher)$/i.test(identity.gender);
   const prefix=feminine?"Querida":"Querido";
   const utterance=new SpeechSynthesisUtterance(prefix+" "+name+", a aula já está a decorrer, por favor entre na aula agora.");
   utterance.lang="pt-PT";
   utterance.rate=0.94;
   utterance.pitch=1.08;
   utterance.volume=1;
   const voices=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
   const preferred=voices.find(v=>/female|feminina|woman|zira|samantha|helena|joana|maria/i.test(String(v.name||""))&&/^pt(-|_)/i.test(String(v.lang||"")))
     ||voices.find(v=>/^pt(-|_)/i.test(String(v.lang||"")))
     ||voices.find(v=>/female|feminina|woman|zira|samantha|helena|joana|maria/i.test(String(v.name||"")));
   if(preferred)utterance.voice=preferred;
   window.speechSynthesis.cancel();
   window.speechSynthesis.speak(utterance);
 }catch(_){}
}

function ringLiveCallOnce(state){
 try{
   const now=state.ac.currentTime;
   // Toque curto inspirado no toque de chamada do iPhone, sem repetir indefinidamente.
   [[0,523.25],[0.16,659.25],[0.32,783.99],[0.56,659.25],[0.72,523.25],
    [1.02,523.25],[1.18,659.25],[1.34,783.99],[1.58,659.25],[1.74,523.25]]
   .forEach(function(pair){
     const offset=pair[0],freq=pair[1];
     const o=state.ac.createOscillator(),g=state.ac.createGain();
     o.type="sine";o.frequency.value=freq;
     g.gain.setValueAtTime(0.0001,now+offset);
     g.gain.exponentialRampToValueAtTime(0.42,now+offset+0.025);
     g.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.12);
     o.connect(g);g.connect(state.ac.destination);
     o.start(now+offset);o.stop(now+offset+0.14);
   });
 }catch(_){}
}

function playLiveCallSound(call){
 if(!call||call.active===false||ringingCalls[call.liveId])return;
 playedCalls[call.liveId]=true;
 try{
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC){
     setTimeout(function(){speakLiveStudentGreeting(call)},2000);
     return;
   }
   const ac=new AC();
   const state={ac,voiceTimer:null,stopTimer:null,voicePending:true};
   ringingCalls[call.liveId]=state;
   const start=function(){
     try{if(ac.state==="suspended")ac.resume().catch(()=>{});}catch(_){}
     ringLiveCallOnce(state);
     state.voiceTimer=setTimeout(function(){
       if(!ringingCalls[call.liveId])return;
       state.voicePending=false;
       speakLiveStudentGreeting(call);
     },2000);
     state.stopTimer=setTimeout(function(){
       try{ac.close&&ac.close()}catch(_){}
       if(ringingCalls[call.liveId]===state)delete ringingCalls[call.liveId];
     },2050);
   };
   start();
   const unlock=function(){
     try{if(ac.state==="suspended")ac.resume().catch(()=>{});}catch(_){}
   };
   window.addEventListener("pointerdown",unlock,{once:false,passive:true});
   window.addEventListener("keydown",unlock,{once:false,passive:true});
 }catch(_){
   setTimeout(function(){speakLiveStudentGreeting(call)},2000);
 }
}
function mirrorCall(call){
 if(!call)return;
 const all=readLocal("apsan_live_notifications",[]),arr=Array.isArray(all)?all.slice():[],i=arr.findIndex(x=>x&&x.liveId===call.liveId&&norm(x.recipientPhone)===norm(call.recipientPhone));
 if(i>=0)arr[i]=Object.assign({},arr[i],call);else arr.push(call);
 writeLocal("apsan_live_notifications",arr.slice(-300));
 const headers=readLocal("apsan_header_notifications",[]),h=Array.isArray(headers)?headers.slice():[],recipientKey="aluno:"+norm(call.recipientPhone),hi=h.findIndex(x=>x&&x.recipientKey===recipientKey&&x.kind==="live-class"&&x.liveId===call.liveId);
 if(call.active===false){
   stopLiveCallSound(call.liveId);
   if(hi>=0)h.splice(hi,1);
   writeLocal("apsan_header_notifications",h.slice(-100));
   window.dispatchEvent(new CustomEvent("apsan-live-call",{detail:call}));
   return;
 }
 const item={id:"hn_live_"+call.liveId+"_"+norm(call.recipientPhone),recipientKey,recipientType:"aluno",title:"🔴 Aula ao vivo",text:(call.teacherName||"Professor")+" iniciou "+(call.title||"uma aula")+" · toque para entrar.",kind:"live-class",link:call.joinUrl||classroomUrl(call.liveId),liveId:call.liveId,signature:"Aula ao vivo · "+call.liveId,createdAt:call.createdAt||new Date().toISOString(),readAt:null};
 if(hi>=0)h[hi]=item;else h.push(item);writeLocal("apsan_header_notifications",h.slice(-100)); cloudSet("apsan_live_notifications",readLocal("apsan_live_notifications",[])).catch(()=>{}); cloudSet("apsan_header_notifications",readLocal("apsan_header_notifications",[])).catch(()=>{}); playLiveCallSound(call); window.dispatchEvent(new CustomEvent("apsan-live-call",{detail:call}));
}
function listenStudent(phone,callback){
 const studentPhone=norm(phone);
 let stopped=false,offs=[];
 async function attach(){
   if(stopped)return;
   try{
     if(!window.apsanCloud)return;
     if(typeof window.apsanCloud.ready==="function")await window.apsanCloud.ready();
     if(stopped)return;
     const process=async function(call,forceRecipient){
       if(!call||!call.liveId)return null;
       const live=await hydrateLive(call.liveId).catch(()=>null);
       const allowed=live&&live.active===true && live.started===true &&
         (Array.isArray(live.allowedStudents)?live.allowedStudents:Array.isArray(call.allowedStudents)?call.allowedStudents:[])
           .map(norm).includes(studentPhone);
       if(call.active!==false&&allowed){
         const item=Object.assign({},call,{recipientPhone:studentPhone});
         mirrorCall(item);
         return item;
       }
       if(call.active===false || (live&&!live.active)){
         const ended=Object.assign({},call,{recipientPhone:studentPhone,active:false,endedAt:call.endedAt||new Date().toISOString()});
         mirrorCall(ended);
       }
       return null;
     };
     const globalListener=await window.apsanCloud.listen("appData/apsan_live_calls_global",async data=>{
       const map=data&&typeof data==="object"?data:{};
       const active=[];
       for(const id of Object.keys(map)){
         const item=await process(map[id],true);
         if(item)active.push(item);
       }
       if(typeof callback==="function")callback(active);
     });
     const personalListener=await window.apsanCloud.listen("appData/apsan_live_calls/"+studentPhone,async data=>{
       const map=data&&typeof data==="object"?data:{};
       for(const id of Object.keys(map))await process(map[id],false);
       if(typeof callback==="function")callback([]);
     });
     offs=[globalListener,personalListener];
   }catch(e){
     console.warn("APSAN live listener",e);
     offs.forEach(function(fn){try{fn&&fn()}catch(_){}});
     offs=[];
     if(!stopped)setTimeout(attach,1500);
   }
 }
 attach();
 return function(){stopped=true;offs.forEach(function(fn){try{fn&&fn()}catch(_){} });};
}
async function markJoined(phone,id){
 const p=norm(phone),live=await hydrateLive(id);if(!live||live.active!==true)return;
 stopLiveCallSound(id);
 const current=await cloudGet("apsan_live_calls/"+p+"/"+id);if(current){current.joinedAt=current.joinedAt||new Date().toISOString();current.readAt=null;current.active=true;await cloudSet("apsan_live_calls/"+p+"/"+id,current);mirrorCall(current)}
}
window.APSANLive={norm,classroomUrl,publishLive,endLive,hydrateLive,listenStudent,markJoined,stopLiveCallSound};
})();