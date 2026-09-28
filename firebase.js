/* APSAN Academy — Firebase Realtime bridge
   Realtime Database is the online source of truth.
   Firebase Storage is intentionally NOT used.
   localStorage remains only as a temporary compatibility cache so the
   existing screens keep working while their data is moved to Realtime DB.
*/
(function(){
  "use strict";

  if(window.APSANFirebase) return;

  var CONFIG = {
    apiKey: "AIzaSyAaR4GxEGkJ1tr05qLB_onkON-0KumtG-A",
    authDomain: "curso-a0.firebaseapp.com",
    databaseURL: "https://curso-a0-default-rtdb.firebaseio.com/",
    projectId: "curso-a0",
    messagingSenderId: "424486251732",
    appId: "1:424486251732:web:3bba92f4b3c8e255945f41",
    measurementId: "G-B21TEJEP7Q"
  };

  var SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
  var readyPromise = null;
  var app = null;
  var auth = null;
  var db = null;

  function loadScript(src){
    return new Promise(function(resolve,reject){
      var s=document.createElement("script");
      s.src=src;
      s.async=false;
      s.onload=resolve;
      s.onerror=function(){reject(new Error("Não foi possível carregar o Firebase."));};
      document.head.appendChild(s);
    });
  }

  function init(){
    if(readyPromise) return readyPromise;
    readyPromise = Promise.resolve()
      .then(function(){ return loadScript(SDK+"firebase-app-compat.js"); })
      .then(function(){ return loadScript(SDK+"firebase-auth-compat.js"); })
      .then(function(){ return loadScript(SDK+"firebase-database-compat.js"); })
      .then(function(){
        app = window.firebase.apps.length
          ? window.firebase.app()
          : window.firebase.initializeApp(CONFIG);
        auth = window.firebase.auth();
        db = window.firebase.database();
        return {app:app,auth:auth,db:db};
      });
    return readyPromise;
  }

  function normalizePhone(value){
    var digits=String(value||"").replace(/\D/g,"");
    return digits.length>9 ? digits.slice(-9) : digits;
  }

  function safeId(value){
    return String(value||"").replace(/[^a-zA-Z0-9_-]/g,"_");
  }

  function accountEmail(account){
    if(account && account.type==="direcao") return "suporte@apsanlda.com";
    var phone=normalizePhone(account && account.phone);
    var type=safeId(account && account.type || "user");
    return phone+"."+type+"@curso-a0.firebaseapp.com";
  }

  function accountKey(account){
    return safeId(
      account && account.id ||
      (normalizePhone(account && account.phone)+"_"+String(account && account.type||"user"))
    );
  }

  function stripSecret(account){
    var copy=Object.assign({},account||{});
    delete copy.password;
    return copy;
  }

  function readLocalAccounts(){
    try{
      var list=JSON.parse(localStorage.getItem("apsan_accounts")||"[]");
      return Array.isArray(list)?list:[];
    }catch(_){return [];}
  }

  function mergeAccounts(local,remote){
    var merged=[];
    var seen={};
    function add(item){
      if(!item||typeof item!=="object") return;
      var key=accountKey(item)+"|"+normalizePhone(item.phone)+"|"+String(item.type||"");
      if(seen[key]){
        var old=seen[key];
        seen[key]=Object.assign({},old,item,old.password&&!item.password?{password:old.password}:{});
        var idx=merged.indexOf(old);
        if(idx>=0) merged[idx]=seen[key];
        return;
      }
      var copy=Object.assign({},item);
      seen[key]=copy;
      merged.push(copy);
    }
    (local||[]).forEach(add);
    (remote||[]).forEach(add);
    return merged;
  }

  async function syncAccounts(){
    var ctx=await init();
    var snap=await ctx.db.ref("accounts").once("value");
    var remote=snap.val()||{};
    var remoteList=Object.keys(remote).map(function(k){
      return Object.assign({id:k},remote[k]||{});
    });
    var local=readLocalAccounts();
    var merged=mergeAccounts(local,remoteList);

    var updates={};
    merged.forEach(function(account){
      var key=accountKey(account);
      if(!remote[key]){
        updates["accounts/"+key]=stripSecret(account);
      }
    });
    if(Object.keys(updates).length) await ctx.db.ref().update(updates);

    localStorage.setItem("apsan_accounts",JSON.stringify(merged));
    return merged;
  }

  async function saveAccount(account){
    var ctx=await init();
    var key=accountKey(account);
    await ctx.db.ref("accounts/"+key).set(stripSecret(Object.assign({},account,{id:key})));
    var local=readLocalAccounts();
    var next=local.filter(function(x){
      return accountKey(x)!==key &&
        !(normalizePhone(x.phone)===normalizePhone(account.phone)&&String(x.type||"")===String(account.type||""));
    });
    next.push(Object.assign({},account,{id:key}));
    localStorage.setItem("apsan_accounts",JSON.stringify(next));
    localStorage.setItem("apsan_account",JSON.stringify(Object.assign({},account,{id:key})));
    return Object.assign({},account,{id:key});
  }

  async function authenticateAccount(account){
    var ctx=await init();
    if(!account || !account.password) throw new Error("A conta não possui palavra-passe.");
    var email=accountEmail(account);
    var credential;
    try{
      credential=await ctx.auth.signInWithEmailAndPassword(email,account.password);
    }catch(error){
      if(error && (error.code==="auth/user-not-found" || error.code==="auth/invalid-credential" || error.code==="auth/invalid-login-credentials")){
        credential=await ctx.auth.createUserWithEmailAndPassword(email,account.password);
      }else{
        throw error;
      }
    }
    await saveAccount(Object.assign({},account,{authUid:credential.user.uid,authEmail:email}));
    return credential.user;
  }

  async function signOut(){
    var ctx=await init();
    return ctx.auth.signOut();
  }

  async function createAccount(account){
    var user=await authenticateAccount(account);
    return saveAccount(Object.assign({},account,{authUid:user.uid,authEmail:accountEmail(account)}));
  }

  async function listen(path,callback){
    var ctx=await init();
    var ref=ctx.db.ref(path);
    ref.on("value",function(snapshot){
      callback(snapshot.val(),snapshot);
    });
    return function(){ref.off("value",callback);};
  }

  async function set(path,value){
    var ctx=await init();
    return ctx.db.ref(path).set(value);
  }

  async function update(path,value){
    var ctx=await init();
    return ctx.db.ref(path).update(value);
  }

  async function push(path,value){
    var ctx=await init();
    return ctx.db.ref(path).push(value);
  }

  async function remove(path){
    var ctx=await init();
    return ctx.db.ref(path).remove();
  }

  async function get(path){
    var ctx=await init();
    var snap=await ctx.db.ref(path).once("value");
    return snap.val();
  }

  window.APSANFirebase={
    config:CONFIG,
    init:init,
    normalizePhone:normalizePhone,
    accountEmail:accountEmail,
    accountKey:accountKey,
    stripSecret:stripSecret,
    syncAccounts:syncAccounts,
    saveAccount:saveAccount,
    authenticateAccount:authenticateAccount,
    createAccount:createAccount,
    signOut:signOut,
    listen:listen,
    get:get,
    set:set,
    update:update,
    push:push,
    remove:remove
  };

  /* Sync the account catalogue without changing the current UI flow. */
  init().then(syncAccounts).catch(function(error){
    console.warn("Firebase Realtime indisponível:",error);
  });
})();