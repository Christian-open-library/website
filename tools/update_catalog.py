#!/usr/bin/env python3
"""Make docs/catalog.json for the Browse page from the library's catalog.

Run:  python3 tools/update_catalog.py   (tools/nightly.sh runs it and publishes any change)

The books repo rebuilds catalog_full.csv after every merge; it carries each work's source page
and license, which the Browse page links to. That repo is private, so it is read with the GitHub
CLI. If that fails, the public catalog.csv in the .github repo is used (no source links then).
Rows keep the catalog's order (by author's last name).

Also written:
- a short display title for each work: cut at its first natural break, and for books from before
  1700 in modern spelling (u/v, i/j, final e and the like only; names are left alone). The spelling
  table is the connector's (~/library-connector, or $COL_CONNECTOR); without it titles keep their
  old spelling. Searching still matches the old spelling too.
- each author's dates and a one-line note, from the books repo's authors.csv.
- docs/titles.json: each work's full title as printed, loaded only when someone opens a book.
"""
import csv, hashlib, io, json, os, pathlib, re, subprocess, sys, urllib.request

FULL = ["gh", "api", "-H", "Accept: application/vnd.github.raw",
        "repos/Christian-open-library/books/contents/catalog_full.csv"]
PUBLIC = "https://raw.githubusercontent.com/Christian-open-library/.github/main/catalog.csv"
AUTHORS = ["gh", "api", "-H", "Accept: application/vnd.github.raw",
           "repos/Christian-open-library/books/contents/authors.csv"]
OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "catalog.json"
TITLES = OUT.with_name("titles.json")
LICENSES = {"public-domain": "Public domain", "cc0": "Public domain (CC0)", "cc-by-sa": "CC BY-SA 4.0", "cc-by": "CC BY"}

def fetch():
    try:
        out = subprocess.run(FULL, capture_output=True, timeout=180, check=True).stdout.decode("utf-8")
        if out.startswith("Author,Title,"):
            return out, "books repo"
    except Exception:
        pass
    return urllib.request.urlopen(PUBLIC, timeout=60).read().decode("utf-8"), "public catalog"

def fetch_authors():
    """Author -> [dates, note], or {} if the books repo can't be read."""
    try:
        out = subprocess.run(AUTHORS, capture_output=True, timeout=120, check=True).stdout.decode("utf-8")
    except Exception:
        return {}
    if not out.startswith("Author,"):
        return {}
    notes = {}
    for r in csv.DictReader(io.StringIO(out)):
        name, dates, note = (r.get("Author") or "").strip(), (r.get("Dates") or "").strip(), (r.get("Note") or "").strip()
        if name and (dates or note):
            notes[name] = [dates[:40], note[:160]]
    return notes

# ---------- short display titles ----------
# A title is cut at its first natural break once it is long: a full stop, colon or semicolon, or "or".
BREAK = re.compile(r"\. |: |; |,? [Oo]r,? (?=[A-Z])")
ABBREV = {"dr", "mr", "mrs", "st", "viz", "no", "vol", "rev", "esq", "tho", "wm", "jo", "jno", "geo", "phil", "rom",
          "cor", "gal", "eph", "heb", "matt", "ps", "isa", "gen", "exod", "rich", "chap", "cap", "ch", "ed", "tr", "sr", "jr",
          "prov", "joh", "john", "luk", "luke", "mar", "mark", "mat", "act", "acts", "ver", "vers", "deut", "lev", "num",
          "josh", "judg", "sam", "chron", "neh", "esth", "eccl", "eccles", "cant", "jer", "ezek", "dan", "hos", "mic",
          "hab", "zech", "zach", "mal", "thess", "tim", "tit", "pet", "jam", "apoc", "psal", "esa", "ier", "iohn"}

def natural_break(title):
    """Where the title's first natural break is (at least 15 letters in), or None."""
    for m in BREAK.finditer(title):
        if m.start() < 15:
            continue
        if title[m.start()] == ".":
            before = re.search(r"([^\W_]+)$", title[:m.start()])
            w = before.group(1) if before else ""
            # Not after an initial, an abbreviation or a numeral: "Tho. Adams", "Dr. Owen", "V. Bookes".
            if len(w) <= 1 or w.lower() in ABBREV or re.fullmatch(r"[IVXLCivxlc]+|\d+", w):
                continue
        if title[m.end():m.end() + 1].isdigit():
            continue                  # "Prov. 19. 14", "Ps. 23"
        return m.start()
    return None
