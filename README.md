# Coachprep

A small browser-based study app for the eight ICF core competencies. Practice exact names, compare coaching choices or rehearse a written exam.

## Features

- Name recall with shared First letter, Next word and Core word hints, Pass and separate counts for answers with and without hints.
- Core competency recall summaries show one outcome per competency: correct without hints (green), correct with hints (yellow), recognized competency in the wrong order (yellow), or wrong/passed (red). Unseen competencies stay neutral; unfinished attempts are labeled unfinished. Question and mixed summary counts and existing review credit are unchanged.
- 32 original fictional coaching scenarios, four per primary competency, each with four plausible responses and a contextual explanation beside each option.
- Single-select best-fit practice with separate strongest-option and valid-approach credit. The competency, official definition and citations appear only after answering.
- Answer explanations focus on the coach's choices, the client's situation and possible effects. Scoring stays in the introduction and results, not in the reasoning beside an answer.
- A short fictional branching conversation retained in the source and saved data, but hidden from public navigation and entry points while it is developed further.
- Eight-item mixed practice across all competencies.
- Exam rehearsal with eight ordered name fields and a three-sentence summary in the user's own words for each competency. An elapsed count-up timer with no time limit, saved drafts, optional comparison with the previous completed pass and a text-copy download.
- Local progress and a simple review schedule: help, a name mismatch or a less suitable response returns in 10 minutes; names without hints and both question-credit categories follow 1, 3, then 7 days.
- Light by default, remembered light/dark choices, and an explicit System setting.
- Full-screen study dialogs in every mode, saved places, stable actions, keyboard controls, visible focus, screen-reader messages and reduced-motion support. Closing an initial introduction without starting returns to the prior view with launch focus restored, without a new session summary or mode event.
- Exercise introductions retain the Coachprep brand in the header and use the exercise heading as the dialog label. After starting, the header shows the exercise name. Home and closing summaries use their practice and resume actions instead of a duplicate navigation menu.
- Recall, Questions and mixed rounds contain at most eight items and end after the last feedback advance. Older longer saved sessions continue in eight-item segments; their answered history and queued items remain saved. Completed rounds offer Start a new round and Practice a different mode. Partial exits keep Resume.
- Submitted answers can be revisited within a round without changing them or earning credit again. Previous-answer review pauses both practice clocks and preserves the current draft and shared hint state. Exam previous-pass comparisons also pause writing time.
- A brief local confetti effect plays once on the first completed round in a mode, then when a round matches or improves on the previous comparable result. It has no network dependency and respects reduced motion. Comparisons use unaided accuracy for recall, question points divided by the current 104-point maximum, and the mean of these per-item values for mixed rounds. Exam comparisons use only exact ordered name matches, never free-form summaries. Transitional rounds containing older question scoring are not compared. Minimal completion flags and the previous mode aggregate stay locally; no performance data enters analytics.
- Per-competency closing results based on actual responses. Questions start at strongest 90, valid 80, improvement 0, plus up to 14 speed points only for accepted responses: `14 * clamp((60 - answerSeconds) / 56, 0, 1)`. The bonus is capped through 4 seconds and decreases linearly to zero at 60 seconds. Feedback, introductions and time away are excluded. Scores are rounded means of earned question scores, including zero-point responses; unseen competencies have no score. New strongest scores can reach 104 and valid scores 94; these are practice points, not percentages.
- Earned question scores are saved with each response. Existing responses without a saved score retain the previous 10-point/64-second bonus when loaded; newly answered questions use the new formula, including in resumed and mixed sessions. No historical response is rescored under the new formula.
- An optional coffee reminder below closing results from the third distinct visitor-local calendar day onward. It repeats at eligible summaries until Not now, which suppresses it for that local day only. The footer link remains available.

Names are checked for the official words in order, ignoring capitalization, extra spaces and punctuation around words. Competency identifiers and names use `C#. <Name>` throughout study and review. C1-C8 are display labels; type only the name. Exam explanations are preserved for self-review, not automatically graded.

Only the names are requested exactly. Definitions are study references. The three existing text fields now ask for one summary sentence each; their stored `bullets` IDs and all earlier answers remain unchanged. The app does not count sentences or grade their meaning automatically.

Question and option order vary between items. Within an item, the displayed option order and A-D labels stay unchanged after answering and when revisiting a saved answer, in both Questions and mixed practice. Your choice remains marked and receives focus without moving to the top. Review lists use narrative labels without revealing the evaluated competency. Each item has one authored strongest option; some have other valid approaches that earn credit and advance the review schedule. A valid approach does not increment strongest-option totals or count as missed. Less suitable means less suitable in the stated moment, not a universally wrong coaching behavior. These are study judgments, not validated ICF exam keys or assessment percentages.

