/* APSAN Academy — Firebase cloud data helpers
 * Realtime Database URL: https://curso-a0-default-rtdb.firebaseio.com/
 *
 * These helpers are the migration boundary. Existing pages can be moved
 * from localStorage to Firebase one module at a time without changing UI.
 */
(function(){
  function ready(){
    return new Promise(function(resolve,reject){
      if(window.apsanFirebase) return resolve(window.apsanFirebase);
      var done=false;
      function onReady(){ if(done)return; done=true; window.removeEventListener("apsan-firebase-ready",onReady); resolve(window.apsanFirebase); }
      window.addEventListener("apsan-firebase-ready",onReady,{once:true});
      setTimeout(function(){ if(done)return; done=true; window.removeEventListener("apsan-firebase-ready",onReady); reject(new Error("Firebase não ficou disponível.")); },15000);
    });
  }

  function clean(value){
    return String(value==null?"":value).trim().replace(/[.#$\[\]/]/g,"_");
  }

  window.apsanCloud = {
    ready: ready,
    path: function(path){ return String(path||"").split("/").filter(Boolean).map(clean).join("/"); },
    get: async function(path){
      var f=await ready();
      var snap=await f.db.ref(this.path(path)).get();
      return snap.exists()?snap.val():null;
    },
    set: async function(path,value){
      var f=await ready();
      await f.db.ref(this.path(path)).set(value);
      return value;
    },
    update: async function(path,value){
      var f=await ready();
      await f.db.ref(this.path(path)).update(value||{});
      return value;
    },
    push: async function(path,value){
      var f=await ready();
      var r=f.db.ref(this.path(path)).push();
      await r.set(value);
      return r.key;
    },
    remove: async function(path){
      var f=await ready();
      await f.db.ref(this.path(path)).remove();
    },
    listen: async function(path,callback){
      var f=await ready();
      var ref=f.db.ref(this.path(path));
      var handler=function(snap){callback(snap.exists()?snap.val():null,snap);};
      ref.on("value",handler);
      return function(){ref.off("value",handler);};
    }
  };
})();