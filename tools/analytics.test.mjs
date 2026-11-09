import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import worker from "../cloudflare/worker.mjs";

const source = readFileSync(new URL("../analytics.js", import.meta.url), "utf8");
const key = "icf-study-usage-opt-out-v1";
function browser(options = {}) {
  const values = new Map(Object.entries(options.storage || {}));
  const toggle = {}, status = {}, scripts = [], requests = [], logs = [];
  const documentEvents = {}, intervals = [];
  let now = 0, focused = true;
  const context = {
    location: { origin: options.origin || "https://smartify.space", pathname: "/coachprep/" },
    navigator: options.navigator || {}, Map, Set, console: { warn: text => logs.push(text), error: text => logs.push(text) },
    localStorage: {
      getItem: name => { if (options.storageFailure) throw new Error("Unavailable"); return values.get(name) ?? null; },
      setItem: (name, value) => { if (options.storageFailure) throw new Error("Unavailable"); values.set(name, value); }
    },
    document: {
      hidden: false, hasFocus: () => focused,
      addEventListener: (name, handler) => { documentEvents[name] = handler; },
      querySelector: selector => selector === "#usage-opt-out" ? toggle : status,
      createElement: () => ({ setAttribute(name, value) { this[name] = value; } }),
      head: { append: script => scripts.push(script) }
    },
    events: {},
    performance: { now: () => now },
    setInterval: (handler, ms) => { assert.equal(ms, 60000);intervals.push(handler); },
    addEventListener(name, handler) { this.events[name] = handler; },
    fetch: (url, init) => { requests.push({ url, init }); if(options.syncFailure)throw new Error("Unavailable");return options.offline ? Promise.reject(new Error("Unavailable")) :
      Promise.resolve({ status: options.status || 204 }); }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return { usage: context.USAGE, context, toggle, status, scripts, requests, values, logs,
    advance: ms => { now += ms; },
    tick: () => intervals.forEach(handler => handler()),
    interact: (trusted = true, inside = true) => documentEvents.keydown({ isTrusted: trusted, target: { closest: () => inside ? {} : null } }),
    visibility: hidden => { context.document.hidden = hidden;documentEvents.visibilitychange(); },
    focus: value => { focused = value;context.events[value ? "focus" : "blur"](); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("custom site loads one manual beacon and sends only version/event/mode without credentials or referrer", async () => {
  const b = browser({ storage: { "icf-practice-room-v1": "private draft", "icf-study-theme-v1": "dark" } });
  b.usage.begin("questions");
  b.usage.complete("questions");
  b.usage.complete("questions");
  await flush();
  assert.equal(b.scripts.length, 1);
  assert.equal(JSON.parse(b.scripts[0]["data-cf-beacon"]).token, "47f860b809424923942f8c71d6e1cb3a");
  assert.equal(b.requests.length, 2);
  for (const request of b.requests) {
    assert.equal(request.url, "https://smartify.space/coachprep/analytics");
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.credentials, "omit");
    assert.equal(request.init.referrerPolicy, "no-referrer");
    assert.equal(request.init.redirect, "error");
    assert.deepEqual(Object.keys(JSON.parse(request.init.body)).sort(), ["event", "mode", "version"]);
    assert.doesNotMatch(request.init.body, /private|draft|dark|score|answer|competency/);
  }
  assert.equal(b.values.get("icf-practice-room-v1"), "private draft");
  assert.equal(b.values.get("icf-study-theme-v1"), "dark");
});

const activities = b => b.requests.map(r => JSON.parse(r.init.body)).filter(r => r.event === "activity");
test("activity deltas count visible focused recent-interaction time, never hidden or historical time", () => {
  const b = browser();
  b.usage.begin("mixed");b.usage.setActive("mixed");
  b.advance(10000);b.interact();b.advance(20000);b.visibility(true);
  b.context.events.pagehide();
  assert.equal(activities(b).length,1);
  assert.equal(activities(b)[0].activeSeconds,30);
  b.advance(120000);b.visibility(false);b.interact();b.advance(15000);
  b.usage.setActive(null);
  b.advance(120000);b.tick();
  assert.equal(activities(b)[1].activeSeconds,15,"Historical review and hidden intervals add no time");
  b.usage.count("mixed","answered");b.usage.count("mixed","hints",2);b.usage.count("mixed","passes");
  b.advance(60000);b.usage.complete("mixed");b.usage.complete("mixed");
  assert.deepEqual(activities(b).at(-1),{version:2,event:"activity",mode:"mixed",activeSeconds:0,answered:1,hints:2,passes:1,exits:0});
  assert.equal(b.requests.filter(r=>JSON.parse(r.init.body).event==="completion").length,1);
});
test("same-item rerenders and untrusted or outside events do not prolong the idle window", () => {
  const b = browser();
  b.usage.setActive("titles");b.advance(30000);b.usage.setActive("titles");
  b.advance(30000);b.interact(false);b.interact(true,false);
  b.advance(30000);b.tick();
  assert.equal(activities(b)[0].activeSeconds,60);
  b.advance(60000);b.tick();assert.equal(activities(b).length,1);
  b.interact();b.advance(1250);b.usage.setActive(null);b.usage.leave("titles");b.usage.leave("titles");
  assert.deepEqual(activities(b)[1],{version:2,event:"activity",mode:"titles",activeSeconds:1,answered:0,hints:0,passes:0,exits:1});
});
test("blur pauses accounting; partial exits are not generated by hides or read-only review", () => {
  const b = browser();
  b.usage.setActive("questions");b.advance(10000);b.focus(false);
  b.advance(60000);b.focus(true);b.interact();b.advance(5000);
  b.usage.setActive(null);b.usage.leave("questions");
  assert.equal(activities(b)[0].activeSeconds,10);assert.equal(activities(b)[0].exits,0);
  assert.equal(activities(b)[1].activeSeconds,5);assert.equal(activities(b)[1].exits,1);
  b.usage.resume("exam");b.advance(60000);b.usage.leave("exam");b.tick();
  assert.equal(activities(b).filter(e=>e.mode==="exam").length,0,"Opening completed history does not create activity or exits");
});
test("aggregate checkpoints are budgeted per mode and deduplicated across hide, pagehide and finish", () => {
  const b = browser();b.usage.begin("titles");b.usage.setActive("titles");
  b.usage.count("titles","answered");b.usage.count("titles","passes");
  b.visibility(true);b.context.events.pagehide();b.usage.setActive(null);b.usage.leave("titles");b.usage.complete("titles");
  assert.equal(activities(b).length,1);
  assert.equal(activities(b)[0].answered,1);assert.equal(activities(b)[0].passes,1);
  b.advance(59999);b.tick();assert.equal(activities(b).length,1);
  b.advance(1);b.tick();assert.equal(activities(b).length,2);assert.equal(activities(b)[1].exits,1);
  b.tick();assert.equal(activities(b).length,2);
  for(const payload of activities(b)){
    assert.ok(new TextEncoder().encode(JSON.stringify(payload)).length<=256);
    assert.deepEqual(Object.keys(payload).sort(),["activeSeconds","answered","event","exits","hints","mode","passes","version"]);
  }
});
test("aggregate deltas are not persisted, retried or replayed after reload or resumed rounds", async () => {
  for(const options of [{offline:true},{status:429},{status:503},{syncFailure:true}]){
    const b = browser(options);b.usage.resume("exam");b.usage.setActive("exam");
    b.advance(1500);b.usage.count("exam","answered",3);b.usage.setActive(null);b.usage.complete("exam");
    await flush();
    assert.equal(activities(b).length,1);
    b.advance(60000);b.tick();b.context.events.pagehide();assert.equal(activities(b).length,1);
    assert.match(b.status.textContent,/could not be sent/);
    assert.equal(b.logs.length,1);assert.equal(b.values.size,0);
    const reloaded = browser({storage:Object.fromEntries(b.values)});
    reloaded.usage.resume("exam");reloaded.tick();reloaded.context.events.pagehide();
    assert.equal(activities(reloaded).length,0);
  }
});
test("privacy suppression discards unsent aggregates and never backfills opt-out time", () => {
  for(const options of [{navigator:{doNotTrack:"1"}},{navigator:{globalPrivacyControl:true}},{storage:{[key]:"1"}},{storageFailure:true},{origin:"https://mike-mo.github.io"}]){
    const b=browser(options);b.usage.setActive("titles");b.usage.count("titles","answered");b.usage.count("titles","hints");
    b.advance(60000);b.tick();b.usage.leave("titles");b.context.events.pagehide();
    assert.equal(b.requests.length,0);
  }
  const b=browser();b.usage.setActive("mixed");b.advance(10000);b.usage.count("mixed","answered");
  b.values.set(key,"1");b.context.events.storage({key});
  b.advance(60000);b.tick();assert.equal(activities(b).length,0);
  b.values.set(key,"0");b.context.events.storage({key});
  b.advance(60000);b.tick();assert.equal(activities(b).length,0);
  b.interact();b.advance(2000);b.usage.setActive(null);b.usage.leave("mixed");
  assert.deepEqual(activities(b)[0],{version:2,event:"activity",mode:"mixed",activeSeconds:2,answered:0,hints:0,passes:0,exits:1});
});
test("finite counter inputs and bounds cannot carry arbitrary payloads", () => {
  const b=browser();
  for(const invoke of [()=>b.usage.setActive("private"),()=>b.usage.count("exam","answer text"),()=>b.usage.count("exam","answered",-1),
    ()=>b.usage.count("exam","answered",257),()=>b.usage.count("exam","answered",NaN),()=>b.usage.count("questions","hints"),
    ()=>b.usage.count("conversation","passes")])assert.throws(invoke);
  b.usage.setActive("titles");b.usage.count("titles","answered",256);b.usage.count("titles","answered",1);b.usage.leave("titles");
  assert.equal(activities(b)[0].answered,256);
  assert.match(b.status.textContent,/could not be sent/,"Overflow is disclosed rather than silently counted");
});
test("actual client checkpoints are accepted by the local Worker without changing legacy points",async()=>{
  const b=browser(),points=[];
  for(const mode of ["titles","questions","mixed","conversation","exam"]){
    b.usage.begin(mode);b.usage.setActive(mode);b.advance(2750);b.usage.count(mode,"answered",mode==="exam"?8:1);
    if(["titles","mixed"].includes(mode)){b.usage.count(mode,"hints",2);b.usage.count(mode,"passes");}
    b.usage.setActive(null);b.usage.complete(mode);
  }
  for(const {url,init} of b.requests){
    const request=new Request(url,{...init,headers:{...init.headers,Origin:"https://smartify.space"}});
    const response=await worker.fetch(request,{
      COACHING_ENGINE:{writeDataPoint:point=>points.push(point)},
      COACHING_USAGE_LIMIT:{limit:async input=>{assert.deepEqual(input,{key:"coaching-usage"});return{success:true};}}
    });
    assert.equal(response.status,204,init.body);
  }
  assert.equal(points.filter(p=>p.blobs[2]==="1").length,10);
  assert.equal(points.filter(p=>p.blobs[2]==="2").length,5);
  assert.equal(points.filter(p=>p.blobs[2]==="2").reduce((n,p)=>n+p.doubles[1],0),10);
});
test("app usage eligibility excludes introductions, lifecycle motion and both forms of historical review",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const helper=app.slice(app.indexOf("function syncUsage("),app.indexOf("function snapshot("));
  for(const patch of [{},{dialog:{open:false}},{modalStarted:false},{flow:null},{flow:{mode:"mixed",completed:true}},
    {review:true},{finishPracticeEntry:()=>{}},{finishShellClose:()=>{}},{clockStarted:null}]){
    let active="not-called";
    const sandbox={dialog:{open:true},modalStarted:true,flow:{mode:"mixed",completed:false},review:false,
      isReview:()=>sandbox.review,finishPracticeEntry:null,finishShellClose:null,clockStarted:1,
      usageMode:mode=>mode,usage:{setActive:mode=>{active=mode;}},...patch};
    vm.createContext(sandbox);vm.runInContext(helper,sandbox);vm.runInContext("syncUsage()",sandbox);
    assert.equal(active,Object.keys(patch).length===0?"mixed":null);
  }
});
test("reported answers are counted once at submission and never while rendering saved history",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const helpers=app.slice(app.indexOf("function noteResponse("),app.indexOf("function startMode("));
  for(const type of ["recall","questions"]){
    const calls=[],sandbox={flow:{mode:"mixed",responses:[],answerMs:0},answerStarted:null,session:{index:0,answers:{}},
      active:{reported:false,item:{type,c:1},outcome:"missed",matched:false,revealed:false,hints:0},
      usage:{count:(...args)=>calls.push(args)},usageMode:mode=>mode,answerTime:()=>1000,
      P:{points:()=>0,recallPoints:()=>0}};
    vm.createContext(sandbox);vm.runInContext(helpers,sandbox);
    vm.runInContext("noteActive();noteActive()",sandbox);
    assert.deepEqual(calls,[["mixed","answered"]]);
    assert.equal(sandbox.flow.responses.length,1);
  }
});

test("all modes deduplicate completion; titles/questions require every distinct item, not renders or repeats", () => {
  const b = browser();
  for (const mode of ["titles", "questions"]) {
    b.usage.begin(mode);
    const count = mode === "titles" ? 8 : 32;
    for (let i = 0; i < count - 1; i++) { b.usage.item(mode, i, count); b.usage.item(mode, i, count); }
    assert.equal(b.requests.filter(r => JSON.parse(r.init.body).event === "completion").length, mode === "titles" ? 0 : 1);
    b.usage.item(mode, count - 1, count);
    b.usage.complete(mode);
  }
  for (const mode of ["mixed", "conversation", "exam"]) {
    b.usage.begin(mode); b.usage.complete(mode); b.usage.complete(mode);
  }
  assert.equal(b.requests.length, 10);
  b.usage.begin("mixed"); b.usage.complete("mixed");
  assert.equal(b.requests.length, 12);
});

test("resumed exam counts only its actual later completion, with no new start", () => {
  const b = browser();
  b.usage.complete("exam");
  assert.equal(b.requests.length, 0);
  b.usage.resume("exam"); b.usage.resume("exam");
  assert.equal(b.requests.length, 0);
  b.usage.complete("exam"); b.usage.complete("exam");
  assert.equal(b.requests.length, 1);
  assert.equal(JSON.parse(b.requests[0].init.body).event, "completion");
});

test("DNT, GPC, remembered opt-out and unavailable preferences suppress beacon and events", () => {
  for (const options of [
    { navigator: { doNotTrack: "1" } }, { navigator: { doNotTrack: "yes" } },
    { navigator: { globalPrivacyControl: true } }, { storage: { [key]: "1" } },
    { storage: { [key]: "invalid" } }, { storageFailure: true }
  ]) {
    const b = browser(options);
    b.usage.begin("titles"); b.usage.complete("titles");
    assert.equal(b.scripts.length, 0); assert.equal(b.requests.length, 0);
    assert.equal(b.toggle.checked, true);
  }
});

test("localhost, file and Pages do not load or send analytics", () => {
  for (const origin of ["http://127.0.0.1:8847", "http://localhost:8847", "null", "https://mike-mo.github.io"]) {
    const b = browser({ origin });
    b.usage.begin("exam"); b.usage.complete("exam");
    assert.equal(b.scripts.length, 0); assert.equal(b.requests.length, 0);
    assert.equal(b.toggle.disabled, true);
  }
});

test("opt-out stops new events, preserves learning data, and honestly explains already-loaded beacon", () => {
  const b = browser({ storage: { "icf-practice-room-v1": "private", "icf-study-theme-v1": "dark" } });
  b.usage.begin("mixed");
  b.toggle.checked = true; b.toggle.onchange();
  b.usage.complete("mixed");
  assert.equal(b.requests.length, 1);
  assert.match(b.status.textContent, /Reload/);
  assert.equal(b.values.get(key), "1");
  assert.equal(b.values.get("icf-practice-room-v1"), "private");
  assert.equal(b.values.get("icf-study-theme-v1"), "dark");
  b.toggle.checked = false; b.toggle.onchange();
  assert.equal(b.scripts.length, 1);
});

test("outage never throws into study lifecycle, retries, or logs personal data", async () => {
  const b = browser({ offline: true });
  b.usage.begin("conversation"); b.usage.complete("conversation"); b.usage.complete("conversation");
  await flush();
  assert.equal(b.requests.length, 2);
  assert.equal(b.logs.length, 1);
  assert.match(b.status.textContent, /unaffected/);
  b.scripts[0].onerror();
  assert.match(b.status.textContent, /could not be sent/);
});

test("another tab's opt-out stops counts in this tab without clearing learning data or loading another beacon", () => {
  const b = browser({ storage: { "icf-practice-room-v1": "private" } });
  b.usage.begin("questions");
  b.values.set(key, "1");
  b.context.events.storage({ key });
  b.usage.complete("questions");
  assert.equal(b.requests.length, 1);
  assert.equal(b.toggle.checked, true);
  assert.match(b.status.textContent, /Reload/);
  assert.equal(b.values.get("icf-practice-room-v1"), "private");
  b.context.events.storage({ key: "icf-practice-room-v1" });
  assert.equal(b.toggle.checked, true);
  assert.equal(b.scripts.length, 1);
});
