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
 item=Object.assign({},item);const students=new Set((Array.isArray(item.students)?item.students:[]).map(s=>norm(typeof s==="object"?(s.phone||s.studentPhone||s.telefone):s)).filter(Boolean));
 (await officialStudents(item.teacherPhone,item.course)).forEach(p=>students.add(p));
 item.students=[...students];item.active=true;item.joinUrl=classroomUrl(item.id);
 const list=readLocal("apsan_live_classes",[]),arr=Array.isArray(list)?list.slice():[],i=arr.findIndex(x=>x&&x.id===item.id);if(i>=0)arr[i]=item;else arr.push(item);writeLocal("apsan_live_classes",arr);
 await cloudSet("apsan_live_classes",arr);
 const now=item.startedAt||new Date().toISOString();
 await Promise.all(item.students.map(p=>cloudSet("apsan_live_calls/"+p+"/"+item.id,{id:"livecall_"+item.id+"_"+p,liveId:item.id,recipientPhone:p,teacherPhone:norm(item.teacherPhone),teacherName:item.teacherName||"Professor",title:item.title||"Aula ao vivo",course:item.course||"Curso",createdAt:now,active:true,joinedAt:null,joinUrl:item.joinUrl,readAt:null})));
 return item;
}
async function endLive(id){
 const list=readLocal("apsan_live_classes",[]),arr=Array.isArray(list)?list.slice():[],item=arr.find(x=>x&&x.id===id),endedAt=new Date().toISOString();
 if(item){item.active=false;item.endedAt=endedAt;writeLocal("apsan_live_classes",arr);await cloudSet("apsan_live_classes",arr)}
 const calls=await cloudGet("apsan_live_calls");if(calls)await Promise.all(Object.keys(calls).map(p=>calls[p]&&calls[p][id]?cloudSet("apsan_live_calls/"+p+"/"+id,Object.assign({},calls[p][id],{active:false,endedAt})):Promise.resolve()));
}
async function hydrateLive(id){
 if(!id)return null;let local=readLocal("apsan_live_classes",[]).find(x=>x&&x.id===id)||null,remote=await cloudGet("apsan_live_classes");
 if(Array.isArray(remote)){const f=remote.find(x=>x&&x.id===id);if(f)local=f}else if(remote&&remote[id])local=remote[id];
 if(local){const arr=readLocal("apsan_live_classes",[]).filter(x=>!x||x.id!==id);arr.push(local);writeLocal("apsan_live_classes",arr)}
 return local;
}
function mirrorCall(call){
 if(!call)return;const all=readLocal("apsan_live_notifications",[]),arr=Array.isArray(all)?all.slice():[],i=arr.findIndex(x=>x&&x.liveId===call.liveId&&norm(x.recipientPhone)===norm(call.recipientPhone));if(i>=0)arr[i]=call;else arr.push(call);writeLocal("apsan_live_notifications",arr.slice(-300));
 const headers=readLocal("apsan_header_notifications",[]),h=Array.isArray(headers)?headers.slice():[],recipientKey="aluno:"+norm(call.recipientPhone),hi=h.findIndex(x=>x&&x.recipientKey===recipientKey&&x.kind==="live-class"&&x.liveId===call.liveId);
 const item={id:"hn_live_"+call.liveId+"_"+norm(call.recipientPhone),recipientKey,recipientType:"aluno",title:"🔴 Aula ao vivo",text:(call.teacherName||"Professor")+" iniciou "+(call.title||"uma aula")+" · toque para entrar.",kind:"live-class",link:call.joinUrl||classroomUrl(call.liveId),liveId:call.liveId,signature:"Aula ao vivo · "+call.liveId,createdAt:call.createdAt||new Date().toISOString(),readAt:null};
 if(hi>=0)h[hi]=item;else h.push(item);writeLocal("apsan_header_notifications",h.slice(-100));window.dispatchEvent(new CustomEvent("apsan-live-call",{detail:call}));
}
function listenStudent(phone,callback){
 if(!window.apsanCloud)return function(){};
 let off=function(){};
 window.apsanCloud.listen("appData/apsan_live_calls/"+norm(phone),async data=>{const map=data&&typeof data==="object"?data:{};const active=[];Object.keys(map).forEach(id=>{const call=map[id];if(call&&call.active!==false){mirrorCall(call);active.push(call)}});await Promise.all(active.map(call=>hydrateLive(call.liveId).catch(()=>null)));if(typeof callback==="function")callback(map)}).then(fn=>{off=fn}).catch(e=>console.warn("APSAN live listener",e));
 return ()=>off();
}
async function markJoined(phone,id){
 const p=norm(phone),current=await cloudGet("apsan_live_calls/"+p+"/"+id);if(current){current.joinedAt=current.joinedAt||new Date().toISOString();current.readAt=null;current.active=true;await cloudSet("apsan_live_calls/"+p+"/"+id,current);mirrorCall(current)}
}
window.APSANLive={norm,classroomUrl,publishLive,endLive,hydrateLive,listenStudent,markJoined};
})();