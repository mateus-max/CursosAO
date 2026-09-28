/* Firebase — APSAN Academy / CursosAO
 * Backend online: Firebase Realtime Database + Authentication.
 * This file intentionally contains only public Firebase web configuration.
 */
(function(){
  if (window.firebase && window.firebase.apps && window.firebase.apps.length) return;

  var scripts = [
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-database-compat.js",
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage-compat.js",
  ];

  function load(index){
    if(index >= scripts.length){
      var firebaseConfig = {
        apiKey: "AIzaSyAaR4GxEGkJ1tr05qLB_onkON-0KumtG-A",
        authDomain: "curso-a0.firebaseapp.com",
        databaseURL: "https://curso-a0-default-rtdb.firebaseio.com/",
        projectId: "curso-a0",
        messagingSenderId: "424486251732",
        appId: "1:424486251732:web:3bba92f4b3c8e255945f41",
        measurementId: "G-B21TEJEP7Q",
        storageBucket: "curso-a0.firebasestorage.app"
      };

      if(!window.firebase.apps.length) window.firebase.initializeApp(firebaseConfig);

      window.apsanFirebase = {
        app: window.firebase.app(),
        auth: window.firebase.auth(),
        db: window.firebase.database(),
        storage: window.firebase.storage()
      };
      window.dispatchEvent(new CustomEvent("apsan-firebase-ready"));
      return;
    }
    var s=document.createElement("script");
    s.src=scripts[index];
    s.async=false;
    s.onload=function(){load(index+1)};
    s.onerror=function(){console.error("Firebase SDK não pôde ser carregado:",scripts[index])};
    document.head.appendChild(s);
  }
  load(0);
})();