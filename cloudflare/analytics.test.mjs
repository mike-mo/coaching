import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";

const origin = "https://smartify.space";
const endpoint = origin + "/coaching/analytics";
const event = { version: 1, event: "start", mode: "questions" };
const request = (body = event, options = {}) => new Request(endpoint, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...options.headers },
  body: typeof body === "string" ? body : JSON.stringify(body)
});
function binding(points = []) {
  return {
    COACHING_ENGINE: { writeDataPoint: point => points.push(point) },
    COACHING_USAGE_LIMIT: { limit: async input => {
      assert.deepEqual(input, { key: "coaching-usage" });
      return { success: true };
    } }
  };
}

test("valid events write only approved enums and constants, never browser attributes", async () => {
  const points = [];
  for (const mode of ["titles", "questions", "mixed", "conversation", "exam"]) {
    for (const phase of ["start", "completion"]) {
      const response = await worker.fetch(request({ version: 1, event: phase, mode }, {
        headers: { Cookie: "private", Authorization: "private", Referer: origin + "/private?answer=private",
          "CF-Connecting-IP": "192.0.2.1", "User-Agent": "private" }
      }), binding(points));
      assert.equal(response.status, 204);
      assert.equal(await response.text(), "");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      assert.deepEqual(points.at(-1), { indexes: [`${phase}:${mode}`], blobs: [phase, mode, "1"], doubles: [1] });
    }
  }
  assert.equal(points.length, 10);
  assert.doesNotMatch(JSON.stringify(points), /private|192\.0\.2/);
});

test("collector denies missing, wrong, Pages and HTTP origins without forwarding", async t => {
  const points = [];
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("Must not proxy"); });
  for (const value of ["", "null", "https://mike-mo.github.io", "https://smartify.space.evil.example", "http://smartify.space"]) {
    assert.equal((await worker.fetch(request(event, { headers: { Origin: value } }), binding(points))).status, 403);
  }
  const insecure = new Request("http://smartify.space/coaching/analytics", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(event)
  });
  assert.equal((await worker.fetch(insecure, binding(points))).status, 403);
  assert.equal(points.length, 0);
  assert.equal(network.mock.callCount(), 0);
});

test("collector has no read endpoint or cross-origin preflight", async () => {
  for (const method of ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]) {
    const response = await worker.fetch(new Request(endpoint, { method }), binding());
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
});

test("strict schema rejects extras, unknown values and malformed content without storing it", async () => {
  const points = [];
  const bodies = ["{", "null", "[]", "1", "\"private\"", {}, { ...event, version: "1" },
    { ...event, version: 2 }, { ...event, mode: "recall" }, { ...event, event: "answer" },
    { ...event, score: 8 }, { ...event, answer: "private" }, { ...event, id: "private" }];
  for (const body of bodies) assert.equal((await worker.fetch(request(body), binding(points))).status, 400);
  for (const type of ["text/plain", "application/json; boundary=private", "application/jsonp", ""]) {
    assert.equal((await worker.fetch(request(event, { headers: { "Content-Type": type } }), binding(points))).status, 400);
  }
  const query = new Request(endpoint + "?mode=questions", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(event)
  });
  assert.equal((await worker.fetch(query, binding(points))).status, 400);
  assert.equal(points.length, 0);
});

test("body limit is exactly 256 UTF-8 bytes, including chunked bodies", async () => {
  const points = [];
  const json = JSON.stringify(event);
  assert.equal((await worker.fetch(request(json.padEnd(256)), binding(points))).status, 204);
  assert.equal((await worker.fetch(request(json.padEnd(257)), binding(points))).status, 413);
  assert.equal((await worker.fetch(request(event, { headers: { "Content-Length": "257" } }), binding(points))).status, 413);
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(json));
      controller.enqueue(new Uint8Array(256));
    },
    cancel() { cancelled = true; }
  });
  const streamed = new Request(endpoint, { method: "POST", duplex: "half", body: stream,
    headers: { Origin: origin, "Content-Type": "application/json" } });
  assert.equal((await worker.fetch(streamed, binding(points))).status, 413);
  assert.equal(cancelled, true);
  assert.equal(points.length, 1);
});

test("missing or failing bindings return 503 and log no payload or client data", async t => {
  const logs = t.mock.method(console, "error", () => {});
  for (const env of [undefined, {}, { COACHING_ENGINE: {} }, {
    ...binding(), COACHING_ENGINE: { writeDataPoint() { throw new Error("private server details"); } }
  }, {
    ...binding(), COACHING_USAGE_LIMIT: { async limit() { throw new Error("private server details"); } }
  }]) {
    assert.equal((await worker.fetch(request(), env)).status, 503);
  }
  assert.equal(logs.mock.callCount(), 5);
  assert.doesNotMatch(JSON.stringify(logs.mock.calls), /private server|questions|192\.0\.2/);
});

test("rate limit uses one nonidentifying bucket and does not write or retry when busy", async () => {
  const points = [];
  const env = binding(points);
  env.COACHING_USAGE_LIMIT.limit = async input => {
    assert.deepEqual(input, { key: "coaching-usage" });
    return { success: false };
  };
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(points.length, 0);
});
