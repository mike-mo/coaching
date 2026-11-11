# Coachprep

A small browser-based study app for the eight ICF core competencies. Practice exact names, compare coaching choices or explain the competencies in your own words.

## Features

- Step-by-step 01 practice: choose an official name from a C number, choose a C number from a core word, type a name from a core word, then type a name from a C number. Each competency progresses independently. Hints appear only at the final step; Pass is always available.
- Core competency recall summaries show one outcome per competency: correct without hints (green), correct with hints (yellow), recognized competency in the wrong order (yellow), or a missed answer (red). Missed answers distinguish Pass: answer revealed from Name did not match when the saved result supports that distinction. Unseen competencies stay neutral; unfinished attempts are labeled unfinished. Existing review credit is unchanged.
- Completed recall summaries separate the actual without-hints count from points. Optional targeted retries repeat passed, nonmatching and wrong-position competencies from that round, with correctly hinted competencies available through an unchecked inclusion control. Selecting or starting a retry does not reschedule items; normal practice recording still applies to subsequent hints and answers. All three summary actions remain.
- 32 original fictional coaching scenarios, four per primary competency, each with four plausible responses and a contextual explanation beside each option.
- Single-select best-fit practice with separate strongest-option and valid-approach credit. The competency, official definition and citations appear only after answering.
- Answer explanations focus on the coach's choices, the client's situation and possible effects. Scoring stays in the introduction and results, not in the reasoning beside an answer.
- A short fictional branching conversation retained in the source and saved data, but hidden from public navigation and entry points while it is developed further.
- Eight-item Mixed practice across all competencies, with up to 10 points for a name and 9 for a scenario, matching new standalone 01 and 02 sessions. Cards use the same layout, omit zero-count categories and distinguish correct, assisted, wrong-order and missed results.
- Written competency rehearsal with eight ordered name fields and a three-sentence summary in the user's own words for each competency. An elapsed count-up timer with no time limit, saved drafts, optional comparison with the previous completed pass and a text-copy download. Entry and setup identify it as a memory and self-explanation exercise, not an ICF exam simulation, with separate official ACC and PCC-MCC exam-guidance links.
- Local progress and a simple review schedule: help, a name mismatch or a less suitable response returns in 10 minutes; names without hints and both question-credit categories follow 1, 3, then 7 days.
- Light by default, remembered light/dark choices, and an explicit System setting.
- Full-screen study dialogs in every mode, saved places, stable actions, keyboard controls, visible focus, screen-reader messages and reduced-motion support. Closing an initial introduction without starting returns to the prior view with launch focus restored, without a new session summary or mode event.
- Exercise introductions retain the Coachprep brand in the header and use the exercise heading as the dialog label. After starting, the header shows the exercise name. Home and closing summaries use their practice and resume actions instead of a duplicate navigation menu.
- Recall, Questions and mixed rounds contain at most eight items and end after the last feedback advance. Older longer saved sessions continue in eight-item segments; their answered history and queued items remain saved. Completed rounds offer Start a new round and Practice a different mode. Partial exits keep Resume.
- Submitted answers can be revisited within a round without changing them or earning credit again. Previous-answer review pauses both practice clocks and preserves the current draft and shared hint state. Exam previous-pass comparisons also pause writing time.
- A brief local confetti effect plays once on the first completed round in a mode, then when a round matches or improves on the previous comparable result. It has no network dependency and respects reduced motion. New scored sessions compare earned points divided by actual available points. Adaptive rounds additionally require matching exercise formats. Earlier sessions retain their own comparison rules. Exam comparisons use only exact ordered name matches, never free-form summaries. Incompatible scoring versions are not compared. Minimal completion flags and the previous mode aggregate stay locally; no performance data enters analytics.
- Targeted recall retries use the normal saved recall flow, including drafts, locked answer review and per-competency points. Their results are labeled separately and show earned points against the actual selected maximum (10 per competency), never a fabricated full-round percentage. They do not trigger confetti, replace the full-round comparison baseline or set a first full-round completion flag. Start a new round still starts ordinary eight-competency recall.
- New 01, 02 and Mixed summaries show a whole-percent earned/available headline and saved integer points against actual item caps. The same saved integers appear in answer feedback, competency cards and round totals. Percentages describe practice points, not coaching ability. Home aggregates count answers, not points from incompatible policies.
- Scores are saved once on submission. Feedback, introductions, transitions, review and time away are excluded from answer timing. Earlier sessions retain their own scoring: Questions and unmarked Mixed use their existing 90/80 base and speed bonuses; the first scored Mixed version keeps its 100/90 scale. No historical response is rescored.
- An optional coffee reminder directly below the percentage and above the action buttons on completed ordinary 01, 02 and Mixed summaries, from the third distinct visitor-local calendar day onward. It never interrupts questions, paused rounds or targeted retries. Treat me to a coffee hides it until the next local day, without assuming a donation. Not now hides it until three more distinct ordinary rounds are completed or the next local day, whichever comes first. The footer remains available with the same heart-shaped-steam icon and caption.

