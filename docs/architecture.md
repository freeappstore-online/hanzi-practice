# Practice architecture and review

Reviewed the app-owned runtime, data import, storage, audio, UI, offline build,
and tests while consolidating practice on 2026-11-04. This is an implementation
review, not a security audit of third-party dependencies or a new linguistic
certification of every recording.

## One catalog, one runner

- `catalog.ts` owns the 846 practice targets, all nine tag dimensions, filtering,
  grouping, sorting, and dynamic progress labels.
- `study-state.ts` validates saved filter rules and session checkpoints. Saved
  selections are queries; running sessions are deduplicated snapshots.
- `StudyLibrary.tsx` presents the same catalog for browsing and starting practice.
- `PracticeSession.tsx` owns stroke interaction for both one- and two-tile items.
  Tile completion updates character history; both word tiles must finish in one
  run to increment the word counter. Whole-word review aggregates both tiles.
- `useStudyProgress.ts` owns storage synchronization and the history/review/count
  write paths. `review.ts` applies the same scheduling to characters and words.
- `App.tsx` owns navigation, session transitions, and legacy URL migration.
  `StudyProgress.tsx` links back through ordinary progress filters.
- `playback.ts` remains the shared audio fallback engine for cards, examples,
  practice, and profile previews. Profile owns the source order and enablement.

The former `Practice`, `WordPractice`, `WordsScreen`, and `ReviewScreen` engines
were removed. There is no second word filter implementation or separate review
runner to drift out of sync.

## Corrections made during review

- Watching strokes during recall retains the hint and existing errors in the
  current attempt; it cannot become an unassisted recall completion.
- Word counter writes merge each stored counter with in-memory progress before
  incrementing, preventing stale state from erasing other word totals.
- Whole-word mistakes persist before completion, and words can enter review.
- Reopening a completed session does not count the completed item twice.
- Async writer callbacks are canceled on navigation/restart. Failed character
  loads can retry; only loaded writers are paused during teardown.
- Grouping retains items with no value under “Not assigned.” A queue contains
  each target once even when it belongs to multiple labels.
- Saved group names and filter IDs are validated against own known values.
- Browser speech skips explicit non-Mandarin Chinese voice variants and handles
  synchronous speech-service failures through the ordinary fallback path.
- Storage failure retains current practice in memory with a visible warning.

## Compatibility and limits

Existing character history, review entries, word counters, audio settings, and
autoplay preference retain their keys. Prior word filters migrate to shared
filters; a legacy saved character becomes a resumable character session. Old
library/review links open presets. The optional legacy history-transfer UI is
unchanged in scope and accurately labels what it transfers.

Local storage is device-local, not account sync. It is not transactional across
simultaneous tabs: merges reduce lost updates but do not guarantee atomic counts
for two completions occurring at exactly the same time. Character history retains
the existing 2,000-attempt cap; character and word totals are separate cumulative counters.

HSK denotes vocabulary proficiency, while stroke bands denote writing load.
The legacy study sets are not HSK levels. Unmatched entries remain Unlisted.
Browser TTS depends on installed Mandarin voices; no audio is synthesized by
stitching individual syllables. See `words.md` and `audio.md` for data provenance.

## Verification

Unit/data tests check tag coverage, exact stroke totals, combined filters,
grouping completeness, dynamic progress, session validation/rotation, saved
queries, scheduling, legacy parsing, audio assets, and SDK styling. Browser tests
draw real mouse/touch paths and cover mobile layouts, mixed queues, reviews,
completed checkpoints, assistance, retries, storage merges, legacy links, audio
fallback/cancellation, all human recordings, and offline one/two-tile practice.

## Follow-up corrections — 2026-11-04

Review counts now respect the current non-progress filters and search. Its quick
button replaces unrelated progress criteria. Character histories from different
tabs are merged in timestamp order before the 2,000-attempt limit is applied.
Experimental audio candidates are restricted to the actual shipped model catalog,
so new characters do not request nonexistent Kokoro files. Profile coverage is
derived from the active data instead of stale hard-coded counts.

## Second review — 2026-11-04

- A pinned Hanzi Writer 3.7.3 patch adds `destroy()` to release document mouseup
  and touchend listeners, cancel active rendering, and prevent a late character
  download from mounting a discarded writer. Both ESM/CJS runtime entry points
  and their declarations are patched. The practice runner calls it on every
  replacement and unmount. Browser instrumentation checks the actual document
  listener counts across navigation, mode changes, and single/two-tile sessions.
- Character downloads validate stroke/median structure before caching. Invalid
  payloads are evicted; stalled requests abort after 15 seconds. Retry starts a
  fresh request. Shared valid preload promises remain reusable.
- Groups have individual expand/collapse and pagination controls. A shared
  24-card budget no longer leaves later groups looking empty. Long saved names
  wrap within the mobile viewport.
- `hanzi-practice:character-totals:v1` stores completion and clean-recall totals
  separately from the bounded history. It is seeded from retained history using
  per-character maxima, so repeated reads do not double-count. Completion merges
  current stored totals before incrementing, and storage events refresh other
  tabs. The existing limitations of non-transactional localStorage still apply.
  Attempts already discarded before this update cannot be reconstructed. The
  legacy history-transfer file does not include these new lifetime counters.

Validation includes history rollover past 2,000 attempts, persisted completion
and Recalled tags after reload, malformed/stalled downloads, discarded pending
writers, document listener cleanup, and independent mobile group browsing.

### Recent practice

`practice-history.ts` persists up to 100 recent runs in `hanzi-practice:history:v1`.
Each run snapshots its item order and stores its own checkpoint, mode, name, timestamps,
and latest completed result per target. The library exposes recent runs independently of
its current filters. Resuming continues unfinished work, including skipped targets; opening
a completed run does not record another result. Starting from a catalog play button creates
a new run. Saved selections remain dynamic filter rules.

Completion is unique completed targets / pack size, not the current queue position.
Clean percentage is completed targets without mistakes or hints / targets with known
results (guided and recall both included). Whole-word results combine both writing tiles.
Retries overwrite the item's latest result without inflating pack completion. An unfinished
writing tile restarts when leaving/reloading; completed targets and pack checkpoints persist.
The previous single-session checkpoint migrates once; earlier completions cannot be inferred
from it. Unknown legacy results count toward completion but not the clean rate. History is
local to this browser, with same-origin tab updates merged by run and result timestamps.

### Packs, lookup, and pack contents

`/` is the pack dashboard: recent practice, due review, pack-name search, and one
category selector. Pack cards come from the same catalog labels as custom filters.
Saved packs are collapsed by default and included in pack search. Opening a card
navigates to `/pack`; its play button starts that selection directly.

`/lookup` is a separate search screen for Hanzi, pinyin, or English. It always
searches the full catalog, independently of pack filters, and shows no results
until a query is entered. Pronunciation and illustrated examples use the shared
item components. Play starts only the selected character or word in guided mode.
The query and return destination survive reloads within the browser tab.

`/pack` contains the selected pack's items and optional filters; arrangement and
saved-selection management are collapsed. Legacy `/characters`, `/words`, and
`/review` links redirect here with their existing filter presets. Progress shortcuts
also open the appropriate pack filters. Starting a pack supplies an explicit mode,
so stale review filters cannot change unrelated practice. Resuming from recent
history returns to Packs; starting from Lookup returns to Lookup.
