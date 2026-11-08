"use strict";
(() => {
  const start=()=>{
  document.title="Coachprep · ICF competency practice";
  const brandText=document.querySelector("#brand>span:last-child")?.firstChild;
  if(brandText?.nodeType===Node.TEXT_NODE)brandText.textContent="Coachprep";
  document.querySelector('[data-view="recall"]').textContent="Name practice";
  document.querySelector('[data-view="scenario"]')?.remove();
  const oldPrivacy=[...document.querySelectorAll("#about-dialog p")].find(p=>p.textContent.includes("doesn't save what you type") || p.textContent.includes("optional deadline"));
  if(oldPrivacy){
    oldPrivacy.textContent="Your saved work stays in this browser. It includes practice counts, review dates and paused sessions, including typed name attempts, selected responses and answer times. Exam rehearsal saves your current answers, elapsed time and previous completed pass for optional self-evaluation. There is no login or AI, and nothing syncs between devices. Private browsing or clearing site data can erase your progress. Use invented examples and save an exam text copy for a backup.";
    const note=document.createElement("p");note.textContent="Question practice scores use 90 points for the strongest option, 80 for a valid approach, and zero for a less suitable response, plus up to 10 accepted-response speed points capped through 4 seconds and tapering to zero at 64 seconds. Feedback and time away are excluded. The coffee reminder appears below closing results from the third distinct local visiting day; Not now suppresses it for that day. At most three visiting dates and the dismissal date stay locally, never in usage stats.";oldPrivacy.after(note);
  }
  if(!document.querySelector("#coffee-warning")){
    const message=document.createElement("p");message.id="coffee-warning";message.className="warning";message.setAttribute("role","alert");message.hidden=true;document.querySelector("main").before(message);
  }
  const D = window.STUDY;
  const KEY = "icf-practice-room-v1";
  const main = document.querySelector("main");
  const warning = document.querySelector("#storage-warning");
  const usage = window.USAGE;
  if (!usage) console.warn("Study usage module is unavailable. Studying is unaffected.");
  const empty = () => ({version:1, items:{}, scenarios:0, exam:null, examPrevious:null, hintedSuccessIndex:0, practices:{}});
  const hintedSuccessMessages = ["You got it!", "That's it!", "Nice work!"];
  const hintedSuccessSupport = "Hints help you learn. Keep practicing until you can remember it without them.";
  const legacyQuestionIds = Array.from({length:8},(_,i)=>`q${i+1}`);
  const allIds = D.competencies.map(c => `r${c.id}`).concat(D.questions.map(q => q.id),legacyQuestionIds);
  let lastStored=null,needsExamMigration=false;
  let state = load();
  let questionOrder = [];
  let view = "home", session = null, active = null;
  let scenarioNode = D.scenario.start, history = [], branchChoice = null;
  let saveFailed = false;
  const P=window.PRACTICE;
  const homeAnchor=document.createComment("practice-home");
  main.before(homeAnchor);
  const dialog=document.createElement("dialog");
  dialog.id="study-dialog";
  dialog.setAttribute("aria-labelledby","study-mode");
  dialog.innerHTML='<header class="study-head"><strong id="study-mode"></strong><span id="study-position"></span><div class="study-head-actions"></div><button id="close-study" class="study-close" aria-label="Close study and show session results">×</button></header><div id="study-errors"></div><div id="study-body"></div><footer id="study-dock"></footer>';
  document.body.append(dialog);
  const moved=[warning,document.querySelector("#theme-warning"),document.querySelector("#coffee-warning"),document.querySelector("#announcement")].map(element=>{
    const anchor=document.createComment("warning-home");element.before(anchor);return {element,anchor};
  });
  const theme=document.querySelector("#theme-toggle"),themeAnchor=document.createComment("theme-home");
  theme.before(themeAnchor);
  let flow=null,clockStarted=null,answerStarted=null,launchFocus=null,introMode=null;
  const modeNames={recall:"Name practice",questions:"Questions",mixed:"Mixed practice",scenario:"Conversation",exam:"Exam rehearsal"};
  const usageMode=mode=>({recall:"titles",scenario:"conversation"}[mode] || mode);
  const coffeeWarning=document.querySelector("#coffee-warning");
  const coffee=P.coffee({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},message=>{
    coffeeWarning.textContent=message;coffeeWarning.hidden=false;
  });
  coffee.visit();
  function elapsed(){return (flow?.elapsedMs || 0)+(clockStarted===null?0:performance.now()-clockStarted);}
  function answerTime(){return (flow?.answerMs || 0)+(answerStarted===null?0:performance.now()-answerStarted);}
  function snapshot(){
    return {view,session,active,scenarioNode,history:history.map(h=>({node:h.node,index:D.scenario.nodes[h.node].choices.indexOf(h.choice)})),branchChoice};
  }
  function stash(){
    if(!flow || !dialog.open)return;
    if(flow.mode==="exam" && state.exam?.status==="draft")state.exam.elapsedMs=elapsed();
    flow.snapshot=snapshot();
    state.practices[flow.mode]={...flow,elapsedMs:elapsed(),answerMs:answerTime()};
  }
  function persist(){stash();return save();}
  function pause(){
    if(!flow)return;
    flow.elapsedMs=elapsed();flow.answerMs=answerTime();clockStarted=null;answerStarted=null;
  }
  function openShell(){
    if(dialog.open)return;
    launchFocus=document.activeElement;
    document.querySelector("#study-body").append(main);
    moved.forEach(({element})=>document.querySelector("#study-errors").append(element));
    document.querySelector(".study-head-actions").append(theme);
    document.body.classList.add("study-open");dialog.showModal();
  }
  function beginFlow(mode,saved=null){
    flow=saved?JSON.parse(JSON.stringify(saved)):{version:1,mode,elapsedMs:0,answerMs:0,responses:[],completed:false,snapshot:null};
    clockStarted=performance.now();answerStarted=null;introMode=null;
    if(mode==="exam" && state.exam){
      if(!saved)flow.elapsedMs=state.exam.elapsedMs;
      if(state.exam.status!=="draft"){flow.elapsedMs=state.exam.elapsedMs;clockStarted=null;}
    }
    if(saved){
      const s=saved.snapshot;view=s.view;session=s.session;active=s.active;scenarioNode=s.scenarioNode;branchChoice=s.branchChoice;
      history=s.history.map(h=>({node:h.node,choice:D.scenario.nodes[h.node].choices[h.index]}));
      usage?.resume(usageMode(mode));
    }
  }
  function noteResponse(item,outcome,extra={}){
    if(!flow)return;
    flow.responses.push({c:item.c,type:item.type,outcome,seconds:answerTime()/1000,...extra});
    flow.answerMs=0;answerStarted=null;
  }
  function noteActive(){
    if(!active || active.reported)return;
    active.reported=true;
    noteResponse(active.item,active.outcome,{matched:active.matched===true,revealed:active.revealed===true});
    if(session && session.index===session.items.length-1){flow.completed=true;usage?.complete(usageMode(flow.mode));}
  }
  function startMode(mode){
    beginFlow(mode);
    if(mode==="scenario"){
      view="scenario";session=null;active=null;scenarioNode=D.scenario.start;history=[];branchChoice=null;
      usage?.begin("conversation");renderScenario();focus(".client");return;
    }
    startSession(mode,mode==="recall"?8:mode==="questions"?D.questions.length:8);
  }
  function showIntro(mode){
    openShell();
    const saved=state.practices[mode];
    if(saved && !saved.completed && (mode!=="exam" || state.exam)){beginFlow(mode,saved);render();focus();return;}
    flow=null;clockStarted=null;answerStarted=null;introMode=mode;view=mode;active=null;session=null;
    if(mode==="exam"){
      if(state.exam){beginFlow("exam",saved || null);view="exam";flow.completed=state.exam.status!=="draft";}
      exam.render();return;
    }
    const copy=mode==="recall"?"Name each competency using the official wording. Try from memory, then use a hint or Pass if you need it.":
      mode==="scenario"?"Choose what you would say to a fictional client, then explore a possible reply. Practice noticing what the client wants, questioning your assumptions and choosing how to follow up. Compare the reasoning behind different replies. This conversation has no score.":
      mode==="mixed"?"Eight items mix competency names and coaching questions. Recall names from memory; choose the strongest question response for the moment.":
      "More than one response may fit. Choose the strongest option for this moment.";
    main.innerHTML=`<section class="study-intro"><div class="intro-mark" aria-hidden="true">8</div><h1>${modeNames[mode]}</h1><p>${copy}</p>${mode==="scenario"?`<h2>${escape(D.scenario.title)}</h2><p>${escape(D.scenario.intro)}</p>`:""}<p>Take your time. You can revisit the reasoning after answering. Close with X to see your session results and keep your place.</p>${mode==="questions"?`<details open><summary>About the practice score</summary><p>Strongest responses start at 90 points, valid approaches at 80. Both can add up to 10 speed points: answers within 4 seconds get the same maximum bonus, declining to zero at 64 seconds. Less suitable responses get no points. Only answer time counts, not feedback reading. This is a study mechanic, not an ICF assessment.</p></details>`:""}</section>`;
    updateShell();
    const button=document.createElement("button");button.id="begin-practice";button.className="primary";button.textContent="Start "+modeNames[mode].toLowerCase();
    button.onclick=()=>startMode(mode);document.querySelector("#study-dock").append(button);focus();
  }
  function closeStudy(){
    if(flow){pause();stash();}
    if(!save()){if(flow){clockStarted=performance.now();if(active && !active.done || view==="scenario" && branchChoice===null)answerStarted=performance.now();}return;}
    const result=flow || {mode:introMode || view,elapsedMs:0,responses:[],completed:false};
    dialog.close();document.body.classList.remove("study-open");
    homeAnchor.after(main);moved.forEach(({element,anchor})=>anchor.after(element));themeAnchor.after(theme);
    view="home";updateNavigation();renderSummary(result);
  }
  function renderSummary(result){
    const answered=result.responses || [],draft=state.exam,examMode=result.mode==="exam";
    const titleMatches=examMode && draft?.status!=="draft"?draft?.answers.map((a,i)=>window.EXAM.compareTitle(a.title,i+1,D.competencies).kind==="match"):null;
    const mean=answered.length?answered.reduce((n,r)=>n+r.seconds,0)/answered.length:null;
    const pendingRecall=active && !active.done && active.item.type==="recall" && (active.hints>0 || active.attempt.trim())?active:null;
    const lastMetric=examMode?titleMatches?`${titleMatches.filter(Boolean).length} / 8`:"Not checked":mean===null?"Not yet":P.duration(mean*1000);
    const q=answered.filter(r=>r.type==="questions");
    main.innerHTML=`<section class="session-summary"><p class="eyebrow">${modeNames[result.mode] || "Practice"} · ${result.completed?"Finished":"Paused"}</p><h1>Your study session</h1><div class="summary-totals"><div><strong>${P.duration(result.elapsedMs)}</strong><span>Elapsed study time</span></div><div><strong>${examMode?draft?.answers.filter(a=>a.title.trim()||a.bullets.some(b=>b.trim())).length || 0:answered.length}</strong><span>${examMode?"Competencies with writing":"Responses finished"}</span></div><div><strong>${lastMetric}</strong><span>${examMode?"Names matching":"Average answer time"}</span></div></div>${active && !active.done && !examMode?'<p class="muted">Your unfinished response is saved. Resume to continue from the same place.</p>':""}
    <h2>By competency</h2><div class="competency-stats">${D.competencies.map(c=>{
      const rows=answered.filter(r=>r.c===c.id),qs=rows.filter(r=>r.type==="questions"),names=rows.filter(r=>r.type==="recall"),conversation=rows.filter(r=>r.type==="scenario");
      const count=o=>qs.filter(r=>r.outcome===o).length,answer=draft?.answers[c.id-1];
      const pending=pendingRecall?.item.c===c.id;
      const practiced=examMode?!!answer&&(!!answer.title.trim()||answer.bullets.some(b=>b.trim())):rows.length>0 || pending;
      const label=examMode && draft?.status==="draft" || result.mode==="recall" && !rows.length?`C${c.id}`:titleLabel(c);
      return `<section class="competency-stat ${practiced?"":"unseen"}"><div class="stat-top"><h3>${escape(label)}</h3>${qs.length?`<div class="practice-score"><small>Practice score</small>${Math.round(qs.reduce((n,r)=>n+P.points(r.outcome,r.seconds),0)/qs.length)}</div>`:""}</div>${!practiced?"<p>Not practiced</p>":examMode?`<p>${answer.title.trim()?"Name entered":"Name blank"} · ${answer.bullets.filter(b=>b.trim()).length} of 3 points written${titleMatches?` · ${titleMatches[c.id-1]?"Name matches":"Name needs review"}`:""}</p>`:
      `${qs.length?`<p>${count("recognition")} strongest · ${count("reasonable")} valid · ${count("missed")} to improve</p><p>${qs.length} answered · average answer time ${P.duration(qs.reduce((n,r)=>n+r.seconds,0)/qs.length*1000)}</p>`:""}${names.length?`<p>${names.filter(r=>r.matched&&r.outcome==="unaided").length} correct without hints · ${names.filter(r=>r.outcome==="assisted").length} with hints or Pass · ${names.filter(r=>!r.matched&&!r.revealed).length} need another look</p>`:""}${pending?`<p>Unfinished name attempt${pendingRecall.hints?` · ${pendingRecall.hints} hint${pendingRecall.hints===1?"":"s"} used`:""}. Resume to continue.</p>`:""}${conversation.length?`<p>${conversation.length} fictional conversation choice${conversation.length===1?"":"s"} explored. No automated score.</p>`:""}`}</section>`;
    }).join("")}</div><details class="summary-help" open><summary>About these results</summary><p>These are practice results, not an official ICF assessment. ${q.length?"Question scores use 90 / 80 / 0 base points plus up to 10 accepted-response speed points, capped through 4 seconds and tapering to zero at 64 seconds. The competency score is the rounded mean of answered questions only.":""} Name recall, conversation choices and exam points are not speed-scored. Exam practice time counts up and pauses while you are away.</p></details>${coffee.eligible()?`<aside id="coffee-reminder" class="coffee-card"><h2>Say thanks</h2><p>Enjoying the practice? A coffee would make my day!</p><div class="actions"><a href="https://buymeacoffee.com/mikemo" target="_blank" rel="noopener noreferrer" class="coffee-action">Buy me a coffee</a><button id="dismiss-coffee">Not now</button></div></aside>`:""}<div class="summary-actions actions"><button id="summary-home">Home</button><button class="primary" id="resume-practice">${result.completed?"Practice again":"Resume "+(modeNames[result.mode] || "practice").toLowerCase()}</button></div></section>`;
    document.querySelector("#summary-home").onclick=()=>{flow=null;view="home";renderHome();(launchFocus?.isConnected?launchFocus:document.querySelector("#brand")).focus();};
    document.querySelector("#resume-practice").onclick=()=>navigate(result.mode || "recall");
    document.querySelector("#dismiss-coffee")?.addEventListener("click",()=>{if(coffee.dismiss()){document.querySelector("#coffee-reminder").remove();document.querySelector("#resume-practice").focus();}});
    focus();
  }
  function updateShell(){
    if(!dialog.open)return;
    const mode=flow?.mode || introMode || view;
    document.querySelector("#study-mode").textContent=modeNames[mode] || "Practice";
    document.querySelector("#study-position").textContent=session?`${Math.min(session.index+1,session.items.length)} / ${session.items.length}`:"";
    const dock=document.querySelector("#study-dock");dock.replaceChildren();
    const time=document.createElement("span");time.id="practice-time";time.setAttribute("role","timer");time.setAttribute("aria-live","off");time.setAttribute("aria-label","Elapsed study time");time.textContent=flow?P.duration(elapsed()):"";dock.append(time);
    const selector=view==="exam"?'#exam-start,button[form="exam-form"],#exam-download,#exam-discard':
      "#next-item,#continue-scenario,#back-home,#restart-scenario,#recall-form button";
    main.querySelectorAll(selector).forEach(button=>{if(button.type==="submit"&&button.closest("form"))button.setAttribute("form",button.closest("form").id);dock.append(button);});
    if(view==="exam"){
      const deadline=main.querySelector(".exam-clock");if(deadline){time.replaceWith(deadline);}
      main.querySelectorAll("#exam-home").forEach(b=>b.hidden=true);
    }
    if(active && !active.done && flow && answerStarted===null)answerStarted=performance.now();
    if(view==="scenario" && branchChoice===null && flow && answerStarted===null)answerStarted=performance.now();
    if(active && !active.done && active.item.type==="questions"){
      const button=document.createElement("button");button.disabled=true;button.textContent="Choose a response";dock.append(button);
    }
    stash();
  }
  document.querySelector("#close-study").onclick=closeStudy;
  function viewportSize(){
    if(!window.visualViewport)return;
    dialog.style.setProperty("--study-height",`${window.visualViewport.height}px`);
    dialog.style.setProperty("--study-top",`${window.visualViewport.offsetTop}px`);
  }
  window.visualViewport?.addEventListener("resize",viewportSize);
  window.visualViewport?.addEventListener("scroll",viewportSize);viewportSize();
  dialog.addEventListener("cancel",event=>{event.preventDefault();closeStudy();});
  dialog.addEventListener("keydown",event=>{
    if(event.key!=="Tab" || document.activeElement.closest("dialog")!==dialog)return;
    const controls=[...dialog.querySelectorAll("button:not([disabled]),input,textarea,select,summary,a[href]")].filter(e=>e.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first || !event.shiftKey&&document.activeElement===last){event.preventDefault();(event.shiftKey?last:first)?.focus();}
  });
  setInterval(()=>{if(dialog.open && flow){const time=document.querySelector("#practice-time");if(time)time.textContent=P.duration(elapsed());persist();}},1000);
  window.addEventListener("pagehide",()=>{if(dialog.open){pause();persist();}});
  window.addEventListener("beforeunload",event=>{if(dialog.open && !persist()){event.preventDefault();event.returnValue="";}});
  window.addEventListener("storage",event=>{
    if(event.key===KEY){
      if(dialog.open && flow){saveFailed=true;storageError("Study data changed in another tab. Keep this tab open and copy any work you need before refreshing. This tab will not overwrite the other tab's saved work.");}
      else state=load();
    }
    if(event.key===coffee.key && document.querySelector("#coffee-reminder") && !coffee.eligible())document.querySelector("#coffee-reminder").remove();
  });

  function storageError(message) {
    if(warning.hidden || warning.textContent !== message){
      warning.textContent = message;
      warning.hidden = false;
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      lastStored=raw;
      if (!raw) return empty();
      const s = JSON.parse(raw);
      const counters = ["unaided","assisted","recognition","missed","streak"];
      if (s.version !== 1 || !s.items || typeof s.items !== "object" || Array.isArray(s.items) ||
          !Number.isInteger(s.scenarios) || s.scenarios < 0 || !window.EXAM.validAttempt(s.exam) ||
          (s.hintedSuccessIndex !== undefined && (!Number.isInteger(s.hintedSuccessIndex) ||
            s.hintedSuccessIndex < 0 || s.hintedSuccessIndex >= hintedSuccessMessages.length))) throw new Error("Invalid study data");
      for (const [id,item] of Object.entries(s.items)) {
        if (!allIds.includes(id) || !item || counters.some(k => !Number.isInteger(item[k]) || item[k] < 0) ||
            (item.reasonable !== undefined && (!Number.isInteger(item.reasonable) || item.reasonable < 0)) ||
            !Number.isFinite(item.due) || item.due < 0 || !["unaided","assisted","recognition","reasonable","missed"].includes(item.last)) {
          throw new Error("Invalid saved item");
        }
        item.reasonable = item.reasonable ?? 0;
      }
      s.exam = s.exam || null;
      needsExamMigration=!!s.exam && s.exam.mode!=="elapsed" || !!s.examPrevious && s.examPrevious.mode!=="elapsed";
      if(s.examPrevious && (!window.EXAM.validAttempt(s.examPrevious) || s.examPrevious.status==="draft")){
        s.examPrevious=null;storageError("Your previous exam comparison could not be opened. Your current exam answers are still available.");
      }
      s.examPrevious=window.EXAM.migrate(s.examPrevious || null);
      s.hintedSuccessIndex = s.hintedSuccessIndex ?? 0;
      if(s.practices!==undefined && (!s.practices || typeof s.practices!=="object" || Array.isArray(s.practices)))storageError("Saved practice sessions could not be opened. Existing review counts and exam answers are still available.");
      s.practices=s.practices && typeof s.practices==="object" && !Array.isArray(s.practices)?s.practices:{};
      for(const [mode,saved] of Object.entries(s.practices)){
        if(saved?.mode!==mode || !window.PRACTICE.validSaved(saved,D)){delete s.practices[mode];storageError("A saved practice session could not be opened. Existing review counts and exam answers are still available.");}
      }
      s.exam=window.EXAM.migrate(s.exam,s.practices.exam?.elapsedMs);
      return s;
    } catch {
      storageError("We couldn't open your saved progress or rehearsal. This tab starts fresh. Your old saved data is unchanged unless you practice or reset. Choose Reset progress to delete it.");
      return empty();
    }
  }
  function save() {
    try {
      if(localStorage.getItem(KEY)!==lastStored){saveFailed=true;storageError("Study data changed in another tab. Keep this tab open and copy any work you need before refreshing. This tab will not overwrite the other tab's saved work.");return false;}
      const recovering=saveFailed,text=JSON.stringify(state);localStorage.setItem(KEY,text);lastStored=text;saveFailed=false;if(recovering)warning.hidden=true;return true;
    }
    catch { saveFailed=true; storageError("Your browser couldn't save your progress or exam answers. Keep this tab open. Refreshing or closing it may lose your work. In Exam rehearsal, choose Save a text copy for a backup."); return false; }
  }
  function record(id, outcome) {
    const p = state.items[id] || {unaided:0, assisted:0, recognition:0, reasonable:0, missed:0, streak:0};
    p[outcome]++;
    p.last = outcome;
    const success = outcome === "unaided" || outcome === "recognition" || outcome === "reasonable";
    p.streak = success ? p.streak + 1 : 0;
    const days = [1,3,7][Math.min(p.streak - 1,2)];
    p.due = Date.now() + (success ? days * 86400000 : 600000);
    state.items[id] = p;
    persist();
  }
  const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const comp = id => D.competencies.find(c => c.id === Number(id));
  const citation = (c, refs = []) => `<div class="citation"><p>${D.source} · ${D.version}<br>Official 2025 model · PDF p. ${Number(c)+2}${refs.length ? " · sub-competencies quoted below" : " · competency name"}.</p>${refs.length?`<ul class="official-references">${refs.map(ref=>`<li><strong>${ref}</strong> "${escape(D.subcompetencies[ref])}"</li>`).join("")}</ul>`:""}</div>`;
  const announce = text => { document.querySelector("#announcement").textContent = text; };
  function focus(selector = "h1") {
    const el = main.querySelector(selector);
    if (el) { el.setAttribute("tabindex","-1"); el.focus(); }
  }
  const normalizeTitle = window.EXAM.normalizeTitle;
  const titleLabel = window.EXAM.titleLabel;
  const exam = window.EXAM.create({get:()=>state.exam,set:a=>{state.exam=a;if(!a){delete state.practices.exam;flow=null;clockStarted=null;answerStarted=null;}},save:persist,storageError,
    getPrevious:()=>state.examPrevious,setPrevious:a=>{state.examPrevious=a;},getElapsed:()=>flow?.mode==="exam"?elapsed():state.exam?.elapsedMs || 0,
    hasStorageFailure:()=>saveFailed,announce,escape,focus,home:closeStudy,
    isVisible:()=>view==="exam",onStarted:()=>usage?.begin("exam"),
    onCompleted:()=>{usage?.complete("exam");if(flow?.mode==="exam"){pause();flow.elapsedMs=state.exam.elapsedMs;flow.completed=true;}},onFinished:()=>{if(view==="home")renderHome();},
    onRender:()=>{if(state.exam && !flow && dialog.open)beginFlow("exam");if(flow?.mode==="exam" && state.exam)flow.completed=state.exam.status!=="draft";updateShell();},citation});
  const totals = field => Object.values(state.items).reduce((n,p) => n+p[field],0);
  const outcomeLabels = {unaided:"Without hints",assisted:"With hints",recognition:"Strongest option",reasonable:"Valid approach",missed:"Needs another look"};
  const isDue = id => !state.items[id] || state.items[id].due <= Date.now();
  function shuffle(values) {
    const result=[...values];
    for(let i=result.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [result[i],result[j]]=[result[j],result[i]];
    }
    return result;
  }
  function arrangeQuestions() {
    questionOrder=shuffle(D.questions).sort((a,b)=>(state.items[a.id]?.due || 0)-(state.items[b.id]?.due || 0));
  }
  function practiceItems(type = "mixed") {
    const titles=D.competencies.map(c=>({id:`r${c.id}`,type:"recall",c:c.id}));
    const questions=questionOrder.map(q=>({id:q.id,type:"questions",c:q.c}));
    return type==="recall"?titles:type==="questions"?questions:titles.concat(questions);
  }
  function navigate(next) {
    if(next==="home"){if(dialog.open)return closeStudy();flow=null;view="home";session=null;active=null;render();focus();return;}
    if(next==="questions")arrangeQuestions();
    showIntro(next);
  }
  function dueLabel(id) {
    if (!state.items[id]) return "New";
    const p = state.items[id];
    if (isDue(id)) return "Ready to review";
    const mins = Math.ceil((p.due-Date.now())/60000);
    return mins < 60 ? `In ${mins} min` : `Review ${new Date(p.due).toLocaleDateString(undefined,{month:"short",day:"numeric"})}`;
  }
  function updateNavigation(){
    document.querySelectorAll("[data-view]").forEach(b => {
      if (b.dataset.view === view) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current");
    });
  }
  function render() {
    updateNavigation();
    if (view==="home") renderHome();
    else if (view==="scenario") renderScenario();
    else if (view==="exam") exam.render();
    else renderStudy();
  }
  function renderHome() {
    const items=practiceItems();
    main.innerHTML = `<section class="hero"><div><p class="eyebrow">ICF core competencies · 2025</p><h1>The eight ICF<br>core competencies</h1><p class="lead">Practice the names from memory, explore coaching choices in questions or try a written exam rehearsal.</p></div><div class="orbit" aria-hidden="true"><strong>8</strong>${Array.from({length:8},(_,i)=>`<span style="left:${50+42*Math.cos((i-1)*Math.PI/4)}%;top:${50+42*Math.sin((i-1)*Math.PI/4)}%">${i+1}</span>`).join("")}</div></section>
      <section class="practice-setup" aria-labelledby="practice-setup-title"><h2 id="practice-setup-title">Choose your practice</h2>
      <section class="grid practice-grid" aria-label="Name and question practice">
      <article class="experience"><span class="number">01 / CORE COMPETENCIES</span><h3>Name practice</h3><p>Try to name each from memory, use a hint to show one word at a time, or choose Pass to see the full name.</p><button data-start="recall">Practice Core Competencies</button></article>
      <article class="experience"><span class="number">02 / QUESTIONS</span><h3>Coaching questions</h3><p>${D.questions.length} fictional scenarios, each with four possible replies. More than one response may fit; choose the strongest for the moment.</p><button data-start="questions">${state.practices.questions && !state.practices.questions.completed?"Resume questions":"Answer questions"}</button></article></section>
      <div class="mixed-start"><button class="primary" id="start-mixed">${state.practices.mixed && !state.practices.mixed.completed?"Resume mixed practice":"Start mixed practice"}</button><p class="muted">Eight items across all competencies, mixing names and questions.</p></div>
      <details class="review-list"><summary>Your review dates · ${items.length} items</summary><p class="muted">Your last result and next review for each name and scenario. "New" means you haven't tried it. You can practice any time.</p>${items.map(item=>`<div class="review-row"><span>${item.type==="recall"?titleLabel(comp(item.c)):escape(D.questions.find(q=>q.id===item.id).label)}<small>${item.type==="recall"?"Name practice":"Coaching scenario"}${state.items[item.id] ? ` · last time: ${outcomeLabels[state.items[item.id].last]}` : ""}</small></span><span>${dueLabel(item.id)}</span></div>`).join("")}</details></section>
      <section class="independent-practice" aria-labelledby="independent-title"><h2 id="independent-title">Written practice</h2>
      <article class="experience"><span class="number">WRITTEN EXAM</span><h3>Exam rehearsal</h3><p>Write all eight names in order and three points for each. See your elapsed time and compare completed passes for self-evaluation.</p><button data-start="exam">${state.exam?.status==="draft"?"Resume rehearsal":state.exam?"Review rehearsal":"Start exam rehearsal"}</button></article></section>
      <h2 class="progress-heading">Across all your practice</h2><section class="stats question-credit-stats" aria-label="Name practice and question credit counts"><div class="stat"><strong>${totals("unaided")}</strong><span>Without hints</span></div><div class="stat"><strong>${totals("assisted")}</strong><span>With hints</span></div><div class="stat"><strong>${totals("recognition")}</strong><span>Strongest option</span></div><div class="stat"><strong>${totals("reasonable")}</strong><span>Valid approach</span></div></section>
      ${legacyQuestionIds.some(id=>state.items[id])?'<p class="muted">Earlier question results remain in your all-time counts. The new scenarios have their own review dates.</p>':""}
      <div class="reset-line"><span>Saved in this browser.</span><button id="reset">Reset progress</button></div>`;
    document.querySelectorAll("[data-start]").forEach(b => b.onclick = () => navigate(b.dataset.start));
    document.querySelector("#start-mixed").onclick = () => navigate("mixed");
    document.querySelector("#reset").onclick = () => document.querySelector("#reset-dialog").showModal();
  }
  function startSession(type, count) {
    arrangeQuestions();
    let items = practiceItems(type);
    items.sort((a,b)=>(state.items[a.id]?.due || 0)-(state.items[b.id]?.due || 0));
    // Interleave modalities and spread mixed practice across competencies.
    if (type==="mixed") {
      const ranked = [...items];
      const chosen=[];
      const seen=new Set();
      for (const item of ranked) {
        if (!seen.has(item.c)) { chosen.push(item); seen.add(item.c); }
      }
      const spread=chosen.map((item,index)=>ranked.find(i=>i.c===item.c && i.type===(index%2===0?"recall":"questions")));
      if(spread.some(item=>!item)){
        console.error("Mixed practice is missing a required modality.");
        announce("Mixed practice is unavailable. Try name or question practice instead.");
        return;
      }
      items=shuffle(spread).concat(shuffle(ranked.filter(item=>!spread.includes(item))));
    }
    session={items:items.slice(0,count),index:0,results:[],type};
    usage?.begin(type==="recall"?"titles":type);
    view=type==="mixed"?"recall":type;
    active=null; render(); focus(".scenario-prompt,.recall-prompt");
  }
  function currentItem() {
    if (session) return session.items[session.index];
    const items=practiceItems(view);
    items.sort((a,b)=>(state.items[a.id]?.due || 0)-(state.items[b.id]?.due || 0));
    return items[0];
  }
  function makeActive(item) { return {item,attempt:"",hints:0,revealed:false,done:false,outcome:null,selected:null,assistLogged:false,
    optionOrder:item.type==="questions"?shuffle(D.questions.find(q=>q.id===item.id).options.map((_,i)=>i)):null}; }
  function renderStudy() {
    announce("");
    if (session && session.index>=session.items.length && session.items.length) return renderComplete();
    const item=active?.item || currentItem();
    if (!item) {
      main.innerHTML=`<h1>No practice items available.</h1><button id="back-home">Back to home</button>`;
      document.querySelector("#back-home").onclick=()=>navigate("home"); return;
    }
    if (!active) active=makeActive(item);
    const recall=item.type==="recall";
    main.innerHTML='<section id="study-card"></section>';
    if(recall) renderRecall(); else renderQuestion();
  }
  function renderRecall() {
    const a=active, c=comp(a.item.c);
    const feedbackHeading=a.revealed?"Official name":a.matched?(a.successMessage || "Correct!"):"The wording doesn't match.";
    const reviewMinutes=Math.max(0,Math.ceil(((state.items[a.item.id]?.due || 0)-Date.now())/60000));
    const nextReview=reviewMinutes===0?"ready now":reviewMinutes<60?`in ${reviewMinutes} minute${reviewMinutes===1?"":"s"}`:
      `on ${new Date(state.items[a.item.id].due).toLocaleDateString(undefined,{month:"short",day:"numeric"})}`;
    const named=D.competencies.find(c=>normalizeTitle(c.title)===normalizeTitle(a.attempt));
    const submittedTitle=named?titleLabel(named,a.attempt):a.attempt;
    const words=c.title.split(" ");
    const shown=Math.min(words.length-1,a.hints);
    const hint=words.map((w,i)=>i<shown?w:"____").join(" ");
    document.querySelector("#study-card").innerHTML=`<div class="card-head"><span>${c.group}</span><span class="pill">C${c.id}</span></div>
      <h2 class="recall-prompt">What is the exact name of C${c.id}?</h2><p class="muted">Use the official 2025 wording.</p>
      ${a.hints && !a.done?`<p class="hint" aria-label="C${c.id} name with missing words">C${c.id} ${hint}</p><p class="muted">Hint ${a.hints} · ${words.length-shown} word${words.length-shown===1?"":"s"} hidden.</p>`:""}
      ${!a.done?`<form id="recall-form"><div class="field"><label for="recall-input">Your answer</label><input id="recall-input" type="text" autocomplete="off" spellcheck="false" value="${escape(a.attempt)}" aria-describedby="recall-help"><small id="recall-help">Type the name without its C number. Hints and Pass are available whenever you need them.</small></div><div class="actions" style="margin-top:18px"><button type="submit" class="primary">Check answer</button><button type="button" id="hint" ${shown>=words.length-1?"disabled":""}>${a.hints?"Show another word":"Show a hint"}</button><button type="button" id="reveal">Pass</button></div></form>`:
      `<div class="feedback ${a.matched===false?"miss":""}"><h3>${escape(feedbackHeading)}</h3>${a.outcome==="assisted"?`<p><span class="pill">With hints</span></p>`:""}${a.successMessage?`<p>${hintedSuccessSupport}</p>`:""}<p class="answer-title">${titleLabel(c)}</p>${!a.revealed?`<p>Your answer: <strong>${escape(submittedTitle)}</strong></p>`:""}<h4>What this competency means</h4><p>${c.summary}</p><p class="muted">Next review: ${nextReview}. You can keep practicing now.</p></div><button class="primary" id="next-item">${session?"Continue":"Next name"}</button>`}
      ${citation(c.id)}`;
    if(a.done) {document.querySelector("#next-item").onclick=nextItem;updateShell();persist();return;}
    const input=document.querySelector("#recall-input");
    input.oninput=()=>{input.setCustomValidity("");a.attempt=input.value;persist();};
    document.querySelector("#recall-form").onsubmit=e=>{
      e.preventDefault();
      if(a.done)return;
      a.attempt=input.value;
      if(!a.attempt.trim()){input.setCustomValidity("Type a name, or choose a hint or Pass.");input.reportValidity();return;}
      const match=normalizeTitle(a.attempt)===normalizeTitle(c.title);
      a.matched=match;
      a.outcome=a.hints?"assisted":match?"unaided":"missed";
      a.done=true;
      noteActive();
      if(match && a.hints){
        a.successMessage=hintedSuccessMessages[state.hintedSuccessIndex];
        state.hintedSuccessIndex=(state.hintedSuccessIndex+1)%hintedSuccessMessages.length;
      }
      if(!a.assistLogged)record(a.item.id,a.outcome);
      else if(!match){state.items[a.item.id].missed++;persist();}
      else persist();
      if (!session) usage?.item("titles",a.item.id,D.competencies.length);
      renderRecall(); focus("#study-card h3"); announce(match?`${a.successMessage || "Correct!"}${a.successMessage?` With hints. ${hintedSuccessSupport}`:""}`:"The wording doesn't match. Check the official name against your answer.");
    };
    document.querySelector("#hint").onclick=()=>{
      if(a.done || a.hints>=words.length-1)return;
      a.hints++; if(!a.assistLogged){record(a.item.id,"assisted"); a.assistLogged=true;}
      renderRecall(); document.querySelector("#recall-input").focus(); announce(`C${c.id} hint: ${hintFor(c.title,a.hints)}`);
    };
    document.querySelector("#reveal").onclick=()=>{
      if(a.done)return;
      a.revealed=true;a.done=true;a.outcome="assisted";
      noteActive();
      if(!a.assistLogged){record(a.item.id,"assisted");a.assistLogged=true;}
      if (!session) usage?.item("titles",a.item.id,D.competencies.length);
      renderRecall();focus("#study-card h3");announce(`${titleLabel(c)}. Pass counts as with hints.`);
    };
    document.querySelector("#study-card").insertAdjacentHTML("beforeend",'<details class="practice-help" open><summary>Practice help</summary><p>Try the competency name from memory. A hint shows one word; Pass reveals the name. Hints and Pass count as assisted practice. Capitalization and surrounding punctuation do not affect the check.</p></details>');
    updateShell();persist();
  }
  function hintFor(title,n) {return title.split(" ").map((w,i)=>i<n?w:"blank").join(" ");}
  function renderQuestion() {
    const a=active, q=D.questions.find(q=>q.id===a.item.id);
    const c=comp(q.c);
    const creditLabels={strongest:"Strongest option",reasonable:"Valid approach",less:"Opportunity to improve"};
    const order=a.done?[a.selected,...a.optionOrder.filter(i=>i!==a.selected)]:a.optionOrder;
    const check='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12L10 17L19 7"/></svg>';
    const improve='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18L18 6M9 6H18V15"/></svg>';
    document.querySelector("#study-card").innerHTML=`${a.done?`<details class="review-question"><summary>Question: ${escape(q.label)}</summary><h2 class="scenario-prompt">${escape(q.prompt)}</h2></details>`:`<h2 class="scenario-prompt">${escape(q.prompt)}</h2>`}
      <div class="options">${order.map(i=>{const o=q.options[i],position=a.optionOrder.indexOf(i);return a.done?
        `<details class="answer-card ${o[2]} ${a.selected===i?"selected":""}" data-answer="${i}" open><summary><span class="letter">${"ABCD"[position]}</span><span class="option-content">${i===a.selected?'<span class="chosen-marker">Your choice</span>':""}<span class="option-text">${escape(o[0])}</span><span class="result-tag">${o[2]==="less"?improve:check}${creditLabels[o[2]]}</span></span></summary><div class="rationale-panel"><hr><p>${escape(o[1])}</p></div></details>`:
        `<button class="option" data-option="${i}"><span class="letter">${"ABCD"[position]}</span><span class="option-text">${escape(o[0])}</span></button>`;}).join("")}</div>
      ${a.done?`<details class="competency-reference"><summary>What competency is at play?</summary><h3>${titleLabel(c)}</h3><p class="definition-label">Official definition</p><blockquote class="competency-definition">"${escape(c.definition)}"</blockquote><p>${escape(q.takeaway)}</p>${citation(c.id,q.refs)}${q.also?.map(other=>`<h4>${titleLabel(comp(other.c))}</h4>${citation(other.c,other.refs)}`).join("") || ""}</details><button class="primary" id="next-item">Next question</button>`:
      '<details class="practice-help" open><summary>Practice help</summary><p>More than one response may fit. Choose the strongest option for this moment. After answering, compare the reasoning for each response.</p></details>'}`;
    document.querySelectorAll("[data-option]").forEach(b=>b.onclick=()=>{
      if(a.done)return;
      a.selected=Number(b.dataset.option); a.done=true;
      a.outcome=q.options[a.selected][2]==="strongest"?"recognition":q.options[a.selected][2]==="reasonable"?"reasonable":"missed";
      noteActive();
      record(a.item.id,a.outcome);
      const chosen=document.querySelector("#scenario-picker option:checked");
      if(chosen)chosen.textContent=`${q.label} · ${dueLabel(q.id)}`;
      if (!session) usage?.item("questions",a.item.id,D.questions.length);
      renderQuestion();focus("#study-card .answer-card.selected summary");document.querySelector("#study-body").scrollTop=0;announce(`${creditLabels[q.options[a.selected][2]]}. ${titleLabel(c)}. You can revisit the question and read each explanation.`);
    });
    if(a.done)document.querySelector("#next-item").onclick=nextItem;
    updateShell();persist();
  }
  function nextItem() {
    if(!active?.done)return;
    if(session) {session.results.push({type:active.item.type,outcome:active.outcome,missed:active.outcome==="missed" || (!active.revealed && active.matched===false)});session.index++;}
    else {
      const items=practiceItems(view);
      const idx=items.findIndex(i=>i.id===active.item.id);
      active=items.length?makeActive(items[(idx+1)%items.length]):null;
      renderStudy();focus();return;
    }
    active=null;flow.answerMs=0;answerStarted=null;renderStudy();focus(session.index>=session.items.length?"h1":".scenario-prompt,.recall-prompt");
  }
  function renderComplete() {
    flow.completed=true;persist();
    usage?.complete(session.type==="recall"?"titles":session.type);
    main.innerHTML=`<h1>Round finished.</h1><p>You answered ${session.results.length} practice items.</p><button class="primary" id="back-home">See session results</button>`;
    document.querySelector("#back-home").onclick=closeStudy;updateShell();
    closeStudy();
  }
  function renderScenario() {
    const s=D.scenario;
    if(scenarioNode===null) {
      const sources=[...new Set(history.map(h=>s.nodes[h.node].c))];
      main.innerHTML=`<p class="eyebrow">Fictional conversation · review</p><h1>Review your choices.</h1><p class="lead">A real client could respond differently. Several replies may work, depending on the client and how you follow up.</p><section class="card">${history.map((h,i)=>`<article class="debrief-entry"><h3>${i+1}. ${titleLabel(comp(s.nodes[h.node].c))}</h3><p><strong>You said:</strong> ${h.choice.text}</p><p><strong>Possible client response:</strong> ${h.choice.reaction}</p><p>${h.choice.reason}</p></article>`).join("")}</section><section class="conversation-sources"><h2>Sources for this conversation</h2>${sources.map(c=>`<h3>${titleLabel(comp(c))}</h3>${citation(c,[...new Set(history.filter(h=>s.nodes[h.node].c===c).flatMap(h=>s.nodes[h.node].refs))])}`).join("")}</section><div class="actions" style="margin-top:24px"><button class="primary" id="restart-scenario">Try other replies</button><button id="back-home">Back to home</button></div>`;
      document.querySelector("#restart-scenario").onclick=()=>navigate("scenario");
      document.querySelector("#back-home").onclick=()=>navigate("home");updateShell();persist();return;
    }
    const node=s.nodes[scenarioNode];
    main.innerHTML=`<section class="card"><div class="card-head"><span>Conversation turn ${history.length+1}</span><span>Fictional</span></div>
      ${branchChoice!==null?`<details class="review-question"><summary>Conversation context: ${escape(s.title)}</summary><p>${escape(s.intro)}</p><p class="client"><strong>Client:</strong> "${escape(node.client)}"</p><p>What would you say next?</p></details>
      <details class="answer-card selected neutral" open><summary><span class="option-content"><span class="chosen-marker">Your choice</span><span class="option-text">${escape(node.choices[branchChoice].text)}</span></span></summary><div class="rationale-panel branch-note"><hr><p><strong>Possible client response:</strong> "${escape(node.choices[branchChoice].reaction)}"</p><p>${escape(node.choices[branchChoice].reason)}</p></div></details>
      <details class="competency-reference"><summary>What competency is at play?</summary><h3>${titleLabel(comp(node.c))}</h3>${citation(node.c,node.refs)}</details><button class="primary" id="continue-scenario">${node.choices[branchChoice].next===null?"Review your choices":"Continue"}</button>`:
      `<p class="client"><strong>Client:</strong> "${escape(node.client)}"</p><h2 style="font-size:1.25rem">What would you say next?</h2><div class="options">${node.choices.map((ch,i)=>`<button class="option" data-branch="${i}"><span class="letter">${"ABC"[i]}</span><span>${escape(ch.text)}</span></button>`).join("")}</div><details class="practice-help" open><summary>Practice help</summary><p>${escape(s.intro)}</p><p>There is no score. Ask yourself what you are assuming and how you would respond if the client disagreed.</p></details>`}</section>`;
    document.querySelectorAll("[data-branch]").forEach(b=>b.onclick=()=>{if(branchChoice!==null)return;branchChoice=Number(b.dataset.branch);noteResponse({c:node.c,type:"scenario"},"explored");renderScenario();persist();focus(".branch-note");announce("You can read a possible client reply and the reason for this choice.");});
    document.querySelector("#continue-scenario")?.addEventListener("click",()=>{
      if(branchChoice===null || node!==s.nodes[scenarioNode])return;
      const choice=node.choices[branchChoice];history.push({node:scenarioNode,choice});
      scenarioNode=choice.next;branchChoice=null;
      if(scenarioNode===null){state.scenarios++;flow.completed=true;persist();usage?.complete("conversation");}
      renderScenario();focus("h1,.client,.review-question>summary");
    });
    updateShell();persist();
  }
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>navigate(b.dataset.view));
  document.querySelector("#brand").onclick=e=>{e.preventDefault();navigate("home");};
  document.querySelector("#about-button").onclick=()=>document.querySelector("#about-dialog").showModal();
  document.querySelector("#close-about").onclick=()=>document.querySelector("#about-dialog").close();
  document.querySelector("#cancel-reset").onclick=()=>document.querySelector("#reset-dialog").close();
  document.querySelector("#confirm-reset").onclick=()=>{
    try {localStorage.removeItem(KEY);lastStored=null;state=empty();saveFailed=false;exam.reset();warning.hidden=true;document.querySelector("#reset-dialog").close();navigate("home");announce("Study progress and rehearsal deleted.");}
    catch {document.querySelector("#reset-dialog").close();storageError("Your browser couldn't delete progress. You can remove it by clearing site data for this local address.");}
  };
  arrangeQuestions();
  if (state.exam?.status==="draft") usage?.resume("exam");
  if(needsExamMigration)save();
  render();
  };
  const base=document.currentScript?.src || location.href;
  const assets=[
    ["practice.js?v=1",!!window.PRACTICE],
    ["exam.js?v=9",window.EXAM?.uiVersion===9],
    ["content.js?v=8",!!window.STUDY?.subcompetencies],
    ["styles.css?v=15",!!document.querySelector('link[href="styles.css?v=15"]')]
  ].filter(([,ready])=>!ready);
  if(!assets.length)start();
  else Promise.all(assets.map(([source])=>new Promise((resolve,reject)=>{
    const css=source.startsWith("styles."),element=document.createElement(css?"link":"script");
    if(css){element.rel="stylesheet";element.href=new URL(source,base).href;}
    else element.src=new URL(source,base).href;
    element.onload=resolve;element.onerror=()=>reject(new Error("A study file could not load"));document.head.append(element);
  }))).then(start,()=>{
    const warning=document.querySelector("#storage-warning");warning.hidden=false;warning.textContent="Study files could not load. Reload when your connection is available. Your saved progress is unchanged.";
    console.error("Study files could not load.");
  });
})();
