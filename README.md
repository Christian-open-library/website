# Christian Open Library website

Plain static site, served by GitHub Pages from `/docs` on `main`. All links are relative.

- Edit the page text in `src/*.html`, then run `python3 tools/build.py` to rebuild `docs/`.
- `docs/style.css`, `docs/site.js`, `docs/img/` and `docs/fonts/` are edited directly.
- Fonts (Geist, Geist Mono) are served from `docs/fonts/` under the SIL Open Font License; no outside requests.
- No trackers, analytics, cookies or outside fonts. Keep it that way: the privacy page says so.
- Live at https://christianopenlibrary.org (custom domain set on GitHub Pages; Cloudflare: apex and www CNAME to christian-open-library.github.io, DNS only).
- This site is the one kept copy of the Privacy, Accuracy and Corrections pages; the `.github` repo's files point here. Add new corrections to `src/corrections.html`.
- The Browse page reads `docs/catalog.json`, made from the books repo's catalog and authors.csv by `tools/update_catalog.py` (short display titles in modern spelling via the connector's spelling table in `~/library-connector`, author dates and notes); full printed titles are in `docs/titles.json`, loaded when a book is opened. Search runs in the browser (`docs/browse.js`): best-match order, editions combined, author cards, suggestions, spelling correction. `tools/nightly.sh` refreshes and publishes it every night (homebox cron, 05:37); it skips if this clone has uncommitted changes. Log: `~/.local/state/website-catalog.log`.
