# Custom-path routing

`worker.mjs` serves the GitHub Pages app at `https://smartify.space/coachprep/` and accepts bounded anonymous usage events. Deploy it as an ES-module Cloudflare Worker with the two bindings below, no secrets or package dependencies.

## Current deployment

| Setting | Value |
| --- | --- |
| Worker | `coaching-pages-proxy` |
| Route | `smartify.space/coachprep*` |
| Compatibility date | `2026-11-07` |
| Main module | `cloudflare/worker.mjs` |
| Collector version | `9ca7ce71-3290-4cb7-b58d-a563e4fcfa46` |
| Collector activated (UTC) | `2026-11-09T05:25:42.536701Z` |

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

These Worker files and tests are excluded from the GitHub Pages artifact, which includes only the eight runtime files, sharing PNG, selected logo and favicon SVGs. Pages publishes stable releases using the [release and rollback procedure](../README.md#github-pages). Worker deployment remains separate whenever its source changes.

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

The collector accepts only HTTPS POST requests with the exact same-origin `Origin`, `application/json` (optionally UTF-8), no query string and at most 256 UTF-8 bytes. The original lifecycle schema is exactly:

```json
{"version":1,"event":"start","mode":"questions"}
```

`event` is `start` or `completion`. `mode` is `titles`, `questions`, `mixed`, `conversation` or `exam`. Invalid requests return 400, 403, 405 or 413. Missing/failing bindings return 503. A 204 acknowledges a validated, rate-permitted call to the synchronous Analytics Engine write API, not proof of later delivery. No CORS is exposed and the Pages browser does not send events.

Version-1 points contain only `blobs: [event, mode, "1"]`, `doubles: [1]` and the enum-based index `event:mode`. The version-2 schema is documented below. Invalid payloads and client attributes are never logged or copied into points. There is no analytics read route.

## What the counters mean

| Mode | Start | Completion |
| --- | --- | --- |
| Names (`titles` event enum) | Start a new eight-item round, after its introduction | All eight names in that saved round have been submitted or passed; hints alone do not finish it |
| Questions | Start a new eight-item round, after its introduction | All questions in that saved round have been answered |
| Mixed | Explicit round start | All items in the existing round have been finished |
| Conversation | Explicit entry/restart | The existing final branch transitions to its review |
| Exam | A new rehearsal is successfully saved | A saved draft transitions to submitted or expired, including after resuming it |

Renders, introductions, next-item clicks alone and unfinished-session exits do not send completion events. Saved rounds can finish across visits. Resuming a saved practice or exam does not send another start; a later real finish can send its completion. Finished-review visits do not finish a session again. Failed storage, privacy changes, rate limits, blocking or network loss can leave starts without completions or completions without a visible start. These counters are not unique-person counts, assessment results or a funnel guaranteed to balance. The client does not retry and never delays studying for analytics.

## Aggregate activity extension

This extension requires a separate compatible Worker update followed by an app release. A commit or local preview does not activate collection. It keeps existing version-1 events and points unchanged and accepts one additional strict schema:

```json
{"version":2,"event":"activity","mode":"mixed","activeSeconds":30,"answered":3,"hints":2,"passes":1,"exits":1}
```

All eight fields are required; no others are accepted. `event` must be `activity`, and `mode` uses the existing five-value enum. Counters are integers, at least one must be positive, and `passes` cannot exceed `answered`. The same 256-byte UTF-8 limit, exact same-origin HTTPS checks, content type, nonidentifying limiter and no-CORS/no-read behavior apply.

| Field | Bounds per point | Meaning |
| --- | --- | --- |
| `activeSeconds` | 0-3600 | Whole seconds of eligible foreground practice since the previous attempted checkpoint for this mode, with subsecond remainder retained in memory |
| `answered` | 0-256 | New submitted recall names (including Pass), selected question responses or conversation choices; for exam, the number of competencies with any writing when a rehearsal is successfully finished |
| `hints` | 0-256 | Successful information-revealing recall hint presses, across all three hint types; no disabled/no-op presses |
| `passes` | 0-256 | Recall Pass actions, also included in `answered` |
| `exits` | 0-64 | Explicit closures of unfinished practice that had entered an eligible practice view in this document; repeated close callbacks and history-only visits do not add another exit |

Hints and Pass are allowed only for `titles` and `mixed`. These counters disclose neither which competency was attempted nor whether a submitted answer was correct. Exam answered counts measure written competencies on submission, not keystrokes, individual text fields or graded answers. In Mixed, `answered` includes both item types; there is no per-item or per-content breakdown.

### Active-time accounting

Eligibility requires a started, unfinished practice modal with its study clock running, no lifecycle animation, and no previous-answer or exam previous-pass review. Normal current-answer feedback is part of practice; completed results and completed historical review are not. The document must also be visible and focused. A study interaction (trusted pointer, keyboard or input event within the practice/confirmation dialog) opens a 60-second active window. Starting/resuming a practice view also opens that window. Repeated renders do not refresh it. Reading longer than one minute without interaction stops adding time until another interaction.

This is a bounded foreground-activity estimate, not attention, learning quality or all elapsed practice time. It does not change the app's existing study, answer or exam clocks. Background/hidden intervals, introductions, home and summaries are excluded. Timer suspension is accounted using the monotonic clock and the interaction deadline rather than a count of timer callbacks.

### Checkpoints, duplicates and delivery limits

Pending deltas live only in document memory. The client checks every 60 seconds and also on blur, hide, pagehide, explicit unfinished closure and real completion. Per document, it attempts no more than one activity request per mode per rolling minute (at most five across all modes); throttled deltas wait for a later checkpoint while that document survives. The existing shared Worker limit remains 100 requests per 60 seconds, including legacy events. Multiple tabs and visitors still share that nonidentifying bucket, so busy periods can undercount.

Counters are drained before sending with credential-free, no-referrer `fetch(..., {keepalive:true})`. Duplicate lifecycle callbacks cannot resend those deltas. There are no retries, analytics localStorage records, event IDs, stable user/session IDs or offline queues. An ambiguous network failure is not retried because the server may already have written the point. No network-level exactly-once guarantee is claimed; repeated independently supplied requests are indistinguishable and remain subject to the existing limiter.

Pagehide flushes available deltas but does not increment `exits`: browsers cannot reliably distinguish tab close, reload, navigation and back/forward caching. Abrupt termination, unavailable unload delivery, subsecond remainder, a pending rate-budgeted delta at unload, privacy suppression, blockers, network errors, saturation or the shared limiter can all lose data. Non-204 responses and detectable dispatch failures mark usage stats incomplete in Sources & about and log a generic warning, never payloads. Counters saturate at the bounds above with the same warning rather than growing an unbounded queue. A 204 still acknowledges the synchronous write API, not later Analytics Engine persistence.

Reload/resume starts measuring only future work, without replaying saved hint counts, submitted responses or old elapsed time. Answer counts are submission observations, not distinct saved items; actually resubmitting after lost storage can count again. Existing start/completion semantics stay unchanged. Real completion after resuming may therefore appear without a start in the observed period. Opt-out, DNT/GPC and unavailable preferences discard unsent deltas and stop collection; opting back in does not backfill suppressed time. `exits` are explicit close actions, not abandoned sessions or people.

### Dataset and activation

Version-2 points use `indexes: ["activity:mode"]`, `blobs: ["activity", mode, "2"]` and `doubles: [1, activeSeconds, answered, hints, passes, exits]`. `double1` is checkpoint count, not practice sessions. Existing version-1 queries continue to work unchanged when filtering `blob3 = '1'`. Do not infer unique users, pair starts/completions into a funnel, or equate beacon counts with these counters.

After approval, deploy in this order:

1. Deploy the reviewed Worker source first, retaining both existing routes, bindings, limiter, DNS, HTML/beacon settings and firewall rules. It accepts both old v1 clients and new v2 clients; no dataset migration is required.
2. Publish the reviewed app snapshot through a new immutable stable release using the existing release-only procedure. The local source references `analytics.js?v=3` and `app.js?v=28`. Releasing the client before updating the Worker would reject v2 requests rather than collect them.
3. Read back aggregate rows after ordinary consenting usage. Keep dashboard credentials, snapshots and read queries private. An empty query is no evidence of active users, engagement or a working matched funnel.

For rollback, restore the client first through a new immutable stable release using a known-good earlier app snapshot. Keep this backward-compatible collector deployed while old and new browser tabs coexist. Do not remove v2 acceptance while cached v2 clients can still send; those clients would receive explicit delivery failures. Existing points remain in the dataset regardless of which client is live. Any later collector rollback is a separate approved operation and must retain the existing bindings, routes and limiter.

Aggregate totals for the new observations:

```sql
SELECT blob2 AS mode,
       SUM(_sample_interval * double2) AS foreground_active_seconds,
       SUM(_sample_interval * double3) AS answered_items,
       SUM(_sample_interval * double4) AS hint_uses,
       SUM(_sample_interval * double5) AS passes,
       SUM(_sample_interval * double6) AS partial_close_actions
FROM coaching_events
WHERE blob1 = 'activity' AND blob3 = '2'
  AND timestamp >= NOW() - INTERVAL '7' DAY
GROUP BY mode
```

The timestamp is ingestion time. A checkpoint may cover earlier work, possibly from several short visits in the same document. Use weighted sums because the dataset can sample; do not treat row counts as sessions or use these aggregate totals to calculate per-person engagement.

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
