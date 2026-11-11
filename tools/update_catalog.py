#!/usr/bin/env python3
"""Make docs/catalog.json for the Browse page from the library's catalog.

Run:  python3 tools/update_catalog.py   (tools/nightly.sh runs it and publishes any change)

The books repo rebuilds catalog_full.csv after every merge; it carries each work's source page
and license, which the Browse page links to. That repo is private, so it is read with the GitHub
CLI. If that fails, the public catalog.csv in the .github repo is used (no source links then).
Rows keep the catalog's order (by author's last name).
"""
import csv, io, json, pathlib, re, subprocess, urllib.request

FULL = ["gh", "api", "-H", "Accept: application/vnd.github.raw",
        "repos/Christian-open-library/books/contents/catalog_full.csv"]
PUBLIC = "https://raw.githubusercontent.com/Christian-open-library/.github/main/catalog.csv"
OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "catalog.json"
LICENSES = {"public-domain": "Public domain", "cc0": "Public domain (CC0)", "cc-by-sa": "CC BY-SA 4.0", "cc-by": "CC BY"}

def fetch():
    try:
        out = subprocess.run(FULL, capture_output=True, timeout=180, check=True).stdout.decode("utf-8")
        if out.startswith("Author,Title,"):
            return out, "books repo"
    except Exception:
        pass
    return urllib.request.urlopen(PUBLIC, timeout=60).read().decode("utf-8"), "public catalog"

def main():
    text, origin = fetch()
    works = []
    for r in csv.DictReader(io.StringIO(text)):
        if not r.get("Title"):
            continue
        m = re.match(r"https?://[^\s)]+", (r.get("Source") or "").strip())
        src = m.group(0).rstrip(".,;") if m else ""
        lic = LICENSES.get((r.get("License") or "").strip().lower(), "")
        works.append([r["Author"].strip(), r["Title"].strip(), r["Year"].strip(), r["Type"].strip(),
                      src, lic])
    OUT.write_text(json.dumps({"fields": ["author", "title", "year", "type", "source", "license"], "works": works},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(OUT.parent.parent)}: {len(works)} works, from the {origin}")

if __name__ == "__main__":
    main()
