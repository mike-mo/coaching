# ICF core competency practice

A small browser-based study app for the eight ICF core competencies. Practice exact titles, compare coaching choices, try a fictional conversation or rehearse a written exam.

## Features

- Title recall with progressive word hints, Pass and separate counts for answers with and without hints.
- 32 original fictional coaching scenarios, four per primary competency, each with four plausible responses and a contextual explanation beside each option.
- Single-select best-fit practice with separate strongest-fit and reasonable-fit credit. The competency, official definition and citations appear only after answering.
- A short fictional branching conversation with source-backed feedback.
- Eight-item mixed practice across all competencies.
- Exam rehearsal with eight ordered title fields and three explanation points per competency. Untimed by default, with an optional two-hour timer, saved drafts and a text-copy download.
- Local progress and a simple review schedule: help, a title mismatch or a less suitable response returns in 10 minutes; titles without hints and both question-credit categories follow 1, 3, then 7 days.
- Light by default, remembered light/dark choices, and an explicit System setting.
- Responsive layouts, keyboard controls, visible focus, screen-reader messages and reduced-motion support.

Titles are checked for the official words in order, ignoring capitalization, extra spaces and punctuation around words. C1-C8 are display labels; type only the title. Exam explanations are preserved for self-review, not automatically graded.

Question and option order vary. The scenario picker and review list use narrative labels, without revealing the evaluated competency. Each item has one authored strongest fit; some have other reasonable responses that earn real credit and advance the review schedule. A reasonable response does not increment strongest-fit totals or count as missed. Less suitable means less suitable in the stated moment, not a universally wrong coaching behavior. These are study judgments, not validated ICF exam keys or assessment percentages.

## Run locally

There are no packages, build tools, accounts or backend services to install. With Python available, run:

```powershell
python -m http.server 8847 --bind 127.0.0.1
```

Open `http://127.0.0.1:8847/`. You can also open `index.html` directly, although a stable local server address is more reliable for browser storage.

## GitHub Pages

The Pages workflow runs on pushes to `main` or a manual workflow dispatch. It copies the seven runtime files and sharing image into a static artifact and deploys that artifact using GitHub's Pages actions.

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

Earlier `q1`-`q8` question records are retained as historical results in all-time counts. The expanded scenarios use new stable IDs and start their own review schedules. Existing recall results and exam drafts are preserved. Older saved records gain a zero-valued reasonable-fit counter when loaded; no storage reset is required.

The exam timer stores a real deadline. Refreshing or returning later does not restart it; expiration saves the answers and opens review. Drafts save while editing. Storage failures are shown in the app, and a text download provides a backup.

Storage is specific to the browser profile and origin, not synced between devices. Clearing site data or using private browsing may remove saved work. Use fictional examples in rehearsal.

The local and GitHub Pages versions use no analytics or external runtime scripts. On `https://smartify.space/coaching/`, an intentional Cloudflare Web Analytics beacon provides basic page metrics, and a first-party collector counts study-mode starts and completions. Neither is required to study. Do Not Track, Global Privacy Control and the saved Sources & about opt-out disable usage statistics. If the beacon has already loaded, study counts stop immediately and the Sources message explains that a later reload stops the beacon too.

Custom events contain only schema version, event and mode. They contain no visitor identifiers, cookies, IP addresses, referrers, query strings, answers, scores, competency details or draft text. Counts are events, not unique people. See [Cloudflare deployment and analytics](cloudflare/README.md) for setup, lifecycle definitions and authenticated aggregate queries. There is no public analytics query endpoint, login or AI service. Opening the official source or optional coffee link visits an external site in a new tab.

## Sources and limitations

Primary source: **2025 ICF Core Competencies**, released September 2025, revision 09.08.25, PDF pp. 3-10. The eight official titles and short definitions are quoted with attribution. Summaries, questions, rationales, fictional dialogue and review examples are original study material. Each question and scenario review identifies its official 2025 sub-competency IDs and PDF page.

Read the official model through the [ICF core competencies resource](https://coachingfederation.org/credentialing/coaching-competencies/icf-core-competencies/).

This is independent practice guidance, not an official ICF assessment or endorsement. Counts do not measure PCC competence or certification readiness. Fictional client reactions are examples, not predictions of how a real client will respond.

Source PDFs, proprietary question banks, private assignments, recordings, client records and personal answers are not included. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and licensing scope.

## Rights

Copyright (c) 2026 mike-mo for original code and original authored study material. No open-source license has been selected. Public availability does not grant rights to reuse the code or third-party quotations. ICF material and marks retain their respective owners' rights.
