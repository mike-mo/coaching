"use strict";
(() => {
  const key="icf-study-theme-v1";
  const root=document.documentElement;
  const system=window.matchMedia("(prefers-color-scheme: dark)");
  const choices=["system","light","dark"];
  let preference="light", error="";
  try {
    const saved=localStorage.getItem(key);
    if(saved!==null){
      if(!choices.includes(saved))throw new Error("Invalid theme preference");
      preference=saved;
    }
  } catch {
    error="We couldn't open your saved theme. Using light for now.";
  }
  const effective=()=>preference==="system"?(system.matches?"dark":"light"):preference;
  function apply() {
    root.dataset.theme=preference;
    document.querySelector('meta[name="theme-color"]').content=effective()==="dark"?"#070a08":"#faf8f2";
  }
  function updateControls() {
    const dark=effective()==="dark";
    const toggle=document.querySelector("#theme-toggle");
    toggle.setAttribute("aria-label",`Switch to ${dark?"light":"dark"} theme`);
    toggle.title=`Switch to ${dark?"light":"dark"} theme`;
    toggle.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${dark?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>':'<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/>'}</svg>`;
    document.querySelector("#theme-select").value=preference;
    const warning=document.querySelector("#theme-warning");
    warning.textContent=error; warning.hidden=!error;
  }
  function choose(next) {
    preference=next; apply();
    try {
      localStorage.setItem(key,next);
      error="";
    } catch {
      error="Your theme changed for this tab, but your browser couldn't save the choice. After a refresh, it may use your previous theme.";
    }
    updateControls();
    document.querySelector("#announcement").textContent=next==="system"?"Following your system theme.":`${next==="dark"?"Dark":"Light"} theme selected.`;
  }
  apply();
  document.addEventListener("DOMContentLoaded",()=>{
    updateControls();
    document.querySelector("#theme-toggle").onclick=()=>choose(effective()==="dark"?"light":"dark");
    document.querySelector("#theme-select").onchange=e=>choose(e.target.value);
    system.addEventListener("change",()=>{if(preference==="system"){apply();updateControls();}});
  });
})();
