import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, readdirSync, statSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const workflow = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const script = workflow.match(/          script: \|\n((?: {12}.*\n)+)/)?.[1].replace(/^ {12}/gm, "");
assert.ok(script, "The production release guard must be present");
const guard = new (Object.getPrototypeOf(async () => {}).constructor)("context", "github", "core", script);

function fixture() {
  const context = {
    eventName: "release", ref: "refs/tags/v1.2.3", sha: "a".repeat(40),
    repo: {owner: "mike-mo", repo: "coachprep"},
    payload: {action: "published", release: {id: 7, tag_name: "v1.2.3", draft: false, prerelease: false}}
  };
  const release = {...context.payload.release, immutable: true, published_at: "2026-11-09T00:00:00Z",
    html_url: "https://github.com/mike-mo/coachprep/releases/tag/v1.2.3"};
  const commit = {sha: context.sha};
  const calls = [], outputs = {};
  const github = {rest: {repos: {
    getRelease: async options => {calls.push(["release", options]); return {data: release};},
    getCommit: async options => {calls.push(["commit", options]); return {data: commit};}
  }}};
  const summary = {addHeading() {return this;}, addTable() {return this;}, addLink() {return this;}, async write() {}};
  const core = {setOutput: (key, value) => {outputs[key] = value;}, summary};
  return {context, release, commit, github, calls, outputs, run: () => guard(context, github, core)};
}

test("Pages runs only on release publication and checks out the verified commit", () => {
  assert.equal(workflow.match(/\non:\n([\s\S]*?)\npermissions:/)?.[1].trim(), "release:\n    types: [published]");
  assert.match(workflow, /github\.event_name == 'release'/);
  assert.match(workflow, /!github\.event\.release\.draft/);
  assert.match(workflow, /!github\.event\.release\.prerelease/);
  assert.match(workflow, /ref: \$\{\{ steps\.release\.outputs\.sha \}\}/);
  assert.match(workflow, /run-name: Publish \$\{\{ github\.event\.release\.tag_name \}\} at \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /node --test tools\/\*\.test\.mjs/);
  assert.match(workflow, /sha256sum/);
});

test("Push and PR validation has no deployment permission, environment or upload", () => {
  assert.equal(ci.match(/\non:\n([\s\S]*?)\npermissions:/)?.[1].trim(), "push:\n  pull_request:");
  assert.match(ci, /permissions:\n  contents: read/);
  assert.match(ci, /node --test tools\/\*\.test\.mjs/);
  assert.doesNotMatch(ci, /pages:|id-token:|environment:|deploy-pages|upload-pages-artifact|workflow_dispatch|workflow_run/);
  assert.deepEqual(readdirSync(resolve(root, ".github", "workflows")).sort(), ["ci.yml", "pages.yml"]);
});

test("Pages artifact allowlist contains exactly the twelve runtime files", () => {
  const commands = [...workflow.matchAll(/^\s+cp (.+) (_site\/(?:assets\/)?)$/gm)];
  const files = commands.flatMap(([, sources]) => sources.split(" ")).sort();
  assert.deepEqual(files, ["index.html", "styles.css", "theme.js", "content.js", "exam.js", "analytics.js",
    "practice.js", "app.js", "assets/share-card.png", "assets/coachprep-logo.svg", "assets/favicon.svg", "assets/coffee-heart-steam.svg"].sort());
  for (const file of files) assert.ok(statSync(resolve(root, file)).isFile(), file);
  assert.doesNotMatch(workflow, /cp\s+-r|cp\s+.*\*|path:\s*\.(?:\/|\s*$)/m);
  assert.match(workflow, /path: _site/);
});

test("A stable immutable release resolves its tag and produces the exact event SHA", async () => {
  const f = fixture();
  await f.run();
  assert.deepEqual(f.outputs, {sha: f.context.sha});
  assert.deepEqual(f.calls, [
    ["release", {...f.context.repo, release_id: 7}],
    ["commit", {...f.context.repo, ref: "refs/tags/v1.2.3"}]
  ]);
});

for (const [name, change] of [
  ["push", f => {f.context.eventName = "push";}],
  ["pull request", f => {f.context.eventName = "pull_request";}],
  ["manual dispatch", f => {f.context.eventName = "workflow_dispatch";}],
  ["edited release", f => {f.context.payload.action = "edited";}],
  ["draft", f => {f.context.payload.release.draft = true;}],
  ["prerelease", f => {f.context.payload.release.prerelease = true;}],
  ["missing release", f => {delete f.context.payload.release;}],
  ["unversioned tag", f => {f.context.payload.release.tag_name = "latest";}],
  ["leading-zero version", f => {f.context.payload.release.tag_name = "v01.2.3";}],
  ["prerelease tag", f => {f.context.payload.release.tag_name = "v1.2.3-beta";}],
  ["branch ref", f => {f.context.ref = "refs/heads/main";}],
  ["invalid SHA", f => {f.context.sha = "main";}],
  ["missing release ID", f => {delete f.context.payload.release.id;}],
  ["currently draft", f => {f.release.draft = true;}],
  ["currently prerelease", f => {f.release.prerelease = true;}],
  ["currently unpublished", f => {f.release.published_at = null;}],
  ["changed release tag", f => {f.release.tag_name = "v1.2.4";}],
  ["mutable release", f => {f.release.immutable = false;}],
  ["missing immutability proof", f => {delete f.release.immutable;}],
  ["tag/commit mismatch", f => {f.commit.sha = "b".repeat(40);}]
]) {
  test(`Release guard rejects ${name} without producing a checkout SHA`, async () => {
    const f = fixture();
    change(f);
    await assert.rejects(f.run());
    assert.deepEqual(f.outputs, {});
  });
}

test("A new rollback version can target the same immutable source commit", async () => {
  const f = fixture();
  f.context.payload.release.tag_name = f.release.tag_name = "v1.2.4";
  f.context.ref = "refs/tags/v1.2.4";
  await f.run();
  assert.equal(f.outputs.sha, "a".repeat(40));
  assert.equal(f.calls[1][1].ref, "refs/tags/v1.2.4");
});

for (const endpoint of ["getRelease", "getCommit"]) {
  test(`An unavailable ${endpoint} fails without a branch fallback`, async () => {
    const f = fixture();
    f.github.rest.repos[endpoint] = async () => {throw new Error("HTTP 404");};
    await assert.rejects(f.run(), /HTTP 404/);
    assert.deepEqual(f.outputs, {});
  });
}
