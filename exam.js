"use strict";
window.EXAM = (() => {
  const duration = 2 * 60 * 60 * 1000;
  const normalizeTitle = text => (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).join(" ");
  const titleLabel = (competency, text = competency.title) => `C${competency.id} ${text}`;
  function validAttempt(a) {
    if (a === null || a === undefined) return true;
    if (!a || typeof a !== "object" || !["untimed","timed","elapsed"].includes(a.mode) ||
        !["draft","submitted","expired"].includes(a.status) ||
        !Number.isFinite(a.startedAt) || a.startedAt <= 0 ||
        !Array.isArray(a.answers) || a.answers.length !== 8) return false;
    if (a.mode === "timed" ? a.deadline !== a.startedAt + duration : a.deadline !== null) return false;
    if (a.status === "draft" ? a.finishedAt !== null : !Number.isFinite(a.finishedAt) || a.finishedAt < a.startedAt) return false;
    if (a.status === "expired" && (a.mode !== "timed" || a.finishedAt !== a.deadline)) return false;
    if (a.mode === "elapsed" && (!Number.isFinite(a.elapsedMs) || a.elapsedMs < 0)) return false;
    return a.answers.every(answer => answer && typeof answer.title === "string" &&
      Array.isArray(answer.bullets) && answer.bullets.length === 3 && answer.bullets.every(b => typeof b === "string"));
  }
  function migrate(a, elapsedMs = 0) {
    if (!a || a.mode === "elapsed") return a;
    return {...a,mode:"elapsed",deadline:null,status:a.status==="expired"?"submitted":a.status,
      elapsedMs:Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : 0};
  }
  function compareTitle(actual, position, competencies) {
    const expected = competencies[position - 1];
    const entered = normalizeTitle(actual);
    if (!entered) return {kind:"blank", message:actual.trim() ? "There are no words in this answer." : "You left this name blank."};
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
    const {get,set,getPrevious,setPrevious,getElapsed,save,storageError,hasStorageFailure,announce,escape,focus,home,isVisible,onFinished,onStarted,onCompleted,citation} = options;
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
        missing.titles ? `${missing.titles} name${missing.titles===1?"":"s"}` : "",
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
    function finish() {
      const a=get();
      if (!a || a.status !== "draft") return;
      const previous={status:a.status,finishedAt:a.finishedAt,elapsedMs:a.elapsedMs};
      a.status="submitted";
      a.finishedAt=Date.now();
      a.elapsedMs=getElapsed();
      const saved=save();
      if(!saved){
        Object.assign(a,previous);render();focus();
        announce("Your browser couldn't save the finished rehearsal. Your answers are still here. Save a text copy or try again.");
        return;
      }
      onCompleted?.();
      pendingAction=null;
      if(dialog.open)dialog.close();
      if(isVisible()){render();focus();}
      else onFinished();
      const matches=a.answers.filter((answer,i)=>compareTitle(answer.title,i+1,D.competencies).kind==="match").length;
      announce(`${matches} of 8 names correct. Review your three points for each competency.`);
    }
    function discard() {
      const a=get();
      if(!a)return;
      confirm(a.status === "draft" ? "Discard this draft?" : "Replace this rehearsal?",
        a.status === "draft" ? "This deletes the current draft. Your previous completed pass and other practice counts stay saved." :
          "Your answers from this pass will stay saved for comparison with your next rehearsal. Your other practice counts stay the same.",
        a.status === "draft" ? "Discard draft" : "Start another rehearsal",
        () => {
          const previous=get(),baseline=getPrevious();
          if(previous.status !== "draft")setPrevious(JSON.parse(JSON.stringify(previous)));
          set(null);
          if(!save()){
            set(previous);setPrevious(baseline);
            storageError("Your browser couldn't save this change. Your rehearsal answers are still here. Try again or save a text copy.");
            render();focus();
            return;
          }
          render();focus();announce(previous.status === "draft" ? "Draft discarded. Your previous pass is still saved." : "Previous pass saved. You can start a new rehearsal.");
        });
    }
    function download() {
      const a=get();if(!a)return;
      const text = ["Core competency exam rehearsal",`Elapsed practice time: ${window.PRACTICE.duration(a.status === "draft" ? getElapsed() : a.elapsedMs)}`,`Status: ${{draft:"In progress",submitted:"Finished",expired:"Finished"}[a.status]}`,
        `Started: ${new Date(a.startedAt).toISOString()}`,
        "",
        ...a.answers.flatMap((answer,i)=>{
          const named=a.status==="draft"?null:D.competencies.find(c=>normalizeTitle(c.title)===normalizeTitle(answer.title));
          const title=named?titleLabel(named,answer.title):`C${i+1} · Your name: ${answer.title}`;
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
      if(!element || !a)return;
      element.textContent=window.PRACTICE.duration(a.status === "draft" ? getElapsed() : a.elapsedMs);
      element.setAttribute("aria-label","Elapsed exam practice time");
    }
    function saveLabel() {
      const element=document.querySelector("#exam-save");
      if(element)element.textContent=hasStorageFailure() ? "Not saved. Keep this tab open or save a text copy." : "Saved in this browser.";
    }
    function renderSetup() {
      main.innerHTML=`<p class="eyebrow">Written practice</p><h1>Exam rehearsal</h1><p class="lead">Write all eight names in order, exactly as ICF names them. For each one, add three points in your own words about what a coach says or does in a session.</p>
        <section class="card exam-setup"><p>Type the names without their C numbers. The timer counts up while you write, with no time limit. Closing pauses it; returning resumes your saved time.</p>
        <p class="muted">${getPrevious() ? "Your previous completed pass is saved. You can choose to compare it with what you write next." : "After your first completed pass, you can keep it to compare with your next rehearsal."} Your points are for self-evaluation, not automatic grading.</p>
        <div class="actions"><button class="primary" id="exam-start">Start rehearsal</button><button id="exam-home">Back to home</button></div></section>`;
      document.querySelector("#exam-start").onclick=()=>{
        if(get())return;
        const startedAt=Date.now();
        set({mode:"elapsed",status:"draft",startedAt,deadline:null,finishedAt:null,elapsedMs:0,
          answers:Array.from({length:8},()=>({title:"",bullets:["","",""]}))});
        const saved=save();render();focus("#exam-title-1");
        if(saved)onStarted?.();
        announce(saved ? "Rehearsal started. Your answers save as you type." : "Rehearsal started, but your browser couldn't save it. Keep this tab open or save a text copy.");
      };
      document.querySelector("#exam-home").onclick=home;
    }
    function renderDraft(a) {
      main.innerHTML=`<p class="eyebrow">Exam rehearsal</p><h1>Write from memory.</h1><p class="lead">Eight names in order, with three points for each about what a coach does in a session. Use your own words for the points.</p>
        <div class="exam-toolbar"><span id="exam-save"></span><span class="exam-clock"><strong id="exam-time" role="timer" aria-live="off">00:00</strong></span></div>
        <p class="muted">Change any answer before you finish. Your draft saves as you type; you can leave and come back to it. Use fictional examples and leave out client details.</p>
        ${getPrevious()?'<p><a href="#exam-comparison" id="exam-compare-link">Compare with your previous pass</a> when you want to review what has changed.</p>':""}
        <nav class="exam-jumps" aria-label="Go to a numbered competency">${a.answers.map((_,i)=>`<a href="#exam-slot-${i+1}" aria-label="Go to C${i+1}">C${i+1}</a>`).join("")}</nav>
        <form id="exam-form">${a.answers.map((answer,i)=>`<fieldset class="card exam-slot" id="exam-slot-${i+1}"><legend>C${i+1}</legend>
          <label for="exam-title-${i+1}">Name for C${i+1}</label><input id="exam-title-${i+1}" data-exam-slot="${i}" data-exam-field="title" value="${escape(answer.title)}" autocomplete="off" spellcheck="false">
          ${answer.bullets.map((bullet,j)=>`<label for="exam-bullet-${i+1}-${j+1}">Point ${j+1}</label><textarea id="exam-bullet-${i+1}-${j+1}" data-exam-slot="${i}" data-exam-field="${j}" rows="3">${escape(bullet)}</textarea>`).join("")}
          </fieldset>`).join("")}</form>${comparison(a)}<div class="actions"><button class="primary" type="submit" form="exam-form">Finish rehearsal</button><button id="exam-download" type="button">Save a text copy</button><button id="exam-discard" type="button">Discard draft</button><button id="exam-home" type="button">Back to home</button></div>`;
      document.querySelectorAll("[data-exam-slot]").forEach(input=>{
        input.addEventListener("input",()=>{
          const current=get();
          if(current?.status !== "draft")return;
          const answer=current.answers[Number(input.dataset.examSlot)];
          if(input.dataset.examField === "title")answer.title=input.value;
          else answer.bullets[Number(input.dataset.examField)]=input.value;
          save();saveLabel();
          const comparisonBody=document.querySelector(".exam-comparison-content");
          if(comparisonBody)comparisonBody.innerHTML=comparisonAnswers(current,getPrevious());
        });
        if(input.dataset.examField === "title")input.addEventListener("keydown",event=>{
          if(event.key === "Enter"){
            event.preventDefault();
            document.querySelector(`#exam-bullet-${Number(input.dataset.examSlot)+1}-1`).focus();
          }
        });
      });
      document.querySelector("#exam-form").onsubmit=event=>{
        event.preventDefault();
        const missing=incomplete(get());
        if(missing.titles || missing.bullets)confirm("Finish with blank answers?",
          `${blanksText(missing)} ${missing.titles+missing.bullets===1?"is":"are"} blank. Finish now to review what you've written, or keep writing.`,
          "Finish with blanks",finish,"Keep writing");
        else finish();
      };
      document.querySelector("#exam-download").onclick=download;
      document.querySelector("#exam-discard").onclick=discard;
      document.querySelector("#exam-home").onclick=home;
      document.querySelector("#exam-compare-link")?.addEventListener("click",event=>{
        event.preventDefault();
        const comparison=document.querySelector("#exam-comparison");
        comparison.open=true;focus("#exam-comparison summary");comparison.scrollIntoView({block:"start"});
      });
      saveLabel();timer();
    }
    function comparisonAnswers(current,previous) {
      return current.answers.map((answer,i)=>`<section class="exam-comparison-slot"><h3>C${i+1}</h3><div class="exam-comparison-grid">${[
        ["Previous pass",previous.answers[i]],["This pass",answer]
      ].map(([label,value])=>`<div><h4>${label}</h4><p class="definition-label">Name</p><p class="submitted-answer">${escape(value.title) || "(blank)"}</p><p class="definition-label">Three points</p><ol class="submitted-bullets">${value.bullets.map(b=>`<li class="submitted-answer">${escape(b) || "(blank)"}</li>`).join("")}</ol></div>`).join("")}</div></section>`).join("");
    }
    function comparison(a) {
      const previous=getPrevious();
      if(!previous)return "";
      return `<details class="exam-comparison" id="exam-comparison"><summary>Compare with your previous pass</summary><p>Previous pass finished ${escape(new Date(previous.finishedAt).toLocaleString())}. Opening this shows your earlier answers. They stay separate from your current draft.</p><p>What is clearer now? Which points describe different coaching behaviors? What would you revise? These written points are for your own evaluation.</p><div class="exam-comparison-content">${comparisonAnswers(a,previous)}</div></details>`;
    }
    function renderReview(a) {
      const checks=a.answers.map((answer,i)=>compareTitle(answer.title,i+1,D.competencies));
      const matches=checks.filter(c=>c.kind==="match").length;
      const missing=incomplete(a);
      main.innerHTML=`<p class="eyebrow">${a.status === "expired" ? "Time is up" : "Exam rehearsal"}</p><h1>${matches===8?"All eight in order!":"Your name results"}</h1>
        <section class="exam-result-summary ${matches===8?"complete":""}" aria-label="Name results">${matches===8?checkIcon:""}<div><p id="exam-title-score">${matches} of 8 names correct</p><p class="exam-score-description">Exact names in the right numbered positions.</p></div></section>
        <p class="lead">Names are checked automatically. Review your three points for each competency below.</p>
        ${missing.titles || missing.bullets ? `<p>${blanksText(missing)} ${missing.titles+missing.bullets===1?"was":"were"} left blank.</p>` : ""}
        <section class="feedback"><h2>Review your three points</h2><p>Check each point: is it something a coach would say or do? Does it fit this competency? Have you made three different points?</p><p>Use the definitions and examples to check your answers. Some competencies also cover a coach's learning and work outside sessions.</p></section>
        <p class="muted">Capital letters, extra spaces and punctuation around words don't affect the name check.</p>
        <div id="exam-save" class="muted"></div><span class="exam-clock"><strong id="exam-time" role="timer" aria-live="off"></strong></span>
        ${a.answers.map((answer,i)=>{
          const c=D.competencies[i], check=checks[i];
          const named=D.competencies.find(c=>normalizeTitle(c.title)===normalizeTitle(answer.title));
          const submittedTitle=named?titleLabel(named,answer.title):answer.title;
          return `<section class="card exam-review-slot"><div class="card-head"><span>C${i+1}</span>${check.kind==="match"?"":`<span class="pill">${check.kind==="wrong-slot"?"Right name, wrong place":check.kind==="blank"?"Left blank":"Check the wording"}</span>`}</div>
            <p class="definition-label">Official name</p><h2>${escape(titleLabel(c))}</h2><p><strong>Your name:</strong> <span class="submitted-answer">${escape(submittedTitle) || "(blank)"}</span></p>
            <p class="exam-title-check ${check.kind==="match"?"got-it":""}">${check.kind==="match"?`${checkIcon}<strong>${escape(check.message)}</strong>`:escape(check.message)}</p><p class="definition-label">Official definition</p><blockquote class="competency-definition">"${escape(c.definition)}"</blockquote>
            <h3>Your three points</h3><ol class="submitted-bullets">${answer.bullets.map(b=>`<li class="submitted-answer">${b.trim()?escape(b):"<span class='muted'>Left blank</span>"}</li>`).join("")}</ol>
            <details open><summary>Examples of what a coach might do</summary><ul class="exam-examples">${D.examExamples[c.id].map(e=>`<li>${escape(e.text)}</li>`).join("")}</ul></details>
            ${citation(c.id,[...new Set(D.examExamples[c.id].flatMap(e=>e.refs))])}
          </section>`;
        }).join("")}
        ${comparison(a)}<div class="actions"><button id="exam-download">Save a text copy</button><button class="primary" id="exam-discard">Start another rehearsal</button><button id="exam-home">Back to home</button></div>`;
      document.querySelector("#exam-download").onclick=download;
      document.querySelector("#exam-discard").onclick=discard;
      document.querySelector("#exam-home").onclick=home;
      saveLabel();timer();
    }
    function render() {
      const current=get();
      if(!current)renderSetup();
      else if(current.status==="draft")renderDraft(current);
      else renderReview(current);
      options.onRender?.();
    }
    setInterval(timer,1000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)timer();});
    window.addEventListener("pageshow",timer);
    window.addEventListener("beforeunload",event=>{
      if(get() && hasStorageFailure()){event.preventDefault();event.returnValue="";}
    });
    return {render,reset:()=>{pendingAction=null;if(dialog.open)dialog.close();}};
  }
  return {uiVersion:9,normalizeTitle,titleLabel,validAttempt,migrate,compareTitle,create};
})();
