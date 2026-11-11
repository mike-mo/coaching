"use strict";
(() => {
  const start=()=>{
  document.title="Coachprep · ICF competency practice";
  const brandText=document.querySelector("#brand>span:last-child")?.firstChild;
  if(brandText?.nodeType===Node.TEXT_NODE)brandText.textContent="Coachprep";
  document.querySelector('[data-view="recall"]').textContent="Core competency recall";
  document.querySelector('[data-view="scenario"]')?.remove();
  const oldPrivacy=[...document.querySelectorAll("#about-dialog p")].find(p=>p.textContent.includes("doesn't save what you type") || p.textContent.includes("optional deadline"));
  if(oldPrivacy){
    oldPrivacy.textContent="Your study progress and written answers stay in this browser and do not sync. Clearing browser data can erase them. Use fictional examples in your answers.";
  }
  document.querySelectorAll("#about-dialog p").forEach(p=>{if(p.textContent.includes("footer coffee link") || p.textContent.includes("third distinct local visiting day"))p.remove();});
  if(!document.querySelector("#coffee-warning")){
    const message=document.createElement("p");message.id="coffee-warning";message.className="warning";message.setAttribute("role","alert");message.hidden=true;document.querySelector("main").before(message);
  }
  const D = window.STUDY;
  const P=window.PRACTICE;
  const KEY = "icf-practice-room-v1";
  const main = document.querySelector("main");
  const warning = document.querySelector("#storage-warning");
  const usage = window.USAGE;
  if (!usage) console.warn("Study usage module is unavailable. Studying is unaffected.");
  const empty = () => ({version:1, items:{}, scenarios:0, exam:null, examPrevious:null, hintedSuccessIndex:0, practices:{},previousRounds:{},completedModes:{},adaptive:P.emptyAdaptive(),supportHistory:P.emptySupport()});
  const hintedSuccessMessages = ["You got it!", "That's it!", "Nice work!"];
  const hintedSuccessSupport = "Hints help you learn. Keep practicing until you can remember it without them.";
  const legacyQuestionIds = Array.from({length:8},(_,i)=>`q${i+1}`);
  const allIds = D.competencies.map(c => `r${c.id}`).concat(D.questions.map(q => q.id),legacyQuestionIds);
  let lastStored=null,needsExamMigration=false,needsPracticeMigration=false;
  let state = load();
  let questionOrder = [];
  let view = "home", session = null, active = null;
  let scenarioNode = D.scenario.start, history = [], branchChoice = null;
  let saveFailed = false;
  const homeAnchor=document.createComment("practice-home");
  main.before(homeAnchor);
  const dialog=document.createElement("dialog");
  dialog.id="study-dialog";
  dialog.setAttribute("aria-labelledby","study-mode");
  dialog.innerHTML='<header class="study-head"><strong id="study-mode"></strong><span id="study-position"></span><div class="study-head-actions"></div><button id="close-study" class="study-close" aria-label="Close study and show session results">×</button></header><div id="study-errors"></div><div id="study-body"></div><footer id="study-dock"></footer>';
  document.body.append(dialog);
  const brandMark=document.querySelector("#brand .brand-mark");
  brandMark.classList.add("coachprep-logo");brandMark.textContent="";
  const introBrand=document.querySelector("#brand").cloneNode(true);
  introBrand.id="study-brand";
  introBrand.onclick=e=>{e.preventDefault();closeStudy();};
  document.querySelector(".study-head").prepend(introBrand);
  const moved=[warning,document.querySelector("#theme-warning"),document.querySelector("#coffee-warning"),document.querySelector("#announcement")].map(element=>{
    const anchor=document.createComment("warning-home");element.before(anchor);return {element,anchor};
  });
  const theme=document.querySelector("#theme-toggle");
  let flow=null,clockStarted=null,answerStarted=null,launchFocus=null,introMode=null,returnView=null,modalStarted=false,reviewIndex=null;
  let studyTransition=null,entryTransition=null,finishPracticeEntry=null,finishShellClose=null;
  const practiceMotion={duration:240,easing:"cubic-bezier(.22,.61,.36,1)"};
  const navigationMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
  navigationMotion.addEventListener("change",()=>{
    if(!navigationMotion.matches)return;
    studyTransition?.cancel();finishPracticeEntry?.();finishShellClose?.();
  });
  const modeNames={recall:"Core competency recall",questions:"Questions",mixed:"Mixed practice",scenario:"Conversation",exam:"Written competency rehearsal"};
  const usageMode=mode=>({recall:"titles",scenario:"conversation"}[mode] || mode);
  const coffeeWarning=document.querySelector("#coffee-warning");
  const coffee=P.coffee({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},message=>{
    coffeeWarning.textContent=message;coffeeWarning.hidden=false;
  });
  coffee.visit();
  let coffeeHiddenOn=null,coffeeSummary=null;
  function suppressCoffee(kind){
    let stored=false;
    try{
      if(kind==="dismiss" && localStorage.getItem(KEY)!==lastStored)refreshStoredProgress();
      stored=coffee[kind](state.supportHistory?.total || 0);
    }catch{
      coffeeWarning.textContent="The coffee reminder preference could not be saved. This tab will keep it hidden; another tab or reload may show it again. Your study progress is unchanged.";
      coffeeWarning.hidden=false;
    }
    if(!stored)coffeeHiddenOn=P.day();
    const reminder=document.querySelector("#coffee-reminder");
    if(reminder){
      reminder.remove();
      document.querySelector("#adaptive-resume,#resume-practice")?.focus({preventScroll:true});
    }
    announce(!stored?"The coffee reminder is hidden in this tab.":kind==="treat"?
      "The coffee reminder is hidden until tomorrow.":"The coffee reminder is hidden until three more rounds are completed or tomorrow, whichever comes first.");
  }
  document.querySelector("#coffee-link").addEventListener("click",()=>suppressCoffee("treat"));
  function refreshCoffeeReminder(){
    const reminder=document.querySelector("#coffee-reminder");
    if(!reminder || dialog.open)return;
    if(!state.supportHistory || !coffee.eligible(state.supportHistory.total)){
      const focused=reminder.contains(document.activeElement);
      reminder.remove();
      if(focused)document.querySelector("#adaptive-resume,#resume-practice")?.focus({preventScroll:true});
      return;
    }
    const copy=P.supportCopy(state.supportHistory,coffeeSummary);
    reminder.querySelector("h2").textContent=copy.heading;
    const progress=reminder.querySelector("#coffee-progress");
    if(progress)progress.textContent=copy.progress;
  }
  window.addEventListener("focus",refreshCoffeeReminder);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshCoffeeReminder();});
  setInterval(refreshCoffeeReminder,60000);
  function elapsed(){return (flow?.elapsedMs || 0)+(clockStarted===null?0:performance.now()-clockStarted);}
  function answerTime(){return (flow?.answerMs || 0)+(answerStarted===null?0:performance.now()-answerStarted);}
  function isReview(){return reviewIndex!==null || flow?.examReview===true;}
  function syncUsage(){
    usage?.setActive?.(dialog.open && modalStarted && flow && !flow.completed && !isReview() &&
      !finishPracticeEntry && !finishShellClose && clockStarted!==null?usageMode(flow.mode):null);
  }
  function snapshot(){
    return {view,session,active,reviewIndex,scenarioNode,history:history.map(h=>({node:h.node,index:D.scenario.nodes[h.node].choices.indexOf(h.choice)})),branchChoice};
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
    syncUsage();
  }
  function openShell(){
    finishShellClose?.();
    if(dialog.open)return;
    document.querySelectorAll(".round-confetti").forEach(layer=>layer.remove());
    launchFocus=document.activeElement;
    returnView={view,session,active,flow,reviewIndex,scenarioNode,history,branchChoice,introMode,examAtOpen:state.exam,scrollY:window.scrollY,nodes:document.createDocumentFragment()};
    returnView.nodes.append(...main.childNodes);
    modalStarted=false;
    document.querySelector("#study-body").append(main);
    moved.forEach(({element})=>document.querySelector("#study-errors").append(element));
    theme.hidden=true;
    document.body.classList.add("study-open");dialog.showModal();
  }
  function beginFlow(mode,saved=null,resumeUsage=true){
    modalStarted=true;
    flow=saved?JSON.parse(JSON.stringify(saved)):{version:1,mode,elapsedMs:0,answerMs:0,responses:[],completed:false,snapshot:null};
    if(!saved?.completed && ["recall","questions","mixed"].includes(mode))flow.supportObserved=true;
    reviewIndex=saved?.snapshot?.reviewIndex ?? null;
    if(mode==="exam")flow.examReview=flow.examReview===true && state.exam?.status==="draft" && !!state.examPrevious;
    clockStarted=flow.completed || isReview()?null:performance.now();answerStarted=null;introMode=null;
    if(mode==="exam" && state.exam){
      if(!saved)flow.elapsedMs=state.exam.elapsedMs;
      if(state.exam.status!=="draft"){flow.elapsedMs=state.exam.elapsedMs;flow.completionRecorded=true;clockStarted=null;}
    }
    if(saved){
      const s=saved.snapshot;view=s.view;session=s.session;active=s.active;scenarioNode=s.scenarioNode;branchChoice=s.branchChoice;
      history=s.history.map(h=>({node:h.node,choice:D.scenario.nodes[h.node].choices[h.index]}));
      if(session && session.roundStart===undefined){
        session.roundStart=Math.floor(session.index/8)*8;
        session.roundEnd=Math.min(session.roundStart+8,session.items.length);
      }
      if(resumeUsage)usage?.resume(usageMode(mode));
    }
  }
  function noteResponse(item,outcome,extra={}){
    if(!flow)return;
    usage?.count?.(usageMode(flow.mode),"answered");
    const seconds=answerTime()/1000;
    flow.responses.push({c:item.c,type:item.type,outcome,seconds,...extra,...(item.step?{step:item.step}:{}),...(P.isIntegerScored(flow)?
      {score:P.integerPoints({type:item.type,outcome,seconds,...extra},flow.scorePolicy),scoreVersion:P.integerScoreVersion(flow)}:P.isScoredMixed(flow)?
      {score:P.mixedPoints({type:item.type,outcome,seconds,...extra}),scoreVersion:4}:
      item.type==="questions"?{score:P.points(outcome,seconds),scoreVersion:2}:item.type==="recall"?{score:P.recallPoints(extra),scoreVersion:item.step?3:2,...(item.step?{step:item.step}:{})}:{})});
    flow.answerMs=0;answerStarted=null;
  }
  function noteActive(){
    if(!active || active.reported)return;
    active.reported=true;
    noteResponse(active.item,active.outcome,{matched:active.matched===true,revealed:active.revealed===true,...(active.item.type==="recall"?{hintCount:active.hints}:{}),...(active.misplacedC?{misplacedC:active.misplacedC}:{})});
    if(P.isIntegerScored(flow) || P.isScoredMixed(flow)){const response=flow.responses.at(-1);active.score=response.score;active.scoreVersion=response.scoreVersion;}
    if(session){session.answers ||= {};session.answers[session.index]=JSON.parse(JSON.stringify(active));}
  }
  function startMode(mode){
    finishPracticeEntry?.();
    const previous=state.practices[mode],queued=previous?.snapshot?.session;
    if(previous?.completed && queued && queued.index+(previous.snapshot.active?.done?1:0)<queued.items.length){
      beginFlow(mode,previous,false);
      flow.completed=false;flow.completionRecorded=false;flow.elapsedMs=0;flow.answerMs=0;
      flow.supportObserved=true;
      reviewIndex=null;clockStarted=performance.now();
      session.roundStart=session.index;session.roundEnd=Math.min(session.index+8,session.items.length);
      usage?.begin(usageMode(mode));render();if(!focusAdaptiveAnswer())focus(".scenario-prompt,.recall-prompt");animatePracticeEntry("start");return;
    }
    beginFlow(mode);
    if(mode==="scenario"){
      view="scenario";session=null;active=null;scenarioNode=D.scenario.start;history=[];branchChoice=null;
      usage?.begin("conversation");renderScenario();focus(".client");animatePracticeEntry("start");return;
    }
    startSession(mode,8);
    animatePracticeEntry("start");
  }
  function showIntro(mode){
    openShell();
    const saved=state.practices[mode];
    if(saved && !saved.completed && (mode!=="exam" || state.exam)){
      beginFlow(mode,saved);render();
      if(reviewIndex===null && active?.done && active.item.type==="recall")focusRecallContinue();
      else if(reviewIndex===null && active?.done && active.item.type==="questions")focus(".answer-card.selected summary",true);
      else if(!focusAdaptiveAnswer())focus(".scenario-prompt,.recall-prompt,h1,.answer-card.selected summary",true);
      animatePracticeEntry("start");
      return;
    }
    flow=null;clockStarted=null;answerStarted=null;reviewIndex=null;introMode=mode;view=mode;active=null;session=null;
    if(mode==="exam"){
      if(state.exam){beginFlow("exam",saved || null);view="exam";flow.completed=state.exam.status!=="draft";}
      exam.render();focus();animatePracticeEntry(state.exam?"start":"intro");return;
    }
    const queued=saved?.snapshot?.session,continuing=saved?.completed && queued && queued.index+(saved.snapshot.active?.done?1:0)<queued.items.length;
    const scoring=continuing?saved:{mode,scorePolicy:P.scorePolicy};
    const scenarioScoreCopy=P.isIntegerScored(scoring)?`No time deduction through ${P.scenarioGrace(scoring)} seconds: the strongest response earns 9 points and a valid alternative 8. They then decrease to 4 and 3 at one minute. Other responses earn zero. Points are rounded to whole numbers.`:
      P.isScoredMixed(scoring)?"This queued round keeps its earlier 100-point names and 90-point scenarios, including its original speed calculation.":
      "This queued round keeps its earlier scenario points: strongest 90, valid 80, plus up to 14 speed points through 4 seconds, decreasing to zero at one minute.";
    const copy=mode==="recall"?"Build up from choosing names and C numbers to typing the official names. Each competency moves up after two correct answers in a row without hints, even on the same day. Core-word questions use a word from the official name. Hints are available at the final typing step; Pass is always available.":
      mode==="scenario"?"Choose what you would say to a fictional client, then explore a possible reply. Practice noticing what the client wants, questioning your assumptions and choosing how to follow up. Compare the reasoning behind different replies. This conversation has no score.":
      mode==="mixed"?`A mix of competency-name practice (01) and coaching scenarios (02), with eight exercises per round. ${continuing && !P.isIntegerScored(scoring)?"This queued round keeps its original points.":"Names earn up to 10 points each; scenarios earn up to 9."} Hints reduce name points, and Pass earns zero. Scenario points decrease with answer time. Recall names from memory; choose the strongest question response for the moment.`:
      "Practice choosing how to respond in realistic coaching situations. After each answer, explore why some responses fit the client better than others.";
    main.innerHTML=`<section class="study-intro"><h1>${modeNames[mode]}</h1><p>${copy}</p>${mode==="scenario"?`<h2>${escape(D.scenario.title)}</h2><p>${escape(D.scenario.intro)}</p>`:""}${mode==="questions" || mode==="mixed"?`<p class="intro-score">${scenarioScoreCopy}</p>`:mode==="recall"?'<p class="intro-score">Correct names earn 10 points. Extra hints reduce points; a word supplied by the exercise is not an extra hint. Pass earns zero. Name points and moving up never depend on speed.</p>':""}</section>`;
    updateShell();
    const button=document.createElement("button");button.id="begin-practice";button.className="primary";button.textContent="Start "+modeNames[mode].toLowerCase();
    button.onclick=()=>startMode(mode);document.querySelector("#study-dock").append(button);focus();animatePracticeEntry("intro");
  }
  function animatePracticeEntry(kind){
    finishPracticeEntry?.();
    if(navigationMotion.matches || !dialog.open)return;
    const enteredFlow=flow,enteredActive=active,resumeClock=clockStarted!==null,resumeAnswer=answerStarted!==null;
    if(flow)pause();
    const finish=()=>{
      if(finishPracticeEntry!==finish)return;
      finishPracticeEntry=null;entryTransition?.cancel();entryTransition=null;
      if(!dialog.open || finishShellClose || !enteredFlow || flow!==enteredFlow || flow.completed || isReview())return;
      if(resumeClock && clockStarted===null)clockStarted=performance.now();
      if(resumeAnswer && active===enteredActive && !active.done && answerStarted===null)answerStarted=performance.now();
      syncUsage();
    };
    finishPracticeEntry=finish;
    const target=kind==="intro"?dialog:document.querySelector("#study-card") || main;
    entryTransition=target.animate([{transform:kind==="intro"?"translateY(40px)":"translateX(40px)",opacity:.8},
      {transform:kind==="intro"?"translateY(0)":"translateX(0)",opacity:1}],practiceMotion);
    entryTransition.onfinish=finish;
  }
  function closeShell(afterClose){
    studyTransition?.cancel();studyTransition=null;
    const finish=()=>{
      if(finishShellClose!==finish)return;
      finishShellClose=null;entryTransition?.cancel();entryTransition=null;dialog.inert=false;
      dialog.close();document.body.classList.remove("study-open");
      homeAnchor.after(main);moved.forEach(({element,anchor})=>anchor.after(element));
      afterClose();
    };
    finishShellClose=finish;
    if(navigationMotion.matches){finish();return;}
    dialog.inert=true;
    entryTransition=dialog.animate([{transform:"translateY(0)",opacity:1},{transform:"translateY(40px)",opacity:0}],practiceMotion);
    entryTransition.onfinish=finish;
  }
  function recordCompletion(){
    if(!flow?.completed || flow.completionRecorded)return null;
    const oldSupport=state.supportHistory;
    if(oldSupport)state.supportHistory=P.supportCompletion(oldSupport,flow);
    if(session?.retry===true){
      flow.completionRecorded=true;stash();
      return {old:state.previousRounds,oldModes:state.completedModes,oldSupport,celebrate:false};
    }
    if(P.isAdaptive(flow)){
      const current=P.adaptiveMetric(flow),oldAdaptive=state.adaptive,previous=oldAdaptive.previousRound;
      state.adaptive={...oldAdaptive,completed:true,previousRound:current};
      flow.completionRecorded=true;stash();
      return {old:state.previousRounds,oldModes:state.completedModes,oldAdaptive,oldSupport,
        celebrate:!oldAdaptive.completed || !!current && !!previous && current.scheme===previous.scheme && current.signature===previous.signature && current.score>=previous.score};
    }
    const matches=flow.mode==="exam"?state.exam?.answers.map((a,i)=>window.EXAM.compareTitle(a.title,i+1,D.competencies).kind==="match"):null;
    const current=P.roundMetric(flow,matches),previous=state.previousRounds[flow.mode];
    const changed={...state.previousRounds};
    if(current)changed[flow.mode]=current;else delete changed[flow.mode];
    const old=state.previousRounds,oldModes=state.completedModes,first=!oldModes[flow.mode];
    state.completedModes={...oldModes,[flow.mode]:true};
    state.previousRounds=changed;flow.completionRecorded=true;stash();
    return {old,oldModes,oldSupport,celebrate:first || P.improves(current,previous)};
  }
  function confetti(){
    const label=flow?.mode==="exam"?"Your competency recall":"Your round";
    announce(`Well done finishing ${label.toLowerCase()}.`);
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const layer=document.createElement("div");layer.className="round-confetti";layer.setAttribute("aria-hidden","true");
    for(let i=0;i<24;i++){
      const piece=document.createElement("span");
      piece.style.cssText=`--x:${Math.random()*100}%;--drift:${Math.random()*160-80}px;--delay:${Math.random()*.25}s;--spin:${Math.random()*720-360}deg;--color:${["#88bea3","#e5c369","#de9eac"][i%3]}`;
      layer.append(piece);
    }
    (dialog.open?dialog:document.body).append(layer);setTimeout(()=>layer.remove(),2200);
  }
  function closeStudy(options){
    if(finishShellClose)return;
    finishPracticeEntry?.();
    if(!modalStarted && returnView){
      const previous=returnView;returnView=null;
      closeShell(()=>{
        main.replaceChildren(previous.nodes);
        if(previous.stale){view="home";session=null;active=null;flow=null;reviewIndex=null;introMode=null;renderHome();}
        else {
          ({view,session,active,flow,reviewIndex,scenarioNode,history,branchChoice,introMode}=previous);
          if(view==="home" && !main.querySelector(".session-summary") && previous.examAtOpen!==state.exam)renderHome();
        }
        clockStarted=null;answerStarted=null;updateNavigation();refreshCoffeeReminder();
        (launchFocus?.isConnected?launchFocus:document.querySelector("#brand")).focus({preventScroll:true});
        window.scrollTo(0,previous.scrollY);
      });
      return;
    }
    if(flow){pause();stash();}
    const completion=recordCompletion();
    if(!save()){
      if(completion){state.previousRounds=completion.old;state.completedModes=completion.oldModes;state.supportHistory=completion.oldSupport;if(completion.oldAdaptive)state.adaptive=completion.oldAdaptive;flow.completionRecorded=false;stash();}
      if(flow && !isReview() && !flow.completed){clockStarted=performance.now();if(active && !active.done || view==="scenario" && branchChoice===null)answerStarted=performance.now();}
      syncUsage();return;
    }
    const result=flow || {mode:introMode || view,elapsedMs:0,responses:[],completed:false};
    if(flow && !flow.completed)usage?.leave?.(usageMode(flow.mode));
    closeShell(()=>{
      returnView=null;reviewIndex=null;
      view="home";updateNavigation();
      if(options?.home===true || result.mode==="exam" && result.completed){
        renderHome();(launchFocus?.isConnected?launchFocus:document.querySelector("#brand")).focus();
      }else renderSummary(result);
      if(completion){usage?.complete(usageMode(result.mode));if(completion.celebrate)confetti();}
    });
  }
  function renderSummary(result){
    function coffeeCard(){
      if(!P.ordinaryRound(result) || !state.supportHistory || coffeeHiddenOn===P.day() || !coffee.eligible(state.supportHistory.total))return "";
      const invitation=coffee.invitation(state.supportHistory.total);
      if(invitation===null)return "";
      const copy=P.supportCopy(state.supportHistory,result);
      coffeeSummary=result;
      return `<aside id="coffee-reminder" class="coffee-card" aria-labelledby="coffee-heading"><div class="coffee-heading"><img class="coffee-icon" src="assets/coffee-heart-steam.svg" width="48" height="48" alt=""><h2 id="coffee-heading">${escape(copy.heading)}</h2></div>
        ${copy.progress?`<p id="coffee-progress">${escape(copy.progress)}</p>`:""}<p id="coffee-invitation">${escape(invitation)}</p>
        <div class="actions"><a id="treat-coffee" href="https://buymeacoffee.com/mikemo" target="_blank" rel="noopener noreferrer" class="coffee-action" aria-label="Treat me to a coffee (opens a new tab)">Treat me to a coffee</a><button id="dismiss-coffee">Not now</button></div></aside>`;
    }
    function bindCoffee(){
      if(!state.supportHistory || !P.ordinaryRound(result))return;
      document.querySelector("#treat-coffee")?.addEventListener("click",()=>suppressCoffee("treat"));
      document.querySelector("#dismiss-coffee")?.addEventListener("click",()=>suppressCoffee("dismiss"));
    }
    const unified=P.isIntegerScored(result);
    const scoreHeadline=total=>total?`<p class="recall-total"><strong>${Math.round(total.earned/total.maximum*100)}%</strong><span>${total.earned} / ${total.maximum} practice points${!result.completed?" · includes unanswered items":""}</span></p>`:"";
    const summaryHeading=label=>`<header class="summary-heading"><div><p class="eyebrow">${label} · ${result.completed?"Finished":"Paused"}</p><h1>Your study session</h1></div><button type="button" class="study-close" id="close-summary" aria-label="Close session results and practice a different mode">×</button></header>`;
    if(P.isAdaptive(result))return renderAdaptiveSummary(result);
    const answered=P.roundResponses(result).map((response,index)=>{
      if(response.type!=="recall" || response.revealed || response.matched!==false)return response;
      const history=result.snapshot?.session,answer=history?.answers?.[(history.roundStart || 0)+index];
      const misplaced=P.recallMisplacement(response,D.competencies,normalizeTitle) ||
        (answer?.item.id===`r${response.c}`?P.recallMisplacement(answer,D.competencies,normalizeTitle):null);
      return misplaced?{...response,misplacedC:misplaced.id}:response;
    }),draft=state.exam,examMode=result.mode==="exam";
    const recallPercent=P.recallPercentage(result);
    const retry=result.snapshot?.session?.retry===true,retryScore=retry?P.recallScore(result):null;
    const recallCount=result.mode==="recall" && result.completed && answered.length &&
      answered.every(r=>r.type==="recall" && typeof r.matched==="boolean" && typeof r.revealed==="boolean")?
      `<p class="recall-accuracy">${answered.filter(r=>P.recallOutcome(r)==="unaided").length} of ${answered.length} competencies recalled without hints</p>`:"";
    const targets=result.mode==="recall" && result.completed?P.recallRetryTargets(answered):{missed:[],assisted:[]};
    const retryLabel=count=>count?`Practice ${count===1?"this competency":`these ${count} competencies`}`:"Choose competencies to practice";
    const retryPanel=targets.missed.length || targets.assisted.length?`<section class="recall-retry" aria-labelledby="retry-heading"><h2 id="retry-heading">Practice again</h2>${targets.missed.length?`<p>Try these competencies from this round again:</p><ul>${targets.missed.map(r=>`<li>${escape(titleLabel(comp(r.c)))} (${r.revealed===true?"passed":P.recallOutcome(r)==="misplaced"?"wrong position":P.recallMissLabel(r).toLowerCase()})</li>`).join("")}</ul>`:"<p>You recalled every competency. You can try the ones you recalled with hints again.</p>"}${targets.assisted.length?`<label class="retry-inclusion"><input type="checkbox" id="include-hinted"> <span>Include ${targets.assisted.map(r=>escape(titleLabel(comp(r.c)))).join("; ")}, recalled with hints</span></label>`:""}<button id="retry-recall" class="primary"${targets.missed.length?"":" disabled"}>${retryLabel(targets.missed.length)}</button><p class="muted">Choosing this retry does not change your review dates.</p></section>`:"";
    const titleMatches=examMode && draft?.status!=="draft"?draft?.answers.map((a,i)=>window.EXAM.compareTitle(a.title,i+1,D.competencies).kind==="match"):null;
    const mean=answered.length?answered.reduce((n,r)=>n+r.seconds,0)/answered.length:null;
    const pendingRecall=active && !active.done && active.item.type==="recall" && (active.hints>0 || active.attempt.trim())?active:null;
    const lastMetric=examMode?titleMatches?`${titleMatches.filter(Boolean).length} / 8`:"Not checked":mean===null?"Not yet":P.duration(mean*1000);
    const q=answered.filter(r=>r.type==="questions"),mixed=result.mode==="mixed",scaledMixed=P.isScoredMixed(result),mixedTotal=P.mixedScore(result);
    main.innerHTML=`<section class="session-summary">${summaryHeading(retry?"Targeted recall retry":modeNames[result.mode] || "Practice")}${recallCount}${unified?scoreHeadline(P.roundScore(result)):recallPercent!==null?`<p class="recall-total"><strong>${recallPercent}%</strong><span>Recall points earned</span></p>`:retryScore?`<p class="recall-total"><strong>${retryScore.earned} / ${retryScore.maximum}</strong><span>Retry points earned</span></p>`:mixedTotal?`<p class="recall-total"><strong>${mixedTotal.earned} / ${mixedTotal.maximum}</strong><span>Earlier Mixed practice points</span></p>`:""}${coffeeCard()}${!unified && ["recall","questions","mixed"].includes(result.mode)?'<p class="muted">Earlier scoring: this saved session keeps its original points. New sessions use up to 10 points for names and 9 for scenarios.</p>':""}<div class="summary-actions actions"><button id="summary-home">Practice a different mode</button><button class="primary" id="resume-practice">${result.completed?"Start a new round &gt;":"Resume "+(modeNames[result.mode] || "practice").toLowerCase()+" &gt;"}</button></div>${retryPanel}<div class="summary-totals"><div><strong>${P.duration(result.elapsedMs)}</strong><span>Elapsed study time</span></div><div><strong>${examMode?draft?.answers.filter(a=>a.title.trim()||a.bullets.some(b=>b.trim())).length || 0:answered.length}</strong><span>${examMode?"Competencies with writing":"Responses finished"}</span></div><div><strong>${lastMetric}</strong><span>${examMode?"Names matching":(mixed || unified) && answered.length===1?"Answer time":"Average answer time"}</span></div></div>${active && !active.done && !examMode?'<p class="muted">Your unfinished response is saved. Resume to continue from the same place.</p>':""}
    <h2 class="competency-stats-heading"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 20V12M12 20V4M19 20V8"/></svg>Stats by competency</h2><div class="competency-stats">${D.competencies.map(c=>{
      const rows=answered.filter(r=>r.c===c.id),qs=rows.filter(r=>r.type==="questions"),names=rows.filter(r=>r.type==="recall"),conversation=rows.filter(r=>r.type==="scenario");
      if(mixed || unified)return renderPointCompetency(c,rows);
      const count=o=>qs.filter(r=>r.outcome===o).length,answer=draft?.answers[c.id-1];
      const pending=pendingRecall?.item.c===c.id;
      const practiced=examMode?!!answer&&(!!answer.title.trim()||answer.bullets.some(b=>b.trim())):rows.length>0 || pending;
      const concealed=active && !active.done && active.item.type==="recall" && active.item.c===c.id;
      const label=examMode && draft?.status==="draft" || concealed || result.mode==="recall" && !rows.length?`C${c.id}`:titleLabel(c);
      const recallScores=names.filter(r=>Object.hasOwn(r,"score"));
      const recallScore=recallScores.length?`<p class="recall-score">Name recall practice score: ${Math.round(recallScores.reduce((sum,r)=>sum+r.score,0)/recallScores.length)} / 10</p>`:"";
      const recallOutcome=P.recallOutcome(names[0]) || (result.mode==="recall" && pending&&pendingRecall.hints?"assisted":null);
      const misplacedNames=names.filter(r=>P.recallOutcome(r)==="misplaced");
      const misplacedNotes=misplacedNames.map(r=>`<p class="recall-order-note">You named ${escape(titleLabel(comp(r.misplacedC)))}. This position is C${c.id}.${r.outcome==="assisted"?' <span class="pill">With hints</span>':""}</p>`).join("");
      const recallLabels={unaided:"Correct without hints",assisted:"Used hints",misplaced:"Recognized competency, wrong order",missed:P.recallMissLabel(names[0])};
      const recallIcons={unaided:"✓",assisted:"?",misplaced:"&#8596;",missed:"×"};
      const recallStatus=recallOutcome?`<p class="recall-outcome"><span aria-hidden="true">${recallIcons[recallOutcome]}</span> ${recallLabels[recallOutcome]}</p>`:"";
      return `<section class="competency-stat ${practiced?"":"unseen"}${recallOutcome?` recall-${recallOutcome}`:""}"><div class="stat-top"><h3>${escape(label)}</h3>${qs.length?`<div class="practice-score"><small>Practice score</small>${Math.round(qs.reduce((n,r)=>n+P.earnedPoints(r),0)/qs.length)}</div>`:""}</div>${!practiced?"<p>Not practiced</p>":examMode?`<p>${answer.title.trim()?"Core competency entered":"Core competency blank"} · ${answer.bullets.filter(b=>b.trim()).length} of 3 sentence fields filled${titleMatches?` · ${titleMatches[c.id-1]?"Named correctly":"Check the competency name"}`:""}</p>`:
      result.mode==="recall"?`${recallStatus}${misplacedNotes}${recallScore}${pending?"<p>Unfinished. Resume to continue.</p>":""}`:
      `${qs.length?`<p>${count("recognition")} strongest · ${count("reasonable")} valid · ${count("missed")} to improve</p><p>${qs.length} answered · average answer time ${P.duration(qs.reduce((n,r)=>n+r.seconds,0)/qs.length*1000)}</p>`:""}${names.length?`${recallStatus}<p>${names.filter(r=>P.recallOutcome(r)==="unaided").length} correct without hints · ${names.filter(r=>P.recallOutcome(r)==="assisted").length} correct with hints · ${names.filter(r=>r.revealed===true).length} passed · ${names.filter(r=>P.recallOutcome(r)==="missed" && r.revealed!==true).length} need another look</p>`:""}${misplacedNotes}${recallScore}${pending?`<p>Unfinished name attempt${pendingRecall.hints?` · ${pendingRecall.hints} hint${pendingRecall.hints===1?"":"s"} used`:""}. Resume to continue.</p>`:""}${conversation.length?`<p>${conversation.length} fictional conversation choice${conversation.length===1?"":"s"} explored. No automated score.</p>`:""}`}</section>`;
    }).join("")}</div><details class="summary-help" open><summary>About these results</summary><p>These are practice results, not an official ICF assessment. ${unified?`Names earn up to 10 points, reduced by extra hints. Built-in exercise cues do not reduce points. Wrong-number official names earn 1 point; wrong answers and Pass earn zero. Strongest scenarios earn 9 points through ${P.scenarioGrace(result)} seconds, decreasing to 4 at one minute; valid alternatives earn 8, decreasing to 3. Other responses earn zero. Each answer is rounded once and saved. Cards and round results sum those saved integers; maximum points include every item in the round. The percentage is earned points divided by available points, not a measure of ability.`:scaledMixed?"This earlier Mixed policy keeps its 100-point names and 90-point scenarios, including its original speed calculation. Card and round points are sums of saved answers; maximum points include all items in the round.":q.length?"Earlier question scores use 90 / 80 / 0 base points plus up to 14 accepted-response speed points, capped through 4 seconds and tapering to zero at one minute. The competency score is the rounded mean of earned scores. Earlier saved answers keep their original bonus.":""} Name recall, conversation choices and written practice are not speed-scored. Written practice time counts up and pauses while you are away.${retry?" This targeted retry is not compared with full rounds and does not change their comparison baseline.":""}</p></details></section>`;
    document.querySelector("#close-summary").onclick=document.querySelector("#summary-home").onclick=()=>{flow=null;view="home";renderHome();(launchFocus?.isConnected?launchFocus:document.querySelector("#brand")).focus();};
    const reviewSession=result.snapshot?.session;
    const reviewable=Object.keys(reviewSession?.answers || {}).map(Number).filter(i=>i>=(reviewSession.roundStart || 0) && i<=reviewSession.index);
    if(reviewable.length){
      const savedRound=state.practices[result.mode];
      const reviewButton=document.createElement("button");reviewButton.id="review-round";reviewButton.textContent="< Review your answers";
      reviewButton.onclick=()=>{
        if(!storedRoundIsCurrent(result.mode,savedRound))return;
        const saved=JSON.parse(JSON.stringify(savedRound));
        saved.snapshot.reviewIndex=Math.max(...reviewable);
        openShell();beginFlow(result.mode,saved,false);
        viewAnswer(Math.max(...reviewable));
        animatePracticeEntry("start");
      };
      document.querySelector(".summary-actions").prepend(reviewButton);
    }
    function renderPointCompetency(c,rows){
      const names=rows.filter(r=>r.type==="recall"),questions=rows.filter(r=>r.type==="questions");
      const pending=pendingRecall?.item.c===c.id,practiced=rows.length>0 || pending;
      const concealed=active && !active.done && active.item.type==="recall" && active.item.c===c.id;
      const statuses=rows.map(r=>r.type==="recall"?P.recallOutcome(r):r.type==="questions"?r.outcome==="missed"?"missed":"unaided":null);
      if(pending && pendingRecall.hints)statuses.push("assisted");
      const outcome=["missed","misplaced","assisted","unaided"].find(value=>statuses.includes(value));
      const total=P.roundScore(result,c.id),scoredNames=names.filter(r=>Object.hasOwn(r,"score"));
      const legacyScores=[
        questions.length?`<div class="practice-score"><small>Earlier question points</small>${Math.round(questions.reduce((sum,r)=>sum+P.earnedPoints(r),0)/questions.length)}</div>`:"",
        scoredNames.length?`<div class="practice-score"><small>Earlier name points</small>${Math.round(scoredNames.reduce((sum,r)=>sum+r.score,0)/scoredNames.length)} / 10</div>`:""
      ].join("");
      const points=rows.length && total?`<div class="practice-score"><small>Practice points</small>${total.earned} / ${total.maximum}</div>`:!unified && !scaledMixed?legacyScores:"";
      const counts=entries=>entries.filter(([n])=>n>0).map(([n,label])=>`${n} ${label}`).join(" · ");
      const questionCounts=counts([["recognition","strongest"],["reasonable","valid"],["missed","to improve"]].map(([value,label])=>[questions.filter(r=>r.outcome===value).length,label]));
      const namedOutcome=["missed","misplaced","assisted","unaided"].find(value=>names.some(r=>P.recallOutcome(r)===value));
      const nameRow=names.find(r=>P.recallOutcome(r)===namedOutcome);
      const nameLabel={unaided:"Correct without hints",assisted:"Used hints",misplaced:"Recognized competency, wrong order",missed:P.recallMissLabel(nameRow)}[namedOutcome];
      const icons={unaided:"✓",assisted:"",misplaced:"&#8596;",missed:"×"};
      const nameCounts=names.length>1?counts([
        [names.filter(r=>P.recallOutcome(r)==="unaided").length,"correct without hints"],
        [names.filter(r=>P.recallOutcome(r)==="assisted").length,"correct with hints"],
        [names.filter(r=>r.revealed===true).length,"passed"],
        [names.filter(r=>P.recallOutcome(r)==="misplaced").length,"wrong order"],
        [names.filter(r=>P.recallOutcome(r)==="missed" && r.revealed!==true).length,"need another look"]
      ]):"";
      return `<section class="competency-stat ${practiced?"":"unseen"}${outcome?` recall-${outcome}`:""} mixed-stat"><div class="stat-top"><h3>${escape(concealed?`C${c.id}`:titleLabel(c))}</h3>${points?`<div class="practice-scores">${points}</div>`:""}</div>
        ${!practiced?"<p>Not practiced</p>":`${questions.length?`<p class="recall-outcome">Scenarios: ${questionCounts}</p>`:""}${names.length?`<p class="recall-outcome"><span aria-hidden="true">${icons[namedOutcome]}</span> Names: ${nameLabel}</p>${nameCounts?`<p>${nameCounts}</p>`:""}`:""}
        ${names.filter(r=>P.recallOutcome(r)==="misplaced").map(r=>`<p class="recall-order-note">You named ${escape(titleLabel(comp(r.misplacedC)))}. This position is C${c.id}.${r.outcome==="assisted"?' <span class="pill">With hints</span>':""}</p>`).join("")}
        ${rows.length?`<p>${rows.length} answered · ${rows.length===1?"answer time":"average answer time"} ${P.duration(rows.reduce((sum,r)=>sum+r.seconds,0)/rows.length*1000)}</p>`:""}
        ${pending?`<p>Unfinished name attempt${pendingRecall.hints?` · ${pendingRecall.hints} hint${pendingRecall.hints===1?"":"s"} used`:""}. Resume to continue.</p>`:""}`}</section>`;
    }
    function renderAdaptiveSummary(result){
      const rows=P.roundResponses(result),retry=result.snapshot.session.retry===true;
      const targets=P.recallRetryTargets(rows),savedRound=state.practices.recall;
      main.innerHTML=`<section class="session-summary">${summaryHeading(retry?"Targeted step-by-step retry":"Step-by-step competency practice")}
        <p>${rows.length} of ${result.snapshot.session.items.length} responses finished · ${P.duration(result.elapsedMs)} study time</p>
        ${unified?scoreHeadline(P.roundScore(result)):retry && result.completed?`<p class="recall-total"><strong>${rows.reduce((sum,r)=>sum+r.score,0)} / ${result.snapshot.session.items.length*10}</strong><span>Retry points earned</span></p>`:""}
        ${coffeeCard()}${!unified?'<p class="muted">Earlier scoring: this saved session keeps its original points and comparison rules.</p>':""}
        <div class="summary-actions actions"><button id="adaptive-review"${Object.keys(result.snapshot.session.answers || {}).length?"":" hidden"}>&lt; Review your answers</button><button id="adaptive-home">Practice a different mode</button><button class="primary" id="adaptive-resume">${result.completed?"Start a new round &gt;":"Resume &gt;"}</button></div>
        ${!result.completed?'<p class="muted">Your unfinished response is saved. Resume to continue.</p>':""}
        ${result.completed && (targets.missed.length || targets.assisted.length)?`<section class="recall-retry"><h2>Practice again</h2><p>Retry ${targets.missed.length} missed or passed competencies from this round.</p>
          ${targets.missed.length?`<ul>${targets.missed.map(r=>`<li>${escape(titleLabel(comp(r.c)))} (${r.revealed?"passed":r.misplacedC?"wrong position":r.step<=2?"wrong choice":"name did not match"})</li>`).join("")}</ul>`:""}
          ${targets.assisted.length?`<label class="retry-inclusion"><input type="checkbox" id="adaptive-include-hinted"><span>Include ${targets.assisted.map(r=>escape(titleLabel(comp(r.c)))).join("; ")}, correctly answered with hints</span></label>`:""}
          <button id="adaptive-retry"${targets.missed.length?"":" disabled"}>Practice selected competencies</button><p class="muted">Choosing a retry does not change review dates. Retry answers are practice, not evidence for moving up or stepping back.</p></section>`:""}
        <h2>Results by competency</h2><div class="competency-stats">${D.competencies.map(c=>{
          const row=rows.find(r=>r.c===c.id),p=state.adaptive.items[c.id],outcome=P.recallOutcome(row);
          const labels={unaided:row?.step===1?"Selected the name":row?.step===2?"Selected the C number":row?.step===3?"Typed with a core word":"Typed from the C number",assisted:"Correct with hints",misplaced:"Recognized competency, wrong order",missed:row?.revealed?"Pass: answer revealed":row?.step<=2?"Choice did not match":"Name did not match"};
          return `<section class="competency-stat${row?` recall-${outcome}`:" unseen"}${unified?" mixed-stat":""}">${unified?`<div class="stat-top"><h3>${row?escape(titleLabel(c)):`C${c.id}`}</h3>${row?`<div class="practice-scores"><div class="practice-score"><small>Practice points</small>${row.score} / 10</div></div>`:""}</div>`:`<h3>${row?escape(titleLabel(c)):`C${c.id}`}</h3>`}
            ${row?`<p class="recall-outcome">${unified && outcome==="unaided"?"Correct without extra hints":escape(labels[outcome])}</p><p>Step ${row.step}: ${P.stepLabels[row.step]}</p>${unified?`<p>1 answered · answer time ${P.duration(row.seconds*1000)}</p>`:`<p>Practice points: ${row.score} / 10</p>`}`:"<p>Not answered</p>"}
            <p>Next practice: Step ${p?.step || 1}</p></section>`;
        }).join("")}</div><details class="summary-help" open><summary>About these results</summary><p>Points belong to the exercise shown, not a measure of ability. ${unified?"The percentage is saved points divided by all available points in this round. Correct names earn 10; extra hints reduce that to 6, 4, 3, 2, then 1. Built-in cues are not extra hints. Known official names at the wrong number earn 1; other wrong answers and Pass earn zero. ":""}Selecting a name, selecting its number and typing it are different tasks. Each competency moves up after two correct answers in a row without hints in normal rounds, even on the same day. It steps back after two answers needing help among its last three normal attempts at that step. These are practice rules, not validated learning thresholds or an ICF assessment.${retry?" Retries do not replace full-round comparisons or change steps.":""}</p></details>
        </section>`;
      document.querySelector("#adaptive-resume").onclick=()=>{if(!storedRoundIsCurrent("recall",savedRound))return;if(result.completed){openShell();startMode("recall");}else navigate("recall");};
      document.querySelector("#close-summary").onclick=document.querySelector("#adaptive-home").onclick=()=>{flow=null;view="home";renderHome();focus();};
      document.querySelector("#adaptive-review").onclick=()=>{
        if(!storedRoundIsCurrent("recall",savedRound))return;
        const index=Math.max(...Object.keys(savedRound.snapshot.session.answers).map(Number));
        openShell();beginFlow("recall",savedRound,false);viewAnswer(index);animatePracticeEntry("start");
      };
      const include=document.querySelector("#adaptive-include-hinted"),button=document.querySelector("#adaptive-retry");
      const selected=()=>targets.missed.concat(include?.checked?targets.assisted:[]).map(r=>r.c);
      if(include)include.onchange=()=>{button.disabled=!selected().length;};
      if(button)button.onclick=()=>{if(!storedRoundIsCurrent("recall",savedRound))return;const ids=selected();if(ids.length)startRecallRetry(ids,true);};
      bindCoffee();
      updateNavigation();focus();
    }
    document.querySelector("#resume-practice").onclick=()=>{
      if(result.completed && ["recall","questions","mixed"].includes(result.mode)){openShell();startMode(result.mode);}
      else {navigate(result.mode || "recall");if(result.completed && result.mode==="exam")document.querySelector("#exam-discard")?.click();}
    };
    const retryButton=document.querySelector("#retry-recall"),includeHinted=document.querySelector("#include-hinted");
    const selectedIds=()=>targets.missed.concat(includeHinted?.checked?targets.assisted:[]).map(r=>r.c);
    if(retryButton){
      if(includeHinted)includeHinted.onchange=()=>{
        const count=selectedIds().length;retryButton.disabled=count===0;retryButton.textContent=retryLabel(count);
      };
      const savedRound=state.practices[result.mode];
      retryButton.onclick=()=>{
        if(!storedRoundIsCurrent(result.mode,savedRound))return;
        const ids=selectedIds();
        if(!ids.length){announce("Choose at least one competency to practice.");return;}
        startRecallRetry(ids);
      };
    }
    bindCoffee();
    updateNavigation();
    focus();
  }
  function storedRoundIsCurrent(mode,savedRound) {
    let unchanged;
    try {unchanged=localStorage.getItem(KEY)===lastStored;}
    catch {storageError("Your browser couldn't open saved progress. Keep this tab open and try again.");return false;}
    if(!savedRound || state.practices[mode]!==savedRound || !unchanged){refreshStoredProgress();return false;}
    return true;
  }
  function updateShell(){
    if(!dialog.open)return;
    document.querySelector("#close-study").setAttribute("aria-label",modalStarted?"Close study and show session results":"Close introduction");
    const mode=flow?.mode || introMode || view;
    const modeLabel=document.querySelector("#study-mode");
    modeLabel.textContent=modeNames[mode] || "Practice";
    modeLabel.hidden=!modalStarted;
    introBrand.hidden=modalStarted;
    const heading=main.querySelector("h1");
    if(!modalStarted && heading)heading.id="study-intro-title";
    dialog.setAttribute("aria-labelledby",modalStarted?"study-mode":"study-intro-title");
    document.querySelector("#study-position").textContent=session?`${reviewIndex!==null?"Review ":""}${Math.min((reviewIndex ?? session.index)-(session.roundStart || 0)+1,(session.roundEnd || session.items.length)-(session.roundStart || 0))} / ${(session.roundEnd || session.items.length)-(session.roundStart || 0)}`:"";
    const dock=document.querySelector("#study-dock");dock.replaceChildren();
    const headerActions=document.querySelector(".study-head-actions");headerActions.replaceChildren();
    const time=document.createElement("span");time.id="practice-time";time.setAttribute("role","timer");time.setAttribute("aria-live","off");time.setAttribute("aria-label","Elapsed study time");time.textContent=flow?P.duration(elapsed()):"";headerActions.append(time);
    dock.classList.toggle("item-navigation",!!session && ["recall","questions","mixed"].includes(mode));
    if(reviewIndex!==null)main.querySelector("#next-item")?.remove();
    const selector=view==="exam"?'#exam-start,button[form="exam-form"],#exam-download,#exam-discard,#exam-home':
      '#next-item,#continue-scenario,#back-home,#restart-scenario,#recall-form button[type="submit"],#reveal';
    main.querySelectorAll(selector).forEach(button=>{if(button.type==="submit"&&button.closest("form")){button.setAttribute("form",button.closest("form").id);if(view!=="exam")button.textContent="Submit";}dock.append(button);});
    if(view==="exam"){
      const deadline=main.querySelector(".exam-clock");if(deadline){deadline.querySelector('[role="timer"]')?.setAttribute("aria-label","Elapsed study time");time.replaceWith(deadline);}
      main.querySelectorAll("#exam-home").forEach(b=>b.hidden=false);
    }
    if(active && !active.done && flow && !isReview() && !finishPracticeEntry && answerStarted===null)answerStarted=performance.now();
    if(view==="scenario" && branchChoice===null && flow && !isReview() && answerStarted===null)answerStarted=performance.now();
    if(active && !active.done && active.item.type==="questions" && reviewIndex===null){
      const cue=document.createElement("p");cue.className="answer-cue muted";cue.textContent="Select an answer to see feedback.";dock.append(cue);
    }
    if(session){
      const available=Object.keys(session.answers || {}).map(Number).filter(i=>i>=(session.roundStart || 0) && i<session.index).sort((a,b)=>a-b);
      const previous=available.filter(i=>i<(reviewIndex ?? session.index)).at(-1);
      const back=document.createElement("button");back.id="review-previous";back.textContent="< Back";back.setAttribute("aria-label","Back to previous answer");back.hidden=previous===undefined;back.disabled=previous===undefined;
      back.onclick=()=>viewAnswer(previous);dock.append(back);
      main.querySelector(".review-unavailable")?.remove();
      if(previous===undefined && (reviewIndex ?? session.index)>(session.roundStart || 0)){
        const note=document.createElement("p");note.className="muted review-unavailable";
        note.textContent="Earlier answers in this saved round weren't stored for review. New answers will be available.";
        main.prepend(note);
      }
      if(reviewIndex!==null){
        const next=available.find(i=>i>reviewIndex);
        if(next!==undefined){const forward=document.createElement("button");forward.id="review-next";forward.textContent="Next >";forward.setAttribute("aria-label","Next reviewed answer");forward.onclick=()=>viewAnswer(next);dock.append(forward);}
        const resume=document.createElement("button");resume.id="review-return";resume.className="primary";resume.textContent=flow.completed?"Back to results":"Return >>";resume.setAttribute("aria-label",flow.completed?"Back to results":"Return to current item");resume.onclick=resumeCurrent;dock.append(resume);
      }
    }
    if(session && ["recall","questions","mixed"].includes(mode)){
      const slot=button=>button.id==="review-previous"?0:["reveal","review-next"].includes(button.id)?1:2;
      [...dock.children].sort((a,b)=>slot(a)-slot(b)).forEach(button=>dock.append(button));
    }
    stash();
    syncUsage();
  }
  function viewAnswer(index){
    if(!session?.answers?.[index]){announce("This earlier answer was not saved for review.");return;}
    finishPracticeEntry?.();
    const from=reviewIndex ?? session.index;
    pause();reviewIndex=index;renderStudy();document.querySelector("#study-body").scrollTop=0;
    focus(".answer-card.selected summary,#study-card .answer-title",true);
    animateStudyNavigation(from,index);
    announce("Reviewing a submitted answer. Your timers are paused.");
  }
  function resumeCurrent(){
    if(flow.completed){closeStudy();return;}
    finishPracticeEntry?.();
    const from=reviewIndex;
    reviewIndex=null;clockStarted=performance.now();answerStarted=active && !active.done?performance.now():null;
    renderStudy();
    if(active?.done && active.item.type==="recall")focusRecallContinue();
    else if(active?.done && active.item.type==="questions")focus(".answer-card.selected summary",true);
    else if(!focusAdaptiveAnswer())focus("#recall-input,.scenario-prompt,#study-card h3",true);
    animateStudyNavigation(from,session.index);
    persist();
    announce("Returned to your current item.");
  }
  function animateStudyNavigation(from,to){
    finishPracticeEntry?.();
    studyTransition?.cancel();studyTransition=null;
    if(from===to || from===null || navigationMotion.matches)return;
    const card=document.querySelector("#study-card");
    if(!card)return;
    studyTransition=card.animate([{transform:`translateX(${to>from?40:-40}px)`,opacity:.8},{transform:"translateX(0)",opacity:1}],
      practiceMotion);
  }
  function examReview(open){
    if(flow?.mode!=="exam" || state.exam?.status!=="draft" || open===!!flow.examReview)return;
    pause();flow.examReview=open;if(!open)clockStarted=performance.now();syncUsage();persist();
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
  function trapDialogFocus(event){
    const owner=event.currentTarget;
    if(event.key!=="Tab" || document.activeElement.closest("dialog")!==owner)return;
    const controls=[...owner.querySelectorAll("button:not([disabled]),input,textarea,select,summary,a[href]")].filter(e=>e.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first || !event.shiftKey&&document.activeElement===last){event.preventDefault();(event.shiftKey?last:first)?.focus();}
  }
  dialog.addEventListener("keydown",trapDialogFocus);
  setInterval(()=>{if(dialog.open && flow){const time=document.querySelector("#practice-time");if(time)time.textContent=P.duration(elapsed());persist();}},1000);
  window.addEventListener("pagehide",()=>{if(dialog.open){finishPracticeEntry?.();pause();persist();}});
  window.addEventListener("beforeunload",event=>{if(dialog.open && !persist()){event.preventDefault();event.returnValue="";}});
  window.addEventListener("storage",event=>{
    if(event.key===KEY || event.key===null)refreshStoredProgress();
    if((event.key===coffee.key || event.key===null) && document.querySelector("#coffee-reminder") && !coffee.eligible(state.supportHistory?.total || 0)){
      const focused=document.querySelector("#coffee-reminder").contains(document.activeElement);
      document.querySelector("#coffee-reminder").remove();
      if(focused)document.querySelector("#adaptive-resume,#resume-practice")?.focus({preventScroll:true});
    }
  });

  function refreshStoredProgress(){
    if(dialog.open && flow){
      saveFailed=true;storageError("Study data changed in another tab. Keep this tab open and copy any work you need before refreshing. This tab will not overwrite the other tab's saved work.");return;
    }
    state=load();
    if(returnView)returnView.stale=true;
    if(!dialog.open){
      flow=null;session=null;active=null;reviewIndex=null;introMode=null;view="home";
      renderHome();focus();
    }
    announce("Study progress changed in another tab. Saved results have been refreshed.");
  }

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
            !Number.isFinite(item.due) || item.due < 0 || !["unaided","assisted","recognition","reasonable","missed"].includes(item.last) ||
            (item.lastMisplacedC!==undefined && (!id.startsWith("r") || !Number.isInteger(item.lastMisplacedC) || item.lastMisplacedC<1 || item.lastMisplacedC>8 || id===`r${item.lastMisplacedC}` || !["assisted","missed"].includes(item.last))) ||
            (item.lastRecallMiss!==undefined && (!id.startsWith("r") || !["passed","incorrect"].includes(item.lastRecallMiss) || !["assisted","missed"].includes(item.last) || item.lastMisplacedC!==undefined))) {
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
      const invalidAdaptive=s.adaptive!==undefined && !P.validAdaptive(s.adaptive);
      if(invalidAdaptive)storageError("Step-by-step progress could not be opened and starts fresh. Earlier recall results and written answers are unchanged.");
      s.adaptive=P.validAdaptive(s.adaptive)?s.adaptive:P.emptyAdaptive();
      if(s.supportHistory!==undefined && !P.validSupport(s.supportHistory)){
        s.supportHistory=null;storageError("The local round summary could not be opened. Coffee progress reminders are off until you reset progress. Your saved answers are unchanged.");
      }else s.supportHistory=s.supportHistory ?? P.emptySupport();
      if(s.practices!==undefined && (!s.practices || typeof s.practices!=="object" || Array.isArray(s.practices)))storageError("Saved practice sessions could not be opened. Existing review counts and exam answers are still available.");
      s.practices=s.practices && typeof s.practices==="object" && !Array.isArray(s.practices)?s.practices:{};
      for(const [mode,saved] of Object.entries(s.practices)){
        if(saved?.mode!==mode || !window.PRACTICE.validSaved(saved,D) ||
          P.isAdaptive(saved) && (invalidAdaptive || saved.snapshot.session.adaptiveRound>s.adaptive.nextRound)){
          delete s.practices[mode];storageError("A saved practice session could not be opened. Existing review counts and exam answers are still available.");
        }
        else {
          const migrated=window.PRACTICE.migrateScores(saved);
          if(migrated!==saved){s.practices[mode]=migrated;needsPracticeMigration=true;}
        }
      }
      s.exam=window.EXAM.migrate(s.exam,s.practices.exam?.elapsedMs);
      if(s.previousRounds!==undefined && !window.PRACTICE.validBaselines(s.previousRounds))storageError("Your previous-round comparison could not be opened. Saved study answers are unchanged.");
      s.previousRounds=window.PRACTICE.validBaselines(s.previousRounds)?s.previousRounds:{};
      if(s.completedModes!==undefined && !P.validCompletedModes(s.completedModes))storageError("Previous completion history could not be opened. Saved answers are unchanged.");
      s.completedModes=P.validCompletedModes(s.completedModes)?s.completedModes:{};
      for(const mode of [...Object.keys(s.previousRounds),...Object.entries(s.practices).filter(([,p])=>p.completed && !P.isAdaptive(p) && p.snapshot?.session?.retry!==true).map(([mode])=>mode)]){
        if(!s.completedModes[mode]){s.completedModes[mode]=true;needsPracticeMigration=true;}
      }
      for(const [mode,saved] of Object.entries(s.practices)){
        if(P.isAdaptive(saved))continue;
        if(saved.completed && !saved.completionRecorded && !s.previousRounds[mode]){
          const metric=window.PRACTICE.roundMetric(saved);
          if(metric){s.previousRounds[mode]=metric;needsPracticeMigration=true;}
        }
        if(saved.completed && saved.completionRecorded===undefined){saved.completionRecorded=true;needsPracticeMigration=true;}
      }
      const previousExam=s.exam && s.exam.status!=="draft"?s.exam:s.examPrevious;
      if(previousExam && !s.previousRounds.exam){
        const matches=previousExam.answers.map((a,i)=>window.EXAM.compareTitle(a.title,i+1,D.competencies).kind==="match");
        s.previousRounds.exam=window.PRACTICE.roundMetric({mode:"exam"},matches);needsPracticeMigration=true;
      }
      if(previousExam)s.completedModes.exam=true;
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
    catch { saveFailed=true; storageError("Your browser couldn't save your progress or written answers. Keep this tab open. Refreshing or closing it may lose your work. In Written competency rehearsal, choose Save a text copy for a backup."); return false; }
  }
  function record(id, outcome, misplacedC=null, recallMiss=null) {
    const p = state.items[id] || {unaided:0, assisted:0, recognition:0, reasonable:0, missed:0, streak:0};
    p[outcome]++;
    p.last = outcome;
    delete p.lastMisplacedC;
    delete p.lastRecallMiss;
    if(misplacedC)p.lastMisplacedC=misplacedC;
    if(recallMiss)p.lastRecallMiss=recallMiss;
    const success = outcome === "unaided" || outcome === "recognition" || outcome === "reasonable";
    p.streak = success ? p.streak + 1 : 0;
    const days = [1,3,7][Math.min(p.streak - 1,2)];
    p.due = Date.now() + (success ? days * 86400000 : 600000);
    state.items[id] = p;
    persist();
  }
  const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const comp = id => D.competencies.find(c => c.id === Number(id));
  const officialReferences = (refs=[],quoted=true) => refs.length?`<ul class="official-references">${refs.map(ref=>`<li><strong>${ref}</strong> ${quoted?'"':""}${escape(D.subcompetencies[ref])}${quoted?'"':""}</li>`).join("")}</ul>`:"";
  const sourceDetails = (c,refs=[]) => `${D.source} · ${D.version}<br>Official 2025 model · PDF p. ${Number(c)+2}${refs.length?" · sub-competencies quoted below":" · competency name"}.`;
  const citation = (c, refs = []) => `<div class="citation"><p>${sourceDetails(c,refs)}</p>${officialReferences(refs)}</div>`;
  const bonusHeading = (c,refs=[],level=3) => `<div class="bonus-heading"><h${level}>${titleLabel(comp(c))}</h${level}><span class="source-info">
    <button type="button" class="source-info-button" popovertarget="bonus-source-${c}" aria-label="Source information for ${escape(titleLabel(comp(c)))}" aria-haspopup="dialog" aria-expanded="false" aria-controls="bonus-source-${c}"><span aria-hidden="true">i</span></button>
    <span id="bonus-source-${c}" class="source-info-panel" popover="auto" role="dialog" aria-label="Source information for C${c}"><span>${sourceDetails(c,refs)}</span><a href="https://coachingfederation.org/credentialing/coaching-competencies/icf-core-competencies/" target="_blank" rel="noopener noreferrer">Official ICF competency resource (opens a new tab)</a><button type="button" class="source-info-close">Close source information</button></span></span></div>`;
  function setupBonusSources(){
    main.querySelectorAll(".source-info").forEach(wrapper=>{
      const button=wrapper.querySelector(".source-info-button"),panel=wrapper.querySelector(".source-info-panel");
      let pinned=false,suppressFocus=false,opening=false,closeTimer=null;
      const isOpen=()=>panel.matches(":popover-open");
      const open=()=>{
        clearTimeout(closeTimer);
        if(opening || !panel.isConnected)return;
        opening=true;
        try{if(!isOpen())panel.showPopover();}finally{opening=false;}
        button.setAttribute("aria-expanded","true");
        const anchor=button.getBoundingClientRect(),size=panel.getBoundingClientRect();
        panel.style.left=`${Math.max(12,Math.min(anchor.left,window.innerWidth-size.width-12))}px`;
        panel.style.top=`${Math.max(12,Math.min(anchor.bottom+6,window.innerHeight-size.height-12))}px`;
      };
      const close=(restore=false)=>{
        clearTimeout(closeTimer);pinned=false;
        const wasOpen=isOpen();suppressFocus=true;
        if(wasOpen)panel.hidePopover();
        button.setAttribute("aria-expanded","false");
        if(restore)button.focus({preventScroll:true});
        if(!wasOpen)suppressFocus=false;
      };
      const leave=()=>{closeTimer=setTimeout(()=>{
        if(!pinned && !wrapper.matches(":hover") && !wrapper.contains(document.activeElement))close();
      },150);};
      wrapper.addEventListener("pointerenter",e=>{if(e.pointerType!=="touch")open();});
      wrapper.addEventListener("pointerleave",leave);
      panel.addEventListener("pointerenter",()=>clearTimeout(closeTimer));
      panel.addEventListener("pointerleave",leave);
      button.addEventListener("focus",()=>{if(!suppressFocus)open();});
      wrapper.addEventListener("focusout",e=>{if(!pinned && !wrapper.contains(e.relatedTarget))close();});
      button.addEventListener("click",e=>{e.preventDefault();if(pinned)close();else{open();pinned=true;}});
      wrapper.addEventListener("keydown",e=>{
        if(e.key==="Escape" && isOpen()){e.preventDefault();e.stopPropagation();close(true);}
      });
      panel.querySelector(".source-info-close").addEventListener("click",()=>close(true));
      panel.addEventListener("beforetoggle",e=>{if(e.newState==="closed")suppressFocus=true;});
      panel.addEventListener("toggle",()=>{
        button.setAttribute("aria-expanded",String(isOpen()));if(!isOpen())pinned=false;suppressFocus=false;
      });
    });
  }
  const announce = text => { document.querySelector("#announcement").textContent = text; };
  function focus(selector = "h1", ensureVisible = false) {
    const el = [...main.querySelectorAll(selector)].find(element=>element.getClientRects().length);
    if (el) {
      if(!el.matches("input,button,select,textarea,summary,a[href],[tabindex],[contenteditable='true']"))el.setAttribute("tabindex","-1");
      el.focus(); if(ensureVisible)el.scrollIntoView({block:"nearest",behavior:"instant"});
    }
  }
  const normalizeTitle = window.EXAM.normalizeTitle;
  const titleLabel = window.EXAM.titleLabel;
  const exam = window.EXAM.create({get:()=>state.exam,set:a=>{state.exam=a;if(!a){delete state.practices.exam;flow=null;clockStarted=null;answerStarted=null;reviewIndex=null;modalStarted=false;}},save:persist,storageError,
    getPrevious:()=>state.examPrevious,setPrevious:a=>{state.examPrevious=a;},getElapsed:()=>flow?.mode==="exam"?elapsed():state.exam?.elapsedMs || 0,
    hasStorageFailure:()=>saveFailed,announce,escape,focus,home:()=>closeStudy({home:true}),
    onReviewChange:examReview,isReviewing:()=>flow?.examReview===true,
    isVisible:()=>view==="exam",onStarted:()=>usage?.begin("exam"),
    onCompleted:()=>{
      if(flow?.mode==="exam"){
        pause();flow.elapsedMs=state.exam.elapsedMs;flow.completed=true;
        const completion=recordCompletion();
        if(completion && persist()){
          usage?.count?.("exam","answered",state.exam.answers.filter(a=>a.title.trim()||a.bullets.some(b=>b.trim())).length);
          usage?.complete("exam");if(completion.celebrate)confetti();
        }
        else if(completion){state.previousRounds=completion.old;state.completedModes=completion.oldModes;state.supportHistory=completion.oldSupport;flow.completionRecorded=false;stash();}
      }
    },onFinished:()=>{if(view==="home")renderHome();},
    onRender:()=>{
      const starting=state.exam && !flow && dialog.open;
      if(starting)beginFlow("exam");
      if(flow?.mode==="exam" && state.exam)flow.completed=state.exam.status!=="draft";
      updateShell();if(starting)animatePracticeEntry("start");
    },citation});
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
    document.querySelector(".tabs").hidden=view==="home";
    theme.hidden=dialog.open || view!=="home" || !!main.querySelector(".session-summary");
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
    const levels={1:"choose the name",2:"choose the C number",3:"type with a core word",4:"type from the C number"};
    main.innerHTML = `<section class="hero"><div><p class="eyebrow">ICF core competencies · 2025</p><h1>The eight ICF<br>core competencies</h1><p class="lead">Practice the names from memory, explore coaching choices in questions or try a written competency rehearsal.</p></div><div class="orbit" aria-hidden="true"><strong class="coachprep-logo"></strong>${Array.from({length:8},(_,i)=>`<span style="left:${50+42*Math.cos((i-1)*Math.PI/4)}%;top:${50+42*Math.sin((i-1)*Math.PI/4)}%">${i+1}</span>`).join("")}</div></section>
      <section class="practice-setup" aria-labelledby="practice-setup-title"><h2 id="practice-setup-title">Choose your practice</h2>
      <section class="grid practice-grid" aria-label="Name and question practice">
      <article class="experience"><span class="number">01 / CORE COMPETENCIES</span><h3>Core competency recall</h3><p>Build up from choosing names and C numbers to typing the names. Two correct answers in a row without hints move each competency up, even on the same day. Pass is always available; hints appear at the final typing step.</p><button data-start="recall">Practice Core Competencies</button></article>
      <article class="experience"><span class="number">02 / QUESTIONS</span><h3>Coaching questions</h3><p>${D.questions.length} fictional scenarios, each with four possible replies. More than one response may fit; choose the strongest for the moment.</p><button data-start="questions">${state.practices.questions && !state.practices.questions.completed?"Resume questions":"Answer questions"}</button></article></section>
      <div class="mixed-start"><button class="primary" id="start-mixed">${state.practices.mixed && !state.practices.mixed.completed?"Resume mixed practice":"Start mixed practice"}</button><p class="muted">A mix of both exercises above: competency-name practice and coaching scenarios, with eight exercises per round.</p></div>
      </section>
      <section class="independent-practice" aria-labelledby="independent-title"><h2 id="independent-title">Written practice</h2>
      <article class="experience"><span class="number">2025 COMPETENCY STUDY</span><h3>Written competency rehearsal</h3><p>${escape(D.examInstruction)}</p><p>${escape(D.writingScope)}</p>${window.EXAM.guidance(escape)}<button data-start="exam">${state.exam?.status==="draft"?"Resume written rehearsal":state.exam?"Review written rehearsal":"Start written rehearsal"}</button></article></section>
      <h2 class="progress-heading">Across all your practice</h2><section class="stats question-credit-stats" aria-label="Core competency recall and question credit counts"><div class="stat"><strong>${totals("unaided")}</strong><span>Without hints</span></div><div class="stat"><strong>${totals("assisted")}</strong><span>With hints</span></div><div class="stat"><strong>${totals("recognition")}</strong><span>Strongest option</span></div><div class="stat"><strong>${totals("reasonable")}</strong><span>Valid approach</span></div></section>
      <p class="muted">The counts above track answers, not points, and exclude step-by-step competency practice. Review your current levels below.</p>
      <details class="review-list" id="practice-progress"><summary>Review your progress</summary><p>Levels are practice formats, not coaching skill. Progress counts correct answers in a row without hints in full rounds; retries do not count.</p>
        <table class="progress-table"><caption class="sr-only">Competency-name practice levels and progress</caption><thead><tr><th scope="col">Competency</th><th scope="col">Current practice</th><th scope="col">Progress</th></tr></thead><tbody>${D.competencies.map(c=>{
          const p=state.adaptive.items[c.id],level=p?.step || 1,streak=p?.successes || 0;
          const progress=level===4?"Keep practicing at this level.":streak>=2?`${streak} correct in a row; next correct answer moves you to Level ${level+1}.`:`${streak} of 2 correct toward Level ${level+1}`;
          return `<tr><th scope="row">${escape(titleLabel(c))}</th><td>Level ${level}: ${levels[level]}</td><td>${progress}</td></tr>`;
        }).join("")}</tbody></table></details>
      ${legacyQuestionIds.some(id=>state.items[id])?'<p class="muted">Earlier question results remain in your all-time counts.</p>':""}
      <div class="reset-line"><span>Saved in this browser.</span><button id="reset">Reset progress</button></div>`;
    document.querySelectorAll("[data-start]").forEach(b => b.onclick = () => navigate(b.dataset.start));
    document.querySelector("#start-mixed").onclick = () => navigate("mixed");
    document.querySelector("#reset").onclick = () => document.querySelector("#reset-dialog").showModal();
    updateNavigation();
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
    const selected=items.slice(0,Math.min(count,8));
    session={items:selected,index:0,results:[],type,roundStart:0,roundEnd:selected.length};
    flow.scorePolicy=type==="recall"?P.nameScorePolicy:P.scorePolicy;session.scorePolicy=flow.scorePolicy;
    if(type==="recall"){
      flow.variant=P.adaptiveVariant;
      state.adaptive={...state.adaptive,nextRound:state.adaptive.nextRound+1};
      session.adaptiveRound=state.adaptive.nextRound;
      session.items=shuffle(D.competencies.map(c=>P.adaptiveItem(c.id,state.adaptive))).sort((a,b)=>
        Number(a.step<=2)-Number(b.step<=2) || (state.adaptive.items[a.c]?.due || 0)-(state.adaptive.items[b.c]?.due || 0));
    }
    usage?.begin(type==="recall"?"titles":type);
    view=type==="mixed"?"recall":type;
    active=null;render();if(!focusAdaptiveAnswer())focus(".scenario-prompt,.recall-prompt");
  }
  function startRecallRetry(ids,adaptive=false) {
    openShell();beginFlow("recall");
    const items=ids.map(c=>adaptive?P.adaptiveItem(c,state.adaptive):({id:`r${c}`,type:"recall",c}));
    session={items,index:0,results:[],type:"recall",roundStart:0,roundEnd:items.length,retry:true};
    flow.scorePolicy=P.nameScorePolicy;session.scorePolicy=flow.scorePolicy;
    if(adaptive){flow.variant=P.adaptiveVariant;state.adaptive={...state.adaptive,nextRound:state.adaptive.nextRound+1};session.adaptiveRound=state.adaptive.nextRound;}
    usage?.begin("titles");view="recall";active=null;
    render();if(!focusAdaptiveAnswer())focus(".recall-prompt");animatePracticeEntry("start");
  }
  function currentItem() {
    if (session) return session.items[session.index];
    const items=practiceItems(view);
    items.sort((a,b)=>(state.items[a.id]?.due || 0)-(state.items[b.id]?.due || 0));
    return items[0];
  }
  function makeActive(item) { return {item,attempt:"",hints:0,revealed:false,done:false,outcome:null,selected:null,assistLogged:false,
    ...(item.step && item.step<=2?{choices:shuffle([item.c,...shuffle(D.competencies.filter(c=>c.id!==item.c).map(c=>c.id)).slice(0,3)])}:{}),
    optionOrder:item.type==="questions"?shuffle(D.questions.find(q=>q.id===item.id).options.map((_,i)=>i)):null}; }
  function renderStudy() {
    announce("");
    if (reviewIndex===null && session && session.index>=(session.roundEnd || session.items.length) && session.items.length) return renderComplete();
    const item=reviewIndex!==null?session.answers[reviewIndex].item:active?.item || currentItem();
    if (!item) {
      main.innerHTML=`<h1>No practice items available.</h1><button id="back-home">Back to home</button>`;
      document.querySelector("#back-home").onclick=()=>navigate("home"); return;
    }
    if (reviewIndex===null && !active) active=makeActive(item);
    const recall=item.type==="recall";
    main.innerHTML='<section id="study-card"></section>';
    if(recall) renderRecall(); else renderQuestion();
    if(reviewIndex!==null)document.querySelector("#study-card").insertAdjacentHTML("afterbegin",'<p class="muted">Previous answer · timers paused.</p>');
  }
  function renderAdaptiveRecall(){
    const a=reviewIndex!==null?session.answers[reviewIndex]:active,c=comp(a.item.c),step=a.item.step;
    const choice=step<=2,words=P.recallHintState(c.title,a.hints,a.hintWords),outcome=P.recallOutcome({...a,c:c.id});
    if(reviewIndex===null && step===4)a.hintWords=words;
    const prompt=step===2?`Which competency goes with "${a.item.cue}"?`:step===3?`What is the full competency name containing "${a.item.cue}"?`:`What is the exact name of C${c.id}?`;
    const labels={unaided:a.successMessage || "Correct!",
      assisted:"Correct with hints",misplaced:"Recognized competency, wrong order",missed:a.revealed?"Pass: answer revealed":choice?"Choice did not match":"Name did not match"};
    document.querySelector("#study-card").innerHTML=`<div class="card-head"><span>Step ${step} · ${P.stepLabels[step]}</span>${step===1 || step===4?`<span class="pill">C${c.id}</span>`:""}</div>
      <h2 class="recall-prompt" id="adaptive-recall-prompt">${escape(prompt)}</h2><p class="muted">${step===2?"Choose the C number.":"Use the official 2025 name, without its C number."}</p>
      ${a.done?`<div class="feedback recall-${outcome}"><h3>${escape(labels[outcome])}</h3>${a.misplacedC?`<p>You remembered C${a.misplacedC}. This question asks for C${c.id}.</p>`:""}<p class="answer-title">${escape(titleLabel(c))}</p>
        ${choice && !a.matched?`<p>Your choice: ${a.selected===null?"Pass":escape(step===2?`C${a.selected}`:comp(a.selected).title)}</p>`:!choice && !a.revealed && !a.matched?`<p>Your answer: ${escape(a.attempt)}</p>`:""}
        <p>Practice points: ${a.scoreVersion===5?a.score:P.recallPoints({matched:a.matched,revealed:a.revealed,hintCount:a.hints,misplacedC:a.misplacedC})} / 10</p><h4>What this competency means</h4><p>${escape(c.summary)}</p></div>
        ${choice?`<div class="options">${a.choices.map((id,i)=>`<button type="button" class="option${id===a.selected && !a.revealed?` recall-choice-${id===c.id?"correct":"incorrect"}`:""}" disabled><span class="letter">${"ABCD"[i]}</span><span>${escape(step===2?`C${id}`:comp(id).title)}${id===c.id?" (correct)":id===a.selected && !a.revealed?" (incorrect)":""}${id===a.selected && !a.revealed?" (your choice)":""}</span></button>`).join("")}</div>`:""}
        ${citation(c.id)}<button class="primary" id="next-item">Continue</button>`:
      `${choice?`<div class="options" role="group" aria-labelledby="adaptive-recall-prompt">${a.choices.map((id,i)=>`<button type="button" class="option" data-name-choice="${id}"><span class="letter">${"ABCD"[i]}</span><span>${escape(step===2?`C${id}`:comp(id).title)}</span></button>`).join("")}</div><button type="button" id="reveal">Pass</button>`:
        `<form id="recall-form"><div class="field"><label for="recall-input">Your answer</label><input id="recall-input" autocomplete="off" spellcheck="false" value="${escape(a.attempt)}" aria-describedby="adaptive-recall-prompt recall-help"><small id="recall-help">Type the full official name. ${step===4?"Hints and ":""}Pass ${step===4?"are":"is"} available.</small></div>
        ${step===4?`<fieldset class="recall-hints"><legend>Hints</legend>${a.hints?`<p class="hint" aria-label="${escape(P.recallHintText(c.title,words,true))}">${escape(P.recallHintText(c.title,words))}</p>`:""}<div class="hint-actions">${[["letter","First letter"],["word","Next word"],["core","Core word"]].map(([kind,label])=>`<button type="button" data-adaptive-hint="${kind}"${P.nextRecallHint(c,words,kind)?"":" disabled"}>${label}</button>`).join("")}</div></fieldset>`:""}
        <button type="submit" class="primary">Submit</button><button type="button" id="reveal">Pass</button></form>`}
        <details class="practice-help" open><summary>Practice help</summary><p>${step===2?"Match this word from an official name to its C number.":step===3?"Use the core word to remember and type the full official name.":step===1?"Choose the official name that belongs to this C number.":"Recall the full name from its C number. First letter, Next word and Core word share one hint line."} Pass shows the answer. ${session.retry?"This retry does not change your step.":"Two correct answers in a row without hints move this competency up. You can do both today."}</p></details>`}`;
    if(a.done){
      const next=document.querySelector("#next-item");next.onclick=nextItem;
      next.onkeydown=e=>{if(e.key==="Enter" && e.repeat)e.preventDefault();};
      updateShell();persist();return;
    }
    const input=document.querySelector("#recall-input");
    const submit=(selected=null,revealed=false)=>{
      if(a.done || reviewIndex!==null)return;
      if(!choice && !revealed){
        a.attempt=input.value;
        if(!a.attempt.trim()){input.setCustomValidity("Type a name, or choose Pass.");input.reportValidity();return;}
      }
      a.selected=selected;a.revealed=revealed;
      a.matched=!revealed && (choice?selected===c.id:normalizeTitle(a.attempt)===normalizeTitle(c.title));
      const misplaced=step===4 && !a.matched && !revealed?D.competencies.find(other=>normalizeTitle(other.title)===normalizeTitle(a.attempt)):null;
      if(misplaced)a.misplacedC=misplaced.id;
      a.outcome=!a.matched?"missed":a.hints?"assisted":"unaided";a.done=true;
      if(a.matched && !a.hints)a.successMessage=P.adaptiveSuccessMessage(flow.responses);
      noteActive();
      state.adaptive=P.adaptiveResult(state.adaptive,flow.responses.at(-1),session.adaptiveRound,session.retry===true,Date.now());
      if(revealed)usage?.count?.("titles","passes");
      persist();renderAdaptiveRecall();focusRecallContinue();
      const message=revealed?"Pass: answer revealed":a.matched && !a.hints?a.successMessage:labels[a.matched?"assisted":misplaced?"misplaced":"missed"];
      announce(`${message} ${titleLabel(c)}.`);
    };
    document.querySelectorAll("[data-name-choice]").forEach(button=>{
      button.onclick=()=>submit(Number(button.dataset.nameChoice));
      button.onkeydown=e=>{if(e.key==="Enter" && e.repeat)e.preventDefault();};
    });
    if(input){
      input.oninput=()=>{input.setCustomValidity("");a.attempt=input.value;persist();};
      const form=document.querySelector("#recall-form");
      form.onsubmit=e=>{e.preventDefault();submit();};
      form.onkeydown=e=>{if(e.key==="Enter" && !e.isComposing && e.target===input){e.preventDefault();if(!e.repeat)form.requestSubmit();}};
    }
    document.querySelectorAll("[data-adaptive-hint]").forEach(button=>button.onclick=()=>{
      if(a.done || reviewIndex!==null)return;
      const next=P.nextRecallHint(c,words,button.dataset.adaptiveHint);
      if(!next)return;
      const selection={start:input.selectionStart,end:input.selectionEnd,direction:input.selectionDirection,scrollLeft:input.scrollLeft};
      a.hintWords=next;a.hints++;a.assistLogged=true;
      state.adaptive=P.adaptiveHint(state.adaptive,c.id,session.adaptiveRound,Date.now());
      usage?.count?.("titles","hints");persist();renderAdaptiveRecall();
      const restored=document.querySelector("#recall-input");restored.focus();restored.setSelectionRange(selection.start,selection.end,selection.direction);restored.scrollLeft=selection.scrollLeft;
      announce(P.recallHintText(c.title,next,true));
    });
    document.querySelector("#reveal").onclick=()=>submit(null,true);
    updateShell();persist();
  }
  function renderRecall() {
    if(P.isAdaptive(flow))return renderAdaptiveRecall();
    const a=reviewIndex!==null?session.answers[reviewIndex]:active, c=comp(a.item.c);
    const misplaced=P.recallMisplacement(a,D.competencies,normalizeTitle);
    const outcome=P.recallOutcome({...a,c:c.id,...(misplaced?{misplacedC:misplaced.id}:{})});
    const feedbackHeading=outcome==="missed"?P.recallMissLabel(a):outcome==="misplaced"?"Recognized competency, wrong order":a.successMessage || "Correct!";
    const feedbackIcon={unaided:"✓",assisted:"",misplaced:"&#8596;",missed:"×"}[outcome];
    const named=D.competencies.find(c=>normalizeTitle(c.title)===normalizeTitle(a.attempt));
    const submittedTitle=named?titleLabel(named,a.attempt):a.attempt;
    const hintWords=P.recallHintState(c.title,a.hints,a.hintWords);
    if(reviewIndex===null)a.hintWords=hintWords;
    const hint=P.recallHintText(c.title,hintWords);
    document.querySelector("#study-card").innerHTML=`<div class="card-head"><span>${c.group}</span><span class="pill">C${c.id}</span></div>
      <h2 class="recall-prompt">What is the exact name of C${c.id}?</h2><p class="muted">Use the official 2025 wording.</p>
      ${!a.done?`<form id="recall-form"><div class="field"><label for="recall-input">Your answer</label><input id="recall-input" type="text" autocomplete="off" spellcheck="false" value="${escape(a.attempt)}" aria-describedby="recall-help"><small id="recall-help">Type the name without its C number. Hints and Pass are available whenever you need them.</small></div><fieldset class="recall-hints"><legend>Hints</legend>${a.hints?`<p class="hint" aria-label="C${c.id} hint: ${escape(P.recallHintText(c.title,hintWords,true))}">${titleLabel(c,hint)}</p>`:""}<div class="hint-actions">${[["letter","First letter"],["word","Next word"],["core","Core word"]].map(([kind,label])=>`<button type="button" data-hint="${kind}" ${P.nextRecallHint(c,hintWords,kind)?"":"disabled"}>${label}</button>`).join("")}</div></fieldset><div class="actions" style="margin-top:18px"><button type="submit" class="primary">Check answer</button><button type="button" id="reveal">Pass</button></div></form>`:
      `<div class="feedback recall-${outcome}"><h3>${feedbackIcon?`<span aria-hidden="true">${feedbackIcon}</span> `:""}${escape(feedbackHeading)}</h3>${misplaced?`<p>That name belongs to C${misplaced.id}. For C${c.id}, practice remembering:</p>`:""}${outcome==="assisted"?`<p><span class="pill">With hints</span></p>`:outcome==="misplaced" && a.hints?'<p class="muted">Hints used</p>':""}${a.successMessage?`<p>${hintedSuccessSupport}</p>`:""}<p class="answer-title">${titleLabel(c)}</p>${!a.revealed && !a.matched?`<p>Your answer: <strong>${escape(submittedTitle)}</strong></p>`:""}${[4,5,6].includes(a.scoreVersion)?`<p>Practice points: ${a.score} / ${a.scoreVersion>=5?P.scoreMaximum(a.item.type):P.mixedMaximum(a.item.type)}</p>`:""}<h4>What this competency means</h4><p>${c.summary}</p></div><button class="primary" id="next-item">${session?"Continue":"Next name"}</button>`}
      ${citation(c.id)}`;
    if(a.done) {
      const next=document.querySelector("#next-item");
      next.onclick=nextItem;
      next.onkeydown=event=>{if(event.key==="Enter" && event.repeat)event.preventDefault();};
      updateShell();persist();return;
    }
    const input=document.querySelector("#recall-input");
    input.oninput=()=>{input.setCustomValidity("");a.attempt=input.value;persist();};
    const form=document.querySelector("#recall-form");
    form.onkeydown=event=>{
      if(event.key!=="Enter" || event.isComposing || event.target!==input)return;
      event.preventDefault();
      if(!event.repeat)form.requestSubmit();
    };
    form.onsubmit=e=>{
      e.preventDefault();
      if(a.done)return;
      a.attempt=input.value;
      if(!a.attempt.trim()){input.setCustomValidity("Type a name, or choose a hint or Pass.");input.reportValidity();return;}
      const match=normalizeTitle(a.attempt)===normalizeTitle(c.title);
      a.matched=match;
      const misplaced=!match?D.competencies.find(other=>normalizeTitle(other.title)===normalizeTitle(a.attempt)):null;
      if(misplaced)a.misplacedC=misplaced.id;
      a.outcome=a.hints?"assisted":match?"unaided":"missed";
      a.done=true;
      noteActive();
      if(match && a.hints){
        a.successMessage=hintedSuccessMessages[state.hintedSuccessIndex];
        state.hintedSuccessIndex=(state.hintedSuccessIndex+1)%hintedSuccessMessages.length;
      }
      const recallMiss=!match && !misplaced?"incorrect":null;
      if(!a.assistLogged)record(a.item.id,a.outcome,a.misplacedC,recallMiss);
      else {
        delete state.items[a.item.id].lastMisplacedC;
        delete state.items[a.item.id].lastRecallMiss;
        if(misplaced)state.items[a.item.id].lastMisplacedC=misplaced.id;
        if(recallMiss)state.items[a.item.id].lastRecallMiss=recallMiss;
        if(!match)state.items[a.item.id].missed++;
        persist();
      }
      if (!session) usage?.item("titles",a.item.id,D.competencies.length);
      renderRecall(); focusRecallContinue(); announce(match?`${a.successMessage || "Correct!"} ${titleLabel(c)}.${a.successMessage?` With hints. ${hintedSuccessSupport}`:""}`:misplaced?`Recognized competency, wrong order. You remembered C${misplaced.id}. This position asks for ${titleLabel(c)}.`:"Name did not match. Check the official name against your answer.");
    };
    document.querySelectorAll("[data-hint]").forEach(button=>button.onclick=()=>{
      if(a.done)return;
      const next=P.nextRecallHint(c,a.hintWords,button.dataset.hint);
      if(!next)return;
      const selection={start:input.selectionStart,end:input.selectionEnd,direction:input.selectionDirection,scrollLeft:input.scrollLeft};
      usage?.count?.(usageMode(flow.mode),"hints");
      a.hintWords=next;a.hints++; if(!a.assistLogged){record(a.item.id,"assisted"); a.assistLogged=true;}
      renderRecall();
      const restored=document.querySelector("#recall-input");restored.focus();
      restored.setSelectionRange(selection.start,selection.end,selection.direction);restored.scrollLeft=selection.scrollLeft;
      announce(`C${c.id} hint: ${P.recallHintText(c.title,a.hintWords,true)}`);
    });
    document.querySelector("#reveal").onclick=()=>{
      if(a.done)return;
      a.revealed=true;a.matched=false;a.done=true;a.outcome="assisted";
      noteActive();
      usage?.count?.(usageMode(flow.mode),"passes");
      if(!a.assistLogged){record(a.item.id,"assisted",null,"passed");a.assistLogged=true;}
      else {delete state.items[a.item.id].lastMisplacedC;state.items[a.item.id].lastRecallMiss="passed";}
      if (!session) usage?.item("titles",a.item.id,D.competencies.length);
      renderRecall();focusRecallContinue();announce(`Pass: answer revealed. The official name is ${titleLabel(c)}.`);
    };
    document.querySelector("#study-card").insertAdjacentHTML("beforeend",'<details class="practice-help" open><summary>Practice help</summary><p>Try the name from memory. First letter, Next word and Core word offer different clues. Pass reveals the name. Hints and Pass count as assisted practice. Capitalization and surrounding punctuation do not affect the check.</p></details>');
    updateShell();persist();
  }
  function focusAdaptiveAnswer() {
    if(!P.isAdaptive(flow) || flow.completed || reviewIndex!==null || !active || active.done)return false;
    focus("#recall-input,[data-name-choice]",true);
    return true;
  }
  function focusRecallContinue() {document.querySelector("#next-item").focus();}
  function renderQuestion(revealFeedback=false) {
    const a=reviewIndex!==null?session.answers[reviewIndex]:active, q=D.questions.find(q=>q.id===a.item.id);
    const c=comp(q.c);
    const creditLabels={strongest:"Strongest option",reasonable:"Valid approach",less:"Opportunity to improve"};
    const order=a.optionOrder;
    const reflection=a.done?`<details class="competency-reference"><summary><span>Bonus exercise: which competencies and markers are at play?</span><span class="bonus-invitation-help">Think it through, then expand to review.</span></summary>${bonusHeading(c.id,q.refs)}<blockquote class="competency-definition">${escape(c.definition)}</blockquote><p>${escape(q.takeaway)}</p>${officialReferences(q.refs,false)}${q.also?.map(other=>`${bonusHeading(other.c,other.refs,4)}${officialReferences(other.refs,false)}`).join("") || ""}</details>`:"";
    const check='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12L10 17L19 7"/></svg>';
    const improve='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18L18 6M9 6H18V15"/></svg>';
    document.querySelector("#study-card").innerHTML=`${a.done?`<details class="review-question"><summary>Question: ${escape(q.label)}</summary><h2 class="scenario-prompt">${escape(q.prompt)}</h2></details>`:`<h2 class="scenario-prompt">${escape(q.prompt)}</h2>`}
      <div class="options${a.done && revealFeedback?" feedback-enter":""}">${order.map(i=>{const o=q.options[i],position=a.optionOrder.indexOf(i);return a.done?
        `<details class="answer-card ${o[2]} ${a.selected===i?"selected":""}" data-answer="${i}" open><summary><span class="letter">${"ABCD"[position]}</span><span class="option-content">${i===a.selected?'<span class="chosen-marker">Your choice</span>':""}<span class="option-text">${escape(o[0])}</span><span class="result-tag">${o[2]==="less"?improve:check}${creditLabels[o[2]]}</span></span></summary><div class="rationale-panel"><hr><p>${escape(o[1])}</p>${q.ethicsRefs?.length?`<p><a href="https://coachingfederation.org/resource/icf-code-of-ethics/" target="_blank" rel="noopener noreferrer">ICF Code of Ethics, ${q.ethicsRefs.length===1?"standard":"standards"} ${q.ethicsRefs.join(" and ")} (opens a new tab)</a></p>`:""}${o[2]==="strongest"?reflection:""}</div></details>`:
        `<button class="option" data-option="${i}"><span class="letter">${"ABCD"[position]}</span><span class="option-text">${escape(o[0])}</span></button>`;}).join("")}</div>
      ${a.done?`${[4,5,6].includes(a.scoreVersion)?`<p>Practice points: ${a.score} / ${a.scoreVersion>=5?P.scoreMaximum(a.item.type):P.mixedMaximum(a.item.type)}</p>`:""}<button class="primary" id="next-item">Next question</button>`:
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
      renderQuestion(true);document.querySelector("#study-body").scrollTop=0;focus("#study-card .answer-card.selected summary",true);announce(`${creditLabels[q.options[a.selected][2]]}. ${titleLabel(c)}. You can revisit the question and read each explanation.`);
    });
    if(a.done){document.querySelector("#next-item").onclick=nextItem;setupBonusSources();}
    updateShell();persist();
  }
  function nextItem() {
    if(reviewIndex!==null || !active?.done)return;
    finishPracticeEntry?.();
    const from=session?.index ?? 0;
    if(session){session.answers ||= {};session.answers[session.index]=JSON.parse(JSON.stringify(active));}
    if(session) {session.results.push({type:active.item.type,outcome:active.outcome,missed:active.outcome==="missed" || (!active.revealed && active.matched===false)});session.index++;}
    else {
      const items=practiceItems(view);
      const idx=items.findIndex(i=>i.id===active.item.id);
      active=items.length?makeActive(items[(idx+1)%items.length]):null;
      renderStudy();focus();animateStudyNavigation(from,from+1);return;
    }
    active=null;flow.answerMs=0;answerStarted=null;renderStudy();
    if(!focusAdaptiveAnswer())focus(session.index>=(session.roundEnd || session.items.length)?"h1":".scenario-prompt,.recall-prompt");
    animateStudyNavigation(from,session.index);
  }
  function renderComplete() {
    flow.completed=true;
    main.innerHTML=`<h1>Round finished.</h1><p>You answered ${(session.roundEnd || session.items.length)-(session.roundStart || 0)} practice items.</p><button class="primary" id="back-home">See session results</button>`;
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
      <details class="competency-reference"><summary><span>Bonus exercise: which competencies and markers are at play?</span><span class="bonus-invitation-help">Think it through, then expand to review.</span></summary>${bonusHeading(node.c,node.refs)}${officialReferences(node.refs,false)}</details><button class="primary" id="continue-scenario">${node.choices[branchChoice].next===null?"Review your choices":"Continue"}</button>`:
      `<p class="client"><strong>Client:</strong> "${escape(node.client)}"</p><h2 style="font-size:1.25rem">What would you say next?</h2><div class="options">${node.choices.map((ch,i)=>`<button class="option" data-branch="${i}"><span class="letter">${"ABC"[i]}</span><span>${escape(ch.text)}</span></button>`).join("")}</div><details class="practice-help" open><summary>Practice help</summary><p>${escape(s.intro)}</p><p>Ask yourself what you are assuming and how you would respond if the client disagreed.</p></details>`}</section>`;
    if(branchChoice!==null)setupBonusSources();
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
  const about=document.querySelector("#about-dialog"),closeAbout=document.querySelector("#close-about");
  if(!about.querySelector(".about-body")){
    const body=document.createElement("div");body.className="about-body";
    [...about.children].filter(e=>!e.classList.contains("dialog-head")).forEach(e=>body.append(e));about.append(body);
  }
  if(closeAbout.textContent.trim()==="Close")closeAbout.textContent="×";
  document.querySelector("#about-button").onclick=()=>{about.showModal();closeAbout.focus();};
  closeAbout.onclick=()=>about.close();
  about.addEventListener("keydown",trapDialogFocus);
  about.addEventListener("close",()=>document.querySelector("#about-button").focus({preventScroll:true}));
  document.querySelector("#cancel-reset").onclick=()=>document.querySelector("#reset-dialog").close();
  document.querySelector("#confirm-reset").onclick=()=>{
    try {localStorage.removeItem(KEY);lastStored=null;state=empty();coffee.resetRounds();saveFailed=false;exam.reset();warning.hidden=true;document.querySelector("#reset-dialog").close();navigate("home");announce("Study progress and rehearsal deleted.");}
    catch {document.querySelector("#reset-dialog").close();storageError("Your browser couldn't delete progress. You can remove it by clearing site data for this local address.");}
  };
  arrangeQuestions();
  if (state.exam?.status==="draft") usage?.resume("exam");
  if(needsExamMigration || needsPracticeMigration)save();
  render();
  };
  const base=document.currentScript?.src || location.href;
  const assets=[
    ["practice.js?v=16",window.PRACTICE?.uiVersion===16],
    ["exam.js?v=14",window.EXAM?.uiVersion===14],
    ["content.js?v=13",window.STUDY?.uiVersion===13],
    ["styles.css?v=28",!!document.querySelector('link[href="styles.css?v=28"]')]
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
