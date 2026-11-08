import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../analytics.js", import.meta.url), "utf8");
const key = "icf-study-usage-opt-out-v1";
function browser(options = {}) {
  const values = new Map(Object.entries(options.storage || {}));
  const toggle = {}, status = {}, scripts = [], requests = [], logs = [];
  const context = {
    location: { origin: options.origin || "https://smartify.space", pathname: "/coachprep/" },
    navigator: options.navigator || {}, Map, Set, console: { warn: text => logs.push(text), error: text => logs.push(text) },
    localStorage: {
      getItem: name => { if (options.storageFailure) throw new Error("Unavailable"); return values.get(name) ?? null; },
      setItem: (name, value) => { if (options.storageFailure) throw new Error("Unavailable"); values.set(name, value); }
    },
    document: {
      querySelector: selector => selector === "#usage-opt-out" ? toggle : status,
      createElement: () => ({ setAttribute(name, value) { this[name] = value; } }),
      head: { append: script => scripts.push(script) }
    },
    events: {},
    addEventListener(name, handler) { this.events[name] = handler; },
    fetch: (url, init) => { requests.push({ url, init }); return options.offline ? Promise.reject(new Error("Unavailable")) :
      Promise.resolve({ status: options.status || 204 }); }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return { usage: context.USAGE, context, toggle, status, scripts, requests, values, logs };
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
