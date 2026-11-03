# Hanzi Practice

Chinese character stroke practice at https://hanzi-practice.freeappstore.online.

Platform rules: https://freeappstore.online/skills.md (SKILLS.md).
Compatibility guide pointer: https://raw.githubusercontent.com/freeappstore-online/freeappstore/main/SKILLS.md

- Work directly on main. No branches or pull requests.
- App issues belong in freeappstore-online/hanzi-practice.
- Dev: pnpm install && pnpm dev. Checks: pnpm test && pnpm test:e2e && fas check.
- Push main to auto-deploy. Provisioning is already complete.
- Keep the SDK Shell and its navigation, PageHeader, and shared UI components.
- Use Tailwind token utilities for feature styling; keep CSS limited to theme/base rules.
- Character metadata: web/src/characters.ts. Data: web/public/characters/*.json.
- Run pnpm prepare:data to copy selected data from hanzi-writer-data.
- Hanzi Writer data is Arphic Public License, separate from app MIT; preserve attribution.
- All practice results are local. Do not claim account sign-in syncs progress.
- Browser tests exercise real stroke recognition; do not replace it with mocked success callbacks.

- 200 characters in five custom study levels; do not describe them as official HSK levels.
- Equal-size SVG tone curves derive from pinyin in web/src/tones.ts.
- Audio assets are generated with Kokoro; see docs/audio.md. Keep model weights outside the repo.
- Preserve audio clip/pinyin consistency and cancellation of automatic advancement on navigation.
- The pnpm SDK patch makes the Shell sign-in control an accessible avatar icon. Preserve it when upgrading the SDK, or replace it with an equivalent upstream option.
