import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const context={window:{}};
vm.runInNewContext(readFileSync(new URL("../practice.js",import.meta.url),"utf8"),context);
vm.runInNewContext(readFileSync(new URL("../content.js",import.meta.url),"utf8"),context);
const P=context.window.PRACTICE,D=context.window.STUDY;
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