### Step-by-step practice (01)

All new ordinary 01 rounds use the four steps above. The question-word list is Ethical, Mindset, Agreements, Trust/Safety, Presence, Listens, Awareness and Growth. C4 alternates Trust and Safety. Word-to-number choices show four C numbers, never names containing the answer word. Both typing steps require the full official name. Word questions conceal the correct number, group and citation page until feedback. Typed items come before choices, with due-date ordering and shuffled ties within each group, to reduce answer exposure.

Each competency starts at Step 1, without inferring readiness from historical scores. Two consecutive correct answers without hints in ordinary rounds move that competency up one step, including within the same day. Repeating full rounds counts; there is no waiting period. A wrong answer, Pass or hinted answer breaks its move-up streak; two such results among its last three ordinary answers at the same step move it back one step. Steps stay between 1 and 4. Format and cue are frozen for each round.

Previously counted successes stay saved. The next ordinary answer applies the two-success rule: a correct answer can move the competency up one step, while a wrong answer, Pass or hinted answer breaks the streak. Loading or reviewing saved answers does not change steps or earned scores. Answer speed does not affect progression or recall points, since it can favor guesses and faster typing or devices rather than stronger recall.

Home's collapsed Review your progress section shows each full official competency name, current practice level and current move-up streak in three columns. New competencies show 0 of 2 correct; promotion and fallback reset the displayed streak. Level 4 invites continued practice without promising another level. Older saved streaks already at the threshold retain their actual count and explain that the next correct answer moves them up. Home no longer lists review dates, but underlying schedules and saved dates are unchanged.

