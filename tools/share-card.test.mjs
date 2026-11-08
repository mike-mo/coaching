import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const png = readFileSync(new URL("../assets/share-card.png", import.meta.url));
const svg = readFileSync(new URL("../assets/share-card.svg", import.meta.url), "utf8");

function meta(attribute, name) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/g)].map(match => match[0]);
  const matching = tags.filter(tag => tag.includes(`${attribute}="${name}"`));
  assert.equal(matching.length, 1, `Exactly one ${name} tag`);
  const content = matching[0].match(/\bcontent="([^"]*)"/);
  assert.ok(content, `${name} has content`);
  return content[1];
}

test("initial HTML includes unique canonical, Open Graph and Twitter metadata", () => {
  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/g);
  assert.equal(canonical.length, 1);
  assert.ok(canonical[0].includes("https://smartify.space/coachprep/"));
  assert.equal(meta("property", "og:type"), "website");
  assert.equal(meta("property", "og:url"), "https://smartify.space/coachprep/");
  assert.equal(meta("property", "og:title"), "Coachprep | ICF core competency practice");
  assert.equal(meta("name", "twitter:card"), "summary_large_image");
  assert.equal(meta("name", "twitter:title"), meta("property", "og:title"));
  assert.equal(meta("name", "twitter:description"), meta("property", "og:description"));
  assert.equal(meta("property", "og:image"), "https://mike-mo.github.io/coachprep/assets/share-card.png?v=2");
  assert.equal(meta("name", "twitter:image"), meta("property", "og:image"));
  assert.equal(meta("name", "twitter:image:alt"), meta("property", "og:image:alt"));
});

test("actual PNG and metadata both specify exactly 1200 by 630", () => {
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.subarray(12, 16).toString(), "IHDR");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.equal(meta("property", "og:image:type"), "image/png");
  assert.equal(meta("property", "og:image:width"), "1200");
  assert.equal(meta("property", "og:image:height"), "630");
});

test("source clock starts at C8 on top and runs C1 through C7 clockwise", () => {
  const groups = [...svg.matchAll(/<g data-competency="(\d)">\s*<circle cx="([\d.]+)" cy="([\d.]+)"/g)];
  assert.deepEqual(groups.map(match => Number(match[1])), [8, 1, 2, 3, 4, 5, 6, 7]);
  const [top, upperRight] = groups;
  assert.equal(Number(top[2]), 960);
  assert.equal(Number(top[3]), 158);
  assert.ok(Number(upperRight[2]) > 960 && Number(upperRight[3]) < 300);
});

test("Pages includes only runtime files and the PNG, not source tools or Workers", () => {
  const workflow = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /cp index\.html styles\.css theme\.js content\.js exam\.js analytics\.js practice\.js app\.js _site\//);
  assert.match(workflow, /cp assets\/share-card\.png _site\/assets\//);
  assert.doesNotMatch(workflow, /cp\s+(-r\s+)?(\.\/?|\*)\s/);
});

test("official resource links retain the ICF domain and competency path",()=>{
  assert.match(html,/https:\/\/coachingfederation\.org\/credentialing\/coaching-competencies\/icf-core-competencies\//);
  assert.doesNotMatch(html,/coachprepfederation|coachprep-competencies/);
});
test("favicon and both sharing marks preserve the exact selected logo geometry",()=>{
  const logo=readFileSync(new URL("../assets/coachprep-logo.svg",import.meta.url),"utf8");
  const favicon=readFileSync(new URL("../assets/favicon.svg",import.meta.url),"utf8");
  const path=logo.match(/<path d="([^"]+)"/)[1];
  assert.equal(favicon.match(/<path d="([^"]+)"/)[1],path);
  assert.match(favicon,/viewBox="0 0 256 256"/);
  assert.match(favicon,/prefers-color-scheme:dark/);
  assert.equal(svg.split(`d="${path}"`).length-1,2);
  assert.equal([...svg.matchAll(/viewBox="0 0 256 256"/g)].length,2);
  assert.match(html,/rel="icon" type="image\/svg\+xml" href="assets\/favicon\.svg\?v=1"/);
  assert.match(readFileSync(new URL("../.github/workflows/pages.yml",import.meta.url),"utf8"),/cp assets\/favicon\.svg _site\/assets\//);
});
