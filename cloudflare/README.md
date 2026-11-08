# Custom-path routing

`worker.mjs` serves the GitHub Pages app at `https://smartify.space/coachprep/` and accepts bounded anonymous usage events. Deploy it as an ES-module Cloudflare Worker with the two bindings below, no secrets or package dependencies.

## Current deployment

| Setting | Value |
| --- | --- |
| Worker | `coaching-pages-proxy` |
| Route | `smartify.space/coachprep*` |
| Compatibility date | `2026-11-07` |
| Main module | `cloudflare/worker.mjs` |

The site's firewall must allow public GET/HEAD requests to host `smartify.space` for exactly `/coachprep` and `/coachprep/` descendants. Usage events also require a POST exception for exactly `https://smartify.space/coachprep/analytics`, with no query string. Keep these exceptions limited to the host, method and path boundary. Other paths and security rules retain their existing behavior, including bot blocking.

The existing `smartify.space/coaching*` route must also stay attached to this Worker. Legacy GET/HEAD requests redirect to `/coachprep/`, preserving the remaining path and query. The exact legacy `/coaching/analytics` POST remains accepted with identical validation, without redirecting already-open tabs. Retain both narrowly scoped collector POST firewall exceptions during the transition. GitHub repository links redirect after rename, but the old GitHub Pages path is not managed by this Worker.

## Deploy

1. Update `coaching-pages-proxy` with the exact contents of `cloudflare/worker.mjs` as its main ES module, using the compatibility date above.
2. Add the Worker route `smartify.space/coachprep*` on the existing `smartify.space` zone. Cloudflare route matching includes query strings, so the trailing wildcard also covers `/coachprep?v=10`.
3. Keep the apex DNS record, existing Cloudflare Tunnel and GitHub Pages configuration unchanged. Leave the GitHub Pages custom-domain CNAME unset.
4. Check `/coachprep`, `/coachprep/` and a versioned asset such as `/coachprep/app.js?v=10`. Confirm that `/coachprep-other` still reaches the existing origin.

The Worker checks the path boundary itself. Only `/coachprep` and `/coachprep/` descendants use GitHub Pages. Other matched paths pass the original request to the existing origin, including its method, headers and body.

`/coachprep` redirects with status 308 to `/coachprep/`, keeping the query string. HTTP requests for this app redirect to HTTPS. The slash lets relative assets resolve under `/coachprep/`. Only GET and HEAD are accepted for the study app; other methods return 405 with `Allow: GET, HEAD`.

The upstream is `https://mike-mo.github.io/coachprep/`. The Worker forwards the asset path and query string, plus Accept and conditional/range headers. It does not copy browser cookies, authorization, referrers, client identity or analytics headers.

Upstream status, content, content type and caching headers pass through. HTML responses add `Cache-Control: no-transform` while retaining the upstream's existing cache directives. This prevents Cloudflare from injecting its analytics or JavaScript Detections scripts into the study page. See the [Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/) and [JavaScript Detections documentation](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/#if-your-origin-sends-a-no-transform-header). HEAD and conditional requests keep their usual behavior.

Relative redirects that resolve to the upstream's `/coachprep` path, and absolute redirects to that same origin and path, point back to the custom site. Other redirects are preserved. Network failures are logged and return an uncacheable 502; unrelated-origin passthrough errors are left to Cloudflare's normal handling.

These Worker files and tests are excluded from the GitHub Pages artifact, which includes only the seven runtime files and sharing PNG. Deploy the Worker separately whenever its source changes.

## Analytics setup

Keep HTML `no-transform`. Coaching loads the existing site's public Web Analytics beacon manually, once per document, after privacy checks. Do not add another beacon or enable automatic injection for coaching. Mode navigation changes the view within the same page and does not load another beacon. The public browser token in `analytics.js` is not an API credential.

Use the Cloudflare dashboard's **Web Analytics** view for `smartify.space`, filtering paths to `/coachprep` and `/coachprep/` descendants. The site's other traffic is separate from coaching. Browser privacy settings, blocking and outages can reduce collected data. No changes to bot rules are required.

Add these Worker bindings without changing plans or enabling paid services:

First enable Analytics Engine from **Workers & Pages > Analytics Engine** in the Cloudflare dashboard on the existing Free plan. Upload error 403, code 10089, means the service has not been enabled; signing in again does not resolve it. Stop if enablement requests a paid upgrade.

