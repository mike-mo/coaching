# Coachprep

A small browser-based study app for the eight ICF core competencies. Practice exact names, compare coaching choices or rehearse a written exam.

## Features

- Name recall with progressive word hints, Pass and separate counts for answers with and without hints.
- 32 original fictional coaching scenarios, four per primary competency, each with four plausible responses and a contextual explanation beside each option.
- Single-select best-fit practice with separate strongest-option and valid-approach credit. The competency, official definition and citations appear only after answering.
- A short fictional branching conversation retained in the source and saved data, but hidden from public navigation and entry points while it is developed further.
- Eight-item mixed practice across all competencies.
- Exam rehearsal with eight ordered name fields and three explanation points per competency. An elapsed count-up timer with no time limit, saved drafts, optional comparison with the previous completed pass and a text-copy download.
- Local progress and a simple review schedule: help, a name mismatch or a less suitable response returns in 10 minutes; names without hints and both question-credit categories follow 1, 3, then 7 days.
- Light by default, remembered light/dark choices, and an explicit System setting.
- Full-screen study dialogs in every mode, saved places, stable actions, keyboard controls, visible focus, screen-reader messages and reduced-motion support.
- Per-competency closing results based on actual responses. Questions use correctness-first scoring: strongest 90, valid 80, improvement 0, plus up to 10 speed points only for accepted responses. The bonus is capped through 4 seconds and decreases linearly to zero at 64 seconds. Feedback, introductions and time away are excluded. Scores are rounded means of answered questions, including zero-point responses; unseen competencies have no score.
- An optional coffee reminder below closing results from the third distinct visitor-local calendar day onward. It repeats at eligible summaries until Not now, which suppresses it for that local day only. The footer link remains available.

Names are checked for the official words in order, ignoring capitalization, extra spaces and punctuation around words. C1-C8 are display labels; type only the name. Exam explanations are preserved for self-review, not automatically graded.

Question and option order vary. Review lists use narrative labels without revealing the evaluated competency. Each item has one authored strongest option; some have other valid approaches that earn credit and advance the review schedule. A valid approach does not increment strongest-option totals or count as missed. Less suitable means less suitable in the stated moment, not a universally wrong coaching behavior. These are study judgments, not validated ICF exam keys or assessment percentages.

## Run locally

There are no packages, build tools, accounts or backend services to install. With Python available, run:

```powershell
python -m http.server 8847 --bind 127.0.0.1
```

Open `http://127.0.0.1:8847/`. You can also open `index.html` directly, although a stable local server address is more reliable for browser storage.

## GitHub Pages

The Pages workflow runs on pushes to `main` or a manual workflow dispatch. It copies the eight runtime files and sharing image into a static artifact and deploys that artifact using GitHub's Pages actions.

Enable GitHub Pages with **GitHub Actions** as the source in the repository's Settings > Pages. The deployment environment records the published URL.

All app assets use relative URLs. The app works at a GitHub project-site subpath and does not require server-side routing. Navigation stays within the page.

## Sharing image

The initial HTML includes a canonical URL, Open Graph metadata and a Twitter large-image card. The original 1200x630 PNG is `assets/share-card.png`; edit `assets/share-card.svg` to change the design.

On Windows with Edge installed, regenerate the PNG from the repository root:

```powershell
.\tools\render-share-card.ps1
```

The renderer also accepts `-BrowserPath` for another installed Chromium browser. It uses local system fonts and an isolated temporary profile, with no packages or external assets.

## Saved data

Study results, counters, review dates, conversation counts and exam answers stay in `localStorage` under `icf-practice-room-v1`. Theme choices use the separate `icf-study-theme-v1` key. The usage-statistics preference uses `icf-study-usage-opt-out-v1`. Reset progress requires confirmation and leaves theme and privacy choices unchanged.

The same study key also stores a compatible `practices` field keyed by mode: unfinished name attempts, selected question responses, option order, conversation position and elapsed/answer milliseconds. Each mode keeps its own saved place. Closing pauses study and exam elapsed clocks. The `/coaching/` to `/coachprep/` custom-path migration keeps the same origin and storage keys. The separate `coachprep-coffee-days-v1` key keeps at most three distinct visiting dates plus a dismissal date; no dates leave the browser. Reset study progress does not reset coffee, theme or privacy preferences.

Earlier `q1`-`q8` question records are retained as historical results in all-time counts. The expanded scenarios use new stable IDs and start their own review schedules. Existing recall results and exam drafts are preserved. Older saved records gain a zero-valued reasonable-fit counter when loaded; no storage reset is required.

The exam stores elapsed practice milliseconds and pauses when safely closed. Older timed and untimed attempts keep all answers; countdown drafts become count-up drafts without expiring, using previously saved elapsed study time where available (otherwise starting elapsed measurement at zero). Earlier expired passes remain completed reviews. When starting another rehearsal, the latest completed pass is saved under `examPrevious` in the same study record. The current draft and this one comparison baseline stay separate. A discarded draft never replaces the completed baseline. Comparison is optional, initially collapsed, and free-form points are never automatically graded. Reset progress removes both current and previous exam answers. Drafts save while editing. Storage failures are shown in the app, and a text download provides a backup.

Storage is specific to the browser profile and origin, not synced between devices. Clearing site data or using private browsing may remove saved work. Use fictional examples in rehearsal.

The local and GitHub Pages versions use no analytics or external runtime scripts. On `https://smartify.space/coachprep/`, an intentional Cloudflare Web Analytics beacon provides basic page metrics, and a first-party collector counts study-mode starts and completions once its service and bindings are enabled. Neither is required to study. Do Not Track, Global Privacy Control and the saved Sources & about opt-out disable usage statistics. The saved opt-out also stops new study events in other open tabs. If the beacon load has already started, the Sources message explains that a later reload stops page analytics too.

Custom events contain only schema version, event and mode. They contain no visitor identifiers, cookies, IP addresses, referrers, query strings, answers, scores, competency details or draft text. Counts are events, not unique people. See [Cloudflare deployment and analytics](cloudflare/README.md) for setup, lifecycle definitions and authenticated aggregate queries. There is no public analytics query endpoint, login or AI service. Opening the official source or optional coffee link visits an external site in a new tab.

## Sources and limitations

Primary source: **2025 ICF Core Competencies**, released September 2025, revision 09.08.25, PDF pp. 3-10. The eight official titles, short definitions and referenced sub-competencies are quoted with attribution. Apostrophes are normalized to straight marks without changing the words. Summaries, questions, rationales, fictional dialogue and review examples are original study material. Citations include each referenced sub-competency's full wording, ID and PDF page. The retained conversation collects its debrief citations at the end, after all choice reviews.

Read the official model through the [ICF core competencies resource](https://coachingfederation.org/credentialing/coaching-competencies/icf-core-competencies/).

This is independent practice guidance, not an official ICF assessment or endorsement. Counts do not measure PCC competence or certification readiness. Fictional client reactions are examples, not predictions of how a real client will respond.

Source PDFs, proprietary question banks, private assignments, recordings, client records and personal answers are not included. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and licensing scope.

## Rights

Copyright (c) 2026 mike-mo for original code and original authored study material. No open-source license has been selected. Public availability does not grant rights to reuse the code or third-party quotations. ICF material and marks retain their respective owners' rights.
