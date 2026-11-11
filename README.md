# Christian Open Library website

Plain static site, served by GitHub Pages from `/docs` on `main`. All links are relative.

- Edit the page text in `src/*.html`, then run `python3 tools/build.py` to rebuild `docs/`.
- `docs/style.css`, `docs/site.js`, `docs/img/` and `docs/fonts/` are edited directly.
- Fonts (Geist, Geist Mono) are served from `docs/fonts/` under the SIL Open Font License; no outside requests.
- No trackers, analytics, cookies or outside fonts. Keep it that way: the privacy page says so.
- Live at https://christianopenlibrary.org (custom domain set on GitHub Pages; Cloudflare: apex and www CNAME to christian-open-library.github.io, DNS only).
- This site is the one kept copy of the Privacy, Accuracy and Corrections pages; the `.github` repo's files point here. Add new corrections to `src/corrections.html`.
- The Browse page reads `docs/catalog.json`. Refresh it from the public catalog with `python3 tools/update_catalog.py`, then commit.
