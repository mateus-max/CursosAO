(() => {
  "use strict";
  function mountASMELayout() {
    const shell = document.querySelector(".classroom-shell");
    const right = document.querySelector(".classroom-right");
    const camera = document.querySelector(".camera-dock");
    if (!shell || !right || !camera || right.dataset.asmeLayout === "1") return;
    right.dataset.asmeLayout = "1";
    shell.classList.add("asme-focus-layout");

    const focus = document.createElement("section");
    focus.className = "asme-teacher-focus";
    focus.innerHTML = '<div class="asme-teacher-focus-head"><div><strong>Professor</strong><small>Transmissão da aula</small></div><span class="asme-live-badge">AO VIVO</span></div><div class="asme-teacher-video"></div>';
    const videoSlot = focus.querySelector(".asme-teacher-video");
    videoSlot.appendChild(camera);

    const tabs = right.querySelector(".right-tabs");
    if (tabs) right.insertBefore(focus, tabs);
    else right.prepend(focus);

    const style = document.createElement("style");
    style.id = "asme-focus-layout-style";
    style.textContent = `
      .asme-focus-layout .classroom-body{grid-template-columns:170px minmax(0,1fr) 360px}
      .asme-focus-layout .classroom-main{background:#eef3f9}
      .asme-focus-layout .board-wrap{padding:16px;background:#eef3f9}
      .asme-focus-layout .board{
        background:#fff;
        background-image:linear-gradient(rgba(23,105,224,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(23,105,224,.035) 1px,transparent 1px);
        background-size:24px 24px;
        border:1px solid #cfdbea;
        border-radius:14px;
        box-shadow:0 12px 35px rgba(18,48,88,.12);
      }
      .asme-focus-layout .board::after{display:none}
      .asme-focus-layout #whiteboardCanvas{cursor:crosshair}
      .asme-focus-layout .board-empty{color:#8a99ad;text-shadow:none}
      .asme-focus-layout .board-text-editor{color:#172033}
      .asme-focus-layout .camera-dock{
        position:relative!important;
        inset:auto!important;
        width:100%!important;
        max-width:none!important;
        padding:0!important;
        margin:0!important;
        border:0!important;
        border-radius:12px!important;
        background:#071a33!important;
        box-shadow:0 10px 26px rgba(0,0,0,.18)!important;
      }
      .asme-focus-layout .camera-dock video{width:100%!important;aspect-ratio:16/10!important;border-radius:10px!important;object-fit:cover}
      .asme-focus-layout .camera-dock-head{padding:8px 9px 5px!important;font-size:11px!important}
      .asme-focus-layout .camera-status{padding:4px 9px 9px!important;font-size:9px!important}
      .asme-teacher-focus{
        margin:12px;
        padding:10px;
        background:#fff;
        color:#172033;
        border:1px solid #dce4ee;
        border-radius:15px;
        box-shadow:0 8px 24px rgba(18,48,88,.08);
      }
      .asme-teacher-focus-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 2px 9px}
      .asme-teacher-focus-head strong{display:block;font-size:14px}
      .asme-teacher-focus-head small{display:block;margin-top:2px;color:#718096;font-size:10px}
      .asme-live-badge{font-size:9px;font-weight:900;color:#fff;background:#e53935;border-radius:999px;padding:5px 8px}
      .asme-teacher-video{width:100%}
      .asme-focus-layout .right-tabs{margin-top:2px}
      @media(max-width:1050px){
        .asme-focus-layout .classroom-body{grid-template-columns:0 minmax(0,1fr) 320px}
        .asme-focus-layout .classroom-side{display:none}
      }
      @media(max-width:760px){
        .asme-focus-layout .classroom-body{display:flex;flex-direction:column}
        .asme-focus-layout .classroom-right{order:-1;max-height:none}
        .asme-teacher-focus{margin:8px}
        .asme-focus-layout .classroom-main{min-height:65dvh}
        .asme-focus-layout .board-wrap{padding:8px}
        .asme-focus-layout .board{min-height:55dvh}
      }
    `;
    document.head.appendChild(style);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountASMELayout);
  else mountASMELayout();
})();
