# Pronunciation audio

All 400 character readings are bundled human recordings. There are also 243
complete-word recordings, used by 263 of the 400 example entries. Tapping an
example's word or pinyin plays its recording when available. No runtime TTS,
model download, API key, or paid speech service is used.

## Sources and matching

- 337 exact character readings: Yue Tan, Shtooka Caen Tan, CC BY-SA 3.0 US.
- 48 isolated homophones from the same speaker: identical complete syllable and
  tone, with the original character retained in each clip's provenance.
- 4 exact readings: Congcong / Association Shtooka, CC BY 3.0 US.
- 1 exact reading: Wei Gao / Nicolas Vion, CC BY 2.0 FR.
- 10 original syllable recordings: Chen Wang, audio-cmn. The source declares
  CC-by-sa without a version; we preserve that declaration rather than inventing
  one. These MP3 files are copied unaltered.

The first three collections come from Trevor Davis's [Free Cultural Works
Mandarin Audio Pack](https://github.com/trevorld/mandarin_audio_utilities/blob/master/fc_README.rst),
version 1.0.0 (2017-07-04). The ZIP includes an attribution/license README, and
its FLAC files include original text, pronunciation and speaker tags. The
[original Yue Tan license notice](https://web.archive.org/web/20240301142447/https://packs.shtooka.net/cmn-caen-tan/readme.txt)
confirms CC BY-SA 3.0 US.

The ten additional syllables are pinned to [audio-cmn revision
f759a0f18f27690742957619e1248ed91e9b3f2c](https://github.com/hugolpz/audio-cmn/tree/f759a0f18f27690742957619e1248ed91e9b3f2c):
ma1, mei4, zuo2, min2, er3, bi2, wa4, chong2, nao3, sen1. Do not automatically
expand this allowlist. Other recordings in that collection have [reported
defects](https://github.com/hugolpz/audio-cmn/issues/7), including absent genuine
neutral-tone recordings.

`web/public/audio/v2/manifest.json` records each source file, original reading,
speaker, license, source checksum, output checksum, and homophone substitution.
`web/public/licenses/PRONUNCIATION.txt` supplies the user-visible credits.
The recording licenses remain separate from this app's MIT code license.

All character matches require identical syllable **and tone**. This avoids six
wrong-reading matches in the original word collection: 了 liǎo vs le, 长 zhǎng vs
cháng, 干 gàn vs gān, 数 shǔ vs shù, 相 xiāng vs xiàng, 还 huán vs hái.
Whole words require matching text and pinyin; normal third-tone sandhi is
accepted (你好 nǐ hǎo surfaces as ní hǎo). No syllables are cut out of words or
stitched together. Four example entries were corrected to dictionary neutral
tones: 学生 xué sheng, 左边 zuǒ bian, 右边 yòu bian, 困难 kùn nan.

## Processing and reproduction

Shtooka FLACs are converted to mono 24 kHz, 64 kbps MP3, peak normalized to 0.88,
with 60 ms leading and 100 ms trailing padding. Pitch and speed are unchanged.
The ten audio-cmn syllable MP3s are unchanged, including their original format.
The versioned `/audio/v2/` paths avoid reusing cached old synthetic recordings.
All production MP3s are precached for offline use.

Keep the 604 MB source archive outside the repository. Python requires numpy and
pypinyin; ffmpeg and ffprobe must be on PATH. The import does not run in the app
build or in the browser.

```sh
curl -fL 'https://www.dropbox.com/s/bh3ctzsgwbagbw0/fc_mandarin_audio_pack.zip?dl=1' -o /tmp/hanzi-human-recordings.zip
pnpm exec tsx -e 'import {CHARACTERS} from "./web/src/characters.ts"; import {writeFileSync} from "node:fs"; writeFileSync("/tmp/hanzi-characters.json",JSON.stringify(CHARACTERS))'
python scripts/import-recordings.py --archive /tmp/hanzi-human-recordings.zip --characters-json /tmp/hanzi-characters.json --output-dir web/public/audio/v2 --syllable-cache /tmp/hanzi-syllable-cache
pnpm test
pnpm test:e2e
```

## Validation and model experiment — 2026-11-03

The checks cover source reading metadata, checksums, durations, decodeability,
non-silent audio, playback lifecycle, error recovery and offline playback.
Sampled human recordings of all four tones and the ten gap syllables were also
screened with pitch contours. These are **not** a native-speaker listening
certification. ASR is especially unreliable for isolated homophones and cannot
by itself establish correct pronunciation.

The former Kokoro set passed file/input checks but drew negative native-speaker
feedback. Its input pinyin checks never established spoken accuracy. The old
`generate-audio.py` is retained only as an explicitly targeted experiment; its
output is not used by the app.

Qwen3-TTS 0.6B CustomVoice was tried locally on this Intel Mac, using Serena,
Chinese, seed 42, temperature 0.5, and the native runtime at
`gabriele-mastrapasqua/qwen3-tts@ef339be58a778b062e1c14382347964552eae007`.
The runtime was built with `make blas EXTRA_CFLAGS='-fno-fast-math -ffp-contract=off'`
and passed its self-test. Several isolated outputs were unsuitable: 民 and 鼻
had falling contours, and 耳 contained extra speech. Those generated files are
**not deployed**. This is evidence about this configuration and task, not a
claim that all Qwen voices or larger models are unsuitable. No Fish model was
generated. The production app uses neither model.