Newly revealed choice markers, result labels and rationales use a single 160ms fade and 3px rise. Submitting does not animate or reorder the answer cards themselves. The question still collapses into its existing expandable review heading, and all rationales remain initially open. Previous-answer review and resumed feedback do not replay this feedback effect. Reduced-motion preferences disable it entirely; focus, navigation and actions do not wait for animation.

Actual item navigation has a separate 240ms horizontal entrance with easing: Back brings content from 40px to the left; Continue, Next and Return bring it from 40px to the right. Only the incoming study card moves, not the header or toolbar. Fast navigation cancels the previous transition, and reduced motion disables it, including a preference change while moving. Submitting, hints, reload and same-item rerenders do not trigger this slide.

The same duration and easing apply to practice lifecycle motion. Introductions enter from 40px below; Start and resumed practice enter forward from the right. Closing the actual modal moves it down 40px and fades it before restoring the existing summary or prior page. X, Escape, intro cancellation and completion use the same exit. Entry motion pauses practice clocks, and closure pauses/saves before moving. Reduced motion makes these transitions immediate. Interrupted entry, repeated exit and rapid reopen cancel stale motion without duplicate saves, summaries or completion events. Exam completion keeps its existing in-modal review; its later actual closure uses the downward exit.

The theme toggle stays on the home page; exercises retain the saved theme and put elapsed time in the header instead. Recall and Questions toolbars keep three fixed slots: Back on the left, Pass or historical Next in the middle, Submit/Continue/Return on the right. Unavailable directions leave empty slots. Return goes from locked historical review to the current item, or keeps the existing Back to results action after a completed round. Hinted-correct feedback retains its yellow state and assistance label without a question-mark icon. Scheduling messages are omitted from recall feedback without changing review dates.

New recall responses start at 10 practice points for a correct name at the required number. Successful hint presses across all three controls reduce that to 6, 4, 3, 2, then a minimum of 1 after five or more hints. Disabled/no-op presses do not count. The cumulative saved hint count survives switching hint types, review, reload and resume; older unfinished word-hint drafts retain their recorded press count. Another official competency entered at the wrong number earns 1 regardless of hints, while other answers and Pass earn 0. Matching uses the existing name normalization rules. Recall scoring versions keep prior earned scores frozen, including the earlier prototype's hinted 10-point results; missing historical scores are not fabricated. Questions and exam scoring are unchanged.

Recognized names in the wrong position use the distinct outcome Recognized competency, wrong order, with the remembered C number in feedback, summaries, saved review and newly recorded review dates. Hint use remains separately identified. Legacy saved guesses can use an exact normalized official-name match when the submitted text is available; records without that evidence keep their prior labels. This changes neither accuracy counts nor review scheduling or round comparisons. Closing results show recall practice scores separately from question scores. Completed standalone recall rounds with eight known earned scores also show a whole-number points percentage near the heading, calculated as `Math.round(total / 80 * 100)`. Partial rounds, Mixed, exam and historical rounds missing scores do not show that completed percentage.

Recall and Mixed recall hints sit below the answer input in the scrollable content, with one shared hint line. First letter reveals the leftmost hidden word's initial, Next word expands the leftmost word that is not fully shown, and Core word reveals the next eligible editorial core word in title order. Core words are Ethical/Practice, Coaching/Mindset, Agreements, Trust/Safety, Presence, Listens, Awareness, and Client/Growth for C1-C8 respectively. Fully shown words are skipped. At least one word stays partly hidden; its initial can still be shown unless it is a single-letter word, whose initial would reveal the whole word. Exhausted or blocked controls disable, and only Pass reveals the complete name. Earlier word-hint drafts retain their revealed words on resume. Hint use still counts as assisted practice once, regardless of hint type.

Submit, Pass and navigation stay in the shared bottom toolbar. Questions retain their existing scrollable Practice help without new hint functionality. Paused and completed summaries put Resume/Start a new round, Practice a different mode and saved-answer review immediately below the title, hide duplicate top navigation, and use an accessible decorative icon beside Stats by competency. Unfinished recall names remain concealed in summaries.

Recall hints use compact, intrinsic-width controls with 44px minimum touch targets. Supporting citations, help, elapsed time and secondary toolbar actions use smaller, lower-contrast text while retaining accessible contrast in both themes. Correct recall feedback shows the expected official name without repeating the submitted answer; wrong and misplaced guesses retain the comparison. Submitting or choosing Pass focuses Continue. A separate Enter advances, while held-key repeats cannot skip feedback. Returning to current recall feedback or resuming it also restores focus to Continue; historical review focuses the expected name instead.

