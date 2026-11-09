import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const context={window:{}};
vm.runInNewContext(readFileSync(new URL("../practice.js",import.meta.url),"utf8"),context);
vm.runInNewContext(readFileSync(new URL("../content.js",import.meta.url),"utf8"),context);
vm.runInNewContext(readFileSync(new URL("../exam.js",import.meta.url),"utf8"),context);
const P=context.window.PRACTICE,D=context.window.STUDY;
function summaryMarkup(result,active=null){
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const renderer=app.slice(app.indexOf("function renderSummary("),app.indexOf("function updateShell("));
  const main={innerHTML:""},controls=new Map();
  const sandbox={P,D,main,result,state:{exam:null,practices:{}},active,
    modeNames:{recall:"Core competency recall",questions:"Questions",mixed:"Mixed practice"},
    comp:id=>D.competencies.find(c=>c.id===id),titleLabel:context.window.EXAM.titleLabel,
    normalizeTitle:context.window.EXAM.normalizeTitle,escape:value=>value,coffee:{eligible:()=>false},
    updateNavigation:()=>{},focus:()=>{},
    document:{querySelector:selector=>{
      if(selector==="#dismiss-coffee")return null;
      if(!controls.has(selector))controls.set(selector,{append:()=>{}});
      return controls.get(selector);
    },createElement:()=>({})}};
  vm.createContext(sandbox);
  vm.runInContext(renderer,sandbox);
  vm.runInContext("renderSummary(result)",sandbox);
  return main.innerHTML;
}
test("recall summary uses the actual match and Pass, not assisted review credit alone",()=>{
  assert.equal(P.recallOutcome(null),null);
  assert.equal(P.recallOutcome({outcome:"unaided",matched:true,revealed:false}),"unaided");
  assert.equal(P.recallOutcome({outcome:"assisted",matched:true,revealed:false}),"assisted");
  assert.equal(P.recallOutcome({outcome:"assisted",matched:false,revealed:false}),"missed");
  assert.equal(P.recallOutcome({outcome:"assisted",matched:false,revealed:true}),"missed");
  assert.equal(P.recallOutcome({outcome:"unaided",matched:false}),"missed");
  assert.equal(P.recallOutcome({outcome:"missed",matched:true}),"missed");
  assert.equal(P.recallOutcome({outcome:"assisted"}),"missed");
});
test("approved 14-point bonus is capped at four seconds and zero at 60",()=>{
  for(const t of [0,1,4]){assert.equal(P.points("recognition",t),104);assert.equal(P.points("reasonable",t),94);}
  assert.equal(P.points("recognition",32),97);assert.equal(P.points("reasonable",32),87);
  for(const t of [60,1000]){assert.equal(P.points("recognition",t),90);assert.equal(P.points("reasonable",t),80);}
  for(const t of [0,4,32,60,1000])assert.equal(P.points("missed",t),0);
  assert.ok(P.points("reasonable",4)>P.points("recognition",60));
  for(const t of [-1,NaN,Infinity])assert.throws(()=>P.points("recognition",t));
  assert.throws(()=>P.points("made-up",1));
});
test("new recall points preserve accuracy and hint distinctions without changing round comparisons",()=>{
  const correct={c:1,type:"recall",matched:true,revealed:false,outcome:"unaided"};
  const hinted={...correct,outcome:"assisted"};
  const misplaced={...correct,matched:false,misplacedC:2,outcome:"missed"};
  assert.equal(P.recallPoints(correct),10);
  assert.equal(P.recallPoints(hinted),10);
  assert.equal(P.recallPoints(misplaced),1);
  assert.equal(P.recallPoints({...misplaced,outcome:"assisted"}),1);
  assert.equal(P.recallPoints({...correct,matched:false}),0);
  assert.equal(P.recallPoints({...correct,revealed:true}),0);
  assert.equal(P.recallPoints({...misplaced,revealed:true}),0);
  assert.equal(P.recallOutcome(misplaced),"misplaced");
  assert.equal(P.recallOutcome({...misplaced,outcome:"assisted"}),"misplaced");
  assert.equal(P.recallOutcome(hinted),"assisted");
  assert.equal(P.roundMetric({mode:"recall",responses:[{...misplaced,score:1,scoreVersion:1}]}).score,0);
  assert.equal(P.roundMetric({mode:"recall",responses:[{...hinted,score:10,scoreVersion:1}]}).score,0);
});
test("wrong-order recognition is distinct and uses only known official-name evidence",()=>{
  const normalize=context.window.EXAM.normalizeTitle;
  const answer={item:{id:"r3",type:"recall",c:3},matched:false,revealed:false,attempt:"  embodies A COACHING mindset!!!  "};
  assert.equal(P.recallMisplacement(answer,D.competencies,normalize).id,2);
  assert.equal(P.recallOutcome({...answer,misplacedC:2}),"misplaced");
  for(const patch of [{attempt:"A fictional guess"},{attempt:D.competencies[2].title},{revealed:true},{matched:true}]){
    assert.equal(P.recallMisplacement({...answer,...patch},D.competencies,normalize),null);
  }
  assert.equal(P.recallOutcome({matched:false,revealed:false,outcome:"missed"}),"missed");
  assert.equal(P.recallOutcome({...answer,misplacedC:3}),"missed");
  assert.equal(P.recallOutcome({...answer,misplacedC:2,revealed:true}),"missed");
});
test("successful mixed hint presses earn 10, 6, 4, 3, 2, 1, 1 and no-ops cost nothing",()=>{
  const c=D.competencies[1],correct={matched:true,revealed:false};
  let states=P.recallHintState(c.title),hintCount=0;
  const scores=[P.recallPoints({...correct,hintCount})];
  for(const kind of ["letter","letter","letter","letter","word","word"]){
    const next=P.nextRecallHint(c,states,kind);
    assert.ok(next);
    states=next;hintCount++;
    scores.push(P.recallPoints({...correct,hintCount}));
  }
  assert.deepEqual(scores,[10,6,4,3,2,1,1]);
  for(const kind of ["letter","word","core"]){
    const next=P.nextRecallHint(c,states,kind);
    assert.equal(next,null);
    if(next)hintCount++;
  }
  assert.equal(hintCount,6);
  const resumed=JSON.parse(JSON.stringify({hintWords:states,hints:hintCount}));
  assert.equal(P.recallPoints({...correct,hintCount:resumed.hints}),1);
  assert.equal(P.recallPoints({...correct,hintCount:10}),1);
  const legacy=P.recallHintState(c.title,2);
  assert.ok(P.nextRecallHint(c,legacy,"letter"));
  assert.equal(P.recallPoints({...correct,hintCount:3}),3);
  for(let n=0;n<=10;n++){
    assert.equal(P.recallPoints({matched:false,revealed:false,misplacedC:2,hintCount:n}),1);
    assert.equal(P.recallPoints({matched:false,revealed:false,hintCount:n}),0);
    assert.equal(P.recallPoints({matched:false,revealed:true,misplacedC:2,hintCount:n}),0);
  }
});
test("new recall score versions save hint counts while prior earned scores stay frozen",()=>{
  const item={id:"r1",type:"recall",c:1};
  const active={item,attempt:D.competencies[0].title,hints:1,done:true,reported:true,revealed:false,matched:true,assistLogged:true,optionOrder:null};
  const result={c:1,type:"recall",matched:true,revealed:false,outcome:"assisted",seconds:3,score:6,scoreVersion:2,hintCount:1};
  const saved={version:1,mode:"recall",completed:false,elapsedMs:3000,answerMs:0,responses:[result],
    snapshot:{view:"recall",scenarioNode:D.scenario.start,history:[],branchChoice:null,
      session:{type:"recall",items:[item],index:0,results:[],answers:{0:active}},active}};
  assert.equal(P.validSaved(saved,D),true);
  assert.equal(P.validSaved(JSON.parse(JSON.stringify(saved)),D),true);
  for(const patch of [{score:10},{hintCount:-1},{hintCount:11},{hintCount:"1"},{hintCount:undefined},{scoreVersion:1}]){
    assert.equal(P.validSaved({...saved,responses:[{...result,...patch}]},D),false,JSON.stringify(patch));
  }
  const old=JSON.parse(JSON.stringify(saved));
  old.responses[0].score=10;old.responses[0].scoreVersion=1;delete old.responses[0].hintCount;
  assert.equal(P.validSaved(old,D),true);
  assert.equal(P.migrateScores(old),old);
  assert.equal(old.responses[0].score,10);
});
test("completed recall percentage is a rounded fixed-80 score, never partial accuracy",()=>{
  const responses=score=>D.competencies.map(c=>({c:c.id,type:"recall",score}));
  const result={mode:"recall",completed:true,responses:responses(10),snapshot:{}};
  assert.equal(P.recallPercentage(result),100);
  assert.equal(P.recallPercentage({...result,responses:responses(0)}),0);
  const rounded=responses(0);rounded[0].score=2;
  assert.equal(P.recallPercentage({...result,responses:rounded}),3);
  const scores=[10,6,4,3,2,1,1,0],rows=responses(0).map((r,i)=>({...r,score:scores[i]}));
  assert.equal(P.recallPercentage({...result,responses:rows}),34);
  assert.equal(P.recallPercentage({...result,completed:false}),null);
  assert.equal(P.recallPercentage({...result,mode:"mixed"}),null);
  assert.equal(P.recallPercentage({...result,mode:"exam"}),null);
  assert.equal(P.recallPercentage({...result,responses:rows.slice(0,7)}),null);
  assert.equal(P.recallPercentage({...result,responses:rows.map((r,i)=>i===0?{c:r.c,type:r.type}:r)}),null);
  assert.equal(P.recallPercentage({...result,responses:rows.map(r=>({...r,c:1}))}),null);
  assert.equal(P.recallPercentage({...result,responses:responses(10).concat(rows),snapshot:{session:{roundStart:8,roundEnd:16}}}),34);
});
test("shared recall hints use leftmost hidden/partial words and editorial core words",()=>{
  const c=D.competencies[0];
  const hidden=P.recallHintState(c.title);
  const letter=P.nextRecallHint(c,hidden,"letter");
  assert.deepEqual(Array.from(letter),[1,0,0]);
  assert.deepEqual(Array.from(P.nextRecallHint(c,letter,"word")),[2,0,0]);
  assert.deepEqual(Array.from(P.nextRecallHint(c,hidden,"core")),[0,2,0]);
  assert.deepEqual(Array.from(P.nextRecallHint(c,[0,2,0],"core")),[0,2,2]);
  assert.equal(P.nextRecallHint(c,[0,2,2],"core"),null);
  assert.equal(P.nextRecallHint(c,[0,2,2],"word"),null);
  assert.deepEqual(Array.from(P.nextRecallHint(c,[0,2,2],"letter")),[1,2,2]);
  assert.equal(P.recallHintText(c.title,[1,2,0]),"D... Ethical ____");
  assert.equal(P.recallHintText(c.title,[1,2,0],true),"first letter D Ethical blank");
  assert.deepEqual(Array.from(hidden),[0,0,0],"Hints do not mutate a caller's state");
  assert.throws(()=>P.nextRecallHint(c,hidden,"unknown"));
  const c2=D.competencies[1];
  assert.deepEqual(Array.from(P.nextRecallHint(c2,[2,0,0,0],"letter")),[2,2,0,0],"A single-letter initial is a full word");
  const c6=D.competencies[5];
  assert.deepEqual(Array.from(P.nextRecallHint(c6,[0,0],"core")),[2,0]);
  assert.equal(P.nextRecallHint(c6,[2,0],"core"),null,"Only Listens is an eligible C6 core word");
  assert.equal(P.nextRecallHint(c6,[2,0],"word"),null);
  assert.deepEqual(Array.from(P.nextRecallHint(c6,[2,0],"letter")),[2,1]);
});
test("all reachable hint combinations preserve a partly hidden word and disable exhausted controls",()=>{
  const editorial={1:["Ethical","Practice"],2:["Coaching","Mindset"],3:["Agreements"],4:["Trust","Safety"],5:["Presence"],6:["Listens"],7:["Awareness"],8:["Client","Growth"]};
  for(const c of D.competencies){
    const words=c.title.split(" "),queue=[P.recallHintState(c.title)],seen=new Set();
    while(queue.length){
      const states=queue.shift(),key=states.join();
      if(seen.has(key))continue;
      seen.add(key);
      assert.ok(states.filter(state=>state===2).length<words.length);
      for(const kind of ["letter","word","core"]){
        const next=P.nextRecallHint(c,states,kind);
        if(!next)continue;
        const changed=states.map((state,i)=>state!==next[i]?i:-1).filter(i=>i!==-1);
        assert.equal(changed.length,1);
        const i=changed[0];
        assert.ok(next[i]>states[i]);
        assert.notEqual(states[i],2);
        if(kind==="core")assert.ok(editorial[c.id].includes(words[i]));
        if(kind==="letter")assert.equal(i,states.indexOf(0));
        if(kind==="word")assert.equal(i,states.findIndex(state=>state!==2));
        assert.ok(next.every((state,i)=>state!==1 || words[i].length>1));
        queue.push(next);
      }
    }
    let core=P.recallHintState(c.title),revealed=[];
    for(let next;(next=P.nextRecallHint(c,core,"core"));core=next){
      revealed.push(words[next.findIndex((state,i)=>state!==core[i])]);
    }
    assert.deepEqual(revealed,editorial[c.id]);
    assert.ok(seen.size>1);
  }
});
test("legacy word hints migrate without losing reveals and saved shared hints are validated",()=>{
  const c=D.competencies[1];
  assert.deepEqual(Array.from(P.recallHintState(c.title,2)),[2,2,0,0]);
  assert.deepEqual(Array.from(P.recallHintState(c.title,10)),[2,2,2,0]);
  assert.deepEqual(Array.from(P.recallHintState(c.title,2,[1,0,2,0])),[1,0,2,0]);
  const item={id:"r2",type:"recall",c:2};
  const answer={item,attempt:"fictional draft",hints:2,hintWords:[1,0,2,0],revealed:false,done:false,
    selected:null,assistLogged:true,optionOrder:null};
  const saved={version:1,mode:"mixed",completed:false,elapsedMs:1000,answerMs:1000,responses:[],
    snapshot:{view:"recall",scenarioNode:D.scenario.start,history:[],branchChoice:null,
      session:{type:"mixed",items:[item],index:0,results:[]},active:answer}};
  assert.equal(P.validSaved(saved,D),true);
  assert.equal(P.validSaved(JSON.parse(JSON.stringify(saved)),D),true);
  for(const hintWords of [[2,2,2,2],[0,1,0,0],[1,0,2],[1,0,3,0],["1",0,2,0],null]){
    assert.equal(P.validSaved({...saved,snapshot:{...saved.snapshot,active:{...answer,hintWords}}},D),false);
  }
  assert.equal(P.validSaved({...saved,snapshot:{...saved.snapshot,active:{...answer,hints:0}}},D),false);
  const legacy=JSON.parse(JSON.stringify(saved));
  delete legacy.snapshot.active.hintWords;
  assert.equal(P.validSaved(legacy,D),true);
});
test("recall scores and misplaced-name metadata survive saved validation without rescoring history",()=>{
  const item={id:"r1",type:"recall",c:1};
  const answer={item,attempt:D.competencies[1].title,hints:0,revealed:false,done:true,reported:true,
    matched:false,misplacedC:2,outcome:"missed",selected:null,assistLogged:false,optionOrder:null};
  const response={c:1,type:"recall",outcome:"missed",seconds:2,matched:false,revealed:false,misplacedC:2,score:1,scoreVersion:1};
  const saved={version:1,mode:"recall",completed:false,elapsedMs:2000,answerMs:0,responses:[response],
    snapshot:{view:"recall",scenarioNode:D.scenario.start,history:[],branchChoice:null,
      session:{type:"recall",items:[item],index:0,results:[],answers:{0:answer}},active:answer}};
  assert.equal(P.validSaved(saved,D),true);
  assert.equal(P.validSaved(JSON.parse(JSON.stringify(saved)),D),true);
  for(const patch of [{score:10},{score:-1},{score:"1"},{scoreVersion:2},{misplacedC:1},{misplacedC:9},{matched:true},{matched:"false"},{revealed:true},{revealed:"false"}]){
    assert.equal(P.validSaved({...saved,responses:[{...response,...patch}]},D),false,JSON.stringify(patch));
  }
  for(const misplacedC of [1,9,"2"]){
    assert.equal(P.validSaved({...saved,snapshot:{...saved.snapshot,active:{...answer,misplacedC}}},D),false);
  }
  const historical=JSON.parse(JSON.stringify(saved));
  delete historical.responses[0].score;delete historical.responses[0].scoreVersion;delete historical.responses[0].misplacedC;
  delete historical.snapshot.active.misplacedC;delete historical.snapshot.session.answers[0].misplacedC;
  assert.equal(P.validSaved(historical,D),true);
  assert.equal(P.migrateScores(historical),historical);
  assert.equal(Object.hasOwn(historical.responses[0],"score"),false);
});
test("historical earned scores retain their original bonus",()=>{
  const old={responses:[
    {type:"questions",outcome:"recognition",seconds:4},
    {type:"questions",outcome:"reasonable",seconds:34},
    {type:"questions",outcome:"missed",seconds:0},
    {type:"recall",outcome:"unaided",seconds:2}
  ]};
  const migrated=P.migrateScores(old);
  assert.notEqual(migrated,old);
  assert.deepEqual(Array.from(migrated.responses.slice(0,3),r=>r.score),[100,85,0]);
  assert.equal(Object.hasOwn(migrated.responses[3],"score"),false);
  assert.equal(Object.hasOwn(old.responses[0],"score"),false);
  assert.equal(P.migrateScores(migrated),migrated);
  assert.equal(P.earnedPoints({score:100,outcome:"recognition",seconds:4}),100);
  assert.equal(P.earnedPoints({score:104,outcome:"recognition",seconds:4}),104);
});
test("round comparisons require the same objective scoring scheme",()=>{
  const q={type:"questions",outcome:"recognition",seconds:4,score:104,scoreVersion:2};
  const r={type:"recall",outcome:"unaided",matched:true,revealed:false,seconds:1};
  const p={mode:"questions",responses:[{...q,score:100,scoreVersion:1},q],snapshot:{session:{roundStart:1,roundEnd:2}}};
  const full=P.roundMetric(p);
  assert.equal(full.score,1);
  assert.equal(P.roundMetric({...p,snapshot:{}}),null);
  assert.equal(P.roundMetric({mode:"recall",responses:[r,{...r,outcome:"assisted"}]}).score,.5);
  assert.equal(P.roundMetric({mode:"mixed",responses:[r,q]}).score,1);
  assert.equal(P.roundMetric({mode:"exam"},[true,true,false,false,false,false,false,false]).score,.25);
  assert.equal(P.improves(full,null),false);
  assert.equal(P.improves(full,{scheme:full.scheme,score:1}),true);
  assert.equal(P.improves(full,{scheme:full.scheme,score:.5}),true);
  assert.equal(P.improves({...full,score:.4},{scheme:full.scheme,score:.5}),false);
  assert.equal(P.improves(full,{scheme:"older",score:.5}),false);
  assert.equal(P.validBaselines({questions:full}),true);
  assert.equal(P.validBaselines({questions:{...full,score:NaN}}),false);
});
test("three distinct local calendar days, not loads or consecutive days",()=>{
  let s={version:1,days:[],dismissed:null};
  for(const date of ["2026-01-01","2026-01-01","2026-01-10"])s=P.visit(s,date);
  assert.equal(s.days.length,2);
  s=P.visit(s,"2026-03-05");assert.equal(s.days.length,3);
  for(let i=1;i<25;i++)s=P.visit(s,`2026-04-${String(i).padStart(2,"0")}`);
  assert.equal(s.days.length,3);
  assert.equal(P.validDay("2026-02-30"),false);assert.equal(P.validDay("2028-02-29"),true);
});
test("coffee storage failures are explicit and do not claim a dismissal",()=>{
  const errors=[],store=new Map();
  let fail=false;
  const coffee=P.coffee({getItem:k=>store.get(k)??null,setItem:(k,v)=>{if(fail)throw Error("full");store.set(k,v);}},e=>errors.push(e));
  assert.equal(coffee.visit(),true);
  store.set(coffee.key,JSON.stringify({version:1,days:["2026-01-01","2026-01-03","2026-01-10"],dismissed:null}));
  assert.equal(coffee.eligible(),true);assert.equal(coffee.dismiss(),true);assert.equal(coffee.eligible(),false);
  fail=true;assert.equal(coffee.dismiss(),false);assert.ok(errors.length);
  store.set(coffee.key,"bad");assert.equal(coffee.eligible(),false);
});
test("saved sessions preserve exact item identity and reject corrupt metadata",()=>{
  const q=D.questions[0],item={id:q.id,type:"questions",c:q.c};
  const p={version:1,mode:"questions",completed:false,elapsedMs:12,answerMs:10,responses:[],
    snapshot:{view:"questions",scenarioNode:D.scenario.start,history:[],branchChoice:null,
      session:{type:"questions",items:[item],index:0,results:[]},
      active:{item,attempt:"",hints:0,revealed:false,done:false,outcome:null,selected:null,assistLogged:false,optionOrder:[0,1,2,3]}}};
  assert.equal(P.validSaved(p,D),true);
  const change=fn=>{const copy=JSON.parse(JSON.stringify(p));fn(copy);assert.equal(P.validSaved(copy,D),false);};
  change(p=>p.snapshot.active.item.c=9);
  change(p=>p.snapshot.active.item.type="recall");
  change(p=>p.snapshot.active.optionOrder=[0,0,1,2]);
  change(p=>p.snapshot.active.done=true);
  change(p=>p.snapshot.history=[{node:"toString",index:0}]);
  change(p=>p.snapshot.view="home");
  change(p=>p.responses=[{c:1,type:"questions",outcome:"explored",seconds:1}]);
  change(p=>p.completionRecorded="yes");
  change(p=>{p.snapshot.session.roundStart=0;p.snapshot.session.roundEnd=9;});
  const scored=JSON.parse(JSON.stringify(p));
  scored.snapshot.active.done=true;scored.snapshot.active.reported=true;scored.snapshot.active.selected=0;
  scored.responses=[{c:q.c,type:"questions",outcome:"recognition",seconds:4,score:104,scoreVersion:2}];
  assert.equal(P.validSaved(scored,D),true);
  for(const score of [-1,105,NaN,"104"])assert.equal(P.validSaved({...scored,responses:[{...scored.responses[0],score}]},D),false);
});
test("saved answer review validates locked history without requiring legacy caches",()=>{
  const items=D.questions.slice(0,2).map(q=>({id:q.id,type:"questions",c:q.c}));
  const answer={item:items[0],attempt:"",hints:0,revealed:false,done:true,reported:true,
    outcome:"recognition",selected:0,assistLogged:false,optionOrder:[0,1,2,3]};
  const response={c:items[0].c,type:"questions",outcome:"recognition",seconds:4,score:104,scoreVersion:2};
  const p={version:1,mode:"questions",completed:false,elapsedMs:4000,answerMs:2000,responses:[response],
    snapshot:{view:"questions",scenarioNode:D.scenario.start,history:[],branchChoice:null,reviewIndex:0,
      session:{type:"questions",items,index:1,results:[{type:"questions",outcome:"recognition",missed:false}],
        roundStart:0,roundEnd:2,answers:{0:answer}},
      active:{...answer,item:items[1],done:false,reported:false,selected:null,outcome:null}}};
  assert.equal(P.validSaved(p,D),true);
  const invalid=fn=>{const copy=JSON.parse(JSON.stringify(p));fn(copy);assert.equal(P.validSaved(copy,D),false);};
  invalid(p=>p.snapshot.session.answers=null);
  invalid(p=>p.snapshot.session.answers[0].item=items[1]);
  invalid(p=>p.snapshot.session.answers[0].done=false);
  invalid(p=>p.snapshot.session.answers[0].selected=null);
  invalid(p=>p.snapshot.session.answers[0].optionOrder=[0,0,1,2]);
  invalid(p=>p.snapshot.reviewIndex=1);
  invalid(p=>p.examReview=true);
  const legacy=JSON.parse(JSON.stringify(p));
  delete legacy.snapshot.session.answers;delete legacy.snapshot.reviewIndex;
  assert.equal(P.validSaved(legacy,D),true);
});
test("first-completion flags stay minimal and separate from comparable scores",()=>{
  assert.equal(P.validCompletedModes({}),true);
  assert.equal(P.validCompletedModes({recall:true,questions:true,mixed:true,exam:true}),true);
  for(const value of [null,[],{questions:false},{other:true},{exam:1}])assert.ok(!P.validCompletedModes(value));
});
test("recall feedback focuses Continue and echoes only wrong submitted answers",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const renderer=app.slice(app.indexOf("function renderRecall("),app.indexOf("function renderQuestion("));
  for(const mode of ["recall","mixed"]){
    for(const kind of ["correct","hinted-correct","wrong","hinted-wrong","misplaced","hinted-misplaced","pass","hinted-pass"]){
      const c=D.competencies[0],item={id:"r1",type:"recall",c:1};
      const a={item,attempt:"",hints:kind.startsWith("hinted")?1:0,done:false,revealed:false,assistLogged:kind.startsWith("hinted"),optionOrder:null};
      let focused=null,announced="",prevented=false;
      const card={innerHTML:"",insertAdjacentHTML:(_,html)=>{card.innerHTML+=html;}};
      const input={value:kind.includes("misplaced")?D.competencies[1].title:kind.includes("wrong")?"A fictional guess":c.title,
        setCustomValidity:()=>{},reportValidity:()=>{},focus:()=>{focused="input";}};
      const form={},next={focus:()=>{focused="continue";}},pass={};
      const counts=[];
      const sandbox={P,D,active:a,reviewIndex:null,session:{type:mode},state:{items:{r1:{due:0,missed:0}},hintedSuccessIndex:0},
        flow:{mode},usageMode:value=>value,usage:{count:(...args)=>counts.push(args)},
        comp:()=>c,titleLabel:context.window.EXAM.titleLabel,normalizeTitle:context.window.EXAM.normalizeTitle,
        escape:value=>value,citation:()=>"",hintedSuccessMessages:["You got it!"],hintedSuccessSupport:"Keep practicing.",
        updateShell:()=>{},persist:()=>{},record:()=>{},noteActive:()=>{},nextItem:()=>{},
        focus:()=>{focused="heading";},announce:text=>{announced=text;},
        document:{querySelector:selector=>({"#study-card":card,"#recall-input":input,"#recall-form":form,"#next-item":next,"#reveal":pass}[selector]),
          querySelectorAll:()=>[]}};
      vm.createContext(sandbox);
      vm.runInContext(renderer,sandbox);
      vm.runInContext("renderRecall()",sandbox);
      assert.doesNotMatch(card.innerHTML,/Hints share one line|hint-help|A hint shows one word/);
      assert.match(card.innerHTML,/First letter, Next word and Core word offer different clues/);
      if(kind.includes("pass"))pass.onclick();
      else form.onsubmit({preventDefault:()=>{prevented=true;}});
      assert.equal(focused,"continue");
      assert.equal(a.done,true);
      assert.deepEqual(counts,kind.includes("pass")?[[mode,"passes"]]:[]);
      if(!kind.includes("pass"))assert.equal(prevented,true);
      assert.equal((card.innerHTML.match(/class="answer-title"/g) || []).length,1);
      if(kind.includes("wrong") || kind.includes("misplaced"))assert.match(card.innerHTML,/Your answer:/);
      else assert.doesNotMatch(card.innerHTML,/Your answer:/);
      if(kind.includes("wrong") || kind.includes("pass")){
        assert.match(card.innerHTML,/feedback recall-missed/);
        assert.match(card.innerHTML,/Wrong \/ passed/);
        assert.doesNotMatch(card.innerHTML,/class="pill">With hints/);
      }else if(kind.includes("misplaced")){
        assert.match(card.innerHTML,/feedback recall-misplaced/);
        assert.match(card.innerHTML,/Recognized competency, wrong order/);
      }else assert.match(card.innerHTML,kind==="correct"?/feedback recall-unaided/:/feedback recall-assisted/);
      assert.doesNotMatch(announced,/\b(points?|score)\b/i);
      assert.doesNotMatch(card.innerHTML,/Next review:|You can keep practicing now/);
      if(kind==="hinted-correct")assert.match(card.innerHTML,/<h3>You got it!<\/h3>/);
      if(kind.includes("correct"))assert.ok(announced.includes(c.title));
      let repeatPrevented=false;
      next.onkeydown({key:"Enter",repeat:true,preventDefault:()=>{repeatPrevented=true;}});
      assert.equal(repeatPrevented,true);
      let freshPrevented=false;
      next.onkeydown({key:"Enter",repeat:false,preventDefault:()=>{freshPrevented=true;}});
      assert.equal(freshPrevented,false,"A separate Enter can activate Continue");
    }
  }
});
test("recall input consumes the submit Enter before focus moves to Continue",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const start=app.indexOf("form.onkeydown=event=>{");
  const handler=app.slice(start,app.indexOf("form.onsubmit=",start));
  let submissions=0,prevented=0;
  const input={},form={requestSubmit:()=>{submissions++;}};
  const sandbox={input,form};
  vm.createContext(sandbox);
  vm.runInContext(handler,sandbox);
  const event={key:"Enter",isComposing:false,repeat:false,target:input,preventDefault:()=>{prevented++;}};
  form.onkeydown(event);
  assert.equal(submissions,1);
  assert.equal(prevented,1);
  form.onkeydown({...event,repeat:true});
  assert.equal(submissions,1);
  assert.equal(prevented,2);
  form.onkeydown({...event,isComposing:true});
  form.onkeydown({...event,target:{}});
  assert.equal(submissions,1);
});
test("hint rerenders preserve caret, backward selection and horizontal input scroll",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const handler=app.slice(app.indexOf('document.querySelectorAll("[data-hint]")'),app.indexOf('document.querySelector("#reveal").onclick',app.indexOf('document.querySelectorAll("[data-hint]")')));
  for(const kind of ["letter","word","core"]){
    for(const range of [[13,13,"none"],[2,10,"backward"]]){
      const input={selectionStart:range[0],selectionEnd:range[1],selectionDirection:range[2],scrollLeft:27};
      const a={item:{id:"r1"},done:false,hints:0,hintWords:[0,0,0]},button={dataset:{hint:kind}};
      const calls=[],restored={focus:()=>calls.push("focus"),setSelectionRange:(...args)=>calls.push(args)};
      let hintCount=0;
      const sandbox={P,a,input,c:D.competencies[0],flow:{mode:"recall"},usageMode:()=>"titles",
        usage:{count:(mode,field)=>{assert.equal(mode,"titles");assert.equal(field,"hints");hintCount++;}},
        record:()=>{},renderRecall:()=>calls.push("render"),announce:()=>{},
        document:{querySelectorAll:()=>[button],querySelector:()=>restored}};
      vm.createContext(sandbox);vm.runInContext(handler,sandbox);button.onclick();
      assert.equal(a.hints,1);
      assert.equal(hintCount,1);
      assert.deepEqual(calls,["render","focus",range]);
      assert.equal(restored.scrollLeft,27);
      a.hintWords=[1,2,2];button.dataset.hint="core";button.onclick();
      assert.equal(a.hints,1,"Exhausted hints do not rerender or disturb selection");
      assert.equal(hintCount,1,"No-op hints do not emit analytics counts");
      assert.equal(calls.length,3);
    }
  }
});
test("programmatic focus keeps native controls and authored tab order intact",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const helper=app.slice(app.indexOf('function focus(selector'),app.indexOf('const normalizeTitle ='));
  for(const native of [true,false]){
    let attrs=0,focused=0,scrolled=0;
    const element={getClientRects:()=>[{}],matches:selector=>{
      for(const token of ["input","summary","button","a[href]","[tabindex]"])assert.ok(selector.includes(token));
      return native;
    },setAttribute:(name,value)=>{assert.equal(name,"tabindex");assert.equal(value,"-1");attrs++;},
    focus:()=>focused++,scrollIntoView:()=>scrolled++};
    const sandbox={main:{querySelectorAll:()=>[element]}};
    vm.createContext(sandbox);vm.runInContext(helper,sandbox);vm.runInContext('focus("target",true)',sandbox);
    assert.equal(attrs,native?0:1);assert.equal(focused,1);assert.equal(scrolled,1);
  }
});
test("external progress updates refresh idle results but preserve active drafts on conflicts",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const helper=app.slice(app.indexOf("function refreshStoredProgress("),app.indexOf("function storageError("));
  for(const open of [false,true]){
    for(const writing of [false,true]){
      const original={draft:"Keep my answer"},updated={practices:{}},calls=[];
      const sandbox={dialog:{open},flow:writing?original:null,state:original,returnView:{},session:{},active:{},reviewIndex:1,
        introMode:"recall",view:"home",saveFailed:false,load:()=>{calls.push("load");return updated;},
        storageError:text=>calls.push(text),renderHome:()=>calls.push("home"),focus:()=>calls.push("focus"),announce:()=>calls.push("announce")};
      vm.createContext(sandbox);vm.runInContext(helper,sandbox);vm.runInContext("refreshStoredProgress()",sandbox);
      if(open&&writing){
        assert.equal(sandbox.state,original);assert.equal(sandbox.flow,original);assert.equal(sandbox.saveFailed,true);
        assert.match(calls[0],/will not overwrite/);assert.equal(calls.length,1);
      }else{
        assert.equal(sandbox.state,updated);assert.equal(sandbox.returnView.stale,true);
        assert.equal(calls.includes("home"),!open);
        if(!open){assert.equal(sandbox.flow,null);assert.equal(sandbox.active,null);assert.equal(sandbox.session,null);}
      }
    }
  }
  assert.match(app,/event\.key===KEY \|\| event\.key===null/);
  assert.match(app,/if\(previous\.stale\)\{view="home";session=null;active=null;flow=null;reviewIndex=null;introMode=null;renderHome\(\);\}/);
});
test("saved answer review rejects removed or replaced rounds, including before a storage event",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const start=app.indexOf("reviewButton.onclick=()=>{"),end=app.indexOf('document.querySelector(".summary-actions").append',start);
  const handler=app.slice(start,end);
  for(const kind of ["missing","replaced","external","unavailable","valid"]){
    const saved={snapshot:{}},button={},calls=[];
    const sandbox={reviewButton:button,savedRound:kind==="missing"?undefined:saved,
      state:{practices:{recall:kind==="missing"?undefined:kind==="replaced"?{}:saved}},result:{mode:"recall"},reviewable:[0,1],
      KEY:"study",lastStored:"original",localStorage:{getItem:()=>{if(kind==="unavailable")throw Error("Unavailable");return kind==="external"?null:"original";}},
      refreshStoredProgress:()=>calls.push("refresh"),storageError:()=>calls.push("error"),openShell:()=>calls.push("open"),
      beginFlow:(_mode,round)=>{assert.equal(round.snapshot.reviewIndex,1);calls.push("begin");},
      viewAnswer:index=>{assert.equal(index,1);calls.push("review");},animatePracticeEntry:()=>calls.push("animate")};
    vm.createContext(sandbox);vm.runInContext(handler,sandbox);button.onclick();
    assert.deepEqual(calls,kind==="valid"?["open","begin","review","animate"]:kind==="unavailable"?["error"]:["refresh"]);
    assert.equal(saved.snapshot.reviewIndex,undefined,"Review uses a copy");
  }
});
test("returning to current feedback focuses visible selected response or recall Continue",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const helper=app.slice(app.indexOf("function resumeCurrent("),app.indexOf("function animateStudyNavigation("));
  for(const type of ["questions","recall"]){
    for(const done of [false,true]){
      const calls=[],sandbox={flow:{completed:false},finishPracticeEntry:null,reviewIndex:0,clockStarted:null,answerStarted:null,
        active:{done,item:{type}},session:{index:1},performance:{now:()=>100},
        renderStudy:()=>calls.push("render"),focusRecallContinue:()=>calls.push("continue"),
        focus:(selector,visible)=>{
          assert.equal(visible,true);
          assert.equal(selector,type==="questions"&&done?".answer-card.selected summary":"#recall-input,.scenario-prompt,#study-card h3");
          calls.push("selected-or-input");
        },
        animateStudyNavigation:()=>{},persist:()=>{},announce:text=>calls.push(text)};
      vm.createContext(sandbox);vm.runInContext(helper,sandbox);vm.runInContext("resumeCurrent()",sandbox);
      assert.equal(sandbox.reviewIndex,null);
      assert.equal(sandbox.answerStarted,done?null:100);
      assert.equal(calls[1],type==="recall"&&done?"continue":"selected-or-input");
      assert.equal(calls[2],"Returned to your current item.");
    }
  }
});
test("item navigation slides in the right direction, cancels stale motion and honors reduced motion",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const helper=app.slice(app.indexOf("function animateStudyNavigation("),app.indexOf("function examReview("));
  const animations=[],navigationMotion={matches:false};
  let cancelled=0,cardPresent=true;
  const card={animate:(frames,options)=>{animations.push({frames,options});return {cancel:()=>{cancelled++;}};}};
  const sandbox={studyTransition:null,finishPracticeEntry:null,practiceMotion:{duration:240,easing:"cubic-bezier(.22,.61,.36,1)"},navigationMotion,document:{querySelector:()=>cardPresent?card:null}};
  vm.createContext(sandbox);vm.runInContext(helper,sandbox);
  vm.runInContext("animateStudyNavigation(0,1)",sandbox);
  assert.equal(animations[0].frames[0].transform,"translateX(40px)");
  assert.equal(animations[0].frames[1].transform,"translateX(0)");
  assert.equal(animations[0].options.duration,240);
  assert.match(animations[0].options.easing,/cubic-bezier/);
  vm.runInContext("animateStudyNavigation(2,0)",sandbox);
  assert.equal(cancelled,1);
  assert.equal(animations[1].frames[0].transform,"translateX(-40px)");
  vm.runInContext("animateStudyNavigation(0,0)",sandbox);
  assert.equal(cancelled,2);
  assert.equal(animations.length,2);
  navigationMotion.matches=true;
  vm.runInContext("animateStudyNavigation(0,1)",sandbox);
  assert.equal(animations.length,2);
  navigationMotion.matches=false;cardPresent=false;
  vm.runInContext("animateStudyNavigation(0,1)",sandbox);
  assert.equal(animations.length,2);
  assert.match(app,/studyTransition\?\.cancel\(\);finishPracticeEntry\?\.\(\);finishShellClose\?\.\(\)/);
});
test("study toolbar keeps Back, Pass/Next and Submit/Continue/Return in fixed slots",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const renderer=app.slice(app.indexOf("function updateShell("),app.indexOf("function viewAnswer("));
  function toolbar({index=3,reviewIndex=null,done=false,questions=false,completed=false}={}){
    const node=()=>({attributes:{},setAttribute(key,value){this.attributes[key]=value;}});
    const dock={children:[],classList:{toggle:()=>{}},replaceChildren(){this.children=[];},append(b){this.children=this.children.filter(child=>child!==b);this.children.push(b);}};
    const header={children:[],replaceChildren(){this.children=[];},append(b){this.children.push(b);}};
    const form={id:"recall-form"},submit={...node(),type:"submit",closest:()=>form};
    const pass={...node(),id:"reveal",type:"button"},next={...node(),id:"next-item",textContent:"Continue",type:"button"};
    const controls={"#study-dock":dock,".study-head-actions":header,"#study-mode":node(),"#close-study":node(),"#study-position":node()};
    const sandbox={main:{querySelector:()=>null,querySelectorAll:()=>reviewIndex!==null || questions?[]:done?[next]:[submit,pass],prepend:()=>{}},
      dialog:{open:true,setAttribute:()=>{}},flow:{mode:questions?"questions":"recall",completed},introMode:null,view:questions?"questions":"recall",
      modeNames:{recall:"Core competency recall",questions:"Questions"},modalStarted:true,introBrand:{},session:{index,items:[1,2,3,4],roundEnd:4,answers:Object.fromEntries(Array.from({length:index},(_,i)=>[i,{}]))},
      reviewIndex,active:{done,item:{type:questions?"questions":"recall"}},finishPracticeEntry:null,answerStarted:null,performance:{now:()=>1},
      isReview:()=>reviewIndex!==null,elapsed:()=>12000,P,stash:()=>{},syncUsage:()=>{},viewAnswer:()=>{},resumeCurrent:()=>{},
      document:{querySelector:s=>controls[s],createElement:()=>node()}};
    vm.createContext(sandbox);vm.runInContext(renderer,sandbox);vm.runInContext("updateShell()",sandbox);
    return {dock,header,submit};
  }
  const current=toolbar();
  assert.equal(current.dock.children[0].id,"review-previous");
  assert.equal(current.dock.children[1].id,"reveal");
  assert.equal(current.dock.children[2],current.submit,"Tab order follows the visible left-to-right slots");
  assert.equal(current.submit.textContent,"Submit");
  assert.equal(current.header.children[0].id,"practice-time");
  assert.equal(current.header.children[0].attributes.role,"timer");
  assert.equal(current.header.children[0].attributes["aria-live"],"off");
  assert.equal(current.dock.children.some(b=>b.id==="practice-time"),false);
  for(const [reviewIndex,back,next] of [[2,true,false],[1,true,true],[0,false,true]]){
    const {dock}=toolbar({reviewIndex});
    assert.equal(!dock.children.find(b=>b.id==="review-previous").hidden,back);
    assert.equal(dock.children.some(b=>b.id==="review-next"),next);
    assert.equal(dock.children.find(b=>b.id==="review-return").textContent,"Return >>");
  }
  assert.equal(toolbar({index:0}).dock.children.find(b=>b.id==="review-previous").hidden,true);
  assert.equal(toolbar({done:true}).dock.children.find(b=>b.id==="next-item").textContent,"Continue");
  assert.equal(toolbar({questions:true}).dock.children.find(b=>b.textContent==="Choose a response").disabled,true);
  assert.equal(toolbar({reviewIndex:2,completed:true}).dock.children.find(b=>b.id==="review-return").textContent,"Back to results");
  const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
  assert.match(css,/#study-dock\.item-navigation\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/#study-dock\.item-navigation>#review-previous\{grid-column:1\}/);
  assert.match(css,/#study-dock\.item-navigation>#reveal,#study-dock\.item-navigation>#review-next\{grid-column:2\}/);
  assert.doesNotMatch(app,/append\(theme\)/);
});
test("lifecycle motion excludes entry time and safely completes downward closure exactly once",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const helpers=app.slice(app.indexOf("function animatePracticeEntry("),app.indexOf("function recordCompletion("));
  const animations=[],navigationMotion={matches:false};
  let now=100,closed=0,restored=0;
  const animate=(frames,options)=>{const a={frames,options,cancelled:false,cancel(){this.cancelled=true;}};animations.push(a);return a;};
  const dialog={open:true,inert:false,animate,close(){this.open=false;closed++;}};
  const sandbox={dialog,navigationMotion,practiceMotion:{duration:240,easing:"cubic-bezier(.22,.61,.36,1)"},
    entryTransition:null,studyTransition:null,finishPracticeEntry:null,finishShellClose:null,
    flow:null,active:null,clockStarted:null,answerStarted:null,performance:{now:()=>now},isReview:()=>false,syncUsage:()=>{},
    document:{querySelector:()=>({animate}),body:{classList:{remove:()=>{}}}},main:{},moved:[],homeAnchor:{after:()=>{}},
    pause:()=>{sandbox.clockStarted=null;sandbox.answerStarted=null;},afterClose:()=>{restored++;}};
  vm.createContext(sandbox);vm.runInContext(helpers,sandbox);
  vm.runInContext('animatePracticeEntry("intro")',sandbox);
  assert.equal(animations[0].frames[0].transform,"translateY(40px)");
  const oldFinish=animations[0].onfinish;
  sandbox.flow={completed:false};sandbox.active={done:false};sandbox.clockStarted=100;sandbox.answerStarted=100;
  vm.runInContext('animatePracticeEntry("start")',sandbox);
  assert.equal(animations[0].cancelled,true);
  assert.equal(animations[1].frames[0].transform,"translateX(40px)");
  assert.equal(sandbox.clockStarted,null);
  assert.equal(sandbox.answerStarted,null);
  oldFinish();
  assert.equal(sandbox.clockStarted,null,"A stale entry completion cannot restart clocks");
  now=340;animations[1].onfinish();
  assert.equal(sandbox.clockStarted,340);
  assert.equal(sandbox.answerStarted,340);
  vm.runInContext("closeShell(afterClose)",sandbox);
  assert.equal(dialog.inert,true);
  assert.equal(closed,0);
  assert.equal(restored,0);
  assert.equal(animations[2].frames[1].transform,"translateY(40px)");
  const finishClose=animations[2].onfinish;
  finishClose();finishClose();
  assert.equal(closed,1);
  assert.equal(restored,1);
  assert.equal(dialog.inert,false);
  dialog.open=true;
  vm.runInContext("closeShell(afterClose)",sandbox);
  const staleClose=animations[3].onfinish;
  sandbox.finishShellClose();
  dialog.open=true;
  staleClose();
  assert.equal(dialog.open,true,"An old completion cannot dismiss a reopened practice");
  navigationMotion.matches=true;
  vm.runInContext("closeShell(afterClose)",sandbox);
  assert.equal(closed,3);
  assert.equal(restored,3);
  assert.equal(animations.length,4,"Reduced-motion closure is immediate");
});
test("C3 consolation summaries distinguish wrong order in recall, Mixed and evidenced legacy review",()=>{
  const response={c:3,type:"recall",matched:false,revealed:false,misplacedC:2,outcome:"missed",seconds:2,score:1,scoreVersion:1};
  for(const mode of ["recall","mixed"]){
    for(const outcome of ["missed","assisted"]){
      const result={mode,completed:false,elapsedMs:2000,responses:[{...response,outcome}],snapshot:{}};
      const html=summaryMarkup(result);
      assert.match(html,/C3\. Establishes and Maintains Agreements/);
      assert.match(html,/Recognized competency, wrong order/);
      assert.match(html,/You named C2\. Embodies a Coaching Mindset\. This position is C3\./);
      assert.match(html,/Name recall practice score: 1 \/ 10/);
      assert.doesNotMatch(html,/Wrong \/ passed/);
      if(outcome==="assisted")assert.match(html,/>With hints</);
      const reloaded=summaryMarkup(JSON.parse(JSON.stringify(result)));
      assert.equal(reloaded,html);
    }
  }
  const legacy={...response};delete legacy.misplacedC;
  const base={mode:"recall",completed:false,elapsedMs:2000,responses:[legacy],snapshot:{}};
  assert.match(summaryMarkup(base),/Wrong \/ passed/);
  assert.doesNotMatch(summaryMarkup(base),/Recognized competency, wrong order/);
  const answer={item:{id:"r3",type:"recall",c:3},matched:false,revealed:false,attempt:D.competencies[1].title};
  assert.match(summaryMarkup({...base,snapshot:{session:{answers:{0:answer}}}}),/Recognized competency, wrong order/);
  assert.equal(legacy.score,1,"Display evidence does not rescore a historical result");
  for(const row of [{...response,misplacedC:undefined,matched:true,outcome:"assisted",score:6},
    {...response,misplacedC:undefined,revealed:true,outcome:"assisted",score:0}]){
    const clean={...row};delete clean.misplacedC;
    const html=summaryMarkup({...base,responses:[clean]});
    assert.doesNotMatch(html,/Recognized competency, wrong order/);
    assert.match(html,clean.matched?/Used hints/:/Wrong \/ passed/);
  }
});
test("whole-number recall percentage stays by the completed heading and uses saved earned scores",()=>{
  const scores=[10,6,4,3,2,1,1,0];
  const result={mode:"recall",completed:true,elapsedMs:1000,
    responses:D.competencies.map((c,i)=>({c:c.id,type:"recall",outcome:"unaided",matched:true,revealed:false,seconds:1,score:scores[i]})),snapshot:{}};
  const html=summaryMarkup(result);
  assert.match(html,/<p class="recall-total"><strong>34%<\/strong><span>Recall points earned<\/span><\/p>/);
  assert.ok(html.indexOf('class="recall-total"')<html.indexOf('class="summary-actions'));
  assert.equal(summaryMarkup(JSON.parse(JSON.stringify(result))),html);
  for(const patch of [{completed:false},{mode:"mixed"},{responses:result.responses.map((r,i)=>i===0?{...r,score:undefined}:r)}]){
    assert.doesNotMatch(summaryMarkup({...result,...patch}),/class="recall-total"/);
  }
});
test("recall and Mixed summaries give Pass and incorrect guesses error priority over hints",()=>{
  for(const mode of ["recall","mixed"]){
    for(const row of [
      {matched:false,revealed:true,outcome:"assisted",hintCount:0,expected:"missed"},
      {matched:false,revealed:true,outcome:"assisted",hintCount:2,expected:"missed"},
      {matched:false,revealed:false,outcome:"assisted",hintCount:2,expected:"missed"},
      {matched:true,revealed:false,outcome:"assisted",hintCount:2,expected:"assisted"},
      {matched:true,revealed:false,outcome:"unaided",hintCount:0,expected:"unaided"}]){
      const response={c:4,type:"recall",seconds:1,...row};
      const html=summaryMarkup({mode,completed:false,elapsedMs:1000,responses:[response],snapshot:{}});
      assert.match(html,new RegExp(`competency-stat  recall-${row.expected}`));
      if(row.expected==="missed")assert.match(html,/Wrong \/ passed/);
      else assert.doesNotMatch(html,/Wrong \/ passed/);
    }
  }
});
test("shared study summaries put actions before totals and hide unfinished recall names",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const renderer=app.slice(app.indexOf("function renderSummary("),app.indexOf("function updateShell("));
  for(const mode of ["recall","questions","mixed"]){
    for(const completed of [false,true]){
      const main={innerHTML:""},controls=new Map();
      const sandbox={P,D,main,state:{exam:null},active:completed?null:{item:{type:"recall",c:2},attempt:"",hints:0,done:false},
        modeNames:{recall:"Core competency recall",questions:"Questions",mixed:"Mixed practice"},
        titleLabel:c=>`C${c.id}. ${c.title}`,escape:value=>value,coffee:{eligible:()=>false},
        updateNavigation:()=>{},focus:()=>{},
        document:{querySelector:selector=>{
          if(selector==="#dismiss-coffee")return null;
          if(!controls.has(selector))controls.set(selector,{});
          return controls.get(selector);
        }}};
      vm.createContext(sandbox);
      vm.runInContext(renderer,sandbox);
      sandbox.result={mode,completed,elapsedMs:0,responses:[],snapshot:{session:{index:0}}};
      vm.runInContext("renderSummary(result)",sandbox);
      const html=main.innerHTML;
      for(const id of ["resume-practice","summary-home"]){
        assert.ok(html.indexOf(`id="${id}"`)<html.indexOf('class="summary-totals"'));
        assert.equal((html.match(new RegExp(`id="${id}"`,"g")) || []).length,1);
      }
      assert.match(html,/Stats by competency/);
      assert.match(html,/<svg[^>]+aria-hidden="true"[^>]+focusable="false"/);
      assert.match(html,completed?/Start a new round/:/Resume /);
      if(!completed)assert.match(html,/<h3>C2<\/h3>/,"Unfinished recall stays concealed, including in Mixed");
    }
  }
  assert.match(app,/document\.querySelector\("\.tabs"\)\.hidden=view==="home";/);
  const selector=app.slice(app.indexOf("const selector=view"),app.indexOf("main.querySelectorAll(selector)"));
  assert.match(selector,/#recall-form button\[type="submit"\],#reveal/);
  assert.doesNotMatch(selector,/data-hint|#hint/);
});
