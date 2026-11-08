import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";

const site = "https://smartify.space";
const upstream = "https://mike-mo.github.io";

test("unrelated paths pass the original request through unchanged", async t => {
  const requests = ["/", "/coaching-other?v=2", "/coachingish", "/COACHING", "/coaching%2Fprivate"];
  const marker = new Response("Existing tunnel response", { status: 403 });
  const mock = t.mock.method(globalThis, "fetch", async request => {
    assert.ok(request instanceof Request);
    return marker;
  });
  for (const path of requests) {
    const request = new Request(site + path, { method: "POST", headers: { Cookie: "existing=1", Authorization: "existing-token" }, body: "existing body" });
    assert.equal(await worker.fetch(request), marker);
    assert.equal(mock.mock.calls.at(-1).arguments[0], request);
    assert.equal(request.headers.get("cookie"), "existing=1");
    assert.equal(await request.clone().text(), "existing body");
  }
});

test("passthrough failures are not caught as coaching errors", async t => {
  const failure = new Error("Existing origin failed");
  t.mock.method(globalThis, "fetch", async () => { throw failure; });
  const log = t.mock.method(console, "error", () => {});
  await assert.rejects(worker.fetch(new Request(site + "/coaching-other")), error => error === failure);
  assert.equal(log.mock.callCount(), 0);
});

test("bare path and HTTP requests redirect to HTTPS with slash and query intact", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Redirect must not fetch"); });
  for (const [input, target] of [
    [site + "/coaching?v=10&topic=8", site + "/coaching/?v=10&topic=8"],
    ["http://smartify.space/coaching?mode=1", site + "/coaching/?mode=1"],
    ["http://smartify.space/coaching/styles.css?v=11", site + "/coaching/styles.css?v=11"],
    ["http://smartify.space/coaching/?v=10", site + "/coaching/?v=10"]
  ]) {
    const response = await worker.fetch(new Request(input));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), target);
  }
  assert.equal(mock.mock.callCount(), 0);
});

test("only GET and HEAD are accepted for coaching paths", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Disallowed method must not fetch"); });
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const response = await worker.fetch(new Request(site + "/coaching/app.js", { method }));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
    assert.match(await response.text(), /GET and HEAD/);
  }
  assert.equal(mock.mock.callCount(), 0);
});

test("GET forwards versioned asset URL and only safe headers, preserving content and caching", async t => {
  const incoming = {
    Accept: "text/javascript",
    "If-None-Match": '"version-10"',
    "If-Modified-Since": "Sun, 08 Nov 2026 00:00:00 GMT",
    Range: "bytes=0-9",
    "If-Range": '"version-10"',
    Cookie: "private-answer=secret",
    Authorization: "Bearer secret",
    Referer: "https://private.example/",
    "User-Agent": "Private browser identifier",
    "CF-Connecting-IP": "192.0.2.1",
    "X-Analytics-ID": "private-identifier"
  };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), upstream + "/coaching/app.js?v=10");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "manual");
    assert.deepEqual([...options.headers.keys()].sort(), ["accept", "if-modified-since", "if-none-match", "if-range", "range"]);
    for (const name of options.headers.keys()) assert.equal(options.headers.get(name), new Headers(incoming).get(name));
    return new Response("const test = 1;", {
      status: 206,
      statusText: "Partial Content",
      headers: { "Content-Type": "text/javascript", "Cache-Control": "max-age=600", ETag: '"version-10"', "Content-Range": "bytes 0-9/14", Vary: "Accept-Encoding" }
    });
  });
  const response = await worker.fetch(new Request(site + "/coaching/app.js?v=10", { headers: incoming }));
  assert.equal(response.status, 206);
  assert.equal(response.statusText, "Partial Content");
  assert.equal(await response.text(), "const test = 1;");
  assert.equal(response.headers.get("content-type"), "text/javascript");
  assert.equal(response.headers.get("cache-control"), "max-age=600");
  assert.equal(response.headers.get("etag"), '"version-10"');
  assert.equal(response.headers.get("content-range"), "bytes 0-9/14");
  assert.equal(response.headers.get("vary"), "Accept-Encoding");
});

