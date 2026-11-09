const upstreamOrigin = "https://mike-mo.github.io";
const safeHeaders = ["accept", "if-none-match", "if-modified-since", "range", "if-range"];
const isCoachingPath = path => path === "/coachprep" || path.startsWith("/coachprep/");
const isLegacyPath = path => path === "/coaching" || path.startsWith("/coaching/");
const usageOrigin = "https://smartify.space";
const usageModes = ["titles", "questions", "mixed", "conversation", "exam"];
const maximumUsageBytes = 256;
const activityLimits = { activeSeconds: 3600, answered: 256, hints: 256, passes: 256, exits: 64 };

function validUsage(event) {
  if (!event || Array.isArray(event) || !usageModes.includes(event.mode)) return false;
  const fields = Object.keys(event).sort().join(",");
  if (event.version === 1) return fields === "event,mode,version" && ["start", "completion"].includes(event.event);
  if (event.version !== 2 || event.event !== "activity" ||
      fields !== "activeSeconds,answered,event,exits,hints,mode,passes,version") return false;
  const counters = Object.entries(activityLimits);
  return counters.every(([key, maximum]) => Number.isInteger(event[key]) && event[key] >= 0 && event[key] <= maximum) &&
    counters.some(([key]) => event[key] > 0) && event.passes <= event.answered &&
    (["titles", "mixed"].includes(event.mode) || event.hints === 0 && event.passes === 0);
}

function usageResponse(message, status, headers = {}) {
  return new Response(message, {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", ...headers }
  });
}

async function collectUsage(request, env) {
  if (request.method !== "POST") return usageResponse("Use POST for usage events.", 405, { Allow: "POST" });
  const url = new URL(request.url);
  if (url.origin !== usageOrigin || request.headers.get("origin") !== usageOrigin) {
    return usageResponse("Usage events require the study site's origin.", 403);
  }
  if (url.search || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") || "")) {
    return usageResponse("Send a JSON usage event without URL parameters.", 400);
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximumUsageBytes)) {
    return usageResponse("The usage event is too large.", 413);
  }
  if (!request.body) return usageResponse("A usage event is required.", 400);
  const reader = request.body.getReader();
  const bytes = new Uint8Array(maximumUsageBytes);
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (size + chunk.value.byteLength > maximumUsageBytes) {
        try { await reader.cancel(); } catch { console.warn("Usage request cancellation failed."); }
        return usageResponse("The usage event is too large.", 413);
      }
      bytes.set(chunk.value, size);
      size += chunk.value.byteLength;
    }
  } catch {
    console.warn("Usage request body could not be read.");
    return usageResponse("The usage event could not be read.", 400);
  } finally {
    reader.releaseLock();
  }
  let event;
  try {
    event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)));
  } catch {
    return usageResponse("The usage event is not valid JSON.", 400);
  }
  if (!validUsage(event)) {
    return usageResponse("The usage event has unsupported fields or values.", 400);
  }
  if (typeof env?.COACHING_ENGINE?.writeDataPoint !== "function" || typeof env?.COACHING_USAGE_LIMIT?.limit !== "function") {
    console.error("Study usage binding is unavailable.");
    return usageResponse("Usage statistics are unavailable.", 503);
  }
  try {
    const { success } = await env.COACHING_USAGE_LIMIT.limit({ key: "coaching-usage" });
    if (!success) return usageResponse("Usage statistics are temporarily busy.", 429, { "Retry-After": "60" });
    env.COACHING_ENGINE.writeDataPoint({
      indexes: [`${event.event}:${event.mode}`],
      blobs: [event.event, event.mode, String(event.version)],
      doubles: event.version === 1 ? [1] : [1, event.activeSeconds, event.answered, event.hints, event.passes, event.exits]
    });
  } catch {
    console.error("Study usage write failed.");
    return usageResponse("Usage statistics are unavailable.", 503);
  }
  return usageResponse(null, 204);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!isCoachingPath(url.pathname) && !isLegacyPath(url.pathname)) return fetch(request);
    if (url.pathname === "/coachprep/analytics" || url.pathname === "/coaching/analytics") return collectUsage(request, env);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("This study site supports GET and HEAD requests only.", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    if (isLegacyPath(url.pathname)) {
      url.protocol = "https:";
      url.pathname = "/coachprep" + url.pathname.slice("/coaching".length);
      if (url.pathname === "/coachprep") url.pathname += "/";
      return Response.redirect(url.href, 308);
    }
    if (url.protocol !== "https:" || url.pathname === "/coachprep") {
      url.protocol = "https:";
      if (url.pathname === "/coachprep") url.pathname = "/coachprep/";
      return Response.redirect(url.href, 308);
    }

    const upstreamUrl = new URL(url.pathname + url.search, upstreamOrigin);
    const headers = new Headers();
    for (const name of safeHeaders) {
      if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    }

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        redirect: "manual"
      });
    } catch (error) {
      console.error("Coaching upstream request failed", {
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error)
      });
      return new Response("The study site could not be reached. Please try again later.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
      });
    }

    const responseHeaders = new Headers(upstream.headers);
    if (/^text\/html(?:\s*;|$)/i.test(responseHeaders.get("content-type") || "")) {
      const cacheControl = responseHeaders.get("cache-control") || "";
      if (!cacheControl.split(",").some(directive => directive.trim().toLowerCase() === "no-transform")) {
        responseHeaders.set("cache-control", `${cacheControl ? cacheControl + ", " : ""}no-transform`);
      }
    }
    const location = responseHeaders.get("location");
    if (location && URL.canParse(location, upstreamUrl)) {
      const target = new URL(location, upstreamUrl);
      if (target.origin === upstreamOrigin && isCoachingPath(target.pathname)) {
        target.protocol = url.protocol;
        target.host = url.host;
        responseHeaders.set("location", target.href);
      }
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  }
};