DANGLING = re.compile(r"(?:[\s,;:]+(?:written|preached|delivered|published|set|made|by|the|of|and|in|into|to|a|an|with|for|at|from|on|upon|unto|that|or|wherein|whereunto|being|as|his|her|their|its|this|these|which|who|viz|together|concerning|touching|against|before|after|between|vpon|vnto|&))+\.?$", re.I)
def was_cut(title, full):
    """True when the catalog stopped the title short of the title as printed (it does at ~80 letters)."""
    a, b = (re.sub(r"[^a-z0-9]+", "", x.lower()) for x in (title, full or ""))
    return len(b) > len(a) + 3 and b.startswith(a[:max(10, len(a) - 12)])

def short_title(title, cut_short):
    if len(title) > 55:
        cut = natural_break(title)
        if cut is not None:
            return title[:cut].rstrip(" ,;:.")
    if cut_short:
        trimmed = DANGLING.sub("", title).rstrip(" ,;:.")
        return trimmed + "\u2026" if len(trimmed) >= 15 else title
    return title

def spelling_modernizer():
    """A function giving a word's modern spelling, or None if the connector's table isn't here."""
    root = pathlib.Path(os.environ.get("COL_CONNECTOR", pathlib.Path.home() / "library-connector"))
    try:
        sys.path.insert(0, str(root))
        from indexer import modernize as M
        mod = M.Modernizer(M.load_lexicon())
    except Exception as e:
        print(f"note: titles keep their old spelling ({type(e).__name__}: {e})")
        return None
    finally:
        if sys.path and sys.path[0] == str(root):
            sys.path.pop(0)
    return lambda w: mod.modernize_text(M.fold_chars(w))

def skeleton(w):
    # Old and modern spellings that differ only in the usual printers' ways share a skeleton.
    w = w.lower().replace("vv", "w").replace("v", "u").replace("j", "i").replace("y", "i").replace("ck", "c")
    return re.sub(r"(.)\1+", r"\1", w).replace("e", "")

def modern_title(title, modern, names):
    def fix(m):
        w = m.group(0)
        if len(w) < 4 or w in names or not w.isalpha():
            return w
        cand = re.sub(r"^V[Vv]", "W", w).replace("vv", "w")     # VVorship -> Worship
        new = modern(cand) or cand
        if not new.isalpha() or skeleton(new) != skeleton(w):
            new = cand
        if new.lower() == w.lower():
            return w
        if w.isupper():
            return new.upper()
        return new[0].upper() + new[1:] if w[0].isupper() else new.lower()
    return re.sub(r"[^\W\d_]+", fix, title)

def old_spelling(year, source):
    y = re.match(r"\d{4}", year or "")
    return "umich.edu" in source or (y is not None and int(y.group(0)) < 1700)

def main():
    text, origin = fetch()
    rows = [r for r in csv.DictReader(io.StringIO(text)) if r.get("Title")]
    modern = spelling_modernizer()
    # Names are left in their own spelling: Andrewes stays Andrewes.
    names = {w for r in rows for w in re.findall(r"[^\W\d_]+", r["Author"])}
    works, full = [], []
    for r in rows:
        m = re.match(r"https?://[^\s)]+", (r.get("Source") or "").strip())
        src = m.group(0).rstrip(".,;") if m else ""
        lic = LICENSES.get((r.get("License") or "").strip().lower(), "")
        title, year = r["Title"].strip(), r["Year"].strip()
        ft = (r.get("Full title") or "").strip()
        short = short_title(title, len(title) >= 60 and was_cut(title, ft))
        if modern and old_spelling(year, src):
            short = modern_title(short, modern, names)
        works.append([r["Author"].strip(), title, year, r["Type"].strip(), src, lic,
                      "" if short == title else short])
        full.append("" if ft == title else ft)
    authors = fetch_authors()
    held = {w[0] for w in works}
    authors = {k: v for k, v in sorted(authors.items()) if k in held}
    version = hashlib.sha256(json.dumps(full, ensure_ascii=False).encode()).hexdigest()[:10]
    OUT.write_text(json.dumps({"fields": ["author", "title", "year", "type", "source", "license", "short"],
                               "titles": version, "works": works, "authors": authors},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    TITLES.write_text(json.dumps({"version": version, "full": full}, ensure_ascii=False, separators=(",", ":")),
                      encoding="utf-8")
    print(f"wrote {OUT.relative_to(OUT.parent.parent)}: {len(works)} works, {len(authors)} author notes, "
          f"{sum(1 for w in works if w[6])} short titles, from the {origin}")

if __name__ == "__main__":
    main()
