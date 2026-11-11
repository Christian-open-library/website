#!/usr/bin/env python3
"""Fetch the library's public catalog and write docs/catalog.json for the Browse page.

Run:  python3 tools/update_catalog.py   (then commit docs/catalog.json)
Source: catalog.csv in the public Christian-open-library/.github repo (kept in its order: by author).
"""
import csv, io, json, pathlib, urllib.request

URL = "https://raw.githubusercontent.com/Christian-open-library/.github/main/catalog.csv"
OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "catalog.json"

def main():
    text = urllib.request.urlopen(URL, timeout=60).read().decode("utf-8")
    rows = list(csv.DictReader(io.StringIO(text)))
    works = [[r["Author"].strip(), r["Title"].strip(), r["Year"].strip(), r["Type"].strip()] for r in rows if r.get("Title")]
    OUT.write_text(json.dumps({"fields": ["author", "title", "year", "type"], "works": works}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(OUT.parent.parent)}: {len(works)} works")

if __name__ == "__main__":
    main()
