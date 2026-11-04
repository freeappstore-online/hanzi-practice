# Hanzi Practice

A free Chinese character stroke practice app: https://hanzi.freeappstore.online

- 400 simplified Chinese characters with ten legacy app study sets, from Foundations to Ideas and connections. These sets are not official HSK levels.
- 272 two-character words with two visible writing tiles, whole-word completion ticks, and automatic progression.
- One Practice library combines characters and words. Filter and group by content, HSK 3.0 (2026), topic, word type, tone pattern, audio, stroke count, study set, or progress. See [practice and tag sources](docs/words.md).
- Combine labels (OR within a dimension, AND across dimensions), save reusable filter selections, and play a selection or group. Active queues snapshot their membership and visit each item once.
- Due and Needs work are progress filters. Whole words and individual characters share review scheduling; due selections start in recall mode.
- Animated stroke order, guided tracing, and recall practice using Hanzi Writer.
- Automatic advancement starts the next exercise 250 ms after completion, using preloaded character data, and stops at the end of the selected queue. The autoplay icon toggles this behavior.
- Character, pinyin, English meaning, and SVG tone curves share the same size. Tap the tone curve for a four-tone guide.
- Tap the character, pinyin, or example word for Mandarin pronunciation. The avatar opens Profile, where you can reorder or disable human recordings, Kokoro model clips, and browser Mandarin TTS. See [audio sources](docs/audio.md).
- Compact icon controls, with modes beside the pad and a visible autoplay state. Skipping during practice starts the next exercise.
- The library remembers filters, search, grouping, and sorting, and shows completed practice counts with a green check.
- Finger, stylus, and mouse input; checks shape, direction, and order.
- Hints, retries, and practice history saved silently on the device. No login needed.
- Resume the current queue, position, mode, and autoplay setting from local browser storage. Legacy character history, review data, word counts, audio preferences, saved place, and old links remain compatible.
- Character data, human recordings and Kokoro clips are precached for offline use after the first online load. Browser voices depend on the device and may need internet.
- Responsive SDK Shell, light/dark themes, and character search by glyph, pinyin, or meaning.

This is a curated study collection, not a full dictionary or calligraphy evaluator. Characters use one selected reading; connected speech and other readings may differ. Progress remains in the browser and does not sync through the optional platform account. The newest 2,000 completed character attempts are retained; the Progress screen displays the newest 30.

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm test:e2e
fas check
```

Tests use Playwright Chromium (`pnpm exec playwright install chromium` if needed). `pnpm test` builds/typechecks and checks progress handling, data coverage, SDK styling, tone labels, and audio coverage/checksums. Browser tests draw actual median paths through mouse/touch input and check mistakes, hints, multi-stroke characters, persistence, storage errors, resize, navigation, and offline reload.

The [architecture and review notes](docs/architecture.md) describe shared state and migration boundaries.

Character metadata is in `web/src/characters.ts`. Run `pnpm prepare:data` after changing the collection to copy the selected files from the pinned `hanzi-writer-data` dependency. Commit these assets so deployment does not need a third-party data server.

## Deployment

Provisioned through `fas publish`. Commit and push directly to `main`; GitHub Actions builds and deploys to FreeAppStore R2 hosting. No branches or pull requests.

## Attribution and licensing

App code: MIT (see LICENSE). Hanzi Writer: MIT, https://github.com/chanind/hanzi-writer.

The unmodified character data is from Hanzi Writer Data 2.0.1 (https://github.com/chanind/hanzi-writer-data), derived from Make Me a Hanzi (https://github.com/skishore/makemeahanzi) and Arphic fonts. It is licensed separately under the Arphic Public License, reproduced in `web/public/licenses/ARPHICPL.txt`. The app's MIT license does not relicense this data.

Human recordings use the source Creative Commons licenses in `web/public/licenses/PRONUNCIATION.txt`. Optional model clips use [Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh), voice zf_001, Apache-2.0. Model weights are not shipped to users.

The old hanzi-practice address remains available. To move device-local history, export practice from About at the old address and import it in About at the new address.
