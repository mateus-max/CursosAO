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
const declinedLiveCalls={};
const laterLiveCalls={};

function stopLiveCallSound(liveId){
 const state=ringingCalls[liveId];
 if(!state)return;
 try{clearTimeout(state.voiceTimer)}catch(_){}
 try{clearTimeout(state.cycleTimer)}catch(_){}
 try{clearTimeout(state.stopTimer)}catch(_){}
 try{state.ac&&state.ac.close&&state.ac.close()}catch(_){}
 try{if(window.speechSynthesis)window.speechSynthesis.cancel()}catch(_){}
 delete ringingCalls[liveId];
}

function getLocalStudentIdentity(phone){
 const target=norm(phone);
 try{
  const accounts=JSON.parse(localStorage.getItem("apsan_accounts")||"[]");
  const list=Array.isArray(accounts)?accounts:[];
  const account=list.find(a=>a&&norm(a.phone||a.telefone||a.studentPhone)===target);
  if(account)return {name:clean(account.name||account.fullName||account.nome||"Aluno"),gender:clean(account.gender||account.sexo||account.genero||"").toLowerCase()};
 }catch(_){}
 return {name:"Aluno",gender:""};
}
function firstNameFromProfile(name){return clean(name).split(/\s+/)[0]||"Aluno";}
function inferStudentGenderFromFirstName(name){
 const first=firstNameFromProfile(name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const female=new Set("abigail adriana alda alexandra alice aline amanda ana andreia angela angelica anita beatriz belinda bruna carla carolina cassia cassiana celia clara claudia cristina daniela diana dina edite edna eliana elisabete elisa elizabeth eloisa elsa emilia erica fabiana fatima filomena flavia gabriela gilda gisela helena ines irene isabel isabela jacinta joana josefina juliana julia katia laura leonor leticia lidia liliana lucia luisa magdalena manuela marcia margarida maria mariana marisa marta matilde michelle monica nadia natalia nelma noemia patricia paula raquel renata rita rosa rosana sandra sara silvia sofia sonia susana tania tatiana teresa valeria vanessa vera veronica vitoria".split(" "));
 const male=new Set("abel adriano alberto alexandre alfredo amaro andre antonio armando artur augusto benjamin bernardo bruno carlos celso cesar cristiano daniel david domingos edgar eduardo elias emilio ernesto estevao fabio felipe fernando francisco gabriel geraldo gilberto gil heitor henrique hugo isaias joao jorge jose julio justino leandro leonardo lourenco lucas manuel marco marcos mateus mauricio miguel moises nelson nicolas nicolau octavio oscar paulo pedro rafael raul ricardo roberto rodrigo romao rui samuel sebastiao sergio silvio simao tomas valdemar vicente vitor wellington wilson".split(" "));
 if(female.has(first))return"female";
 if(male.has(first))return"male";
 return"";
}
function studentAddressFromProfile(identity){
 const inferred=inferStudentGenderFromFirstName(identity.name);
 if(inferred)return inferred;
 const g=String(identity.gender||"").toLowerCase();
 return /^(f|female|feminino|menina|mulher)$/.test(g)?"female":"male";
}
const speakingCalls={};
function speakLiveStudentGreeting(call,onEnd){
 if(!call||call.active===false)return;
 const liveId=call.liveId;
 if(speakingCalls[liveId])return;
 speakingCalls[liveId]=true;
 const finish=function(){
   delete speakingCalls[liveId];
   if(onEnd)onEnd();
 };
 try{
  if(!window.speechSynthesis||typeof window.SpeechSynthesisUtterance!=="function"){finish();return;}
  const identity=getLocalStudentIdentity(call.recipientPhone);
  const name=firstNameFromProfile(identity.name)||"Aluno";
  const prefix=studentAddressFromProfile(identity)==="female"?"Senhora":"Senhor";
  const parts=[
   prefix+" "+name+",",
   "entre na aula,",
   "a sua aula já está a decorrer."
  ];
  const voices=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
  const preferred=voices.find(v=>/female|feminina|woman|zira|samantha|helena|joana|maria/i.test(String(v.name||""))&&/^pt(-|_)/i.test(String(v.lang||"")))
   ||voices.find(v=>/^pt(-|_)/i.test(String(v.lang||"")))
   ||voices.find(v=>/female|feminina|woman|zira|samantha|helena|joana|maria/i.test(String(v.name||"")));
  let index=0;
  const speakNext=function(){
   if(!ringingCalls[liveId]||call.active===false){finish();return;}
   if(index>=parts.length){finish();return;}
   const utterance=new SpeechSynthesisUtterance(parts[index++]);
   utterance.lang="pt-PT";utterance.rate=0.88;utterance.pitch=1.08;utterance.volume=1;
   if(preferred)utterance.voice=preferred;
   let settled=false;
   const next=function(){
    if(settled)return;
    settled=true;
    setTimeout(speakNext,120);
   };
   utterance.onend=next;
   utterance.onerror=next;
   window.speechSynthesis.speak(utterance);
  };
  speakNext();
 }catch(_){finish();}
}
function scheduleLiveCallCycle(call,state){
 if(!state||!ringingCalls[call.liveId]||call.active===false)return;
 try{if(state.ac.state==="suspended")state.ac.resume().catch(()=>{});}catch(_){}
 ringLiveCallOnce(state);
 state.voiceTimer=setTimeout(function(){
  if(!ringingCalls[call.liveId]||call.active===false)return;
  speakLiveStudentGreeting(call,function(){
   if(!ringingCalls[call.liveId]||call.active===false)return;
   state.cycleTimer=setTimeout(function(){scheduleLiveCallCycle(call,state)},700);
  });
 },1000);
}
function playLiveCallSound(call){
 if(!call||call.active===false||ringingCalls[call.liveId]||declinedLiveCalls[call.liveId]||laterLiveCalls[call.liveId])return;
 playedCalls[call.liveId]=true;
 try{
   const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
   const ac=new AC(),state={ac,voiceTimer:null,cycleTimer:null};ringingCalls[call.liveId]=state;scheduleLiveCallCycle(call,state);
   const unlock=function(){try{if(ac.state==="suspended")ac.resume().catch(()=>{});}catch(_){}};
   window.addEventListener("pointerdown",unlock,{passive:true});window.addEventListener("keydown",unlock,{passive:true});
 }catch(_){}
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
   const endedId="hn_live_ended_"+call.liveId+"_"+norm(call.recipientPhone);
   if(!h.some(x=>x&&x.id===endedId)){
     h.push({id:endedId,recipientKey,recipientType:"aluno",title:"Aula encerrada",
       text:(call.teacherName||"Professor")+" encerrou "+(call.title||"a aula")+".",
       kind:"live-class-ended",link:"",liveId:call.liveId,signature:"Aula encerrada · "+call.liveId,
       createdAt:call.endedAt||new Date().toISOString(),readAt:null});
   }
   writeLocal("apsan_header_notifications",h.slice(-100));
   cloudSet("apsan_header_notifications",readLocal("apsan_header_notifications",[])).catch(()=>{});
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
         if(call.callDecision==="declined"||call.callDecision==="later"){
           stopLiveCallSound(call.liveId);
           return call;
         }
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
async function setStudentCallDecision(phone,id,decision){
 const p=norm(phone);
 stopLiveCallSound(id);
 if(decision==="declined")declinedLiveCalls[id]=true;
 if(decision==="later")laterLiveCalls[id]=true;
 const current=await cloudGet("apsan_live_calls/"+p+"/"+id);
 if(current){
   current.callDecision=decision;
   current.decisionAt=new Date().toISOString();
   current.active=true;
   await cloudSet("apsan_live_calls/"+p+"/"+id,current);
   mirrorCall(Object.assign({},current,{recipientPhone:p}));
 }
 return true;
}
window.APSANLive={norm,classroomUrl,publishLive,endLive,hydrateLive,listenStudent,markJoined,stopLiveCallSound,setStudentCallDecision};
})();