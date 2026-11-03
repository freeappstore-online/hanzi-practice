"""Generate bundled Mandarin clips; model weights stay outside the repository.

Dependencies: kokoro-onnx==0.6.1 misaki[zh]==0.9.4 soundfile==0.14.0
See docs/audio.md for model downloads and the exact generation command.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

import numpy as np
import onnxruntime as rt
import soundfile as sf
from kokoro_onnx import Kokoro
from misaki import zh
from pypinyin import load_single_dict
from pypinyin.contrib.tone_convert import to_tone3

parser = argparse.ArgumentParser()
parser.add_argument('--model-dir', type=Path, required=True)
parser.add_argument('--characters-json', type=Path, required=True)
parser.add_argument('--reuse-existing', action='store_true', help='Keep clips whose reading, settings, and checksum still match')
args = parser.parse_args()
rows = json.loads(args.characters_json.read_text())
destination = Path('web/public/audio')
destination.mkdir(parents=True, exist_ok=True)
options = rt.SessionOptions()
options.intra_op_num_threads = 2
options.inter_op_num_threads = 1
model_path = args.model_dir / 'kokoro-v1.1-zh.onnx'
voices_path = args.model_dir / 'voices-v1.1-zh.bin'
model = Kokoro.from_session(rt.InferenceSession(str(model_path), sess_options=options, providers=['CPUExecutionProvider']), str(voices_path), vocab_config=str(args.model_dir / 'config.json'))
g2p = zh.ZHG2P(version='1.1')
# These are isolated readings. Sentence rules otherwise turn 地 dì into neutral di5.
g2p.frontend.tone_modifier.modified_tone = lambda word, pos, finals: finals
# Pin the reading to the displayed pinyin, including polyphonic and neutral-tone characters.
load_single_dict({ord(c['hanzi']): c['pinyin'] for c in rows})
prepared = []
for c in rows:
    phonemes, _ = g2p(c['hanzi'] + '。')
    expected = int(to_tone3(c['pinyin'], neutral_tone_with_five=True)[-1])
    assert re.findall('[1-5]', phonemes) == [str(expected)], (c, phonemes)
    assert '❓' not in phonemes, (c, phonemes)
    prepared.append({**c, 'phonemes': phonemes, 'tone': expected})

def generate(c):
    filename = f"{ord(c['hanzi']):x}.mp3"
    output = destination / filename
    cached = cached_clips.get(c['hanzi'])
    if cached and all(cached.get(key) == c[key] for key in ('pinyin', 'tone', 'phonemes')) and cached.get('file') == filename:
        if output.exists() and hashlib.sha256(output.read_bytes()).hexdigest() == cached.get('sha256'):
            return cached
    samples, rate = model.create(c['phonemes'], voice='zf_001', speed=0.85, is_phonemes=True)
    peak = float(np.max(np.abs(samples)))
    assert peak > 0.01 and np.isfinite(samples).all(), c
    samples = samples * (0.88 / peak)
    samples = np.pad(samples, (int(rate * .06), int(rate * .1)))
    assert .3 < len(samples) / rate < 4, c
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'clip.wav'
        sf.write(wav, samples, rate)
        subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','64k',str(output)],check=True)
    return {'hanzi': c['hanzi'], 'pinyin': c['pinyin'], 'tone': c['tone'], 'phonemes': c['phonemes'], 'file': filename, 'seconds': round(len(samples) / rate, 3), 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}

manifest = {'model': 'hexgrad/Kokoro-82M-v1.1-zh', 'license': 'Apache-2.0', 'voice': 'zf_001', 'speed': .85, 'sampleRate': 24000, 'modelSha256': hashlib.file_digest(model_path.open('rb'), 'sha256').hexdigest(), 'voicesSha256': hashlib.file_digest(voices_path.open('rb'), 'sha256').hexdigest(), 'clips': []}
cached_clips = {}
if args.reuse_existing and (destination / 'manifest.json').exists():
    previous = json.loads((destination / 'manifest.json').read_text())
    if all(previous.get(key) == value for key, value in manifest.items() if key != 'clips'):
        cached_clips = {clip['hanzi']: clip for clip in previous['clips']}
# ONNX Runtime sessions support concurrent inference. Keep total CPU threads bounded.
with ThreadPoolExecutor(max_workers=2) as executor:
    for i, clip in enumerate(executor.map(generate, prepared), 1):
        manifest['clips'].append(clip)
        (destination / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        if i % 10 == 0: print(f"Prepared {i}/{len(rows)}",flush=True)
print('Prepared and validated all pronunciation clips.',flush=True)
