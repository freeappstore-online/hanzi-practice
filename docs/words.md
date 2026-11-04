# Word practice and tags

The Words screen includes 272 unique two-character words from the existing
examples whose two characters already have bundled stroke data. Both writing
tiles remain visible on phones and desktops. Only the current tile accepts ink;
completing it activates the second tile. Autoplay advances to the next word
250 ms after both tiles are complete. Next-word data is preloaded.

Each completed character still updates character progress and review scheduling.
A whole-word tick is recorded only after both tiles are completed in one run.
Skipping, watching, restarting, or leaving a partial word never adds a word tick.
Restart starts both tiles again. Recall hides both outlines and the word text.
The character review queue remains character-based.

All 372 distinct example words have metadata in `web/src/word-tags.json`,
and their tags appear in the existing word-example popups.
The 272 writable words expose these dimensions in the Words screen:

- HSK vocabulary difficulty: **HSK 3.0, 2026 syllabus**, using the dataset's
  `newest-*` field, never the older `new-*` (2021) or `old-*` fields.
- Topic: curated, often more than one topic per word.
- Word type: source part-of-speech tags mapped to readable names.
- Audio: human whole-word recording or TTS only.
- Tone pair: derived from the displayed pinyin, with 5 meaning neutral.

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
```

Filters intersect, can be activated by tapping word tags, and save locally with
the chosen grouping and word counts in `hanzi-practice:words:v1`. Grouping by
HSK or topic offers a play icon per group; the top play button practices the
whole filtered result once. A word can appear in multiple topic groups, but the
whole filtered queue contains no duplicates. Finishing the last word stops.

Audio coverage remains 400/400 individual characters and 243/372 distinct example
words (263/400 example entries). Of the 272 writable words, 169 have whole-word
human audio. No syllables are stitched together. All word playback follows the
profile's fallback order; Kokoro has no word clips, so missing recordings use
browser Mandarin TTS if enabled and available. Stored files and stroke data are
available offline after the cache finishes; browser speech is device-dependent.
