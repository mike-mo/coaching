import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const context={window:{}};
for(const file of ["practice.js","content.js"])vm.runInNewContext(readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context);
const P=context.window.PRACTICE,D=context.window.STUDY,day=86400000;
const correct=(c=4,step=1)=>({c,type:"recall",step,matched:true,revealed:false,hintCount:0,outcome:"unaided",score:10,scoreVersion:3,seconds:1});
function answer(progress,response,now,retry=false){
  const next={...progress,nextRound:progress.nextRound+1};
  return P.adaptiveResult(next,response,next.nextRound,retry,now);
}
function fixture(step=1){
  const progress=P.emptyAdaptive();
  progress.items[4]={...P.adaptiveResult({...progress,nextRound:1},correct(),1,false,1000).items[4],step};
  const item=P.adaptiveItem(4,progress);
  const active={item,attempt:"",hints:0,revealed:false,done:false,outcome:null,selected:null,assistLogged:false,optionOrder:null,
    ...(step<=2?{choices:[2,4,5,8]}:{})};
  return {version:1,variant:P.adaptiveVariant,mode:"recall",completed:false,elapsedMs:0,answerMs:0,responses:[],
    snapshot:{view:"recall",history:[],scenarioNode:D.scenario.start,branchChoice:null,reviewIndex:null,active,
      session:{items:[item],index:0,results:[],type:"recall",roundStart:0,roundEnd:1,retry:true,adaptiveRound:1,answers:{}}}};
}
function homeProgress(progress){
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8"),main={innerHTML:""};
  const state={adaptive:progress,practices:{},items:{},exam:null};
  const before=JSON.stringify(state);
  const sandbox={D,state,main,escape:value=>value,titleLabel:c=>`C${c.id}. ${c.title}`,totals:()=>0,
    legacyQuestionIds:[],window:{EXAM:{guidance:()=>""}},updateNavigation:()=>{},
    document:{querySelectorAll:()=>[],querySelector:()=>({})}};
  vm.createContext(sandbox);
  vm.runInContext(app.slice(app.indexOf("function renderHome("),app.indexOf("function startSession(")),sandbox);
  vm.runInContext("renderHome()",sandbox);
  assert.equal(JSON.stringify(state),before,"Rendering must not change schedules or saved streaks");
  return main.innerHTML;
}
function competencyRow(html,c){
  return html.match(new RegExp(`<tr><th scope="row">C${c}\\. [\\s\\S]*?</tr>`))[0];
}
test("Home progress keeps a collapsed semantic three-column table without review dates or lifetime counts",()=>{
  const html=homeProgress(P.emptyAdaptive());
  assert.match(html,/<details class="review-list" id="practice-progress"><summary>Review your progress<\/summary>/);
  assert.equal((html.match(/scope="col"/g)||[]).length,3);
  assert.equal((html.match(/scope="row"/g)||[]).length,8);
  assert.match(html,/Competency<\/th><th scope="col">Current practice<\/th><th scope="col">Progress/);
  for(const c of D.competencies){
    const row=competencyRow(html,c.id);
    assert.ok(row.includes(`C${c.id}. ${c.title}`));
    assert.match(row,/Level 1: choose the name/);
    assert.match(row,/0 of 2 correct toward Level 2/);
  }
  assert.doesNotMatch(html,/Your review dates|Step-by-step progress|Ready to review|counted separately below/);
  assert.match(html,/exclude step-by-step competency practice/);
});
test("Home shows the actual per-competency ordinary streak through promotion and fallback",()=>{
  let progress=answer(P.emptyAdaptive(),correct(),1000);
  progress.items[4].counts[1].correct=99;
  assert.match(competencyRow(homeProgress(progress),4),/1 of 2 correct toward Level 2/);
  assert.match(competencyRow(homeProgress(progress),1),/0 of 2 correct toward Level 2/);
  progress=answer(progress,correct(),2000,true);
  assert.match(competencyRow(homeProgress(progress),4),/1 of 2 correct toward Level 2/);
  progress=answer(progress,correct(),3000);
  let row=competencyRow(homeProgress(progress),4);
  assert.match(row,/Level 2: choose the C number/);
  assert.match(row,/0 of 2 correct toward Level 3/);
  progress=answer(progress,correct(4,2),4000);
  assert.match(competencyRow(homeProgress(progress),4),/1 of 2 correct toward Level 3/);
  const missed={...correct(4,2),matched:false,outcome:"missed",score:0};
  progress=answer(progress,missed,5000);
  assert.match(competencyRow(homeProgress(progress),4),/0 of 2 correct toward Level 3/);
  progress=answer(progress,missed,6000);
  row=competencyRow(homeProgress(progress),4);
  assert.match(row,/Level 1: choose the name/);
  assert.match(row,/0 of 2 correct toward Level 2/);
});
test("Home labels typed levels honestly and preserves threshold-ready legacy streaks",()=>{
  const progress=answer(P.emptyAdaptive(),correct(),1000);
  progress.items[4]={...progress.items[4],step:3,successes:1};
  assert.match(competencyRow(homeProgress(progress),4),/Level 3: type with a core word/);
  assert.match(competencyRow(homeProgress(progress),4),/1 of 2 correct toward Level 4/);
  progress.items[4].successes=3;
  let row=competencyRow(homeProgress(progress),4);
  assert.match(row,/3 correct in a row; next correct answer moves you to Level 4/);
  assert.doesNotMatch(row,/3 of 2/);
  progress.items[4].step=4;
  row=competencyRow(homeProgress(progress),4);
  assert.match(row,/Level 4: type from the C number/);
  assert.match(row,/Keep practicing at this level/);
  assert.doesNotMatch(row,/Level 5|of 2 correct/);
});
test("question words retain the edited shortlist without changing legacy Core word hints",()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(P.questionWords)),{
    1:["Ethical"],2:["Mindset"],3:["Agreements"],4:["Trust","Safety"],5:["Presence"],6:["Listens"],7:["Awareness"],8:["Growth"]
  });
  for(const c of D.competencies){
    for(const word of P.questionWords[c.id]){
      assert.equal(D.competencies.filter(other=>other.title.split(" ").includes(word)).length,1);
      assert.ok(c.title.split(" ").includes(word));
    }
    const item=P.adaptiveItem(c.id,P.emptyAdaptive());
    assert.equal(item.step,1);assert.equal(item.cue,null);
  }
  assert.deepEqual(Array.from(P.nextRecallHint(D.competencies[7],[0,0,0],"core")),[0,2,0]);
});
test("two same-day ordinary successes promote only that competency and remain idempotent",()=>{
  let progress=P.emptyAdaptive();
  progress=answer(progress,correct(),1000);
  assert.equal(progress.items[4].successes,1);
  assert.equal(progress.items[4].due,1000+day);
  progress=answer(progress,correct(2),1500);
  const other=JSON.stringify(progress.items[2]);
  progress=answer(progress,correct(),2000);
  assert.equal(progress.items[4].step,2);
  assert.equal(progress.items[4].successes,0);
  assert.equal(progress.items[4].due,2000+day);
  assert.equal(JSON.stringify(progress.items[2]),other);
  assert.equal(progress.items[2].step,1);
  assert.equal(progress.items[2].successes,1);
  assert.equal(progress.items[1],undefined);
  assert.equal(P.adaptiveResult(progress,correct(),progress.nextRound,false,3000),progress);
  assert.equal(P.validAdaptive(JSON.parse(JSON.stringify(progress))),true);
});
test("same-day full-round repetition moves through every step without a speed gate",()=>{
  let progress=P.emptyAdaptive();
  for(let round=1;round<=8;round++){
    const next={...progress,nextRound:round};
    progress=D.competencies.reduce((current,c)=>{
      const item=P.adaptiveItem(c.id,current);
      return P.adaptiveResult(current,{...correct(c.id,item.step),seconds:c.id%2?0.1:600},round,false,1000+round);
    },next);
    for(const c of D.competencies){
      assert.equal(progress.items[c.id].step,Math.min(4,1+Math.floor(round/2)));
    }
    assert.equal(P.validAdaptive(JSON.parse(JSON.stringify(progress))),true);
  }
});
test("wrong, Pass and hinted ordinary answers break the promotion streak",()=>{
  for(const missed of [
    {...correct(4,4),matched:false,outcome:"missed",score:0},
    {...correct(4,4),matched:false,revealed:true,outcome:"missed",score:0},
    {...correct(4,4),hintCount:1,outcome:"assisted",score:6}
  ]){
    let progress=answer(P.emptyAdaptive(),correct(),1000);
    progress.items[4]={...progress.items[4],step:4,successes:0,recent:[]};
    progress=answer(progress,correct(4,4),2000);
    progress=answer(progress,missed,3000);
    assert.equal(progress.items[4].successes,0);
    assert.equal(progress.items[4].step,4);
    progress=answer(progress,correct(4,4),4000);
    assert.equal(progress.items[4].successes,1);
  }
  let progress=answer(P.emptyAdaptive(),correct(),1000);
  progress=answer(progress,{...correct(),matched:false,outcome:"missed",score:0},2000);
  progress=answer(progress,correct(),3000);
  assert.equal(progress.items[4].step,1);
  assert.equal(progress.items[4].successes,1);
  progress=answer(progress,correct(),4000);
  assert.equal(progress.items[4].step,2);
});
test("reload preserves old counted successes and applies the new threshold only on later ordinary answers",()=>{
  for(const successes of [1,2,3]){
    const original=answer(P.emptyAdaptive(),correct(),1000);
    original.items[4]={...original.items[4],successes};
    const saved=JSON.stringify(original),loaded=JSON.parse(saved);
    assert.equal(P.validAdaptive(loaded),true);
    assert.equal(JSON.stringify(loaded),saved);
    const advanced=answer(loaded,correct(),1001);
    assert.equal(advanced.items[4].step,2);
    assert.equal(advanced.items[4].successes,0);
    assert.equal(JSON.stringify(loaded),saved);
    const failed=answer(JSON.parse(saved),{...correct(),matched:false,outcome:"missed",score:0},1001);
    assert.equal(failed.items[4].step,1);
    assert.equal(failed.items[4].successes,0);
  }
  const completed=answer(P.emptyAdaptive(),correct(),1000);
  completed.items[4]={...completed.items[4],step:4,successes:3};
  const loaded=JSON.parse(JSON.stringify(completed));
  assert.equal(P.validAdaptive(loaded),true);
  const next=answer(loaded,correct(4,4),1001);
  assert.equal(next.items[4].step,4);
  assert.equal(next.items[4].successes,3);
});
test("two answers needing help among three fall back one step and require fresh successes",()=>{
  let progress=answer(P.emptyAdaptive(),correct(),1000);
  progress.items[4]={...progress.items[4],step:4,successes:0,recent:[]};
  progress=answer(progress,{...correct(4,4),hintCount:1,outcome:"assisted",score:6},2000);
  assert.equal(progress.items[4].step,4);
  progress=answer(progress,correct(4,4),1000+day);
  progress=answer(progress,{...correct(4,4),matched:false,outcome:"missed",score:0},1000+2*day);
  assert.equal(progress.items[4].step,3);
  assert.equal(progress.items[4].successes,0);
  assert.deepEqual(Array.from(progress.items[4].recent),[]);
  assert.equal(progress.items[4].due,1000+2*day+600000);
  progress.items[4].step=1;
  for(let i=0;i<4;i++)progress=answer(progress,{...correct(),matched:false,outcome:"missed",score:0},2000+i);
  assert.equal(progress.items[4].step,1);
});
test("retry answers affect schedules and counts but never readiness or full-round metrics",()=>{
  let progress=answer(P.emptyAdaptive(),correct(),1000);
  const before=progress.items[4];
  progress=answer(progress,correct(),1000+day,true);
  assert.equal(progress.items[4].successes,before.successes);
  assert.equal(progress.items[4].lastSuccessAt,before.lastSuccessAt);
  assert.deepEqual(Array.from(progress.items[4].recent),Array.from(before.recent));
  assert.equal(progress.items[4].due,1000+4*day);
  progress=answer(progress,{...correct(),revealed:true,matched:false,outcome:"missed",score:0},1000+day,true);
  assert.equal(progress.items[4].step,1);
  assert.equal(progress.items[4].due,1000+day+600000);
  assert.equal(progress.items[4].successes,before.successes);
  progress=answer(progress,correct(),1000+day+1);
  assert.equal(progress.items[4].step,2);
  const saved=fixture();saved.completed=true;
  assert.equal(P.adaptiveMetric(saved),null);
  assert.equal(P.roundMetric(saved),null);
  assert.equal(P.recallPercentage(saved),null);
});
test("older unmarked recall keeps its saved answer, assistance and earned score",()=>{
  const saved=fixture(4),a=saved.snapshot.active;
  delete saved.variant;delete a.item.step;delete a.item.cue;
  Object.assign(a,{attempt:D.competencies[3].title,hints:1,done:true,reported:true,matched:true,outcome:"assisted",assistLogged:true});
  saved.responses=[{...correct(),hintCount:1,score:6,scoreVersion:2,outcome:"assisted"}];
  delete saved.responses[0].step;
  saved.snapshot.session.answers[0]=JSON.parse(JSON.stringify(a));
  const original=JSON.stringify(saved),loaded=JSON.parse(original);
  assert.equal(P.validSaved(loaded,D),true);
  assert.equal(P.isAdaptive(loaded),false);
  assert.equal(JSON.stringify(P.migrateScores(loaded)),original);
});
test("a hint reschedules once and its final answer cannot advance the same schedule",()=>{
  let progress=answer(P.emptyAdaptive(),correct(),1000);
  progress.items[4].step=4;progress.nextRound++;
  progress=P.adaptiveHint(progress,4,progress.nextRound,2000);
  assert.equal(progress.items[4].due,602000);
  assert.equal(P.adaptiveHint(progress,4,progress.nextRound,3000),progress);
  progress=P.adaptiveResult(progress,{...correct(4,4),hintCount:1,outcome:"assisted",score:6},progress.nextRound,false,4000);
  assert.equal(progress.items[4].due,602000);
  assert.equal(progress.items[4].streak,0);
  assert.equal(progress.items[4].counts[4].assisted,1);
  assert.equal(progress.items[4].successes,0);
});
test("word choice rotates only Trust/Safety, retaining cue and choices in saved drafts",()=>{
  let progress=answer(P.emptyAdaptive(),correct(),1000);
  progress.items[4].step=2;
  assert.equal(P.adaptiveItem(4,progress).cue,"Trust");
  progress=answer(progress,correct(4,2),1000+day,true);
  assert.equal(P.adaptiveItem(4,progress).cue,"Safety");
  for(let step=1;step<=4;step++){
    const saved=fixture(step);
    assert.equal(P.validSaved(saved,D),true,`Step ${step} draft`);
    const active=saved.snapshot.active;
    active.done=true;active.reported=true;active.matched=true;active.outcome="unaided";
    active.attempt=step>2?D.competencies[3].title:"";
    if(step<=2)active.selected=4;
    saved.responses=[correct(4,step)];saved.snapshot.session.answers[0]=JSON.parse(JSON.stringify(active));
    assert.equal(P.validSaved(JSON.parse(JSON.stringify(saved)),D),true,`Step ${step} submitted`);
  }
});
test("saved adaptive formats reject corrupt cues, choices, scores and cross-format answers",()=>{
  const changes=[
    p=>p.snapshot.active.choices=[4,4,5,8],
    p=>p.snapshot.active.choices=[1,3,5,8],
    p=>p.snapshot.active.hints=1,
    p=>p.snapshot.active.item.cue="Practice",
    p=>p.snapshot.session.adaptiveRound=0,
    p=>p.variant="unknown"
  ];
  for(const change of changes){const saved=fixture(2);change(saved);assert.equal(P.validSaved(saved,D),false);}
  const submitted=fixture(2),a=submitted.snapshot.active;
  a.done=true;a.reported=true;a.matched=true;a.selected=4;a.outcome="unaided";
  submitted.responses=[correct(4,2)];
  for(const patch of [{step:3},{score:11},{hintCount:1},{scoreVersion:2},{misplacedC:2}]){
    assert.equal(P.validSaved({...submitted,responses:[{...correct(4,2),...patch}]},D),false,JSON.stringify(patch));
  }
  for(const patch of [{version:2},{nextRound:-1},{completed:"yes"},{previousRound:{signature:"123",score:1}}]){
    assert.equal(P.validAdaptive({...P.emptyAdaptive(),...patch}),false);
  }
});
test("adaptive comparisons require all eight responses and keep format signatures",()=>{
  const rows=D.competencies.map(c=>correct(c.id,(c.id%4)+1));
  const saved={variant:P.adaptiveVariant,completed:true,responses:rows,snapshot:{session:{roundStart:0,roundEnd:8}}};
  assert.equal(P.adaptiveMetric(saved).signature,"23412341");
  assert.equal(P.adaptiveMetric(saved).score,1);
  assert.equal(P.adaptiveMetric({...saved,responses:rows.slice(1)}),null);
  assert.equal(P.adaptiveMetric({...saved,responses:[...rows.slice(1),rows[1]]}),null);
  assert.equal(P.roundMetric(saved),null);
});
function render(item,patch={},review=false,interact){
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const source=app.slice(app.indexOf("function noteResponse("),app.indexOf("function startMode("))+
    app.slice(app.indexOf("function renderAdaptiveRecall("),app.indexOf("function renderRecall("));
  const card={innerHTML:""},controls=new Map();
  const active={item,attempt:"",hints:0,hintWords:undefined,done:false,revealed:false,selected:null,choices:[item.c,...[1,2,3,4,5,6,7,8].filter(c=>c!==item.c).slice(0,3)],...patch};
  const choices=active.choices.map(id=>({dataset:{nameChoice:String(id)}}));
  const sandbox={P,D,active,reviewIndex:review?0:null,session:{retry:false,adaptiveRound:1,index:0,answers:{0:active}},
    state:{adaptive:{...P.emptyAdaptive(),nextRound:1}},flow:{mode:"recall",responses:[]},usage:null,answerStarted:null,
    answerTime:()=>1000,normalizeTitle:value=>value.toLowerCase(),focusRecallContinue:()=>{},announce:message=>{sandbox.announcement=message;},
    comp:id=>D.competencies.find(c=>c.id===id),
    escape:value=>String(value),titleLabel:c=>`C${c.id}. ${c.title}`,citation:id=>`<div class="citation">PDF p. ${id+2}</div>`,
    document:{querySelector:selector=>{
      if(selector==="#study-card")return card;
      if(selector==="#recall-input" && !card.innerHTML.includes('id="recall-input"'))return null;
      if(!controls.has(selector))controls.set(selector,{});
      return controls.get(selector);
    },querySelectorAll:selector=>selector==="[data-name-choice]"?choices:[]},
    updateShell:()=>{},persist:()=>{},nextItem:()=>{}};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);vm.runInContext("renderAdaptiveRecall()",sandbox);
  interact?.({sandbox,controls,choices});
  return card.innerHTML;
}
test("all 32 exercise surfaces use the right answer shape and only final-step hints",()=>{
  for(const c of D.competencies){
    for(let step=1;step<=4;step++){
      const item={id:`r${c.id}`,type:"recall",c:c.id,step,cue:[2,3].includes(step)?P.questionWords[c.id][0]:null};
      const html=render(item);
      assert.equal((html.match(/data-name-choice=/g) || []).length,step<=2?4:0);
      assert.equal(html.includes('id="recall-input"'),step>2);
      assert.equal((html.match(/data-adaptive-hint=/g) || []).length,step===4?3:0);
      assert.doesNotMatch(html,/class="citation"/);
      if(step===2){
        assert.match(html,/<span>C2<\/span>/);
        assert.doesNotMatch(html,/Cultivates Trust and Safety|Maintains Presence|Listens Actively/);
      }
      if(step===2 || step===3)assert.doesNotMatch(html,/class="pill"/);
    }
  }
});
test("practice help makes same-day progression discoverable without promising promotion in retries",()=>{
  const item={id:"r4",type:"recall",c:4,step:1,cue:null};
  assert.match(render(item),/Two correct answers in a row without hints move this competency up\. You can do both today\./);
  const retry=render(item,{},false,({sandbox})=>vm.runInContext("session.retry=true;renderAdaptiveRecall()",sandbox));
  assert.match(retry,/This retry does not change your step\./);
  assert.doesNotMatch(retry,/You can do both today/);
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  assert.match(app,/two correct answers in a row without hints in normal rounds, even on the same day/);
  assert.doesNotMatch(app,/three counted successes|at most one every 24 hours/);
});
test("Pass is red and zero points at every step, including after final-step hints",()=>{
  for(let step=1;step<=4;step++){
    const item={id:"r4",type:"recall",c:4,step,cue:[2,3].includes(step)?"Trust":null};
    const html=render(item,{done:true,reported:true,revealed:true,matched:false,outcome:"missed",hints:step===4?1:0});
    assert.match(html,/feedback recall-missed/);
    assert.match(html,/Pass: answer revealed/);
    assert.match(html,/Practice points: 0 \/ 10/);
    assert.match(html,/C4\. Cultivates Trust and Safety/);
    assert.match(html,/class="citation"/);
    assert.doesNotMatch(html,/data-adaptive-hint=|data-name-choice=/);
  }
});
test("stripping a variant marker cannot reinterpret an adaptive draft as legacy recall",()=>{
  const saved=fixture(2);
  delete saved.variant;
  assert.equal(P.validSaved(saved,D),false);
});
test("correct choices omit duplicate feedback in both formats and saved review",()=>{
  for(const step of [1,2]){
    const item={id:"r2",type:"recall",c:2,step,cue:step===2?"Mindset":null};
    for(const review of [false,true]){
      const html=render(item,{done:true,reported:true,matched:true,selected:2,outcome:"unaided"},review);
      assert.match(html,/C2\. Embodies a Coaching Mindset/);
      assert.doesNotMatch(html,/Your choice:/);
      assert.match(html,/Practice points: 10 \/ 10/);
      assert.match(html,/\(correct\) \(your choice\)/);
      const wrong=render(item,{done:true,reported:true,matched:false,selected:4,outcome:"missed"},review);
      assert.match(wrong,/C2\. Embodies a Coaching Mindset/);
      assert.ok(wrong.includes(`Your choice: ${step===2?"C4":"Cultivates Trust and Safety"}`));
      assert.match(wrong,/Practice points: 0 \/ 10/);
    }
  }
});
test("encouragement rotates through successes, without counting mistakes, Pass or hints",()=>{
  assert.deepEqual([0,1,2,3].map(n=>P.adaptiveSuccessMessage(Array.from({length:n},()=>correct()))),
    ["Correct!","Well done!","Exactly!","Correct!"]);
  const others=[{...correct(),matched:false},{...correct(),revealed:true},{...correct(),hintCount:1}];
  assert.equal(P.adaptiveSuccessMessage(others),"Correct!");
  assert.equal(P.adaptiveSuccessMessage([correct(),...others]),"Well done!");
});
test("stored encouragement survives reload, rerender and saved choice review",()=>{
  for(const step of [1,2]){
    const saved=fixture(step),a=saved.snapshot.active;
    Object.assign(a,{done:true,reported:true,matched:true,selected:4,outcome:"unaided",successMessage:"Exactly!"});
    saved.responses=[correct(4,step)];saved.snapshot.session.answers[0]=JSON.parse(JSON.stringify(a));
    const reloaded=JSON.parse(JSON.stringify(saved));
    assert.equal(P.validSaved(reloaded,D),true);
    for(const review of [false,true]){
      const answer=review?reloaded.snapshot.session.answers[0]:reloaded.snapshot.active;
      for(let i=0;i<2;i++){
        const html=render(answer.item,answer,review);
        assert.match(html,/<h3>Exactly!<\/h3>/);
        assert.doesNotMatch(html,/<h3>Selected (?:the name|the C number)<\/h3>/);
        assert.match(html,/Practice points: 10 \/ 10/);
      }
    }
    assert.match(render(a.item,{...a,successMessage:undefined}),/<h3>Correct!<\/h3>/);
  }
});
test("success copy cannot replace assisted, wrong-order, incorrect or Pass feedback",()=>{
  const item={id:"r4",type:"recall",c:4,step:4,cue:null},base={done:true,reported:true,successMessage:"Well done!"};
  for(const patch of [
    {matched:true,hints:1,outcome:"assisted",expected:"Correct with hints"},
    {matched:false,misplacedC:2,outcome:"missed",expected:"Recognized competency, wrong order"},
    {matched:false,outcome:"missed",expected:"Name did not match"},
    {matched:false,revealed:true,outcome:"missed",expected:"Pass: answer revealed"}
  ]){
    const html=render(item,{...base,...patch});
    assert.ok(html.includes(`<h3>${patch.expected}</h3>`));
    assert.doesNotMatch(html,/<h3>(?:Correct!|Well done!|Exactly!)<\/h3>/);
  }
});
test("choice submission stores encouragement before the review snapshot and announces the same message",()=>{
  const messages=["Correct!","Well done!","Exactly!","Correct!"];
  for(const step of [1,2]){
    const item={id:"r4",type:"recall",c:4,step,cue:step===2?"Trust":null};
    for(let n=0;n<messages.length;n++){
      let snapshot;
      const html=render(item,{},false,({sandbox,choices})=>{
        sandbox.flow.responses.push(...Array.from({length:n},()=>correct()));
        choices.find(button=>button.dataset.nameChoice==="4").onclick();
        snapshot=JSON.parse(JSON.stringify(sandbox.session.answers[0]));
        assert.equal(snapshot.successMessage,messages[n]);
        assert.equal(sandbox.flow.responses.at(-1).score,10);
        assert.equal(sandbox.announcement,`${messages[n]} C4. Cultivates Trust and Safety.`);
      });
      assert.ok(html.includes(`<h3>${messages[n]}</h3>`));
      assert.ok(render(item,snapshot,true).includes(`<h3>${messages[n]}</h3>`));
    }
  }
});
test("selected choice highlights retain order, readable outcome labels and locked review",()=>{
  for(const step of [1,2]){
    const item={id:"r4",type:"recall",c:4,step,cue:step===2?"Trust":null};
    for(const review of [false,true]){
      for(const selected of [4,2,null]){
        const passed=selected===null;
        const html=render(item,{choices:[2,4,8,1],done:true,reported:true,matched:selected===4,selected,revealed:passed},review);
        const buttons=Array.from(html.matchAll(/<button type="button" class="option([^"]*)" disabled>(.*?)<\/button>/g));
        assert.equal(buttons.length,4);
        for(let i=0;i<4;i++){
          const id=[2,4,8,1][i],chosen=id===selected;
          assert.equal(buttons[i][1],chosen?` recall-choice-${selected===4?"correct":"incorrect"}`:"");
          assert.ok(buttons[i][2].includes(step===2?`C${id}`:D.competencies[id-1].title));
          assert.equal(buttons[i][2].includes("(your choice)"),chosen);
          assert.equal(buttons[i][2].includes("(incorrect)"),chosen && selected!==4);
          assert.equal(buttons[i][2].includes("(correct)"),id===4);
        }
        assert.doesNotMatch(html,/data-name-choice=/);
      }
    }
  }
});
test("selected outcome styling reuses readable light, dark and system theme colors",()=>{
  const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
  assert.match(css,/#study-card \.option\.recall-choice-correct\{background:var\(--correct\);border:3px solid var\(--correct-line\)/);
  assert.match(css,/#study-card \.option\.recall-choice-incorrect\{background:var\(--recall-wrong\);border:3px solid var\(--recall-wrong-line\)/);
  const luminance=hex=>{
    const channels=hex.match(/\w{2}/g).map(pair=>parseInt(pair,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  };
  const contrast=(a,b)=>{
    const levels=[luminance(a),luminance(b)].sort((x,y)=>y-x);
    return (levels[0]+.05)/(levels[1]+.05);
  };
  const tokens=source=>Object.fromEntries(Array.from(source.matchAll(/--([\w-]+):#([0-9a-f]{6})(?![0-9a-f])/g),m=>[m[1],m[2]]));
  const defaults={...tokens(css.slice(0,css.indexOf("\n"))),...tokens(css.slice(css.indexOf(":root {"),css.indexOf(':root[data-theme="dark"]')))};
  for(const theme of [defaults,...Array.from(css.matchAll(/:root\[data-theme="(?:dark|system)"\] \{([^}]+)\}/g),m=>({...defaults,...tokens(m[1])}))]){
    for(const [background,line] of [["correct","correct-line"],["recall-wrong","recall-wrong-line"]]){
      assert.ok(contrast(theme.ink,theme[background])>=4.5,`Text on ${background}`);
      assert.ok(contrast(theme[line],theme[background])>=3,`Border on ${background}`);
    }
  }
});
test("saved adaptive success copy must describe an actual unassisted success",()=>{
  const saved=fixture(),a=saved.snapshot.active;
  Object.assign(a,{done:true,reported:true,matched:true,selected:4,outcome:"unaided",successMessage:"Well done!"});
  saved.responses=[correct()];
  assert.equal(P.validSaved(saved,D),true);
  for(const message of [null,7,{},["Exactly!"],"Selected the name"]){
    a.successMessage=message;
    assert.equal(P.validSaved(saved,D),false);
  }
  Object.assign(a,{successMessage:"Well done!",matched:false,selected:2,outcome:"missed"});
  saved.responses=[{...correct(),matched:false,outcome:"missed",score:0}];
  assert.equal(P.validSaved(saved,D),false);
});
test("adaptive answer focus is limited to current unanswered adaptive questions",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const helper=app.slice(app.indexOf("function focusAdaptiveAnswer("),app.indexOf("function focusRecallContinue("));
  const calls=[],sandbox={P,flow:{variant:P.adaptiveVariant},reviewIndex:null,active:{done:false},
    focus:(selector,visible)=>calls.push({selector,visible})};
  vm.createContext(sandbox);vm.runInContext(helper,sandbox);
  assert.equal(vm.runInContext("focusAdaptiveAnswer()",sandbox),true);
  assert.deepEqual(calls,[{selector:"#recall-input,[data-name-choice]",visible:true}]);
  for(const patch of [{reviewIndex:0},{active:{done:true}},{active:null},{flow:{mode:"recall"}},{flow:{variant:P.adaptiveVariant,completed:true}}]){
    Object.assign(sandbox,{flow:{variant:P.adaptiveVariant},reviewIndex:null,active:{done:false}},patch);
    assert.equal(vm.runInContext("focusAdaptiveAnswer()",sandbox),false);
    assert.equal(calls.length,1);
  }
});
test("every adaptive next-question format pair focuses the answer control without submitting it",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const helpers=app.slice(app.indexOf("function focusAdaptiveAnswer("),app.indexOf("function focusRecallContinue("))+
    app.slice(app.indexOf("function nextItem("),app.indexOf("function renderComplete("));
  for(let from=1;from<=4;from++)for(let to=1;to<=4;to++){
    const items=[{id:"r1",c:1,type:"recall",step:from},{id:"r2",c:2,type:"recall",step:to}],calls=[];
    const sandbox={P,reviewIndex:null,active:{item:items[0],done:true,outcome:"unaided"},flow:{variant:P.adaptiveVariant,answerMs:100},
      session:{items,index:0,roundEnd:2,results:[],answers:{}},finishPracticeEntry:null,answerStarted:10,
      renderStudy:()=>{calls.push("render");sandbox.active={item:items[1],done:false};},
      focus:(selector,visible)=>{assert.equal(selector,"#recall-input,[data-name-choice]");assert.equal(visible,true);calls.push("answer-focus");},
      animateStudyNavigation:(a,b)=>{assert.equal(a,0);assert.equal(b,1);calls.push("motion");}};
    vm.createContext(sandbox);vm.runInContext(helpers,sandbox);
    vm.runInContext("nextItem()",sandbox);
    assert.deepEqual(calls,["render","answer-focus","motion"]);
    assert.equal(sandbox.session.index,1);
    assert.equal(sandbox.active.done,false);
    assert.equal(sandbox.session.answers[0].done,true);
    vm.runInContext("nextItem()",sandbox);
    assert.equal(sandbox.session.index,1);
    assert.deepEqual(calls,["render","answer-focus","motion"]);
  }
});
test("focused answer controls retain question context and choices reject repeated Enter",()=>{
  for(let step=1;step<=4;step++){
    const item={id:"r4",type:"recall",c:4,step,cue:step===2 || step===3?"Trust":null};
    const html=render(item,{},false,({choices})=>{
      if(step>2)return;
      for(const button of choices){
        let prevented=0;
        button.onkeydown({key:"Enter",repeat:true,preventDefault:()=>{prevented++;}});
        assert.equal(prevented,1);
        button.onkeydown({key:"Enter",repeat:false,preventDefault:()=>{prevented++;}});
        button.onkeydown({key:"Tab",repeat:true,preventDefault:()=>{prevented++;}});
        assert.equal(prevented,1);
      }
    });
    assert.match(html,/<h2 class="recall-prompt" id="adaptive-recall-prompt">/);
    assert.match(html,step<=2?/role="group" aria-labelledby="adaptive-recall-prompt"/:/aria-describedby="adaptive-recall-prompt recall-help"/);
    assert.doesNotMatch(html,/tabindex=/);
  }
});
