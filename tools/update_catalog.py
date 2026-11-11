#!/usr/bin/env python3
"""Fetch the library's public catalog and write docs/catalog.json for the Browse page.

Run:  python3 tools/update_catalog.py   (then commit docs/catalog.json)
Source: catalog.csv in the books repo, or the public copy (kept in its order: by author).
"""
import csv, io, json, pathlib, subprocess, urllib.request

# The books repo rebuilds its catalog after every merge, so it is the freshest copy.
# It is private: read it with the GitHub CLI when this machine is signed in, else
# fall back to the public copy in the .github repo.
BOOKS = ["gh", "api", "-H", "Accept: application/vnd.github.raw", "repos/Christian-open-library/books/contents/catalog.csv"]
URL = "https://raw.githubusercontent.com/Christian-open-library/.github/main/catalog.csv"

def fetch():
    try:
        out = subprocess.run(BOOKS, capture_output=True, timeout=120, check=True).stdout.decode("utf-8")
        if out.startswith("Author,Title,"):
            return out, "books repo"
    except Exception:
        pass
    return urllib.request.urlopen(URL, timeout=60).read().decode("utf-8"), "public catalog"
OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "catalog.json"

def main():
    text, source = fetch()
    rows = list(csv.DictReader(io.StringIO(text)))
    works = [[r["Author"].strip(), r["Title"].strip(), r["Year"].strip(), r["Type"].strip()] for r in rows if r.get("Title")]
    OUT.write_text(json.dumps({"fields": ["author", "title", "year", "type"], "works": works}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(OUT.parent.parent)}: {len(works)} works, from the {source}")

if __name__ == "__main__":
    main()
