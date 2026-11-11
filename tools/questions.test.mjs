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
  assert.equal(data.examExamples, undefined);
  for (const [c, references] of Object.entries(data.examReferences)) refs(Number(c), references);
  for (const node of Object.values(data.scenario.nodes)) refs(node.c, node.refs);
});

test("question feedback stays conditional and all four classifications have rationale rows", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const question = app.slice(app.indexOf("function renderQuestion("), app.indexOf("function nextItem()"));
  assert.match(question, /a\.done\?`<details class="review-question"/);
  assert.match(question, /"ABCD"\[position\]/);
  assert.match(question, /class="answer-card/);
  assert.match(question, /Bonus exercise: which competencies and markers are at play\?/);
  assert.match(question, /class="bonus-invitation-help">Think it through, then expand to review\./);
  assert.match(question, /class="rationale-panel"><hr>/);
  assert.doesNotMatch(question, /:citation\(q\.c/);
  assert.match(app, /outcome === "reasonable"/);
  assert.match(app, /legacyQuestionIds/);
});

test("Questions and mixed feedback retain every displayed option position in saved review", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const renderer = app.slice(app.indexOf("function renderQuestion("), app.indexOf("function nextItem()"));
  for (const mode of ["questions", "mixed"]) {
    for (const order of [[2, 0, 3, 1], [1, 3, 0, 2]]) {
      for (const selected of order) {
        const q = data.questions[0], card = { innerHTML: "" }, body = { scrollTop: 200 };
        let buttons = [], writes = 0, records = 0;
        const a = { item: { id: q.id, type: "questions", c: q.c }, optionOrder: order, selected: null, done: false };
        const sandbox = {
          D: data, active: a, reviewIndex: null, session: { type: mode, answers: {} },
          comp: id => data.competencies.find(c => c.id === id),
          escape: value => String(value), titleLabel: c => c.title, citation: () => "",
          updateShell: () => {}, persist: () => {}, nextItem: () => {},
          noteActive: () => { writes++; }, record: () => { records++; }, announce: () => {},
          focus: () => { assert.equal(body.scrollTop, 0, "Reset scroll before bringing the selected summary into view"); },
          document: {
            querySelector: selector => selector === "#study-card" ? card : selector === "#study-body" ? body : selector === "#next-item" ? {} : null,
            querySelectorAll: () => {
              buttons = a.done ? [] : order.map(i => ({ dataset: { option: String(i) } }));
              return buttons;
            }
          }
        };
        vm.createContext(sandbox);
        vm.runInContext(app.slice(app.indexOf("const officialReferences ="),app.indexOf("const announce =")),sandbox);
        vm.runInContext("setupBonusSources=()=>{}",sandbox);
        vm.runInContext(renderer, sandbox);
        const displayedOrder = () => Array.from(card.innerHTML.matchAll(/data-(?:option|answer)="(\d)"/g), match => Number(match[1]));
        const letters = () => Array.from(card.innerHTML.matchAll(/class="letter">([A-D])/g), match => match[1]);
        vm.runInContext("renderQuestion()", sandbox);
        assert.deepEqual(displayedOrder(), order);
        const beforeLetters = letters();
        assert.doesNotMatch(card.innerHTML,/class="competency-reference"/);
        const submit = buttons.find(b => Number(b.dataset.option) === selected).onclick;
        submit();
        assert.deepEqual(displayedOrder(), order);
        assert.deepEqual(letters(), beforeLetters);
        assert.match(card.innerHTML, /options feedback-enter/);
        assert.equal((card.innerHTML.match(/Your choice/g) || []).length, 1);
        assert.match(card.innerHTML, new RegExp(`selected" data-answer="${selected}"`));
        assert.equal((card.innerHTML.match(/class="rationale-panel"/g) || []).length, 4);
        const reflection=card.innerHTML.indexOf('<details class="competency-reference">');
        const strongest=card.innerHTML.indexOf(`data-answer="${q.answer}"`);
        assert.ok(reflection>strongest);
        const strongestBody=card.innerHTML.slice(strongest,reflection);
        assert.doesNotMatch(strongestBody,/<\/details>/,"Reflection belongs inside the strongest explanation, not a later card");
        assert.ok(strongestBody.includes(q.options[q.answer][1]));
        assert.equal((card.innerHTML.match(/class="competency-reference"/g) || []).length,1);
        assert.doesNotMatch(card.innerHTML,/<details class="competency-reference"[^>]*open/);
        assert.match(card.innerHTML,/<summary><span>Bonus exercise: which competencies and markers are at play\?<\/span><span class="bonus-invitation-help">Think it through, then expand to review\.<\/span><\/summary>/);
        assert.doesNotMatch(card.innerHTML,/Official definition|class="definition-label"/);
        assert.ok(card.innerHTML.includes(`<blockquote class="competency-definition">${data.competencies.find(c=>c.id===q.c).definition}</blockquote>`));
        for(const entry of [{c:q.c,refs:q.refs},...(q.also || [])]){
          assert.ok(card.innerHTML.includes(`id="bonus-source-${entry.c}" class="source-info-panel" popover="auto" role="dialog"`));
          assert.ok(card.innerHTML.includes(`PDF p. ${entry.c+2}`));
          assert.ok(card.innerHTML.includes(data.source));assert.ok(card.innerHTML.includes(data.version));
          for(const ref of entry.refs)assert.ok(card.innerHTML.includes(`<li><strong>${ref}</strong> ${data.subcompetencies[ref]}</li>`));
        }
        assert.equal(a.outcome, q.options[selected][2] === "strongest" ? "recognition" : q.options[selected][2] === "reasonable" ? "reasonable" : "missed");
        submit();
        assert.equal(writes, 1);
        assert.equal(records, 1, "Answers remain locked");
        sandbox.session.answers[0] = JSON.parse(JSON.stringify(a));
        sandbox.reviewIndex = 0;
        vm.runInContext("renderQuestion()", sandbox);
        assert.deepEqual(displayedOrder(), order);
        assert.deepEqual(letters(), beforeLetters);
        assert.doesNotMatch(card.innerHTML, /feedback-enter|data-option=/);
        assert.equal((card.innerHTML.match(/class="competency-reference"/g) || []).length,1);
        sandbox.reviewIndex = null;
        vm.runInContext("renderQuestion()", sandbox);
        assert.doesNotMatch(card.innerHTML, /feedback-enter/, "Resumed feedback does not replay motion");
      }
    }
  }
});
test("bonus source controls keep compact visible text, accessible metadata and original citations elsewhere",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8"),sandbox={D:data,
    escape:value=>String(value),comp:id=>data.competencies.find(c=>c.id===id),titleLabel:c=>`C${c.id}. ${c.title}`};
  vm.createContext(sandbox);
  vm.runInContext(app.slice(app.indexOf("const officialReferences ="),app.indexOf("const announce =")),sandbox);
  for(const c of data.competencies){
    const ref=Object.keys(data.subcompetencies).find(ref=>ref.startsWith(`${c.id}.`));
    sandbox.c=c;sandbox.ref=ref;
    const heading=vm.runInContext("bonusHeading(c.id,[ref])",sandbox);
    assert.ok(heading.includes(`<h3>C${c.id}. ${c.title}</h3>`));
    assert.ok(heading.includes(`aria-label="Source information for C${c.id}. ${c.title}"`));
    assert.match(heading,/aria-haspopup="dialog" aria-expanded="false" aria-controls="bonus-source-/);
    assert.match(heading,/Official ICF competency resource \(opens a new tab\)/);
    assert.match(heading,/class="source-info-close">Close source information/);
    assert.ok(heading.includes(`PDF p. ${c.id+2}`));
    const old=vm.runInContext("citation(c.id,[ref])",sandbox);
    assert.ok(old.includes(`"${data.subcompetencies[ref]}"`),"Non-bonus citation formatting is unchanged");
    const compact=vm.runInContext("officialReferences([ref],false)",sandbox);
    assert.equal(compact,`<ul class="official-references"><li><strong>${ref}</strong> ${data.subcompetencies[ref]}</li></ul>`);
  }
  const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
  assert.match(css,/\.competency-definition\{[^}]*margin:4px 0 14px 12px;[^}]*font-style:italic;[^}]*line-height:1\.55/);
  assert.match(css,/\.competency-reference \.official-references li\+li\{margin-top:6px\}/);
  assert.match(css,/\.competency-reference \.bonus-invitation-help\{[^}]*display:block;[^}]*font-weight:400;[^}]*color:var\(--supporting\)/);
});
test("source popovers suppress focus reentry during native show and dismissal",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const helpers=app.slice(app.indexOf("const officialReferences ="),app.indexOf("const announce ="));
  const element=()=>({handlers:{},addEventListener(name,fn){this.handlers[name]=fn;}});
  const button=element(),panel=element(),wrapper=element(),closeButton=element(),attributes={},tasks=[];
  let shown=false,changing=false,shows=0,prevents=0;
  button.setAttribute=(key,value)=>{attributes[key]=value;};
  button.focus=()=>button.handlers.focus();
  button.getBoundingClientRect=()=>({left:40,bottom:80});
  panel.isConnected=true;panel.style={};panel.matches=()=>shown;
  panel.getBoundingClientRect=()=>({width:200,height:160});
  panel.querySelector=()=>closeButton;
  panel.showPopover=()=>{
    assert.equal(changing,false,"Native popover operations cannot reenter");
    changing=true;shows++;button.focus();shown=true;changing=false;
    tasks.push(()=>panel.handlers.toggle());
  };
  panel.hidePopover=()=>{
    changing=true;panel.handlers.beforetoggle({newState:"closed"});
    shown=false;button.focus();changing=false;
    tasks.push(()=>panel.handlers.toggle());
  };
  wrapper.querySelector=selector=>selector===".source-info-button"?button:panel;
  wrapper.matches=()=>false;wrapper.contains=target=>target===button || target===panel;
  const sandbox={D:data,main:{querySelectorAll:()=>[wrapper]},window:{innerWidth:390,innerHeight:740},
    document:{activeElement:button},clearTimeout:()=>{},setTimeout:()=>0};
  vm.createContext(sandbox);vm.runInContext(helpers,sandbox);vm.runInContext("setupBonusSources()",sandbox);
  const flush=()=>{while(tasks.length)tasks.shift()();};
  button.focus();flush();
  assert.equal(shows,1);assert.equal(shown,true);assert.equal(attributes["aria-expanded"],"true");
  wrapper.handlers.keydown({key:"Escape",preventDefault:()=>{prevents++;},stopPropagation:()=>{}});
  flush();assert.equal(shown,false);assert.equal(shows,1);assert.equal(prevents,1);
  button.handlers.click({preventDefault:()=>{}});flush();
  assert.equal(shows,2);assert.equal(shown,true);
  closeButton.handlers.click();flush();
  assert.equal(shown,false);assert.equal(shows,2);
  button.focus();flush();assert.equal(shows,3);
  panel.hidePopover();flush();
  assert.equal(shown,false);assert.equal(shows,3,"Outside/native dismissal does not reopen on restored focus");
});

