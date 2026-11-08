import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const svg = read("../assets/coachprep-logo.svg").replace(/\r\n/g, "\n");
const html = read("../index.html");
const app = read("../app.js");
const css = read("../styles.css");

test("selected compact diagonal SVG remains exact across line-ending conventions", () => {
  assert.equal(createHash("sha256").update(svg).digest("hex"), "280d681329a7af15eb469e64f024d0995837b0a0f0054f4cfc364dcfafe0ca46");
  assert.match(svg, /viewBox="0 0 256 256" fill="currentColor"/);
  assert.doesNotMatch(svg, /<script|<filter|<image|href=|font-family=/);
});

test("shared header and selected orbit element use the same decorative mark", () => {
  assert.match(html, /class="brand-mark coachprep-logo" aria-hidden="true"><\/span><span>Coachprep/);
  assert.match(app, /brandMark\.classList\.add\("coachprep-logo"\)/);
  assert.match(app, /const introBrand=document\.querySelector\("#brand"\)\.cloneNode\(true\)/);
  assert.match(app, /<strong class="coachprep-logo"><\/strong>/);
  assert.match(app, /42\*Math\.cos\(\(i-1\)\*Math\.PI\/4\)/);
});

test("shared mask preserves geometry and inherits existing theme color", () => {
  assert.match(css, /color:var\(--green\);background:currentColor/);
  assert.match(css, /mask:url\("assets\/coachprep-logo\.svg"\) center \/ contain no-repeat/);
  assert.match(css, /aspect-ratio:1;border-radius:0/);
});

test("Pages explicitly allowlists the selected local logo", () => {
  const workflow = read("../.github/workflows/pages.yml");
  assert.match(workflow, /cp assets\/coachprep-logo\.svg _site\/assets\//);
  assert.doesNotMatch(workflow, /cp\s+(-r\s+)?assets\/\*/);
});
