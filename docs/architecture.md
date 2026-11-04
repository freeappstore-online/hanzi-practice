# Practice architecture and review

Reviewed the app-owned runtime, data import, storage, audio, UI, offline build,
and tests while consolidating practice on 2026-11-04. This is an implementation
review, not a security audit of third-party dependencies or a new linguistic
certification of every recording.

## One catalog, one runner

- `catalog.ts` owns the 672 practice targets, all nine tag dimensions, filtering,
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
the existing 2,000-attempt cap; word totals are separate cumulative counters.

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
