"use strict";
(() => {
  const D = window.STUDY;
  const KEY = "icf-practice-room-v1";
  const main = document.querySelector("main");
  const warning = document.querySelector("#storage-warning");
  const usage = window.USAGE;
  if (!usage) console.warn("Study usage module is unavailable. Studying is unaffected.");
  const empty = () => ({version:1, items:{}, scenarios:0, exam:null, hintedSuccessIndex:0});
  const hintedSuccessMessages = ["You got it!", "That's it!", "Nice work!"];
  const hintedSuccessSupport = "Hints help you learn. Keep practicing until you can remember it without them.";
  const legacyQuestionIds = Array.from({length:8},(_,i)=>`q${i+1}`);
  const allIds = D.competencies.map(c => `r${c.id}`).concat(D.questions.map(q => q.id),legacyQuestionIds);
  let state = load();
  let questionOrder = [];
  let view = "home", session = null, active = null;
  let scenarioNode = D.scenario.start, history = [], branchChoice = null;
  let saveFailed = false;

  function storageError(message) {
    if(warning.hidden || warning.textContent !== message){
      warning.textContent = message;
      warning.hidden = false;
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
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
      s.hintedSuccessIndex = s.hintedSuccessIndex ?? 0;
      return s;
    } catch {
      storageError("We couldn't open your saved progress or rehearsal. This tab starts fresh. Your old saved data is unchanged unless you practice or reset. Choose Reset progress to delete it.");
      return empty();
    }
  }
  function save() {
    try { const recovering=saveFailed; localStorage.setItem(KEY, JSON.stringify(state)); saveFailed=false; if(recovering)warning.hidden=true; return true; }
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
    save();
  }
  const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const comp = id => D.competencies.find(c => c.id === Number(id));
  const citation = (c, refs = []) => `<p class="citation">${D.source} · ${D.version}<br>Official 2025 model · PDF p. ${Number(c)+2}${refs.length ? ` · ${refs.join(", ")}` : " · competency title"}.</p>`;
  const announce = text => { document.querySelector("#announcement").textContent = text; };
  function focus(selector = "h1") {
    const el = main.querySelector(selector);
    if (el) { el.setAttribute("tabindex","-1"); el.focus(); }
  }
  const normalizeTitle = window.EXAM.normalizeTitle;
  const titleLabel = window.EXAM.titleLabel;
  const exam = window.EXAM.create({get:()=>state.exam,set:a=>{state.exam=a;},save,storageError,
    hasStorageFailure:()=>saveFailed,announce,escape,focus,home:()=>navigate("home"),
    isVisible:()=>view==="exam",onStarted:()=>usage?.begin("exam"),
    onCompleted:()=>usage?.complete("exam"),onFinished:()=>{if(view==="home")renderHome();},citation});
  const totals = field => Object.values(state.items).reduce((n,p) => n+p[field],0);
  const outcomeLabels = {unaided:"Without hints",assisted:"With hints",recognition:"Strongest fit",reasonable:"Reasonable fit",missed:"Needs another look"};
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
    view=next; session=null; active=null;
    if (next==="recall" || next==="questions") usage?.begin(next==="recall"?"titles":"questions");
    if (next==="scenario") usage?.begin("conversation");
    if (next==="questions") arrangeQuestions();
    if (next==="scenario") { scenarioNode=D.scenario.start; history=[]; branchChoice=null; }
    render(); focus();
  }
  function dueLabel(id) {
    if (!state.items[id]) return "New";
    const p = state.items[id];
    if (isDue(id)) return "Ready to review";
    const mins = Math.ceil((p.due-Date.now())/60000);
    return mins < 60 ? `In ${mins} min` : `Review ${new Date(p.due).toLocaleDateString(undefined,{month:"short",day:"numeric"})}`;
  }
  function render() {
    document.querySelectorAll("[data-view]").forEach(b => {
      if (b.dataset.view === view) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current");
    });
    if (view==="home") renderHome();
    else if (view==="scenario") renderScenario();
    else if (view==="exam") exam.render();
    else renderStudy();
  }
  function renderHome() {
    const items=practiceItems();
    main.innerHTML = `<section class="hero"><div><p class="eyebrow">ICF core competencies · 2025</p><h1>The eight ICF<br>core competencies</h1><p class="lead">Practice the titles from memory. Explore coaching choices in questions and a fictional conversation, or try a written exam rehearsal.</p></div><div class="orbit" aria-hidden="true"><strong>8</strong>${Array.from({length:8},(_,i)=>`<span style="left:${50+42*Math.cos((i-1)*Math.PI/4)}%;top:${50+42*Math.sin((i-1)*Math.PI/4)}%">${i+1}</span>`).join("")}</div></section>
      <section class="practice-setup" aria-labelledby="practice-setup-title"><h2 id="practice-setup-title">Choose your practice</h2>
      <section class="grid practice-grid" aria-label="Title and question practice">
      <article class="experience"><span class="number">01 / TITLES</span><h3>Core competency practice</h3><p>Try a title from memory, use a hint to show one word at a time, or choose Pass to see the full title.</p><button data-start="recall">Practice titles</button></article>
      <article class="experience"><span class="number">02 / QUESTIONS</span><h3>Coaching questions</h3><p>${D.questions.length} fictional scenarios, each with four possible replies. Choose the best fit for the moment. Other reasonable replies earn credit too.</p><button data-start="questions">Answer questions</button></article></section>
      <div class="mixed-start"><button class="primary" id="start-mixed">Start mixed practice</button><p class="muted">Eight items across all competencies, mixing titles and questions.</p></div>
      <details class="review-list"><summary>Your review dates · ${items.length} items</summary><p class="muted">Your last result and next review for each title and scenario. "New" means you haven't tried it. You can practice any time.</p>${items.map(item=>`<div class="review-row"><span>${item.type==="recall"?titleLabel(comp(item.c)):escape(D.questions.find(q=>q.id===item.id).label)}<small>${item.type==="recall"?"Title practice":"Coaching scenario"}${state.items[item.id] ? ` · last time: ${outcomeLabels[state.items[item.id].last]}` : ""}</small></span><span>${dueLabel(item.id)}</span></div>`).join("")}</details></section>
      <section class="independent-practice" aria-labelledby="independent-title"><h2 id="independent-title">Conversation &amp; exam</h2><div class="grid practice-grid">
      <article class="experience"><span class="number">03 / CONVERSATION</span><h3>Try a conversation</h3><p>Choose what to say to a fictional client. See a possible reaction and review the choices you made.</p><button data-start="scenario">Start conversation</button></article>
      <article class="experience"><span class="number">WRITTEN EXAM</span><h3>Exam rehearsal</h3><p>Write all eight titles in order and three points for each. Practice without a timer, or use the optional two-hour timer.</p><button data-start="exam">${state.exam?.status==="draft"?"Resume rehearsal":state.exam?"Review rehearsal":"Start exam rehearsal"}</button></article></div></section>
      <h2 class="progress-heading">Across all your practice</h2><section class="stats question-credit-stats" aria-label="Title practice and question credit counts"><div class="stat"><strong>${totals("unaided")}</strong><span>Without hints</span></div><div class="stat"><strong>${totals("assisted")}</strong><span>With hints</span></div><div class="stat"><strong>${totals("recognition")}</strong><span>Strongest fit</span></div><div class="stat"><strong>${totals("reasonable")}</strong><span>Reasonable fit</span></div></section>
      ${legacyQuestionIds.some(id=>state.items[id])?'<p class="muted">Earlier question results remain in your all-time counts. The new scenarios have their own review dates.</p>':""}
      <div class="reset-line"><span>Saved in this browser. ${state.scenarios} conversation${state.scenarios===1?"":"s"} completed.</span><button id="reset">Reset progress</button></div>`;
    document.querySelectorAll("[data-start]").forEach(b => b.onclick = () => navigate(b.dataset.start));
    document.querySelector("#start-mixed").onclick = () => startSession("mixed",8);
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
        announce("Mixed practice is unavailable. Try title or question practice instead.");
        return;
      }
      items=shuffle(spread).concat(shuffle(ranked.filter(item=>!spread.includes(item))));
    }
    session={items:items.slice(0,count),index:0,results:[],type};
    usage?.begin(type==="recall"?"titles":type);
    view=type==="mixed"?"recall":type;
    active=null; render(); focus();
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
    const title=recall?"What's the title?":"Choose the best fit.";
    main.innerHTML=`<p class="eyebrow">${session?.type==="mixed"?"Mixed practice":recall?"Core competency practice":"Coaching questions"}</p><h1>${title}</h1>
      ${session?`<div class="progress-bar" aria-label="Item ${session.index+1} of ${session.items.length}"><span style="width:${100*session.index/session.items.length}%"></span></div>`:""}
      ${!recall && !session?`<div class="toolbar"><div class="field"><label for="scenario-picker">Choose a scenario</label><select id="scenario-picker">${questionOrder.map(q=>`<option value="${q.id}" ${q.id===item.id?"selected":""}>${escape(q.label)} · ${dueLabel(q.id)}</option>`).join("")}</select></div><span class="muted">${D.questions.length} scenarios</span></div>`:""}
      <div class="study-layout"><section class="card" id="study-card"></section><aside class="side-note"><h3>${recall?"Using hints and Pass":"About these questions"}</h3><p>${recall?"A hint shows another word. Pass shows the full title so you can check it before moving on. Either counts as 'With hints', even if you leave the answer blank. Capital letters, extra spaces and punctuation around words don't affect the title check.":"All scenarios are fictional. Choose the strongest response for this moment. Reasonable alternatives earn separate credit. After answering, you'll see the competency and the reasons for all four choices."}</p><p>${recall?"There's no time limit.":"Strongest and reasonable fits both advance your review schedule. Picking from options is different from recall. There's no time limit."}</p><details><summary>When to practice again</summary><p>Try again in 10 minutes after a title mismatch, hint, Pass or a less suitable response. Titles without hints and credited question responses move to 1, 3, then 7 days between reviews. New items are ready now.</p></details><button id="leave-practice">${session?"End practice":"Back to home"}</button></aside></div>`;
    document.querySelector("#leave-practice").onclick=()=>navigate("home");
    document.querySelector("#scenario-picker")?.addEventListener("change",e=>{
      const selected=practiceItems("questions").find(i=>i.id===e.target.value);
      if(!selected){announce("That scenario is unavailable. Choose another.");return;}
      active=makeActive(selected);renderStudy();focus();
    });
    if(recall) renderRecall(); else renderQuestion();
  }
  function renderRecall() {
    const a=active, c=comp(a.item.c);
    const feedbackHeading=a.revealed?"Official title":a.matched?(a.successMessage || "Correct!"):"The wording doesn't match.";
    const reviewMinutes=Math.max(0,Math.ceil(((state.items[a.item.id]?.due || 0)-Date.now())/60000));
    const nextReview=reviewMinutes===0?"ready now":reviewMinutes<60?`in ${reviewMinutes} minute${reviewMinutes===1?"":"s"}`:
      `on ${new Date(state.items[a.item.id].due).toLocaleDateString(undefined,{month:"short",day:"numeric"})}`;
    const named=D.competencies.find(c=>normalizeTitle(c.title)===normalizeTitle(a.attempt));
    const submittedTitle=named?titleLabel(named,a.attempt):a.attempt;
    const words=c.title.split(" ");
    const shown=Math.min(words.length-1,a.hints);
    const hint=words.map((w,i)=>i<shown?w:"____").join(" ");
    document.querySelector("#study-card").innerHTML=`<div class="card-head"><span>${session?`${session.index+1} / ${session.items.length}`:"Title practice"} · ${c.group}</span><span class="pill">C${c.id}</span></div>
      <h2 class="recall-prompt">What is the exact title of C${c.id}?</h2><p class="muted">Use the official 2025 wording.</p>
      ${a.hints && !a.done?`<p class="hint" aria-label="C${c.id} title with missing words">C${c.id} ${hint}</p><p class="muted">Hint ${a.hints} · ${words.length-shown} word${words.length-shown===1?"":"s"} hidden.</p>`:""}
      ${!a.done?`<form id="recall-form"><div class="field"><label for="recall-input">Your answer</label><input id="recall-input" type="text" autocomplete="off" spellcheck="false" value="${escape(a.attempt)}" aria-describedby="recall-help"><small id="recall-help">Type the title without its C number. Hints and Pass are available whenever you need them.</small></div><div class="actions" style="margin-top:18px"><button type="submit" class="primary">Check answer</button><button type="button" id="hint" ${shown>=words.length-1?"disabled":""}>${a.hints?"Show another word":"Show a hint"}</button><button type="button" id="reveal">Pass</button></div></form>`:
      `<div class="feedback ${a.matched===false?"miss":""}"><h3>${feedbackHeading}</h3>${a.outcome==="assisted"?`<p><span class="pill">With hints</span></p>`:""}${a.successMessage?`<p>${hintedSuccessSupport}</p>`:""}<p class="answer-title">${titleLabel(c)}</p>${!a.revealed?`<p>Your answer: <strong>${escape(submittedTitle)}</strong></p>`:""}<h4>What this competency means</h4><p>${c.summary}</p><p class="muted">Next review: ${nextReview}. You can keep practicing now.</p></div><button class="primary" id="next-item">${session?"Continue":"Next title"}</button>`}
      ${citation(c.id)}`;
    if(a.done) {document.querySelector("#next-item").onclick=nextItem; return;}
    const input=document.querySelector("#recall-input");
    input.oninput=()=>{input.setCustomValidity("");a.attempt=input.value;};
    document.querySelector("#recall-form").onsubmit=e=>{
      e.preventDefault();
      if(a.done)return;
      a.attempt=input.value;
      if(!a.attempt.trim()){input.setCustomValidity("Type a title, or choose a hint or Pass.");input.reportValidity();return;}
      const match=normalizeTitle(a.attempt)===normalizeTitle(c.title);
      a.matched=match;
      a.outcome=a.hints?"assisted":match?"unaided":"missed";
      a.done=true;
      if(match && a.hints){
        a.successMessage=hintedSuccessMessages[state.hintedSuccessIndex];
        state.hintedSuccessIndex=(state.hintedSuccessIndex+1)%hintedSuccessMessages.length;
      }
      if(!a.assistLogged)record(a.item.id,a.outcome);
      else if(!match){state.items[a.item.id].missed++;save();}
      else save();
      if (!session) usage?.item("titles",a.item.id,D.competencies.length);
      renderRecall(); focus("#study-card h3"); announce(match?`${a.successMessage || "Correct!"}${a.successMessage?` With hints. ${hintedSuccessSupport}`:""}`:"The wording doesn't match. Check the official title against your answer.");
    };
    document.querySelector("#hint").onclick=()=>{
      if(a.done || a.hints>=words.length-1)return;
      a.hints++; if(!a.assistLogged){record(a.item.id,"assisted"); a.assistLogged=true;}
      renderRecall(); document.querySelector("#recall-input").focus(); announce(`C${c.id} hint: ${hintFor(c.title,a.hints)}`);
    };
    document.querySelector("#reveal").onclick=()=>{
      if(a.done)return;
      a.revealed=true;a.done=true;a.outcome="assisted";
      if(!a.assistLogged){record(a.item.id,"assisted");a.assistLogged=true;}
      if (!session) usage?.item("titles",a.item.id,D.competencies.length);
      renderRecall();focus("#study-card h3");announce(`${titleLabel(c)}. Pass counts as with hints.`);
    };
  }
  function hintFor(title,n) {return title.split(" ").map((w,i)=>i<n?w:"blank").join(" ");}
  function renderQuestion() {
    const a=active, q=D.questions.find(q=>q.id===a.item.id);
    const c=comp(q.c);
    const creditLabels={strongest:"Strongest fit",reasonable:"Reasonable fit",less:"Less suitable here"};
    const heading=a.outcome==="recognition"?"Strongest fit for this moment.":a.outcome==="reasonable"?"Reasonable fit. Credit recorded.":"Another response fits this moment better.";
    document.querySelector("#study-card").innerHTML=`<div class="card-head"><span>${session?`${session.index+1} / ${session.items.length}`:`Scenario ${questionOrder.findIndex(item=>item.id===q.id)+1} / ${D.questions.length}`}</span><span class="pill">Fictional</span></div><h2 class="scenario-prompt">${escape(q.prompt)}</h2>
      ${a.done?`<div class="feedback ${a.outcome==="missed"?"miss":""}"><h3>${heading}</h3><p>${escape(q.takeaway)}</p><p class="muted">${a.outcome==="missed"?"Try this scenario again in 10 minutes.":`${outcomeLabels[a.outcome]} counts separately. Your review moves to the 1, 3, then 7 day schedule.`}</p><div class="competency-reference"><p class="definition-label">Primary focus</p><h4>${titleLabel(c)}</h4><p class="definition-label">Official definition</p><blockquote class="competency-definition">"${escape(c.definition)}"</blockquote>${citation(c.id,q.refs)}
      ${q.also?.length?`<details><summary>Related behaviors</summary>${q.also.map(other=>`<h4>${titleLabel(comp(other.c))}</h4>${citation(other.c,other.refs)}`).join("")}</details>`:""}</div></div>`:""}
      <div class="options">${a.optionOrder.map((i,position)=>{const o=q.options[i];return `<button class="option ${a.selected===i?"selected":""} ${a.done && o[2]==="strongest"?"correct":""}" data-option="${i}" ${a.done?"disabled":""}><span class="letter">${"ABCD"[position]}</span><span class="option-content"><span class="option-text">${escape(o[0])}</span>${a.done?`<span class="option-result">${creditLabels[o[2]]}${i===a.selected?" · Your answer":""}</span><span class="option-rationale">${escape(o[1])}</span>`:""}</span></button>`;}).join("")}</div>
      ${a.done?`<button class="primary" id="next-item" style="margin-top:18px">${session?"Continue":"Next question"}</button>`:""}`;
    document.querySelectorAll("[data-option]").forEach(b=>b.onclick=()=>{
      if(a.done)return;
      a.selected=Number(b.dataset.option); a.done=true;
      a.outcome=q.options[a.selected][2]==="strongest"?"recognition":q.options[a.selected][2]==="reasonable"?"reasonable":"missed";
      record(a.item.id,a.outcome);
      const chosen=document.querySelector("#scenario-picker option:checked");
      if(chosen)chosen.textContent=`${q.label} · ${dueLabel(q.id)}`;
      if (!session) usage?.item("questions",a.item.id,D.questions.length);
      renderQuestion();focus("#study-card .feedback h3");announce(`${a.outcome==="recognition"?"Strongest fit.":a.outcome==="reasonable"?"Reasonable fit. Credit recorded.":"Another response fits this moment better."} ${titleLabel(c)}. You can read the reason beside each option.`);
    });
    if(a.done)document.querySelector("#next-item").onclick=nextItem;
  }
  function nextItem() {
    if(session) {session.results.push({type:active.item.type,outcome:active.outcome,missed:active.outcome==="missed" || (!active.revealed && active.matched===false)});session.index++;}
    else {
      const items=practiceItems(view);
      const idx=items.findIndex(i=>i.id===active.item.id);
      active=items.length?makeActive(items[(idx+1)%items.length]):null;
      renderStudy();focus();return;
    }
    active=null;renderStudy();focus();
  }
  function renderComplete() {
    usage?.complete(session.type==="recall"?"titles":session.type);
    const count=outcome=>session.results.filter(r=>r.outcome===outcome).length;
    const misses=session.results.filter(r=>r.missed).length;
    main.innerHTML=`<p class="eyebrow">Mixed practice</p><h1>Practice complete.</h1><p class="lead">You finished ${session.results.length} practice items.</p><div class="stats question-credit-stats"><div class="stat"><strong>${count("unaided")}</strong><span>Without hints</span></div><div class="stat"><strong>${count("assisted")}</strong><span>With hints</span></div><div class="stat"><strong>${count("recognition")}</strong><span>Strongest fit</span></div><div class="stat"><strong>${count("reasonable")}</strong><span>Reasonable fit</span></div></div><p>${misses} item${misses===1?"":"s"} need another look. A less suitable response, title mismatch or help means reviewing in 10 minutes. Titles without hints and both credited question responses follow the 1, 3, then 7 day schedule.</p><button class="primary" id="back-home">Back to home</button>`;
    document.querySelector("#back-home").onclick=()=>navigate("home");
  }
  function renderScenario() {
    const s=D.scenario;
    if(scenarioNode===null) {
      main.innerHTML=`<p class="eyebrow">Fictional conversation · review</p><h1>Review your choices.</h1><p class="lead">A real client could respond differently. Several replies may work, depending on the client and how you follow up.</p><section class="card">${history.map((h,i)=>`<article class="debrief-entry"><h3>${i+1}. ${titleLabel(comp(s.nodes[h.node].c))}</h3><p><strong>You said:</strong> ${h.choice.text}</p><p><strong>Possible client response:</strong> ${h.choice.reaction}</p><p>${h.choice.reason}</p>${citation(s.nodes[h.node].c,s.nodes[h.node].refs)}</article>`).join("")}</section><div class="actions" style="margin-top:24px"><button class="primary" id="restart-scenario">Try other replies</button><button id="back-home">Back to home</button></div>`;
      document.querySelector("#restart-scenario").onclick=()=>navigate("scenario");
      document.querySelector("#back-home").onclick=()=>navigate("home");return;
    }
    const node=s.nodes[scenarioNode];
    main.innerHTML=`<p class="eyebrow">Fictional coaching conversation</p><h1>${s.title}</h1><p class="lead">${s.intro}</p><div class="study-layout"><section class="card"><div class="card-head"><span>${history.length+1}. ${scenarioNode==="repair"?"Check the session goal again":scenarioNode==="opening"?"Agree on the session goal":scenarioNode==="explore"?"Understand the concern":"Finish the session"}</span><span class="pill">Fictional</span></div><p class="client"><strong>Client:</strong> "${node.client}"</p>
      ${branchChoice!==null?`<div class="branch-note"><p><strong>You said:</strong> ${node.choices[branchChoice].text}</p><p><strong>Possible client response:</strong> "${node.choices[branchChoice].reaction}"</p><p>${node.choices[branchChoice].reason}</p>${citation(node.c,node.refs)}</div><button class="primary" id="continue-scenario">${node.choices[branchChoice].next===null?"Review your choices":"Continue"}</button>`:
      `<h2 style="font-size:1.25rem">What would you say next?</h2><div class="options">${node.choices.map((ch,i)=>`<button class="option" data-branch="${i}"><span class="letter">${"ABC"[i]}</span><span>${ch.text}</span></button>`).join("")}</div>`}</section><aside class="side-note"><h3>About this conversation</h3><p>There is no score. Ask yourself what you're assuming and how you'd respond if the client disagreed.</p><button id="leave-scenario">Back to home</button></aside></div>`;
    document.querySelector("#leave-scenario").onclick=()=>navigate("home");
    document.querySelectorAll("[data-branch]").forEach(b=>b.onclick=()=>{branchChoice=Number(b.dataset.branch);renderScenario();focus(".branch-note");announce("You can read a possible client reply and the reason for this choice.");});
    document.querySelector("#continue-scenario")?.addEventListener("click",()=>{
      const choice=node.choices[branchChoice];history.push({node:scenarioNode,choice});
      scenarioNode=choice.next;branchChoice=null;
      if(scenarioNode===null){state.scenarios++;save();usage?.complete("conversation");}
      renderScenario();focus();
    });
  }
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>navigate(b.dataset.view));
  document.querySelector("#brand").onclick=e=>{e.preventDefault();navigate("home");};
  document.querySelector("#about-button").onclick=()=>document.querySelector("#about-dialog").showModal();
  document.querySelector("#close-about").onclick=()=>document.querySelector("#about-dialog").close();
  document.querySelector("#cancel-reset").onclick=()=>document.querySelector("#reset-dialog").close();
  document.querySelector("#confirm-reset").onclick=()=>{
    try {localStorage.removeItem(KEY);state=empty();saveFailed=false;exam.reset();warning.hidden=true;document.querySelector("#reset-dialog").close();navigate("home");announce("Study progress and rehearsal deleted.");}
    catch {document.querySelector("#reset-dialog").close();storageError("Your browser couldn't delete progress. You can remove it by clearing site data for this local address.");}
  };
  arrangeQuestions();
  if (state.exam?.status==="draft") usage?.resume("exam");
  exam.expire();
  render();
})();
