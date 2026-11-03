# Hanzi Practice

A free Chinese character stroke practice app: https://hanzi-practice.freeappstore.online

- 40 beginner simplified Chinese characters, grouped by numbers, nature, people, and everyday words.
- Animated stroke order, guided tracing, and recall practice using Hanzi Writer.
- Finger, stylus, and mouse input; checks shape, direction, and order.
- Hints, retries, and completed practice history saved locally. No login needed.
- All character data ships with the app and is precached for offline practice after the first online load.
- Responsive SDK Shell, light/dark themes, and character search by glyph, pinyin, or meaning.

This is a starter collection, not a full dictionary or calligraphy evaluator. Progress remains in the browser and does not sync through the optional platform account. The newest 2,000 completed attempts are retained; the Progress screen displays the newest 30.

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm test:e2e
fas check
```

Tests use Playwright Chromium (`pnpm exec playwright install chromium` if needed). `pnpm test` builds/typechecks and checks progress handling, data coverage, and SDK styling. Browser tests draw actual median paths through mouse/touch input and check mistakes, hints, multi-stroke characters, persistence, storage errors, resize, navigation, and offline reload.

Character metadata is in `web/src/characters.ts`. Run `pnpm prepare:data` after changing the collection to copy the selected files from the pinned `hanzi-writer-data` dependency. Commit these assets so deployment does not need a third-party data server.

## Deployment

Provisioned through `fas publish`. Commit and push directly to `main`; GitHub Actions builds and deploys to FreeAppStore R2 hosting. No branches or pull requests.

## Attribution and licensing

App code: MIT (see LICENSE). Hanzi Writer: MIT, https://github.com/chanind/hanzi-writer.

The unmodified character data is from Hanzi Writer Data 2.0.1 (https://github.com/chanind/hanzi-writer-data), derived from Make Me a Hanzi (https://github.com/skishore/makemeahanzi) and Arphic fonts. It is licensed separately under the Arphic Public License, reproduced in `web/public/licenses/ARPHICPL.txt`. The app's MIT license does not relicense this data.
