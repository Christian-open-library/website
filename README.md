# Christian Open Library website

Plain static site, served by GitHub Pages from `/docs` on `main`. All links are relative.

- Edit the page text in `src/*.html`, then run `python3 tools/build.py` to rebuild `docs/`.
- `docs/style.css`, `docs/site.js`, `docs/img/` and `docs/fonts/` are edited directly. `docs/img/letters.svg` is made by the build.
- Fonts (Newsreader, Inter) are served from `docs/fonts/` under the SIL Open Font License; no outside requests.
- No trackers, analytics, cookies or outside fonts. Keep it that way: the privacy page says so.
- Sources of the words: the `.github` repo (`profile/README.md`, `PRIVACY.md`, `ACCURACY.md`, `CORRECTIONS.md`). See HANDOFF.md.
