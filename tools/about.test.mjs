import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
const start=html.indexOf('<dialog id="about-dialog"');
const about=html.slice(start,html.indexOf("</dialog>",start));

test("About is concise, attributed and transparent without scoring or donation exposition",()=>{
  const words=about.replace(/<[^>]+>/g," ").trim().split(/\s+/);
  assert.ok(words.length<285,`${words.length} words`);
  assert.match(about,/2025 ICF Core Competencies/);
  assert.match(about,/September 2025, rev\. 09\.08\.25, PDF pp\. 3-10/);
  assert.match(about,/noncommercial study/);
  assert.match(about,/not affiliated with or endorsed by ICF/);
  assert.match(about,/without guarantees of accuracy or suitability/);
  assert.match(about,/written answers stay in this browser/);
  assert.match(about,/Cloudflare collects page-visit and performance stats/);
  assert.match(about,/no answer text, scores or tracking identifiers/);
  assert.match(about,/foreground practice time within one minute of an interaction/);
  assert.doesNotMatch(about,/coffee|visiting day|Not now|speed points|90 points|10 minutes|1, 3,/i);
});
test("ethics sources distinguish Code standards from competency and PCC identifiers",()=>{
  assert.match(about,/href="https:\/\/coachingfederation\.org\/resource\/icf-code-of-ethics\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(about,/Code standards 2\.4 and 2\.5/);
  assert.match(about,/separate from 2025 competency IDs and PCC\/course markers/);
  assert.match(about,/exam route and test date/);
});
test("About retains accessible X, theme and privacy controls with focus restoration",()=>{
  assert.match(about,/id="close-about" aria-label="Close sources and about"><svg/);
  for(const id of ["about-title","theme-select","theme-help","usage-opt-out","usage-status"])assert.ok(about.includes(`id="${id}"`));
  assert.match(app,/about\.addEventListener\("close",/);
  assert.match(app,/closeAbout\.focus\(\)/);
  assert.match(html,/aria-label="Would you treat me to a coffee\? \(opens a new tab\)">Would you treat me to a coffee\?/);
  assert.match(html,/href="https:\/\/buymeacoffee\.com\/mikemo" target="_blank" rel="noopener noreferrer"/);
});
