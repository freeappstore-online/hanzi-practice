"""Import HSK 3.0 (2026) tags; keep unmatched words explicitly unlisted.

Run with a complete.json downloaded from the pinned revision below.
Topic tags are curated separately; this never changes readings or meanings.
"""
import hashlib
import json
import sys
from pathlib import Path

REVISION = '7ac65bf1a6387d35f1ade478906172a19311c7f9'
source = Path(sys.argv[1]).read_bytes()
entries = {e['simplified']: e for e in json.loads(source)}
topics = json.loads(Path('scripts/word-topics.json').read_text())
supplement = json.loads(Path('scripts/hsk-official-supplement.json').read_text())
examples = json.loads(Path('web/src/examples.json').read_text())
types = {'n':'Noun','nr':'Proper noun','ns':'Place name','nt':'Proper noun','nz':'Proper noun',
         'v':'Verb','vn':'Verb','vd':'Verb','a':'Adjective','ad':'Adjective','an':'Adjective',
         'b':'Adjective','z':'Adjective','d':'Adverb','r':'Pronoun','m':'Number','q':'Measure word',
         'p':'Preposition','c':'Conjunction','u':'Particle','y':'Particle','e':'Interjection',
         'o':'Interjection','t':'Time word','s':'Location','f':'Location','i':'Expression','l':'Expression'}
result = {}
for example in examples.values():
    word = example['word']
    entry = entries.get(word, {})
    levels = [int(l.split('-')[1]) for l in entry.get('level', []) if l.startswith('newest-')]
    result[word] = {'hsk': min(levels) if levels else None,
                    'topics': topics[word],
                    'types': sorted({types[p] for p in entry.get('pos', []) if p in types}) or ['Unclassified']}
for word, entry in supplement['entries'].items():
    assert result[word]['hsk'] in (None, entry['hsk'])
    result[word]['hsk'] = entry['hsk']
Path('web/src/word-tags.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
Path('docs/word-tags-source.json').write_text(json.dumps({
    'repository':'https://github.com/drkameleon/complete-hsk-vocabulary',
    'revision':REVISION,'file':'complete.json','sha256':hashlib.sha256(source).hexdigest(),
    'levelField':'newest-*','edition':'HSK 3.0, 2026 syllabus',
    'syllabus':'https://www.chinesetest.cn/syllabus',
    'license':'MIT; web/public/licenses/HSK-VOCABULARY-MIT.txt',
    'unmatched':'Unlisted in the imported source; not an inferred proficiency level',
    'officialSupplement':'scripts/hsk-official-supplement.json',
    'topicSource':'Curated in scripts/word-topics.json',
    'words':len(result),'matched':sum(e['hsk'] is not None for e in result.values()),
},indent=2)+'\n')
print(f'Tagged {len(result)} words.')