| Binding | Configuration |
| --- | --- |
| `COACHING_ENGINE` | Analytics Engine dataset `coaching_events` |
| `COACHING_USAGE_LIMIT` | Rate Limiting binding, a new account-unique integer namespace, limit `100`, period `60` |

The limiter uses the constant key `coaching-usage`, shared across this endpoint's visitors. It uses no IP, user identifier or fingerprint. Limits are approximate per Cloudflare location, not a strict worldwide quota. Busy requests return 429 and the browser does not retry them. Verify binding availability on the existing Free plan before deployment; do not upgrade if unavailable. Analytics Engine's documented Free limits are 100,000 points and 10,000 reads per day, with three-month retention. Monitor quotas rather than assuming unlimited capacity.

The collector accepts only HTTPS POST requests with the exact same-origin `Origin`, `application/json` (optionally UTF-8), no query string, at most 256 UTF-8 bytes, and exactly:

```json
{"version":1,"event":"start","mode":"questions"}
```

`event` is `start` or `completion`. `mode` is `titles`, `questions`, `mixed`, `conversation` or `exam`. Invalid requests return 400, 403, 405 or 413. Missing/failing bindings return 503. A 204 acknowledges a validated, rate-permitted call to the synchronous Analytics Engine write API, not proof of later delivery. No CORS is exposed and the Pages browser does not send events.

Each point contains only `blobs: [event, mode, "1"]`, `doubles: [1]` and the enum-based index `event:mode`. Invalid payloads and client attributes are never logged or copied into points. There is no analytics read route.

## What the counters mean

| Mode | Start | Completion |
| --- | --- | --- |
| Titles | Explicit entry/restart | Every distinct title has been submitted or passed during that visit; hints alone do not finish it |
| Questions | Explicit entry/restart | Every distinct question has been answered during that visit |
| Mixed | Explicit round start | All items in the existing round have been finished |
| Conversation | Explicit entry/restart | The existing final branch transitions to its review |
| Exam | A new rehearsal is successfully saved | A saved draft transitions to submitted or expired, including after resuming it |

Renders, next-item clicks alone and finished-review visits do not send completion events. Reloading a saved unfinished exam does not send another start; a later real finish can send its completion. A submitted/expired saved exam cannot finish again on reload. Failed storage, privacy changes, rate limits, blocking or network loss can leave starts without completions or completions without a visible start. These counters are not unique-person counts, assessment results or a funnel guaranteed to balance. The client does not retry and never delays studying for analytics.

## Aggregate study queries

Use an authenticated Cloudflare Analytics Engine SQL API request with an account token carrying **Account Analytics Read**. Keep the token outside browser code and the repository. The endpoint is `https://api.cloudflare.com/client/v4/accounts/<account_id>/analytics_engine/sql`; POST SQL in the request body. No public admin website is provided.

Most frequently started modes in the past seven days:

```sql
SELECT blob2 AS mode, SUM(_sample_interval * double1) AS starts
FROM coaching_events
WHERE blob1 = 'start' AND blob3 = '1'
  AND timestamp >= NOW() - INTERVAL '7' DAY
GROUP BY mode
ORDER BY starts DESC
```

Starts and completions by UTC day and mode:

```sql
SELECT intDiv(toUInt32(timestamp), 86400) * 86400 AS utc_day,
       blob2 AS mode, blob1 AS event,
       SUM(_sample_interval * double1) AS events
FROM coaching_events
WHERE blob3 = '1' AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY utc_day, mode, event
ORDER BY utc_day, mode, event
```

Use weighted counts because Analytics Engine can sample. `COUNT(*)` counts stored rows and may understate events. Convert `utc_day` from Unix seconds when presenting it.

References: [Analytics Engine setup](https://developers.cloudflare.com/analytics/analytics-engine/get-started/), [SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/), [Free limits/pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/), [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [manual Web Analytics](https://developers.cloudflare.com/web-analytics/get-started/).

## Check the source locally

With Node.js 22 or newer, run from the repository root:

```powershell
node --test cloudflare\worker.test.mjs cloudflare\analytics.test.mjs tools\analytics.test.mjs tools\questions.test.mjs tools\share-card.test.mjs
```

The tests use built-in Node modules and mocked fetch calls. They do not modify DNS, deploy a Worker or send requests to the live domain. After deployment, verify the real HTTPS route, public assets, study interactions and existing-origin passthrough.
