import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const context={window:{}};
vm.runInNewContext(readFileSync(new URL("../exam.js",import.meta.url),"utf8"),context);
const E=context.window.EXAM;
const startedAt=1762000000000;
test("competency labels separate identifiers without changing official names",()=>{
  const c={id:1,title:"Demonstrates Ethical Practice"};
  assert.equal(E.titleLabel(c),"C1. Demonstrates Ethical Practice");
  assert.equal(E.titleLabel(c,"DEMOnstrates Ethical Practice"),"C1. DEMOnstrates Ethical Practice");
  assert.equal(c.title,"Demonstrates Ethical Practice");
});
const attempt=(mode,status="draft")=>({mode,status,startedAt,deadline:mode==="timed"?startedAt+7200000:null,
  finishedAt:status==="draft"?null:startedAt+7200000,answers:Array.from({length:8},(_,i)=>({title:`Saved name ${i+1}`,bullets:["first","second","third"]}))});
test("legacy timed and untimed drafts retain every answer during elapsed migration",()=>{
  for(const mode of ["timed","untimed"]){
    const old=attempt(mode),converted=E.migrate(old,12345);
    assert.equal(E.validAttempt(old),true);assert.equal(E.validAttempt(converted),true);
    assert.equal(converted.mode,"elapsed");assert.equal(converted.deadline,null);assert.equal(converted.status,"draft");
    assert.equal(converted.elapsedMs,12345);assert.deepEqual(converted.answers,old.answers);
    assert.equal(old.mode,mode);
  }
});
test("completed and expired legacy passes stay completed and keep finish timestamps",()=>{
  for(const status of ["submitted","expired"]){
    const old=attempt("timed",status),converted=E.migrate(old);
    assert.equal(E.validAttempt(old),true);assert.equal(E.validAttempt(converted),true);
    assert.equal(converted.status,"submitted");assert.equal(converted.finishedAt,old.finishedAt);
    assert.deepEqual(converted.answers,old.answers);assert.equal(converted.elapsedMs,0);
  }
});
test("elapsed metadata is validated without weakening legacy validation",()=>{
  const valid={...attempt("untimed"),mode:"elapsed",elapsedMs:123};
  assert.equal(E.validAttempt(valid),true);assert.equal(E.migrate(valid),valid);
  for(const elapsedMs of [undefined,-1,Infinity,NaN,"123"])assert.equal(E.validAttempt({...valid,elapsedMs}),false);
  assert.equal(E.validAttempt({...valid,deadline:startedAt+7200000}),false);
  assert.equal(E.validAttempt({...attempt("timed"),deadline:null}),false);
  assert.equal(E.validAttempt({...valid,answers:[]}),false);
});
test("public entry points hide conversation and preserve exact requested home copy",()=>{
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const home=app.slice(app.indexOf("function renderHome()"),app.indexOf("function startSession("));
  assert.doesNotMatch(html,/data-view="scenario"/);
  assert.doesNotMatch(home,/data-start="scenario"|Start conversation|03 \/ CONVERSATION/);
  assert.match(home,/01 \/ CORE COMPETENCIES/);
  assert.match(home,/Try to name each from memory, use a hint to show one word at a time, or choose Pass to see the full name\./);
  assert.match(home,/>Practice Core Competencies<\/button>/);
  assert.match(app,/Sources for this conversation/);
});
test("exam instructions distinguish exact names from three-sentence summaries",()=>{
  const c={window:{}};
  vm.runInNewContext(readFileSync(new URL("../content.js",import.meta.url),"utf8"),c);
  assert.equal(c.window.STUDY.examInstruction,
    "Write the names of all eight core competencies exactly, in order, then summarize each in three sentences in your own words. After another rehearsal, you can compare your answers with your previous answers.");
  const source=readFileSync(new URL("../exam.js",import.meta.url),"utf8");
  assert.match(source,/Sentence \$\{j\+1\}/);
  assert.match(source,/escape\(D\.examInstruction\)/);
  assert.doesNotMatch(source,/add three points|Use a timer\?/);
});
test("intro-only close restores prior view without saving or summarizing",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const close=app.slice(app.indexOf("function closeStudy()"),app.indexOf("function renderSummary("));
  const initial=close.slice(close.indexOf("if(!modalStarted"),close.indexOf("if(flow)"));
  assert.match(initial,/replaceChildren\(previous\.nodes\)/);
  assert.match(initial,/focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(initial,/save\(|renderSummary|usage/);
});