Immediate recall feedback and saved review use the same actual-result priority as the closing summary: correct without hints is green, correct with hints is yellow, and incorrect guesses or Pass are red and labeled Wrong / passed, even after hints. Recognized names in the wrong position stay distinct with a yellow, non-success order marker. Labels and icons accompany color; assistance alone never produces a success state.

## Run locally

There are no packages, build tools, accounts or backend services to install. With Python available, run:

```powershell
python -m http.server 8847 --bind 127.0.0.1
```

Open `http://127.0.0.1:8847/`. Use the local server so SVG masks and browser storage work consistently.

## GitHub Pages

Pushes to any branch or tag and pull requests run read-only validation. They do not publish the site. Production deployment runs only when a stable GitHub Release is published with a unique tag in `vMAJOR.MINOR.PATCH` form, such as `v0.1.0`. Drafts, prereleases and tag pushes alone do not deploy. There is no manual deployment workflow.

The deployment verifies that the release is still published and immutable, resolves its tag and checks out the exact event commit rather than the current branch tip. It validates that snapshot, then copies only the eight runtime files, sharing PNG, selected logo and favicon SVG into the Pages artifact. Workflow run names, summaries, asset checksums and the `github-pages` deployment history record which release and SHA were published. A release is live only after its Pages deployment succeeds.

Repository settings use **GitHub Actions** as the Pages source, **Enable release immutability** for future releases, and a `github-pages` environment allowing only the tag pattern `v*`, with no branch permission. Keep these settings: immutability locks published tags/assets, and the environment blocks historical `main` deployments too.

All app assets use relative URLs. The app works at a GitHub project-site subpath and does not require server-side routing. Navigation stays within the page.

### Publish a version

Choose a reviewed full commit SHA containing these workflows and use a new version tag. Replace the example version and SHA before running:

```powershell
$Snapshot = "REPLACE_WITH_REVIEWED_FULL_COMMIT_SHA"
git tag -a v0.1.0 $Snapshot -m "Coachprep v0.1.0"
git push origin refs/tags/v0.1.0
gh release create v0.1.0 --verify-tag --draft --title "v0.1.0" --notes "Describe the changes."
```

Review the draft and attach any release assets before publishing; immutable assets cannot be changed afterward. Leave the prerelease option off, then publish in GitHub or run `gh release edit v0.1.0 --draft=false`. Confirm the matching **Deploy GitHub Pages** run succeeds and check both public URLs. Keep the release and tag as the source snapshot even after Actions artifacts expire.

### Roll back

Find a prior release with a successful Pages deployment and confirm its full commit SHA. Create a new, unused version tag pointing at that same commit, then publish a stable release describing the rollback. For example, after a problematic `v0.1.1`, restore the source from `v0.1.0` as `v0.1.2`:

```powershell
git fetch origin --tags
git rev-parse 'v0.1.0^{commit}'
git tag -a v0.1.2 'v0.1.0^{commit}' -m "Restore the v0.1.0 snapshot"
git push origin refs/tags/v0.1.2
gh release create v0.1.2 --verify-tag --title "v0.1.2: rollback to v0.1.0" --notes "Restore the known-good v0.1.0 snapshot."
```

This records a new publication of the old source without moving tags, reverting application commits or force-pushing history. Browser storage is not rolled back; check saved-data compatibility when choosing the target.

Release tags must contain the release workflow. Older commits cannot gain a new trigger retroactively. The commit introducing this policy preserves the runtime files from the pre-release live commit `4493ca806986b429e962fa367901d4b06b1eedaa` unchanged; use that policy-enabled snapshot as the fallback for the current site. Enabling this policy does not itself create a release or change the live site.

## Site logo

The header, exercise introductions and home orbit use `assets/coachprep-logo.svg`, the selected compact diagonal Twin C mark. A CSS mask applies the existing theme color while preserving the SVG's geometry and aspect ratio. The favicon and sharing image use the same exact path and viewBox. The transparent SVG favicon switches color for light or dark browser chrome.

Sources & about keeps attribution, educational/noncommercial purpose, assessment limitations and truthful storage/analytics disclosures alongside theme and opt-out controls. Its X stays visible while the content scrolls; X and Escape return focus to the opening button. The informational caveats do not promise legal protection or create a new repository license.

## Sharing image

The initial HTML includes a canonical URL, Open Graph metadata and a Twitter large-image card. The 1200x630 PNG is `assets/share-card.png`; edit `assets/share-card.svg` to change the design. Metadata uses a versioned PNG URL so the refreshed logo does not depend on an older image cache.

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
