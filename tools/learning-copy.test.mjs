import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {createHash} from "node:crypto";

const sandbox = {window:{}};
runInNewContext(readFileSync(new URL("../content.js", import.meta.url), "utf8"), sandbox);
const D = sandbox.window.STUDY;

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
    "b859b400930beb592171beb0675849c4da0258f0cef57861448ee70ff2094111");
});
test("only records and technology scenarios add separately numbered ethics references",()=>{
  const cited=D.questions.filter(q=>q.ethicsRefs);
  assert.deepEqual(Array.from(cited,q=>[q.id,Array.from(q.ethicsRefs)]),[
    ["case-summary-tool",["2.4","2.5"]],["case-learning-tool",["2.5"]]
  ]);
});
