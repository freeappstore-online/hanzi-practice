# Hanzi Practice

A free Chinese character stroke practice app: https://hanzi-practice.freeappstore.online

- 200 simplified Chinese characters across five app study levels: Foundations, Daily essentials, Around you, Explore further, and Express yourself. These are not official HSK levels.
- Animated stroke order, guided tracing, and recall practice using Hanzi Writer.
- Automatic advancement starts the next exercise 250 ms after completion, using preloaded character data, crosses level boundaries, and stops at the end. The autoplay icon toggles this behavior.
- Character, pinyin, English meaning, and SVG tone curves share the same size. Tap the tone curve for a four-tone guide.
- Tap the character or pinyin for Mandarin pronunciation, generated with the free Kokoro model and bundled as small MP3 clips. See [audio generation](docs/audio.md).
- Finger, stylus, and mouse input; checks shape, direction, and order.
- Hints, retries, and practice history saved silently on the device. No login needed.
- The selected level, character, and autoplay setting resume from local browser storage.
- All character data and audio ship with the app and are precached for offline practice after the first online load.
- Responsive SDK Shell, light/dark themes, and character search by glyph, pinyin, or meaning.

This is a curated study collection, not a full dictionary or calligraphy evaluator. Characters use one selected reading; connected speech and other readings may differ. Progress remains in the browser and does not sync through the optional platform account. The newest 2,000 completed attempts are retained; the Progress screen displays the newest 30.

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm test:e2e
fas check
```

Tests use Playwright Chromium (`pnpm exec playwright install chromium` if needed). `pnpm test` builds/typechecks and checks progress handling, data coverage, SDK styling, tone labels, and audio coverage/checksums. Browser tests draw actual median paths through mouse/touch input and check mistakes, hints, multi-stroke characters, persistence, storage errors, resize, navigation, and offline reload.

Character metadata is in `web/src/characters.ts`. Run `pnpm prepare:data` after changing the collection to copy the selected files from the pinned `hanzi-writer-data` dependency. Commit these assets so deployment does not need a third-party data server.

## Deployment

Provisioned through `fas publish`. Commit and push directly to `main`; GitHub Actions builds and deploys to FreeAppStore R2 hosting. No branches or pull requests.

## Attribution and licensing

App code: MIT (see LICENSE). Hanzi Writer: MIT, https://github.com/chanind/hanzi-writer.

The unmodified character data is from Hanzi Writer Data 2.0.1 (https://github.com/chanind/hanzi-writer-data), derived from Make Me a Hanzi (https://github.com/skishore/makemeahanzi) and Arphic fonts. It is licensed separately under the Arphic Public License, reproduced in `web/public/licenses/ARPHICPL.txt`. The app's MIT license does not relicense this data.

Mandarin audio is synthetic output from [Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh), voice zf_001, Apache-2.0. Model attribution and the license are in `web/public/licenses/`. Model weights are not shipped to users.
