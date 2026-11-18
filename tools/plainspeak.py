#!/usr/bin/env python3
"""Flag sentences on the site that read like AI writing: clause after clause joined by commas,
long sentences, dashes and stock AI words. Run: python3 tools/plainspeak.py [src/page.html ...]
Prints each flagged sentence with the reason. Exit code 1 if anything is flagged (with --strict).
"""
import re, sys, glob, pathlib
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
BLOCK = {'p','li','h1','h2','h3','h4','td','th','div','br','dt','dd','summary','button','label','blockquote','figcaption'}
# Commas that tack on another clause: ", and it", ", with the", ", not for", ", which", ", so"
TACK = re.compile(r', (and|with|not|which|so|but|or|since|because|including|such as|then|while|where|so that)\b', re.I)
AI_WORDS = re.compile(r'\b(seamless(ly)?|robust|leverag\w*|delve\w*|empower\w*|journey|curated|unlock\w*|vibrant|tapestry|'
                      r'navigat\w+ the|landscape|comprehensive|crucial|foster\w*|elevat\w*|streamlin\w*|effortless\w*|'
                      r'dive into|whether you|in today|rich (history|heritage)|at your fingertips|treasure trove|'
                      r'not just|not only|more than just|designed to|ensur\w+)\b', re.I)
LIST_WORD_MAX = 4   # a comma segment this short is probably a list item, not a clause

class Text(HTMLParser):
    def __init__(s):
        super().__init__(); s.skip = 0; s.out = []
    def handle_starttag(s, t, a):
        if t in ('script', 'style', 'svg', 'code', 'pre'): s.skip += 1
        if t in BLOCK: s.out.append('\n')
    def handle_endtag(s, t):
        if t in ('script', 'style', 'svg', 'code', 'pre'): s.skip -= 1
        if t in BLOCK: s.out.append('\n')
    def handle_data(s, d):
        if not s.skip: s.out.append(d)

def sentences(path):
    p = Text(); p.feed(path.read_text())
    txt = re.sub(r'[ \t\r]+', ' ', ''.join(p.out))
    for line in txt.split('\n'):
        for s in re.split(r'(?<=[.!?”"])\s+(?=[A-Z0-9“"])', line.strip()):
            if len(s.split()) > 3: yield s.strip()

def problems(s):
    words = len(s.split()); commas = s.count(',')
    segs = [len(x.split()) for x in s.split(',')]
    clause_commas = sum(1 for n in segs[1:] if n > LIST_WORD_MAX)
    why = []
    if words > 25: why.append(f'{words} words')
    if clause_commas >= 2: why.append(f'{commas} commas joining clauses')
    tacks = TACK.findall(s)
    if tacks and commas >= 2 and clause_commas >= 1: why.append('tacked-on clause: ", ' + '", ", '.join(t.lower() for t in tacks) + '"')
    if '—' in s or ' – ' in s: why.append('dash')
    m = AI_WORDS.findall(s)
    if m: why.append('AI word: ' + ', '.join(sorted({x[0] if isinstance(x, tuple) else x for x in m})))
    return why

def main(argv):
    strict = '--strict' in argv
    files = [pathlib.Path(a) for a in argv if not a.startswith('--')] or sorted((ROOT / 'src').glob('*.html'))
    total = flagged = 0
    for f in files:
        rows = []
        for s in sentences(f):
            total += 1
            why = problems(s)
            if why: rows.append((s, why))
        flagged += len(rows)
        if rows:
            print(f'\n== {f.name}: {len(rows)} to look at')
            for s, why in rows: print(f'  - {s}\n      ({"; ".join(why)})')
    print(f'\n{flagged} of {total} sentences flagged.')
    return 1 if strict and flagged else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