test("HEAD reaches upstream as HEAD and returns headers without a body", async t => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), upstream + "/coaching/");
    assert.equal(options.method, "HEAD");
    return new Response(null, { headers: { "Content-Length": "300", "Content-Type": "text/html", ETag: '"homepage"' } });
  });
  const response = await worker.fetch(new Request(site + "/coaching/", { method: "HEAD" }));
  assert.equal(response.body, null);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("content-length"), "300");
  assert.equal(response.headers.get("etag"), '"homepage"');
  assert.equal(response.headers.get("cache-control"), "no-transform");
});

test("HTML opts out of edge script injection without changing existing cache policy", async t => {
  for (const [original, expected] of [
    ["public, max-age=600", "public, max-age=600, no-transform"],
    ["private, no-store", "private, no-store, no-transform"],
    ["max-age=600, No-Transform", "max-age=600, No-Transform"],
    [null, "no-transform"]
  ]) {
    const headers = new Headers({ "Content-Type": "text/html; charset=utf-8", ETag: '"unchanged"' });
    if (original !== null) headers.set("cache-control", original);
    t.mock.method(globalThis, "fetch", async () => new Response("<html>Original study page</html>", { headers }));
    const response = await worker.fetch(new Request(site + "/coaching/"));
    assert.equal(response.headers.get("cache-control"), expected);
    assert.equal(response.headers.get("etag"), '"unchanged"');
    assert.equal(await response.text(), "<html>Original study page</html>");
    t.mock.restoreAll();
  }
});

test("conditional 304 and missing asset 404 remain unchanged", async t => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (String(url).endsWith("/missing.js")) return new Response("Missing asset", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "max-age=60" } });
    assert.equal(options.headers.get("if-none-match"), '"same"');
    return new Response(null, { status: 304, headers: { ETag: '"same"', "Cache-Control": "max-age=600" } });
  });
  const cached = await worker.fetch(new Request(site + "/coaching/app.js", { headers: { "If-None-Match": '"same"' } }));
  assert.equal(cached.status, 304);
  assert.equal(cached.body, null);
  assert.equal(cached.headers.get("etag"), '"same"');
  const missing = await worker.fetch(new Request(site + "/coaching/missing.js"));
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), "Missing asset");
  assert.equal(missing.headers.get("cache-control"), "max-age=60");
});

test("relative and same-origin coaching redirects point back to the custom site", async t => {
  for (const [location, expected] of [
    ["styles.css?v=11", site + "/coaching/styles.css?v=11"],
    ["/coaching/?v=10", site + "/coaching/?v=10"],
    [upstream + "/coaching/exam.js?v=5#section", site + "/coaching/exam.js?v=5#section"],
    ["//mike-mo.github.io/coaching/?source=1", site + "/coaching/?source=1"],
    ["?v=12", site + "/coaching/?v=12"]
  ]) {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "max-age=60" } }));
    const response = await worker.fetch(new Request(site + "/coaching/"));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), expected);
    assert.equal(response.headers.get("cache-control"), "max-age=60");
    t.mock.restoreAll();
  }
});

test("external, non-coaching and malformed redirect locations stay as upstream sent them", async t => {
  for (const location of ["https://example.com/elsewhere", upstream + "/coaching-other", "/another-project/", "http://["]) {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 301, headers: { Location: location } }));
    const response = await worker.fetch(new Request(site + "/coaching/"));
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), location);
    t.mock.restoreAll();
  }
});

test("upstream failures are logged and return an explicit uncacheable 502", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Network unavailable"); });
  const log = t.mock.method(console, "error", () => {});
  const response = await worker.fetch(new Request(site + "/coaching/app.js?v=10"));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(await response.text(), /could not be reached/);
  assert.equal(log.mock.callCount(), 1);
  assert.deepEqual(log.mock.calls[0].arguments, ["Coaching upstream request failed", { path: "/coaching/app.js", error: "Network unavailable" }]);
});
