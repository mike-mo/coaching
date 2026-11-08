# Custom-path routing

`worker.mjs` serves the GitHub Pages app at `https://smartify.space/coaching/`. Deploy it as an ES-module Cloudflare Worker with no bindings, secrets or package dependencies.

## Current deployment

| Setting | Value |
| --- | --- |
| Worker | `coaching-pages-proxy` |
| Route | `smartify.space/coaching*` |
| Compatibility date | `2026-11-07` |
| Main module | `cloudflare/worker.mjs` |

The site's firewall must allow public GET/HEAD requests to host `smartify.space` for exactly `/coaching` and `/coaching/` descendants. Keep any required exception limited to that host, method and path boundary. Other paths and security rules retain their existing behavior.

## Deploy

1. Update `coaching-pages-proxy` with the exact contents of `cloudflare/worker.mjs` as its main ES module, using the compatibility date above.
2. Add the Worker route `smartify.space/coaching*` on the existing `smartify.space` zone. Cloudflare route matching includes query strings, so the trailing wildcard also covers `/coaching?v=10`.
3. Keep the apex DNS record, existing Cloudflare Tunnel and GitHub Pages configuration unchanged. Leave the GitHub Pages custom-domain CNAME unset.
4. Check `/coaching`, `/coaching/` and a versioned asset such as `/coaching/app.js?v=10`. Confirm that `/coaching-other` still reaches the existing origin.

The Worker checks the path boundary itself. Only `/coaching` and `/coaching/` descendants use GitHub Pages. Other matched paths pass the original request to the existing origin, including its method, headers and body.

`/coaching` redirects with status 308 to `/coaching/`, keeping the query string. HTTP requests for this app redirect to HTTPS. The slash lets relative assets resolve under `/coaching/`. Only GET and HEAD are accepted for the study app; other methods return 405 with `Allow: GET, HEAD`.

The upstream is `https://mike-mo.github.io/coaching/`. The Worker forwards the asset path and query string, plus Accept and conditional/range headers. It does not copy browser cookies, authorization, referrers, client identity or analytics headers. The app has no analytics endpoint or tracking integration.

Upstream status, content, content type and caching headers pass through. HEAD and conditional requests keep their usual behavior. Relative redirects that resolve to the upstream's `/coaching` path, and absolute redirects to that same origin and path, point back to the custom site. Other redirects are preserved. Network failures are logged and return an uncacheable 502; unrelated-origin passthrough errors are left to Cloudflare's normal handling.

These Worker files and tests are excluded from the GitHub Pages artifact by its six-runtime-file allowlist. Deploy the Worker separately whenever its source changes.

## Check the source locally

With Node.js 22 or newer, run from the repository root:

```powershell
node --test cloudflare\worker.test.mjs
```

The tests use built-in Node modules and mocked fetch calls. They do not modify DNS, deploy a Worker or send requests to the live domain. After deployment, verify the real HTTPS route, public assets, study interactions and existing-origin passthrough.
