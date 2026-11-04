# Unified practice and tags

The Practice library includes 480 characters and 366 unique two-character words from the existing
examples whose two characters already have bundled stroke data. Both writing
tiles remain visible on phones and desktops. Only the current tile accepts ink;
completing it activates the second tile. Autoplay advances to the next word
250 ms after both tiles are complete. Next-word data is preloaded.

Each completed character still updates character progress and review scheduling.
A whole-word tick is recorded only after both tiles are completed in one run.
Skipping, watching, restarting, or leaving a partial word never adds a word tick.
Restart starts both tiles again. Recall hides both outlines and the word text.
Both characters and whole words have review records. Errors or hints on either tile also update the whole-word review, even if the session is abandoned. Due review is a standard filter and shares the same runner.

All 378 distinct example words have metadata in `web/src/word-tags.json`,
and their tags appear in the existing word-example popups.
Characters and words share these dimensions:

- HSK vocabulary difficulty: **HSK 3.0, 2026 syllabus**, using the dataset's
  `newest-*` field, never the older `new-*` (2021) or `old-*` fields.
- Topic: curated, often more than one topic per word.
- Word type: source part-of-speech tags mapped to readable names.
- Audio: human whole-word recording or TTS only.
- Tone pattern: derived from the displayed pinyin, with 5 meaning neutral.
- Content: single characters or two-character words.
- Stroke count: bundled stroke totals, in 1–5, 6–10, 11–20, and 21+ bands.
- Study set: twelve curated character sets, not official proficiency levels. Words are unassigned.
- Progress: New, Practised, Ready to review, Needs work, and Recalled; these can overlap.

Two missing entries (你好 at HSK 1 and 头痛 at HSK 4) are supplemented directly
from the official syllabus, with row references and its PDF checksum preserved
in `scripts/hsk-official-supplement.json`. 194 matched entries were cross-checked
against extracted official vocabulary rows, with no differing levels.

The source is Complete HSK Vocabulary, revision
`7ac65bf1a6387d35f1ade478906172a19311c7f9`, MIT licensed. Attribution and source
checksum are in `word-tags-source.json`; the full license is bundled at
`/licenses/HSK-VOCABULARY-MIT.txt`. The official syllabus reference is
https://www.chinesetest.cn/syllabus. Unlisted means no matching 2026 level in the
imported source; it is not an assertion that the word is advanced or absent from
every official list. Unclassified types likewise are not guessed. HSK vocabulary
level is not a stroke-count or calligraphy-difficulty measure.

Reproduce tags with:

```sh
curl -fL https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/7ac65bf1a6387d35f1ade478906172a19311c7f9/complete.json -o /tmp/hanzi-hsk-complete.json
python3 scripts/prepare-word-tags.py /tmp/hanzi-hsk-complete.json
pnpm exec tsx scripts/prepare-character-tags.ts /tmp/hanzi-hsk-complete.json
```

Character metadata is generated from the same pinned source, with an exact match
for the displayed pinyin reading before accepting HSK or word-type metadata.
361/480 selected readings have a confirmed level. Character topics are curated
by the existing character group in `scripts/character-topics.json`; stroke totals
come from bundled Hanzi Writer data. The generator checks the source checksum.
Types may include several source parts of speech and are not restricted to the
single English gloss shown on a card.

Labels within a dimension combine with OR; different dimensions combine with
AND. Search covers Hanzi, pinyin (with or without tone marks), and English.
Every dimension supports grouping and a play icon per group. The main play
button practices the entire filtered selection. A card starts its displayed
group at that item, rotating the remaining entries so each is visited once.
An item can appear in more than one group; sessions always deduplicate IDs.

Saved selections store filter/search/group/sort rules, so progress filters update
when revisited. Starting practice snapshots membership; changing progress during
a session cannot remove its next item. The queue stops at its final item.
The completed checkpoint survives reload without incrementing practice again.

Selection settings live in `hanzi-practice:study:v1`, and the resumable session
in `hanzi-practice:session:v1`. Word counts retain `hanzi-practice:words:v1`.
Character history, review and audio keep their earlier storage keys. Old
`/characters`, `/words`, and `/review` URLs open corresponding filter presets.

Audio coverage is 480/480 individual characters and 246/378 distinct example
words (326/480 example entries). Of the 366 writable words, 242 have whole-word
human audio. No syllables are stitched together. All word playback follows the
profile's fallback order; Kokoro has no word clips, so missing recordings use
browser Mandarin TTS if enabled and available. Stored files and stroke data are
available offline after the cache finishes; browser speech is device-dependent.

## Collection expansion — 2026-11-04

Sets 11 (Everyday words) and 12 (More of the world) add 40 characters each.
Their stroke data comes from the same pinned Hanzi Writer Data dependency.
The additional components unlock 94 more two-character practice words, bringing
the total to 366. The original ten sets, IDs, and saved progress are unchanged.

All 80 added character readings and six added distinct word examples were
checked against the CC-CEDICT 2026-11-02 dictionary used for the earlier examples
(gzip SHA-256 `e203bbf4a28c2ab54762e9b1fb813e53aa9112939704e71a5117f3b3555a46cb`).
Readings are selected deliberately for polyphonic characters; for example 发 is
fà (hair), 为 is wèi (for), and 着 is zhe (continuing-action particle). A whole
word can use another valid reading, such as 着急 zháo jí. HSK labels still require
an exact reading match in the pinned vocabulary dataset, with no invented levels.

The Review button's count uses the active content/topic/search filters. Selecting
Review replaces other progress criteria, so “New” cannot accidentally broaden
the queue. The label menu still permits deliberate OR combinations of statuses.
