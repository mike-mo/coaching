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
test("correctness dominates; bonus is capped at four seconds and zero at 64",()=>{
  for(const t of [0,1,4]){assert.equal(P.points("recognition",t),100);assert.equal(P.points("reasonable",t),90);}
  assert.equal(P.points("recognition",34),95);assert.equal(P.points("reasonable",34),85);
  for(const t of [64,1000]){assert.equal(P.points("recognition",t),90);assert.equal(P.points("reasonable",t),80);}
  for(const t of [0,4,34,64,1000])assert.equal(P.points("missed",t),0);
  for(const t of [-1,NaN,Infinity])assert.throws(()=>P.points("recognition",t));
  assert.throws(()=>P.points("made-up",1));
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
});
