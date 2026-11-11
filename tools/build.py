#!/usr/bin/env python3
"""Wrap each src/*.html fragment in the shared layout and write docs/*.html.

A fragment starts with one line:  <!-- title: Page title | desc: One sentence. -->
Everything before the line  <!-- body -->  is the page heading; the rest is the page.
Run from anywhere:  python3 tools/build.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "src", ROOT / "docs"

NAV = [("index", "Home"), ("setup", "Set it up"), ("check", "How to check it"), ("download", "Download"),
       ("privacy", "Privacy"), ("accuracy", "Accuracy"), ("corrections", "Corrections")]

LAYOUT = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="img/favicon.png" type="image/png">
<link rel="preload" href="fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="style.css">
</head>
<body class="page-{name}">
<a class="skip" href="#main">Skip to the page</a>
<header class="site">
  <div class="bar">
    <a class="brand" href="index.html"><img src="img/icon.svg" width="34" height="34" alt=""><span>Christian Open Library</span></a>
    <nav class="nav-desktop" aria-label="Main">
      <ul>
{nav}
      </ul>
    </nav>
    <details class="nav-mobile">
      <summary><span class="burger" aria-hidden="true"></span><span>Menu</span></summary>
      <nav aria-label="Main">
        <ul>
{nav}
        </ul>
      </nav>
    </details>
  </div>
</header>
<main id="main">
{main}
</main>
<footer class="site">
  <div class="foot">
    <p class="foot-brand"><img src="img/icon.svg" width="28" height="28" alt=""> Christian Open Library</p>
    <nav aria-label="Footer">
      <ul>
{footnav}
      </ul>
    </nav>
    <p>Write to <a href="mailto:hello@christianopenlibrary.org">hello@christianopenlibrary.org</a> with questions, corrections, or a book that is missing.</p>
    <p class="foot-small">A personal project of Matt Miller. Not a ministry of any church, presbytery or denomination. No ads, trackers or cookies. Soli Deo gloria.</p>
  </div>
</footer>
<script src="site.js" defer></script>
</body>
</html>
"""

def build():
    for key, _ in NAV:
        assert (SRC / f"{key}.html").exists(), key
    for src in sorted(SRC.glob("*.html")):
        text = src.read_text(encoding="utf-8")
        m = re.match(r"<!--\s*title:\s*(.*?)\s*\|\s*desc:\s*(.*?)\s*-->\s*", text, re.S)
        if not m:
            raise SystemExit(f"{src.name}: missing title/desc line")
        title, desc, rest = m.group(1), m.group(2), text[m.end():]
        if "<!-- body -->" not in rest:
            raise SystemExit(f"{src.name}: missing <!-- body --> line")
        head, body = rest.split("<!-- body -->", 1)
        name = src.stem
        full = title if name == "index" else f"{title} · Christian Open Library"
        items = []
        for key, label in NAV:
            cur = ' aria-current="page"' if key == name else ""
            items.append(f'        <li><a href="{key}.html"{cur}>{label}</a></li>')
        foot = [f'        <li><a href="{k}.html">{l}</a></li>' for k, l in NAV]
        if name == "index":
            main = (f'<div class="page-head home-head">\n  <div class="wrap">\n{head.strip()}\n  </div>\n</div>\n'
                    f'<div class="wrap prose">\n{body.strip()}\n</div>')
        else:
            main = (f'<div class="page-head">\n  <div class="wrap">\n{head.strip()}\n  </div>\n</div>\n'
                    f'<div class="wrap prose">\n{body.strip()}\n</div>')
        html = LAYOUT.format(title=full, desc=desc, name=name, nav="\n".join(items),
                             footnav="\n".join(foot), main=main)
        (OUT / f"{name}.html").write_text(html, encoding="utf-8")
        print("wrote", f"docs/{name}.html")

if __name__ == "__main__":
    build()
