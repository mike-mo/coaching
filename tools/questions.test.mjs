import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL("../content.js", import.meta.url), "utf8"), context);
const data = context.window.STUDY;
const maximum = { 1: 7, 2: 10, 3: 12, 4: 6, 5: 7, 6: 6, 7: 11, 8: 9 };
function refs(c, values) {
  assert.ok(Array.isArray(values) && values.length > 0);
  assert.equal(new Set(values).size, values.length);
  for (const value of values) {
    assert.match(value, /^\d\.\d{2}$/);
    const [parent, number] = value.split(".").map(Number);
    assert.equal(parent, c);
    assert.ok(number >= 1 && number <= maximum[c], value);
    assert.ok(data.subcompetencies[value]?.length > 20, `Full official wording for ${value}`);
  }
}

test("eight source-verified official titles and definitions remain unchanged", () => {
  const digest = createHash("sha256").update(JSON.stringify(data.competencies.map(c => [c.title, c.definition]))).digest("hex");
  assert.equal(digest, "de8ffd855b29152a935ebca375bdecd80d9329c86b6eafaede8487ab02d30895");
  assert.deepEqual(Array.from(data.competencies, c => c.id), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("referenced official sub-competency wording matches the PDF-verified text", () => {
  assert.equal(Object.keys(data.subcompetencies).length,61);
  assert.equal(createHash("sha256").update(JSON.stringify(data.subcompetencies)).digest("hex"),
    "65c23f92749d7489ed1ed120a99f1367edbce75d38bdac449ceca532484a1f86");
});

test("32 differentiated scenarios cover each primary competency four times with stable new IDs", () => {
  assert.equal(data.questions.length, 32);
  for (const property of ["id", "label", "prompt"]) {
    assert.equal(new Set(data.questions.map(q => q[property].toLowerCase().replace(/\s+/g, " "))).size, 32, property);
  }
  for (const c of data.competencies) assert.equal(data.questions.filter(q => q.c === c.id).length, 4);
  for (const q of data.questions) {
    assert.match(q.id, /^case-[a-z-]+$/);
    assert.doesNotMatch(q.id, /^q[1-8]$/);
    assert.ok(q.prompt.length > 100 && q.takeaway.length > 30);
  }
});

test("every item has exactly four authored choices and an unambiguous strongest key", () => {
  const positions = [0, 0, 0, 0];
  for (const q of data.questions) {
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options.map(o => o[0])).size, 4, q.id);
    assert.equal(q.options.filter(o => o[2] === "strongest").length, 1, q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    assert.equal(q.options[q.answer][2], "strongest", q.id);
    for (const option of q.options) {
      assert.equal(option.length, 3);
      assert.ok(option[0].length > 15 && option[1].length > 40);
      assert.ok(["strongest", "reasonable", "less"].includes(option[2]));
    }
    positions[q.answer]++;
  }
  assert.deepEqual(positions, [8, 8, 8, 8]);
  assert.ok(data.questions.some(q => !q.options.some(o => o[2] === "reasonable")), "No forced reasonable credit");
});

test("primary and reinforcing citations refer to real 2025 sub-competencies", () => {
  for (const q of data.questions) {
    refs(q.c, q.refs);
    for (const other of q.also || []) { assert.notEqual(other.c, q.c); refs(other.c, other.refs); }
  }
  for (const [c, examples] of Object.entries(data.examExamples)) for (const example of examples) refs(Number(c), example.refs);
  for (const node of Object.values(data.scenario.nodes)) refs(node.c, node.refs);
});

test("question feedback stays conditional and all four classifications have rationale rows", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const question = app.slice(app.indexOf("function renderQuestion()"), app.indexOf("function nextItem()"));
  assert.match(question, /a\.done\?`<details class="review-question"/);
  assert.match(question, /"ABCD"\[position\]/);
  assert.match(question, /class="answer-card/);
  assert.match(question, /What competency is at play/);
  assert.match(question, /class="rationale-panel"><hr>/);
  assert.doesNotMatch(question, /:citation\(q\.c/);
  assert.match(app, /outcome === "reasonable"/);
  assert.match(app, /legacyQuestionIds/);
});
