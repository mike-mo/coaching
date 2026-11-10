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
  assert.match(home,/Try to name each from memory\. First letter, Next word and Core word offer clues; Pass shows the full name\./);
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
test("written practice clearly scopes the exercise and names both official exam routes",()=>{
  const c={window:{}};
  vm.runInNewContext(readFileSync(new URL("../content.js",import.meta.url),"utf8"),c);
  vm.runInNewContext(readFileSync(new URL("../exam.js",import.meta.url),"utf8"),c);
  const D=c.window.STUDY,E=c.window.EXAM;
  assert.equal(D.writingScope,"A memory and self-explanation exercise, not an ICF exam simulation. Only exact names and order are checked; you review your summaries.");
  assert.equal(D.examGuidance[0].label,"ACC exam guidance");
  assert.equal(D.examGuidance[0].url,"https://coachingfederation.org/credentialing/icf-credential-exams/acc-exam/");
  assert.equal(D.examGuidance[1].label,"PCC-MCC exam transition guidance");
  assert.equal(D.examGuidance[1].url,"https://coachingfederation.org/blog/candidates-guide-to-updated-credentialing-exam/");
  const guidance=E.guidance(value=>value);
  assert.equal((guidance.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,2);
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const source=readFileSync(new URL("../exam.js",import.meta.url),"utf8");
  assert.match(app,/>Written practice<\/h2>/);
  assert.match(app,/>2025 COMPETENCY STUDY<\/span><h3>Written competency rehearsal<\/h3>/);
  assert.match(app,/Start written rehearsal/);
  assert.doesNotMatch(source,/>Exam practice<|>Exam rehearsal<|Core competency exam rehearsal/);
  assert.match(source,/icf-written-competency-rehearsal\.txt/);
  assert.match(source,/\["Written competency rehearsal",D\.writingScope/);
});
test("intro-only close restores prior view without saving or summarizing",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const close=app.slice(app.indexOf("function closeStudy("),app.indexOf("function renderSummary("));
  const initial=close.slice(close.indexOf("if(!modalStarted"),close.indexOf("if(flow)"));
  assert.match(initial,/replaceChildren\(previous\.nodes\)/);
  assert.match(initial,/focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(initial,/save\(|renderSummary|usage/);
});
