"""Import pinyin-matched Shtooka recordings from the Free Cultural Works pack.

Requires Python, numpy, pypinyin and ffmpeg. See docs/audio.md.
The original archive remains outside the repository. No syllables are cut from words.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request
import zipfile

import numpy as np
from pypinyin.contrib.tone_convert import to_tone3

PACKS = {
    'shtooka_caen_tan': {'author': 'Yue Tan', 'copyright': '(c) 2009 Yue Tan', 'license': 'CC-BY-SA-3.0-US', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/3.0/us/'},
    'shtooka_balm_congcong': {'author': 'Association Shtooka', 'copyright': '(c) 2010 Association Shtooka', 'license': 'CC-BY-3.0-US', 'licenseUrl': 'https://creativecommons.org/licenses/by/3.0/us/'},
    'shtooka_balm_hsk1': {'author': 'Wei Gao and Nicolas Vion', 'copyright': '(c) 2006 Wei Gao and Nicolas Vion', 'license': 'CC-BY-2.0-FR', 'licenseUrl': 'https://creativecommons.org/licenses/by/2.0/fr/'},
}
ARCHIVE_URL = 'https://www.dropbox.com/s/bh3ctzsgwbagbw0/fc_mandarin_audio_pack.zip?dl=1'

def numbered(pinyin):
    return ''.join(to_tone3(s, neutral_tone_with_five=True).replace('ü', 'v') for s in pinyin.split())

def spoken(reading):
    # Two consecutive third tones: first surfaces as second. Do not change neutral
    # tones, other lexical readings, or pretend syllable concatenation is word audio.
    return re.sub(r'3(?=[a-zv]+3)', '2', reading)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--characters-json', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--syllable-cache', type=Path, required=True)
    args = parser.parse_args()
    characters = json.loads(args.characters_json.read_text())
    examples = json.loads(Path('web/src/examples.json').read_text())
    archive_hash = hashlib.file_digest(args.archive.open('rb'), 'sha256').hexdigest()
    assert archive_hash == '029c5820eba2b3e0353384953a6e279d90da531bdd1fcd824a2b2a73355d3a7b', 'Source archive changed; inspect its provenance before importing'
    with zipfile.ZipFile(args.archive) as archive:
        candidates = []
        for name in archive.namelist():
            match = re.fullmatch(r'audio/([^/]+)/([^/]+)_([^/_]+)\.flac', name)
            if match and match[1] in PACKS:
                candidates.append({'pack': match[1], 'reading': match[2], 'text': match[3], 'entry': name})
        candidates.sort(key=lambda c: (list(PACKS).index(c['pack']), c['entry']))
        jobs, missing = [], []
        for c in characters:
            reading = numbered(c['pinyin'])
            choices = [a for a in candidates if a['reading'] == reading and len(a['text']) == 1]
            choices.sort(key=lambda a: a['text'] != c['hanzi'])  # Prefer exact character over a homophone.
            if not choices:
                missing.append(c)
                continue
            jobs.append({'kind': 'character', 'hanzi': c['hanzi'], 'pinyin': c['pinyin'], 'tone': int(reading[-1]), 'file': f"{ord(c['hanzi']):x}.mp3", 'source': choices[0]})
        seen = set()
        for e in examples.values():
            key = (e['word'], e['pinyin'])
            if key in seen:
                continue
            seen.add(key)
            reading = numbered(e['pinyin'])
            choices = [a for a in candidates if a['text'] == e['word'] and spoken(a['reading']) == spoken(reading)]
            if choices:
                file = 'words/' + '-'.join(f'{ord(c):x}' for c in e['word']) + '.mp3'
                jobs.append({'kind': 'word', 'word': e['word'], 'pinyin': e['pinyin'], 'file': file, 'source': choices[0]})
        # Read selected entries once, validating the zip CRC before conversion.
        source_data = {j['source']['entry']: archive.read(j['source']['entry']) for j in jobs}
    def convert(job):
        source = job['source']
        raw = source_data[source['entry']]
        output = args.output_dir / job['file']
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as temp:
            flac = Path(temp) / 'source.flac'
            flac.write_bytes(raw)
            tags = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format_tags', '-of', 'json', str(flac)]))['format']['tags']
            tags = {k.upper(): v.strip() for k, v in tags.items()}
            assert tags.get('SWAC_TEXT', tags.get('TITLE')) == source['text'], (source, tags)
            original_pinyin = tags.get('SWAC_PRON_PHON', '')
            if job['kind'] == 'character' and original_pinyin:
                assert numbered(original_pinyin) == source['reading'], (source, original_pinyin)
            samples = np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(flac),'-ac','1','-ar','24000','-f','f32le','-']), dtype=np.float32)
            peak = float(np.max(np.abs(samples)))
            assert np.isfinite(samples).all() and peak > .01, source
            samples = np.pad(samples * (.88 / peak), (1440, 2400)).astype(np.float32)
            assert .3 < len(samples) / 24000 < 6, source
            subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar','24000','-ac','1','-i','pipe:0','-codec:a','libmp3lame','-b:a','64k',str(output)],input=samples.tobytes(),check=True)
        provenance = {**PACKS[source['pack']], **source, 'originalPinyin': original_pinyin, 'sourceSha256': hashlib.sha256(raw).hexdigest(), 'match': 'homophone' if job['kind'] == 'character' and source['text'] != job['hanzi'] else 'exact', 'speaker': tags.get('SWAC_SPEAK_NAME', tags.get('ARTIST', ''))}
        return {**{k:v for k,v in job.items() if k != 'source'}, 'provider':'human', 'source':provenance, 'seconds':round(len(samples)/24000,3), 'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}
    with ThreadPoolExecutor(max_workers=4) as pool:
        converted = list(pool.map(convert, jobs))
    manifest = {'version':2, 'convertedSampleRate':24000, 'archiveUrl':ARCHIVE_URL, 'archiveSha256':archive_hash, 'processing':'24 kHz mono MP3, 64 kbps, peak normalized to 0.88, 60 ms leading and 100 ms trailing padding; no pitch or speed changes', 'clips':[c for c in converted if c['kind']=='character'], 'words':[c for c in converted if c['kind']=='word']}
    # Only the ten individually screened syllables. Never fill arbitrary gaps
    # from this collection: other files have known quality defects, including
    # absent neutral tones (audio-cmn issue #7).
    allowed = {'ma1','mei4','zuo2','min2','er3','bi2','wa4','chong2','nao3','sen1'}
    revision = 'f759a0f18f27690742957619e1248ed91e9b3f2c'
    args.syllable_cache.mkdir(parents=True, exist_ok=True)
    for c in missing:
        reading = numbered(c['pinyin'])
        assert reading in allowed, f'Unreviewed syllable: {reading}'
        entry = f'64k/syllabs/cmn-{reading}.mp3'
        url = f'https://raw.githubusercontent.com/hugolpz/audio-cmn/{revision}/{entry}'
        cached = args.syllable_cache / (reading+'.mp3')
        if not cached.exists():
            urllib.request.urlretrieve(url,cached)
        raw = cached.read_bytes()
        info = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(cached)]))
        seconds = float(info['format']['duration'])
        assert .3 < seconds < 4
        file = f"{ord(c['hanzi']):x}.mp3"
        (args.output_dir / file).write_bytes(raw)  # Keep the source audio unaltered.
        manifest['clips'].append({'kind':'character','hanzi':c['hanzi'],'pinyin':c['pinyin'],'tone':int(reading[-1]),'file':file,'provider':'human','seconds':seconds,'sha256':hashlib.sha256(raw).hexdigest(),'source':{'author':'Chen Wang','speaker':'Chen Wang','license':'CC-BY-SA','licenseUrl':f'https://github.com/hugolpz/audio-cmn/tree/{revision}#license','licenseNote':'Source declares CC-by-sa without specifying a version. Retained as declared.','pack':'audio-cmn-syllables','entry':entry,'url':url,'revision':revision,'reading':reading,'match':'syllable','processing':'Original MP3 unchanged','sourceSha256':hashlib.sha256(raw).hexdigest()}})
    assert len(manifest['clips']) == len(characters)
    catalog = {c['word']:{'pinyin':c['pinyin'],'file':c['file']} for c in manifest['words']}
    Path('web/src/word-audio.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
    (args.output_dir / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f"Imported {len(manifest['clips'])} human character readings and {len(manifest['words'])} words.")

if __name__ == '__main__':
    main()
