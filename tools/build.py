#!/usr/bin/env python3
"""Wrap each src/*.html fragment in the shared layout and write docs/*.html.

Each fragment starts with one line:  <!-- title: Page title | desc: One sentence. -->
Run from anywhere:  python3 tools/build.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "src", ROOT / "docs"

NAV = [("index", "Home"), ("setup", "Set it up"), ("check", "How to check it"),
       ("privacy", "Privacy"), ("accuracy", "Accuracy"), ("corrections", "Corrections")]

LAYOUT = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="img/favicon.png" type="image/png">
<link rel="stylesheet" href="style.css">
</head>
<body>
<a class="skip" href="#main">Skip to the page</a>
<header class="site">
  <div class="wrap">
    <a class="brand" href="index.html"><img src="img/icon.svg" width="44" height="44" alt=""><span>Christian Open Library</span></a>
    <nav aria-label="Main">
      <ul>
{nav}
      </ul>
    </nav>
  </div>
</header>
<main id="main" class="wrap">
{body}
</main>
<footer class="site">
  <div class="wrap">
    <p>Questions, corrections or a book that is missing? Write to <a href="mailto:hello@christianopenlibrary.org">hello@christianopenlibrary.org</a>.</p>
    <p>A personal project of Matt Miller. It has no ads, no trackers and no cookies. Not a ministry of any church, presbytery or denomination.</p>
    <p class="small">Soli Deo gloria.</p>
  </div>
</footer>
<script src="copy.js" defer></script>
</body>
</html>
"""

def build():
    for key, label in NAV:
        assert (SRC / f"{key}.html").exists(), key
    for src in sorted(SRC.glob("*.html")):
        text = src.read_text(encoding="utf-8")
        m = re.match(r"<!--\s*title:\s*(.*?)\s*\|\s*desc:\s*(.*?)\s*-->\s*", text, re.S)
        if not m:
            raise SystemExit(f"{src.name}: missing title/desc line")
        title, desc, body = m.group(1), m.group(2), text[m.end():]
        name = src.stem
        full = title if name == "index" else f"{title} · Christian Open Library"
        items = []
        for key, label in NAV:
            cur = ' aria-current="page"' if key == name else ""
            items.append(f'        <li><a href="{key}.html"{cur}>{label}</a></li>')
        html = LAYOUT.format(title=full, desc=desc, nav="\n".join(items), body=body.rstrip())
        (OUT / f"{name}.html").write_text(html, encoding="utf-8")
        print("wrote", f"docs/{name}.html")

if __name__ == "__main__":
    build()
