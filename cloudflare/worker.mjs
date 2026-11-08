const upstreamOrigin = "https://mike-mo.github.io";
const safeHeaders = ["accept", "if-none-match", "if-modified-since", "range", "if-range"];
const isCoachingPath = path => path === "/coaching" || path.startsWith("/coaching/");

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!isCoachingPath(url.pathname)) return fetch(request);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("This study site supports GET and HEAD requests only.", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    if (url.protocol !== "https:" || url.pathname === "/coaching") {
      url.protocol = "https:";
      if (url.pathname === "/coaching") url.pathname = "/coaching/";
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