These are proposed practice rules, not validated difficulty or learning thresholds. Number association, selecting visible wording and recalling a full name are different tasks. A supplied title word can make typing easier than selecting its number. [Research on question formats](https://doi.org/10.1080/09658211.2013.831454) does not establish a universal ordering. [Spacing research](https://doi.org/10.1037/0033-2909.132.3.354) supports delayed practice, not these exact intervals.

Correct answers earn 10 practice points at Steps 1-3. Step 4 retains existing hint deductions and 1-point credit for typing another official name at the wrong number. Other wrong answers and Pass earn zero; Pass remains red even after hints. Results identify each format; new sessions also show a whole-percent points total, explicitly not a measure of ability. Choice feedback retains all four options in their saved positions and identifies the correct answer; [corrective-feedback research](https://doi.org/10.3758/MC.36.3.604) supports addressing distractor errors.

Correct unaided feedback rotates through Correct!, Well done! and Exactly! within each round. The chosen message is saved with the answer and stays the same on reload or review. Correct answers with hints keep their assistance label; Pass, incorrect answers and wrong-order answers never receive a success message.

After a choice, the selected option is green if correct or red if incorrect, with text labels as well as color. Options stay in their saved order and cannot be changed in review. Pass reveals the correct option without highlighting a selection.

Adaptive counts, steps, dates and comparisons are separate from earlier recall and Mixed data, under the same browser-local study key. Correct unhinted answers schedule 1, 3, then 7 days; help, wrong answers or Pass schedule 10 minutes. Moving up resets the review streak and schedules the new step in 1 day; fallback schedules 10 minutes. First hint use reschedules once, not again on that answer's submission.

Targeted adaptive retries use the selected competencies' current steps, show their actual selected maximum and never advance or lower steps. Selecting a retry changes no review date; subsequent responses and hints still update scheduling. Hinted-correct responses remain an optional unchecked inclusion. Retries do not replace full-round baselines or trigger completion celebrations. Full adaptive rounds compare only when all eight formats and scoring versions match. New rounds compare saved point totals; older rounds retain unaided accuracy. Their first-completion flag is separate from historical recall.

Saved unmarked recall rounds, queued segments and their retries keep their original format, hints and scores. Mixed keeps the original typed-name format and hints, with a separate scoring version for new sessions. Start a new round from a completed legacy recall session enters adaptive practice. The detailed legacy recall behavior below still applies to those saved rounds and Mixed; shared hints and name deductions also apply at adaptive Step 4. Existing completed scores are never recalculated.

### Unified practice points

New 02 and Mixed sessions use `scorePolicy: "integer-10-9-v2"` on the session and saved round, with `scoreVersion: 6` on answers. Standalone 01 and targeted name retries retain `integer-10-9-v1` and response version 5, with unchanged points and comparisons. Names, including adaptive choices, earn up to 10 points. Successful extra hint presses reduce that to 6, 4, 3, 2, then a minimum of 1. A built-in question word or choice list is part of the exercise, not an extra hint. Another official name typed at the wrong number earns 1 regardless of hints. Other wrong answers and Pass earn zero. Name points and adaptive progression never depend on speed.

New scenario points use `t = clamp((answerSeconds - 16) / 44, 0, 1)`: strongest `Math.round(9 - 5*t)`, valid alternative `Math.round(8 - 5*t)`, unsuitable 0. There is no time deduction through 16 seconds inclusive. Strongest answers earn 9 through 16 seconds and 4 at 60 seconds or later; valid alternatives earn 8 and 3 at those endpoints. Rounding occurs once on submission. The saved whole number is reused, not recomputed from a later clock.

Cards and round results sum saved integers and actual item caps, including unanswered items in the maximum. Eight names have 80 possible points, eight scenarios 72, and a four-name/four-scenario round 76. These are computed from the actual queued round, including targeted retries. The headline is `Math.round(100 * earned / available)`. Any missed answer makes its combined competency card red; otherwise wrong order or assistance makes it yellow. Accepted results are green, with outcome text that distinguishes strongest, valid and name results. Written rehearsal and self-reviewed explanations do not gain point percentages.

Existing drafts, queued segments, completed results and saved review retain their original units, earned scores and subsequent-answer policy. Earlier `integer-10-9-v1` sessions keep response version 5 and their 4-second scenario window, using `clamp((answerSeconds - 4) / 56, 0, 1)`. Their summaries and queued-round introductions describe that original window. Unmarked Mixed retains separate Earlier name points and Earlier question points. Its 100/90 successor keeps `mixedScoreVersion: 1` and response version 4, including `Math.round(oldQuestionPoints * 90 / 104)` for subsequent scenarios. Existing adaptive sessions retain response version 3 and their prior comparison scheme. No saved session is upgraded in place, and unlike scenario timing versions never compare for improvement/confetti. Standalone 01 comparisons, answer counts and scheduling are unchanged.

Names are checked for the official words in order, ignoring capitalization, extra spaces and punctuation around words. Competency identifiers and names use `C#. <Name>` in feedback and review; word questions conceal the correct identifier until answered. C1-C8 are answer options only for word-to-number selection; type only the name in both typing steps. Exam explanations are preserved for self-review, not automatically graded.

Only the names are requested exactly. Definitions are study references. The three existing text fields now ask for one summary sentence each; their stored `bullets` IDs and all earlier answers remain unchanged. The app does not count sentences or grade their meaning automatically.

Question and option order vary between items. Within an item, the displayed option order and A-D labels stay unchanged after answering and when revisiting a saved answer, in both Questions and mixed practice. Your choice remains marked and receives focus without moving to the top. A plain-text toolbar cue says Select an answer to see feedback; selecting an option still submits immediately. Review lists use narrative labels without revealing the evaluated competency. Each item has one authored strongest option; some have other valid approaches that earn credit and advance the review schedule. A valid approach does not increment strongest-option totals or count as missed. Less suitable means less suitable in the stated moment, not a universally wrong coaching behavior. These are study judgments, not validated ICF exam keys or assessment percentages.

Sources & about links to the official ICF Code of Ethics and distinguishes Code standards 2.4/2.5 from 2025 core-competency IDs and PCC/course markers. The records/transcription scenario links both standards from its unchanged rationales; the technology-rating scenario links standard 2.5. Official competency quotations, options, reasoning, disclosure defaults and feedback focus/layout stay unchanged. Exam guidance is route- and date-specific; the app's 2025 study model is not a claim about every exam's reference version.

Newly revealed choice markers, result labels and rationales use a single 160ms fade and 3px rise. Submitting does not animate or reorder the answer cards themselves. The question still collapses into its existing expandable review heading, and all rationales remain initially open. Previous-answer review and resumed feedback do not replay this feedback effect. Reduced-motion preferences disable it entirely; focus, navigation and actions do not wait for animation.

The optional competency reflection stays collapsed below the strongest option's explanation in Questions and Mixed. Its invitation is "Bonus exercise: which competencies and markers are at play?" with a separate muted line, "Think it through, then expand to review." The unchanged official definition is an indented italic blockquote. Sub-competencies show their official number and exact text without decorative quote marks, with tighter list spacing. A circled-i beside each competency heading reveals the source version, PDF page and official resource link on hover, keyboard focus/activation or touch; Escape, the close control and outside clicks dismiss it. The existing takeaway and official references remain unchanged and are not relabeled as PCC assessment markers. The hidden conversation exercise uses the same invitation, compact source controls and reference list below its existing explanation.

Actual item navigation has a separate 240ms horizontal entrance with easing: Back brings content from 40px to the left; Continue, Next and Return bring it from 40px to the right. Only the incoming study card moves, not the header or toolbar. Fast navigation cancels the previous transition, and reduced motion disables it, including a preference change while moving. Submitting, hints, reload and same-item rerenders do not trigger this slide.

The same duration and easing apply to practice lifecycle motion. Introductions enter from 40px below; Start and resumed practice enter forward from the right. Closing the actual modal moves it down 40px and fades it before restoring the existing summary or prior page. X, Escape, intro cancellation and completion use the same exit. Entry motion pauses practice clocks, and closure pauses/saves before moving. Reduced motion makes these transitions immediate. Interrupted entry, repeated exit and rapid reopen cancel stale motion without duplicate saves, summaries or completion events. Exam completion keeps its existing in-modal review; its later actual closure uses the downward exit.

The theme toggle stays on the home page; exercises retain the saved theme and put elapsed time in the header instead. Recall and Questions toolbars keep three fixed slots: Back on the left, Pass or historical Next in the middle, Submit/Continue/Return on the right. Unavailable directions leave empty slots. Return goes from locked historical review to the current item, or keeps the existing Back to results action after a completed round. Hinted-correct feedback retains its yellow state and assistance label without a question-mark icon. Scheduling messages are omitted from recall feedback without changing review dates.

Adaptive 01 focuses the answer textbox or first choice when starting, advancing or returning to an unanswered item. The question remains associated with the control for assistive technology. Enter evaluates an answer and focuses Continue; a separate Enter advances. Held Enter does not skip feedback or answer the next item. Locked answer review keeps its existing focus behavior.

New recall responses start at 10 practice points for a correct name at the required number. Successful hint presses across all three controls reduce that to 6, 4, 3, 2, then a minimum of 1 after five or more hints. Disabled/no-op presses do not count. The cumulative saved hint count survives switching hint types, review, reload and resume; older unfinished word-hint drafts retain their recorded press count. Another official competency entered at the wrong number earns 1 regardless of hints, while other answers and Pass earn 0. Matching uses the existing name normalization rules. Recall scoring versions keep prior earned scores frozen, including the earlier prototype's hinted 10-point results; missing historical scores are not fabricated. Earlier question sessions retain their original scoring; Written practice remains self-reviewed.

Recognized names in the wrong position use the distinct outcome Recognized competency, wrong order, with the remembered C number in feedback, summaries, saved review and newly recorded review dates. Hint use remains separately identified. Legacy saved guesses can use an exact normalized official-name match when the submitted text is available; records without that evidence keep their prior labels. Accuracy counts and review scheduling are unchanged. Earlier unmarked Mixed results keep recall practice scores separate from question scores. Legacy standalone recall shows its completed percentage only with eight known earned scores, calculated as `Math.round(total / 80 * 100)`. New scored sessions use the earned/available headline described above, including partial rounds with unanswered items counted in the maximum. Written rehearsal has no points percentage.

Recall and Mixed recall hints sit below the answer input in the scrollable content, with one shared hint line. First letter reveals the leftmost hidden word's initial, Next word expands the leftmost word that is not fully shown, and Core word reveals the next eligible editorial core word in title order. Core words are Ethical/Practice, Coaching/Mindset, Agreements, Trust/Safety, Presence, Listens, Awareness, and Client/Growth for C1-C8 respectively. Fully shown words are skipped. At least one word stays partly hidden; its initial can still be shown unless it is a single-letter word, whose initial would reveal the whole word. Exhausted or blocked controls disable, and only Pass reveals the complete name. Earlier word-hint drafts retain their revealed words on resume. Hint use still counts as assisted practice once, regardless of hint type.

Submit, Pass and navigation stay in the shared bottom toolbar. Questions retain their existing scrollable Practice help without new hint functionality. Paused and completed summaries put their actions below the heading, score and any eligible coffee reminder, in the order "< Review your answers", "Practice a different mode", "Start a new round >". An unfinished round keeps a Resume action, and review is only available when saved answers exist. The actions stack in the same order on phones. Summaries hide duplicate top navigation and use an accessible decorative icon beside Stats by competency. Their top-right X invokes the same handler as Practice a different mode, including that summary's existing focus behavior. Unfinished recall names remain concealed in summaries.

Recall hints use compact, intrinsic-width controls with 44px minimum touch targets. Supporting citations, help, elapsed time and secondary toolbar actions use smaller, lower-contrast text while retaining accessible contrast in both themes. Correct recall feedback shows the expected official name without repeating the submitted answer; wrong and misplaced guesses retain the comparison. Submitting or choosing Pass focuses Continue. A separate Enter advances, while held-key repeats cannot skip feedback. Returning to current recall feedback or resuming it also restores focus to Continue; historical review focuses the expected name instead.

Hint reveals preserve the answer's caret and text selection. Programmatic focus leaves native controls in the Tab order; returning to answered Questions focuses the selected response's visible summary. Changes to saved progress in another tab refresh idle home/results views and invalidate stale review actions. An open practice draft stays visible with a conflict warning instead of being overwritten; copy any needed work before refreshing.

Immediate recall feedback and saved review use the same actual-result priority as the closing summary: correct without hints is green, correct with hints is yellow, and incorrect guesses or Pass are red, even after hints. Pass: answer revealed and Name did not match distinguish the two missed outcomes without awarding points or a success announcement. Saved records without enough evidence retain a generic Needs another look label. Recognized names in the wrong position stay distinct with a yellow, non-success order marker. Labels and icons accompany color; assistance alone never produces a success state.

## Run locally

There are no packages, build tools, accounts or backend services to install. With Python available, run:

```powershell
python -m http.server 8847 --bind 127.0.0.1
```

Open `http://127.0.0.1:8847/`. Use the local server so SVG masks and browser storage work consistently.

## GitHub Pages

Pushes to any branch or tag and pull requests run read-only validation. They do not publish the site. Production deployment runs only when a stable GitHub Release is published with a unique tag in `vMAJOR.MINOR.PATCH` form, such as `v0.1.0`. Drafts, prereleases and tag pushes alone do not deploy. There is no manual deployment workflow.

The deployment verifies that the release is still published and immutable, resolves its tag and checks out the exact event commit rather than the current branch tip. It validates that snapshot, then copies only the eight runtime files, sharing PNG, selected logo, favicon and coffee SVG into the Pages artifact. Workflow run names, summaries, asset checksums and the `github-pages` deployment history record which release and SHA were published. A release is live only after its Pages deployment succeeds.

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

The same study key also stores a compatible `practices` field keyed by mode: unfinished name attempts, selected question responses, option order, conversation position and elapsed/answer milliseconds. Each mode keeps its own saved place. Closing pauses study and exam elapsed clocks. The `/coaching/` to `/coachprep/` custom-path migration keeps the same origin and storage keys.

Coffee progress starts prospectively, without reconstructing rounds or dates from old answer counters. A versioned `supportHistory` inside the study key counts ordinary completed 01/02/Mixed rounds and distinct local completion dates. Existing unfinished drafts and queued segments count when completed under this version; old finished rounds, reloads, saved review, pauses, targeted retries, Conversation and Written do not. Completion uses the existing saved completion flag and transaction, without a new round or visitor identifier. Failed study saves roll these counters back too. Reset study progress clears this local summary along with learning progress.

Only current and yesterday's compact comparison aggregates are retained, matched by mode, scoring policy, actual item set, item count and adaptive steps/core-word cues. Only saved unified integer scores participate. Positive comparisons use average earned/available percentages, reported as whole percentage points, or average foreground round duration, reported as a whole percent less time. Score improvement takes precedence; faster time alone does not produce the Good progress heading or imply better learning. Missing, zero-time, incompatible or nonpositive comparisons are omitted. At most 256 comparison groups are kept; exceeding the limit disables that day's optional comparison rather than presenting a partial average. All round/day counts remain intact. None of these dates, counts or comparison values leave this browser, and no new answer text or analytics is stored.

The separate `coachprep-coffee-days-v1` key now uses a compatible version 3 value, retaining at most three visiting dates and a local-day cooldown with the completed-round count at dismissal. Version 1 visit dates/same-day dismissal and version 2 cooldowns are preserved on migration. A Treat click, including the permanent footer link, suppresses until a strictly later local calendar date. Not now can also expire after three additional ordinary completions across modes. Re-rendering and review do not advance it. Clock rollback does not end a next-day cooldown early. Reset study progress keeps coffee, theme and privacy preferences, adjusting the dismissal's round-count reference to the cleared counter. Clearing site data removes these too. Invalid coffee or support-summary data disables the automatic reminder with a visible warning; study answers remain available. No payment or donation state is collected or inferred from clicks.

The inline card cycles through seven approved invitation lines in order, starting with "A little practice for you, a little coffee for me?" and using "Finding your coaching footing?" in the fourth. Only the current index, completed-round count at exposure and a pending-next-exposure flag are saved. A newly completed ordinary round with an eligible reminder, or the first eligible return after Treat/Not now, advances once; intervening suppressed rounds do not skip lines. Reloads, saved review, rerenders, focus, theme changes and minute updates retain the current line. A new date alone does not rotate an undismissed exposure. The footer caption, icon, progress comparison and cooldowns are unchanged. Preference write failures show a warning and withhold the reminder rather than displaying an unstable choice.

Earlier `q1`-`q8` question records are retained as historical results in all-time counts. The expanded scenarios use new stable IDs and start their own review schedules. Existing recall results and exam drafts are preserved. Older saved records gain a zero-valued reasonable-fit counter when loaded; no storage reset is required.

The exam stores elapsed practice milliseconds and pauses when safely closed. Older timed and untimed attempts keep all answers; countdown drafts become count-up drafts without expiring, using previously saved elapsed study time where available (otherwise starting elapsed measurement at zero). Earlier expired passes remain completed reviews. When starting another rehearsal, the latest completed pass is saved under `examPrevious` in the same study record. The current draft and this one comparison baseline stay separate. A discarded draft never replaces the completed baseline. Comparison is optional, initially collapsed, and free-form points are never automatically graded. Reset progress removes both current and previous exam answers. Drafts save while editing. Storage failures are shown in the app, and a text download provides a backup.

Storage is specific to the browser profile and origin, not synced between devices. Clearing site data or using private browsing may remove saved work. Use fictional examples in rehearsal.

The local and GitHub Pages versions use no analytics or external runtime scripts. On `https://smartify.space/coachprep/`, an intentional Cloudflare Web Analytics beacon provides basic page metrics, and a first-party collector accepts study-mode starts and completions. The aggregate extension also counts answered items, actual hint uses, passes, explicit partial-practice exits and whole seconds of foreground-active practice. Active time requires a visible, focused practice view within 60 seconds of a study interaction; introductions, historical review, completion views and lifecycle animation do not count. These are aggregate observations, not unique visitors, matched funnels or measured attention. Collector updates and app releases are separate; see [the schema and activation sequence](cloudflare/README.md#aggregate-activity-extension).

Custom events contain only schema version, finite event/mode values and bounded aggregate counters. They contain no visitor identifiers, cookies, IP addresses, referrers, query strings, answer text, scores, content IDs, competency details or draft text. Neither analytics service is required to study. Do Not Track, Global Privacy Control and the saved Sources & about opt-out disable usage statistics and discard pending activity deltas. The saved opt-out also stops new study events in other open tabs. If the beacon load has already started, the Sources message explains that a later reload stops page analytics too. See [Cloudflare deployment and analytics](cloudflare/README.md) for lifecycle definitions, delivery limitations and authenticated aggregate queries. There is no public analytics query endpoint, login or AI service. Opening the official source or optional coffee link visits an external site in a new tab.

## Sources and limitations

Primary source: **2025 ICF Core Competencies**, released September 2025, revision 09.08.25, PDF pp. 3-10. The eight official titles, short definitions and referenced sub-competencies are quoted with attribution. Apostrophes are normalized to straight marks without changing the words. Summaries, questions, rationales, fictional dialogue and review examples are original study material. Citations include each referenced sub-competency's full wording, ID and PDF page. The retained conversation collects its debrief citations at the end, after all choice reviews.

Read the official model through the [ICF core competencies resource](https://coachingfederation.org/credentialing/coaching-competencies/icf-core-competencies/).

This is independent practice guidance, not an official ICF assessment or endorsement. Counts do not measure PCC competence or certification readiness. Fictional client reactions are examples, not predictions of how a real client will respond.

Source PDFs, proprietary question banks, private assignments, recordings, client records and personal answers are not included. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and licensing scope.

## Rights

Copyright (c) 2026 mike-mo for original code and original authored study material. No open-source license has been selected. Public availability does not grant rights to reuse the code or third-party quotations. ICF material and marks retain their respective owners' rights.
