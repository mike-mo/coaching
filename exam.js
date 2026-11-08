"use strict";
window.EXAM = (() => {
  const duration = 2 * 60 * 60 * 1000;
  const normalizeTitle = text => (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).join(" ");
  const titleLabel = (competency, text = competency.title) => `C${competency.id} ${text}`;
  function validAttempt(a) {
    if (a === null || a === undefined) return true;
    if (!a || typeof a !== "object" || !["untimed","timed"].includes(a.mode) ||
        !["draft","submitted","expired"].includes(a.status) ||
        !Number.isFinite(a.startedAt) || a.startedAt <= 0 ||
        !Array.isArray(a.answers) || a.answers.length !== 8) return false;
    if (a.mode === "timed" ? a.deadline !== a.startedAt + duration : a.deadline !== null) return false;
    if (a.status === "draft" ? a.finishedAt !== null : !Number.isFinite(a.finishedAt) || a.finishedAt < a.startedAt) return false;
    if (a.status === "expired" && (a.mode !== "timed" || a.finishedAt !== a.deadline)) return false;
    return a.answers.every(answer => answer && typeof answer.title === "string" &&
      Array.isArray(answer.bullets) && answer.bullets.length === 3 && answer.bullets.every(b => typeof b === "string"));
  }
  function compareTitle(actual, position, competencies) {
    const expected = competencies[position - 1];
    const entered = normalizeTitle(actual);
    if (!entered) return {kind:"blank", message:actual.trim() ? "There are no words in this answer." : "You left this title blank."};
    if (entered === normalizeTitle(expected.title)) return {kind:"match", message:"Got it!"};
    const elsewhere = competencies.find(c => normalizeTitle(c.title) === entered);
    if (elsewhere) return {kind:"wrong-slot", message:`That's competency ${elsewhere.id}. This space is for competency ${position}.`};
    const actualWords = entered.split(" ");
    const expectedWords = normalizeTitle(expected.title).split(" ");
    const unmatched = (left, right) => {
      const pool = [...right];
      return left.filter(word => {
        const index = pool.indexOf(word);
        if (index === -1) return true;
        pool.splice(index,1); return false;
      });
    };
    const missing = unmatched(expectedWords,actualWords);
    const extra = unmatched(actualWords,expectedWords);
    if (!missing.length && !extra.length) return {kind:"word-order", message:"The words are right; their order needs changing."};
    return {kind:"different", message:[
      missing.length ? `Missing words: ${missing.join(", ")}.` : "",
      extra.length ? `Extra or changed words: ${extra.join(", ")}.` : ""
    ].filter(Boolean).join(" ")};
  }
  function create(options) {
    const {get,set,save,storageError,hasStorageFailure,announce,escape,focus,home,isVisible,onFinished,citation} = options;
    const D = window.STUDY;
    const main = document.querySelector("main");
    const checkIcon = '<svg class="exam-check-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    let pendingAction = null;
    const dialog = document.createElement("dialog");
    dialog.id = "exam-confirm-dialog";
    dialog.setAttribute("aria-labelledby","exam-confirm-title");
    document.body.append(dialog);
    function incomplete(a) {
      return {
        titles:a.answers.filter(answer => !normalizeTitle(answer.title)).length,
        bullets:a.answers.reduce((n,answer) => n + answer.bullets.filter(b => !b.trim()).length,0)
      };
    }
    function blanksText(missing) {
      return [
        missing.titles ? `${missing.titles} title${missing.titles===1?"":"s"}` : "",
        missing.bullets ? `${missing.bullets} point${missing.bullets===1?"":"s"}` : ""
      ].filter(Boolean).join(" and ");
    }
    function confirm(title, message, label, action, cancelLabel = "Keep this rehearsal") {
      pendingAction = action;
      dialog.innerHTML = `<h2 id="exam-confirm-title">${title}</h2><p>${message}</p><div class="actions"><button id="exam-cancel">${cancelLabel}</button><button class="primary" id="exam-confirm">${label}</button></div>`;
      document.querySelector("#exam-cancel").onclick = () => {pendingAction=null;dialog.close();};
      document.querySelector("#exam-confirm").onclick = () => {
        const execute=pendingAction;pendingAction=null;dialog.close();execute?.();
      };
      dialog.showModal();
      document.querySelector("#exam-cancel").focus();
    }
    dialog.addEventListener("cancel",()=>{pendingAction=null;});
    function finish(status = "submitted", refresh = true) {
      const a=get();
      if (!a || a.status !== "draft") return;
      a.status=status;
      a.finishedAt=status === "expired" ? a.deadline : Date.now();
      save();
      pendingAction=null;
      if(dialog.open)dialog.close();
      if(refresh){
        if(isVisible()){render();focus();}
        else onFinished();
      }
      const matches=a.answers.filter((answer,i)=>compareTitle(answer.title,i+1,D.competencies).kind==="match").length;
      announce(`${status === "expired" ? "Time is up. " : ""}${matches} of 8 titles correct. Review your three points for each competency.`);
    }
    function expire() {
      const a=get();
      if(a?.status === "draft" && a.mode === "timed" && Date.now() >= a.deadline){
        finish("expired");return true;
      }
      return false;
    }
    function discard() {
      const a=get();
      if(!a)return;
      confirm(a.status === "draft" ? "Discard this draft?" : "Replace this rehearsal?",
        "This deletes your rehearsal answers from this browser. Save a text copy first if you want to keep them. Your other practice counts stay the same.",
        a.status === "draft" ? "Discard draft" : "Start another rehearsal",
        () => {
          const previous=get();set(null);
          if(!save()){
            set(previous);
            storageError("Your browser couldn't delete this rehearsal. Your answers are still here. Try again, or clear this site's data in your browser settings.");
            return;
          }
          render();focus();announce("Rehearsal deleted. You can start a new one.");
        });
    }
    function download() {
      const a=get();if(!a)return;
      const text = ["Core competency exam rehearsal",`Timer: ${a.mode === "timed" ? "Two hours" : "No timer"}`,`Status: ${{draft:"In progress",submitted:"Finished",expired:"Time is up"}[a.status]}`,
        `Started: ${new Date(a.startedAt).toISOString()}`,
        ...(a.deadline ? [`Timer ends: ${new Date(a.deadline).toISOString()}`] : []),"",
        ...a.answers.flatMap((answer,i)=>{
          const named=a.status==="draft"?null:D.competencies.find(c=>normalizeTitle(c.title)===normalizeTitle(answer.title));
          const title=named?titleLabel(named,answer.title):`C${i+1} · Your title: ${answer.title}`;
          return [`${i+1}. ${title}`,...answer.bullets.map((b,j)=>`  ${j+1}. ${b}`),""];
        })
      ].join("\n");
      const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
      const link=document.createElement("a");
      link.href=url;link.download="icf-exam-rehearsal.txt";document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function timer() {
      const a=get(), element=document.querySelector("#exam-time");
      if(!element || a?.status !== "draft" || a.mode !== "timed")return;
      const seconds=Math.max(0,Math.ceil((a.deadline-Date.now())/1000));
      const hours=Math.floor(seconds/3600);
      const minutes=Math.floor(seconds%3600/60);
      element.textContent=[hours,minutes,seconds%60].map(n=>String(n).padStart(2,"0")).join(":");
      element.setAttribute("aria-label",`${Math.ceil(seconds/60)} minutes remaining`);
    }
    function saveLabel() {
      const element=document.querySelector("#exam-save");
      if(element)element.textContent=hasStorageFailure() ? "Not saved. Keep this tab open or save a text copy." : "Saved in this browser.";
    }
    function renderSetup() {
      main.innerHTML=`<p class="eyebrow">Written practice</p><h1>Exam rehearsal</h1><p class="lead">Write all eight titles in order, exactly as ICF names them. For each one, add three points in your own words about what a coach says or does in a session.</p>
        <section class="card exam-setup"><p>Type the titles without their C numbers. Choose a two-hour timer, or practice at your own pace.</p>
        <fieldset class="exam-mode"><legend>Use a timer?</legend><label><input type="radio" name="exam-mode" value="untimed" checked> No timer</label><label><input type="radio" name="exam-mode" value="timed"> Two-hour timer</label></fieldset>
        <p class="muted">The timer keeps running if you leave or refresh. At two hours, your answers open for review. Start another rehearsal for a new timer.</p>
        <div class="actions"><button class="primary" id="exam-start">Start rehearsal</button><button id="exam-home">Back to home</button></div></section>`;
      document.querySelector("#exam-start").onclick=()=>{
        if(get())return;
        const mode=document.querySelector('input[name="exam-mode"]:checked').value;
        const startedAt=Date.now();
        set({mode,status:"draft",startedAt,deadline:mode === "timed" ? startedAt+duration : null,finishedAt:null,
          answers:Array.from({length:8},()=>({title:"",bullets:["","",""]}))});
        const saved=save();render();focus("#exam-title-1");
        announce(saved ? "Rehearsal started. Your answers save as you type." : "Rehearsal started, but your browser couldn't save it. Keep this tab open or save a text copy.");
      };
      document.querySelector("#exam-home").onclick=home;
    }
    function renderDraft(a) {
      main.innerHTML=`<p class="eyebrow">Rehearsal ${a.mode === "timed" ? "with a two-hour timer" : "without a timer"}</p><h1>Write from memory.</h1><p class="lead">Eight titles in order, with three points for each about what a coach does in a session. Use your own words for the points.</p>
        <div class="exam-toolbar"><span id="exam-save"></span>${a.mode === "timed" ? '<span class="exam-clock">Time remaining <strong id="exam-time" role="timer" aria-live="off"></strong></span>' : "<span>No time limit</span>"}</div>
        <p class="muted">Change any answer before you finish. Your draft saves as you type; you can leave and come back to it. Use fictional examples and leave out client details.</p>
        <nav class="exam-jumps" aria-label="Go to a numbered competency">${a.answers.map((_,i)=>`<a href="#exam-slot-${i+1}" aria-label="Go to C${i+1}">C${i+1}</a>`).join("")}</nav>
        <form id="exam-form">${a.answers.map((answer,i)=>`<fieldset class="card exam-slot" id="exam-slot-${i+1}"><legend>C${i+1}</legend>
          <label for="exam-title-${i+1}">Title for C${i+1}</label><input id="exam-title-${i+1}" data-exam-slot="${i}" data-exam-field="title" value="${escape(answer.title)}" autocomplete="off" spellcheck="false">
          ${answer.bullets.map((bullet,j)=>`<label for="exam-bullet-${i+1}-${j+1}">Point ${j+1}</label><textarea id="exam-bullet-${i+1}-${j+1}" data-exam-slot="${i}" data-exam-field="${j}" rows="3">${escape(bullet)}</textarea>`).join("")}
          </fieldset>`).join("")}<div class="actions"><button class="primary" type="submit">Finish rehearsal</button><button id="exam-download" type="button">Save a text copy</button><button id="exam-discard" type="button">Discard draft</button><button id="exam-home" type="button">Back to home</button></div></form>`;
      document.querySelectorAll("[data-exam-slot]").forEach(input=>{
        input.addEventListener("input",()=>{
          if(expire())return;
          const current=get();
          if(current?.status !== "draft")return;
          const answer=current.answers[Number(input.dataset.examSlot)];
          if(input.dataset.examField === "title")answer.title=input.value;
          else answer.bullets[Number(input.dataset.examField)]=input.value;
          save();saveLabel();
        });
        if(input.dataset.examField === "title")input.addEventListener("keydown",event=>{
          if(event.key === "Enter"){
            event.preventDefault();
            if(!expire())document.querySelector(`#exam-bullet-${Number(input.dataset.examSlot)+1}-1`).focus();
          }
        });
      });
      document.querySelector("#exam-form").onsubmit=event=>{
        event.preventDefault();if(expire())return;
        const missing=incomplete(get());
        if(missing.titles || missing.bullets)confirm("Finish with blank answers?",
          `${blanksText(missing)} ${missing.titles+missing.bullets===1?"is":"are"} blank. Finish now to review what you've written, or keep writing.`,
          "Finish with blanks",()=>{if(!expire())finish();},"Keep writing");
        else finish();
      };
      document.querySelector("#exam-download").onclick=download;
      document.querySelector("#exam-discard").onclick=discard;
      document.querySelector("#exam-home").onclick=home;
      saveLabel();timer();
    }
    function renderReview(a) {
      const checks=a.answers.map((answer,i)=>compareTitle(answer.title,i+1,D.competencies));
      const matches=checks.filter(c=>c.kind==="match").length;
      const missing=incomplete(a);
      main.innerHTML=`<p class="eyebrow">${a.status === "expired" ? "Time is up" : "Exam rehearsal"}</p><h1>${matches===8?"All eight in order!":"Your title results"}</h1>
        <section class="exam-result-summary ${matches===8?"complete":""}" aria-label="Title results">${matches===8?checkIcon:""}<div><p id="exam-title-score">${matches} of 8 titles correct</p><p class="exam-score-description">Exact titles in the right numbered positions.</p></div></section>
        <p class="lead">Titles are checked automatically. Review your three points for each competency below.</p>
        ${missing.titles || missing.bullets ? `<p>${blanksText(missing)} ${missing.titles+missing.bullets===1?"was":"were"} left blank.</p>` : ""}
        <section class="feedback"><h2>Review your three points</h2><p>Check each point: is it something a coach would say or do? Does it fit this competency? Have you made three different points?</p><p>Use the definitions and examples to check your answers. Some competencies also cover a coach's learning and work outside sessions.</p></section>
        <p class="muted">Capital letters, extra spaces and punctuation around words don't affect the title check.</p>
        <div id="exam-save" class="muted"></div>
        ${a.answers.map((answer,i)=>{
          const c=D.competencies[i], check=checks[i];
          const named=D.competencies.find(c=>normalizeTitle(c.title)===normalizeTitle(answer.title));
          const submittedTitle=named?titleLabel(named,answer.title):answer.title;
          return `<section class="card exam-review-slot"><div class="card-head"><span>C${i+1}</span>${check.kind==="match"?"":`<span class="pill">${check.kind==="wrong-slot"?"Right title, wrong place":check.kind==="blank"?"Left blank":"Check the wording"}</span>`}</div>
            <p class="definition-label">Official title</p><h2>${escape(titleLabel(c))}</h2><p><strong>Your title:</strong> <span class="submitted-answer">${escape(submittedTitle) || "(blank)"}</span></p>
            <p class="exam-title-check ${check.kind==="match"?"got-it":""}">${check.kind==="match"?`${checkIcon}<strong>${escape(check.message)}</strong>`:escape(check.message)}</p><p class="definition-label">Official definition</p><blockquote class="competency-definition">"${escape(c.definition)}"</blockquote>
            <h3>Your three points</h3><ol class="submitted-bullets">${answer.bullets.map(b=>`<li class="submitted-answer">${b.trim()?escape(b):"<span class='muted'>Left blank</span>"}</li>`).join("")}</ol>
            <details><summary>Examples of what a coach might do</summary><ul class="exam-examples">${D.examExamples[c.id].map(e=>`<li>${escape(e.text)} <small>Official ${e.refs.join(", ")}</small></li>`).join("")}</ul></details>
            ${citation(c.id,[...new Set(D.examExamples[c.id].flatMap(e=>e.refs))])}
          </section>`;
        }).join("")}
        <div class="actions"><button id="exam-download">Save a text copy</button><button class="primary" id="exam-discard">Start another rehearsal</button><button id="exam-home">Back to home</button></div>`;
      document.querySelector("#exam-download").onclick=download;
      document.querySelector("#exam-discard").onclick=discard;
      document.querySelector("#exam-home").onclick=home;
      saveLabel();
    }
    function render() {
      // Deadline checks also run on return, not just while a tab's timers are active.
      const a=get();
      if(a?.status === "draft" && a.mode === "timed" && Date.now()>=a.deadline){
        finish("expired",false);
      }
      const current=get();
      if(!current)renderSetup();
      else if(current.status==="draft")renderDraft(current);
      else renderReview(current);
    }
    setInterval(()=>{if(!expire())timer();},1000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden){expire();timer();}});
    window.addEventListener("pageshow",()=>{expire();timer();});
    window.addEventListener("beforeunload",event=>{
      if(get() && hasStorageFailure()){event.preventDefault();event.returnValue="";}
    });
    return {render,expire,reset:()=>{pendingAction=null;if(dialog.open)dialog.close();}};
  }
  return {normalizeTitle,titleLabel,validAttempt,compareTitle,create};
})();
