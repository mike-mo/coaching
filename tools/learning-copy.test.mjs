import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {createHash} from "node:crypto";

const sandbox = {window:{}};
runInNewContext(readFileSync(new URL("../content.js", import.meta.url), "utf8"), sandbox);
const D = sandbox.window.STUDY;

test("Mixed description refers to the activities above only on Home",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const description="A mix of both exercises above: competency-name practice and coaching scenarios, with eight exercises per round.";
  const introduction="A mix of competency-name practice (01) and coaching scenarios (02), with eight exercises per round.";
  assert.equal(app.split(description).length-1,1);
  assert.match(app,/01 \/ CORE COMPETENCIES/);
  assert.match(app,/02 \/ QUESTIONS/);
  assert.ok(app.includes(`<p class="muted">${description}</p>`));
  assert.ok(app.includes('mode==="mixed"?`'+introduction));
  assert.doesNotMatch(app,/Eight items across all competencies, mixing names and questions/);
});

test("all question and conversation explanations stay in the coaching context", () => {
  const options = D.questions.flatMap(q => q.options);
  assert.equal(D.questions.length, 32);
  assert.equal(options.length, 128);
  const reasons = options.map(o => o[1]).concat(D.questions.map(q => q.takeaway),
    Object.values(D.scenario.nodes).flatMap(n => n.choices.map(c => c.reason)));
  for (const reason of reasons) {
    assert.doesNotMatch(reason, /\b(?:credits?|scores?|scoring|rubrics?|bonuses?|maxim(?:ize|izing|isation|ization))\b|\b(?:earn(?:s|ed|ing)?|award(?:s|ed)?)\s+points?\b/i);
  }
});

test("official quotations, sources, option text, keys and conversation remain unchanged", () => {
  const structure = {source:D.source,version:D.version,examInstruction:D.examInstruction,
    subcompetencies:D.subcompetencies,competencies:D.competencies,
    questions:D.questions.map(({ethicsRefs,...q}) => ({...q,options:q.options.map(o => [o[0],o[2]])})),scenario:D.scenario};
  assert.equal(createHash("sha256").update(JSON.stringify(structure)).digest("hex"),
    "3e9cdccf05e442b038a7c691450f92130e6985befe839a4cffc7da66011ef926");
});
test("accountability prompt uses plain progress-update wording without changing its meaning",()=>{
  assert.equal(D.questions.find(q=>q.id==="case-client-accountability").prompt,
    "A client has chosen a small experiment and says giving the coach formal progress updates makes them focus on pleasing the coach. They would prefer to reflect privately on what they learn. How should the coach respond?");
  assert.doesNotMatch(D.questions.find(q=>q.id==="case-client-accountability").prompt,/report-backs/);
});
test("only records and technology scenarios add separately numbered ethics references",()=>{
  const cited=D.questions.filter(q=>q.ethicsRefs);
  assert.deepEqual(Array.from(cited,q=>[q.id,Array.from(q.ethicsRefs)]),[
    ["case-summary-tool",["2.4","2.5"]],["case-learning-tool",["2.5"]]
  ]);
});