test("feedback motion is brief, unstaggered and opt-in to normal motion preferences", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /@media\(prefers-reduced-motion:no-preference\)\{\s*\.feedback-enter .chosen-marker,.feedback-enter .result-tag,.feedback-enter .rationale-panel\{animation:question-feedback-enter 160ms ease-out\}/);
  assert.match(css, /@keyframes question-feedback-enter\{from\{opacity:\.65;transform:translateY\(3px\)\}to\{opacity:1;transform:translateY\(0\)\}\}/);
});
test("hidden conversation keeps the same optional invitation below its existing explanation",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const start=app.indexOf("function renderScenario(");
  const renderer=app.slice(start,app.indexOf('document.querySelectorAll("[data-view]")',start));
  const node=data.scenario.nodes[data.scenario.start],main={innerHTML:""};
  const sandbox={D:data,main,scenarioNode:data.scenario.start,branchChoice:0,history:[],
    escape:value=>String(value),comp:id=>data.competencies.find(c=>c.id===id),titleLabel:c=>c.title,
    citation:()=>"<p>Official 2025 sub-competencies</p>",updateShell:()=>{},persist:()=>{},
    document:{querySelectorAll:()=>[],querySelector:()=>({addEventListener:()=>{}})}};
  vm.createContext(sandbox);
  vm.runInContext(app.slice(app.indexOf("const officialReferences ="),app.indexOf("const announce =")),sandbox);
  vm.runInContext("setupBonusSources=()=>{}",sandbox);
  vm.runInContext(renderer,sandbox);vm.runInContext("renderScenario()",sandbox);
  assert.ok(main.innerHTML.indexOf('<details class="competency-reference">')>main.innerHTML.indexOf(node.choices[0].reason));
  assert.match(main.innerHTML,/Bonus exercise: which competencies and markers are at play\?/);
  assert.match(main.innerHTML,/class="bonus-invitation-help">Think it through, then expand to review\./);
  assert.doesNotMatch(main.innerHTML,/<details class="competency-reference"[^>]*open|What competency is at play/);
});
