# Pronunciation audio

The app serves short, pre-generated MP3 files. It does not send text to a paid service and does not download model weights to the user's device.

## Model and generation

- Model: [hexgrad/Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh), Apache-2.0.
- ONNX export: [kokoro-onnx model-files-v1.1](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1), full-precision Chinese model.
- Voice: `zf_001`; speed 0.85; 24 kHz mono; MP3 64 kbps.
- Frontend: Misaki 0.9.4 Mandarin v1.1. Its single-character dictionary is overridden with each entry's displayed pinyin. Connected-speech tone changes are disabled because these are isolated character readings. Generation asserts the phoneme tone matches that pinyin (including neutral tone 5) and fails on unknown phonemes, silent/non-finite audio, or implausible duration.
- Samples are peak-normalized with 60 ms leading and 100 ms trailing padding. No original human recordings are included.
- `web/public/audio/manifest.json` records model/voice checksums and each clip's character, pinyin, tone, phonemes, duration, and checksum.

The reading is for the character in isolation, not every possible reading in a phrase. Tone sandhi in connected speech can differ. These clips are synthetic speech, not a human pronunciation assessment.

## Reproduce

Keep weights and Python dependencies outside the app repository. Python 3.12 and ffmpeg are required. The app's production build only uses the committed MP3 assets.

```sh
uv venv /tmp/hanzi-tts-env
uv pip install --python /tmp/hanzi-tts-env/bin/python kokoro-onnx==0.6.1 'misaki[zh]==0.9.4' soundfile==0.14.0
mkdir -p /tmp/hanzi-tts-model
curl -fL https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.1-zh.onnx -o /tmp/hanzi-tts-model/kokoro-v1.1-zh.onnx
curl -fL https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.1-zh.bin -o /tmp/hanzi-tts-model/voices-v1.1-zh.bin
curl -fL https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh/raw/main/config.json -o /tmp/hanzi-tts-model/config.json
pnpm exec tsx -e 'import {CHARACTERS} from "./web/src/characters.ts"; import {writeFileSync} from "node:fs"; writeFileSync("/tmp/hanzi-characters.json",JSON.stringify(CHARACTERS))'
/tmp/hanzi-tts-env/bin/python scripts/generate-audio.py --model-dir /tmp/hanzi-tts-model --characters-json /tmp/hanzi-characters.json
```

Add `--reuse-existing` to keep existing clips when their pinyin, phonemes, generation settings, and file checksum match. Review audio and run the tests before committing changed assets. Do not commit weights, virtual environments, or temporary WAV files. The model's Apache-2.0 license is reproduced in `web/public/licenses/KOKORO-APACHE-2.0.txt`.

## Pronunciation audit — 2026-11-03

The automated checks above verify generation inputs and file integrity; they do **not** establish that the spoken consonants, vowels, and tones are correct. Native-speaker feedback has raised concerns about the current clips. Keep that distinction when reporting test results. Kokoro's Chinese model card describes this as an early release; no evidence here establishes it as the best model for Mandarin teaching.

A possible replacement is the [audio-cmn word collection](https://github.com/hugolpz/audio-cmn), with recordings by Yue Tan from the Shtooka / University of Caen collection. At revision `f759a0f18f27690742957619e1248ed91e9b3f2c`, direct filenames in `64k/hsk` cover 343 of our 400 characters and 258 example entries. These are **filename coverage counts, not verified matches to our pinyin**. The pinyin-named FLAC files in Trevor Davis's archived collection narrow the Yue Tan character matches to **337/400**. Six source readings differ: 了 liǎo (app le), 长 zhǎng (cháng), 干 gàn (gān), 数 shǔ (shù), 相 xiāng (xiàng), 还 huán (hái). This is metadata verification, not a native-speaker listening assessment. The three Shtooka collections together have 342 exact character-and-pinyin matches. Avoid silently substituting alternate readings.

The [original collection README, archived 2024-03-01](https://web.archive.org/web/20240301142447/https://packs.shtooka.net/cmn-caen-tan/readme.txt) states Copyright 2009 Yue Tan, Creative Commons Attribution Share Alike 3.0 United States. [Trevor Davis's collection notes](https://github.com/trevorld/mandarin_audio_utilities/blob/master/fc_README.rst) independently identify the same source and license and describe filenames with pinyin. Preserve the attribution, source, and license if distributing these recordings. This license finding applies to the Yue Tan word collection, not every asset elsewhere in audio-cmn.

Do not blindly use the separate Chen Wang syllable set to fill gaps: the [maintainer's quality issue](https://github.com/hugolpz/audio-cmn/issues/7) reports degraded recordings and missing true neutral-tone recordings. Do not choose a polyphonic character recording solely by its Hanzi filename, or pass off a fallback clip as a different voice/model.

Alternative synthetic candidates are [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) (Apache-2.0) and [Fish S2-Pro](https://huggingface.co/fishaudio/s2-pro) (research license for weights; do not assume unrestricted app redistribution). Both would generate static clips ahead of deployment. Neither has been generated or validated for this app yet. The production audio remains Kokoro pending a verified replacement.
