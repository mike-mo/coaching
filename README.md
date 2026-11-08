# ICF core competency practice

A small browser-based study app for the eight ICF core competencies. Practice exact titles, compare coaching choices, try a fictional conversation or rehearse a written exam.

## Features

- Title recall with progressive word hints, Pass and separate counts for answers with and without hints.
- Eight original multiple-choice questions, with an explanation beside each option after answering.
- A short fictional branching conversation with source-backed feedback.
- Eight-item mixed practice across all competencies.
- Exam rehearsal with eight ordered title fields and three explanation points per competency. Untimed by default, with an optional two-hour timer, saved drafts and a text-copy download.
- Local progress and a simple review schedule: help or a missed answer returns in 10 minutes; successive correct answers without hints follow 1, 3, then 7 days.
- Light by default, remembered light/dark choices, and an explicit System setting.
- Responsive layouts, keyboard controls, visible focus, screen-reader messages and reduced-motion support.

Titles are checked for the official words in order, ignoring capitalization, extra spaces and punctuation around words. C1-C8 are display labels; type only the title. Exam explanations are preserved for self-review, not automatically graded.

## Run locally

There are no packages, build tools, accounts or backend services to install. With Python available, run:

```powershell
python -m http.server 8847 --bind 127.0.0.1
```

Open `http://127.0.0.1:8847/`. You can also open `index.html` directly, although a stable local server address is more reliable for browser storage.

## GitHub Pages

The Pages workflow runs on pushes to `main` or a manual workflow dispatch. It copies only the six runtime files into a static artifact and deploys that artifact using GitHub's Pages actions.

Enable GitHub Pages with **GitHub Actions** as the source in the repository's Settings > Pages. The deployment environment records the published URL.

All app assets use relative URLs. The app works at a GitHub project-site subpath and does not require server-side routing. Navigation stays within the page.

Serving it at a custom path such as `https://smartify.space/coaching/` requires routing on that domain's existing host or reverse proxy. A DNS record or GitHub Pages CNAME cannot route an individual URL path. This repository does not claim the domain or configure its DNS.

## Saved data

Study results, counters, review dates, conversation counts and exam answers stay in `localStorage` under `icf-practice-room-v1`. Theme choices use the separate `icf-study-theme-v1` key. Reset progress requires confirmation and leaves the theme choice unchanged.

The exam timer stores a real deadline. Refreshing or returning later does not restart it; expiration saves the answers and opens review. Drafts save while editing. Storage failures are shown in the app, and a text download provides a backup.

Storage is specific to the browser profile and origin, not synced between devices. Moving from localhost to GitHub Pages starts a separate history; the app does not migrate answers automatically. Clearing site data or using private browsing may remove saved work. Use fictional examples in rehearsal.

The app has no analytics, login, AI service, external runtime scripts or tracking widget. Opening the official source or optional coffee link visits an external site in a new tab.

## Sources and limitations

Primary source: **2025 ICF Core Competencies**, released September 2025, revision 09.08.25, PDF pp. 3-10. The eight official titles and short definitions are quoted with attribution. Summaries, questions, rationales, fictional dialogue and review examples are original study material. Each question and scenario review identifies its official 2025 sub-competency IDs and PDF page.

Read the official model through the [ICF core competencies resource](https://coachingfederation.org/credentialing/coaching-competencies/icf-core-competencies/).

Exam format reference: **Preparing for Graduation-One Month Left!**, course announcement posted November 4, 2026, Written Exam section. The relevant task is paraphrased: write the eight titles in order and three points in your own words for each. Official descriptions need not be memorized. The course allows two hours; this app also offers untimed rehearsal. The original announcement and unrelated course details are not distributed.

Official 2025 numbers, such as `3.06`, are not interchangeable with course Feedforward/PCC-style markers such as `3.1`.

This is independent practice guidance, not an official ICF assessment or endorsement. Counts do not measure PCC competence or certification readiness. Fictional client reactions are examples, not predictions of how a real client will respond.

Source PDFs, proprietary question banks, private assignments, recordings, client records and personal answers are not included. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and licensing scope.

## Rights

Copyright (c) 2026 mike-mo for original code and original authored study material. No open-source license has been selected. Public availability does not grant rights to reuse the code or third-party quotations. ICF material and marks retain their respective owners' rights.
