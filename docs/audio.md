# Pronunciation audio

The app serves short, pre-generated MP3 files. It does not send text to a paid service and does not download model weights to the user's device.

## Model and generation

- Model: [hexgrad/Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh), Apache-2.0.
- ONNX export: [kokoro-onnx model-files-v1.1](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1), full-precision Chinese model.
- Voice: `zf_001`; speed 0.85; 24 kHz mono; MP3 64 kbps.
- Frontend: Misaki 0.9.4 Mandarin v1.1. Its single-character dictionary is overridden with each entry's displayed pinyin. Generation asserts the phoneme tone matches that pinyin (including neutral tone 5) and fails on unknown phonemes, silent/non-finite audio, or implausible duration.
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

Review audio and run the tests before committing changed assets. Do not commit weights, virtual environments, or temporary WAV files. The model's Apache-2.0 license is reproduced in `web/public/licenses/KOKORO-APACHE-2.0.txt`.
