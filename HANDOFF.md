# Website handoff (written 2026-11-11)

Matt asked for a free website that tells people how to set up the connector, because GitHub daunts
his users (pastors and lay readers, 25 to 75, many not technical). Build it here.

## Decisions already made
- **No "get the books" page for now.** Matt said not to worry about how people get the books yet.
- **Hosting:** GitHub Pages (free; visitors never see GitHub). Repo `Christian-open-library/website`,
  public, not created yet. Serve plain static files from `/docs` on `main`, with a `.nojekyll` file.
- **Use relative links everywhere**, so the site works at
  `christian-open-library.github.io/website/` for Matt to preview before the domain points at it.
- **Domain later:** christianopenlibrary.org. Only after Matt approves the preview: he adds DNS
  records in Cloudflare (apex and `www` as CNAME to `christian-open-library.github.io`, DNS only, not
  proxied), then set the custom domain on the Pages site. Do not touch the existing records: the MX
  and SPF records are his email routing (hello@ works), and `mcp.` is the connector.
- **No trackers, analytics, cookies or outside fonts.** The privacy page says there are none.

## Pages
1. **Home:** what it is in two sentences, what you can ask (examples), who runs it, contact.
2. **Set it up:** step by step for Claude, ChatGPT and Gemini; sign in with email (a code is sent);
   no GitHub account needed; then example questions to try. Pictures would help: ask Matt for
   screenshots, do not fake them.
3. **How to check it.**
4. **What happens to your question** (privacy).
5. **How well it finds things** (test results).
6. **Corrections.**
Contact on every page: hello@christianopenlibrary.org. Feedback by email, not GitHub forms.

## Where the words come from (do not invent claims)
The text was written and corrected on 2026-11-11 and lives in the `.github` repo
(clone: `~/library-work/front-door`; fetch `origin/main` first):
- `profile/README.md`: the bio, the setup steps, the connector address
  (`https://mcp.christianopenlibrary.org/mcp`), "How to check it", the gifts link.
- `PRIVACY.md`, `ACCURACY.md`, `CORRECTIONS.md`: copy these, in a friendlier layout.
- `profile/brand/`: logo and icon. Banner colours: navy `#121c33`, gold `#c9a45c`.
Once the domain is live, make the site the one true copy of those three pages and have the GitHub
front page link to them, so the two do not drift.

## Wording rules Matt agreed to today
- Passages are word for word from the library's copy, which has errors, most of all in scans.
- Year and page are given where the source has them, not always.
- The AI app writes the answer and can summarize badly or quote from memory. The connector says
  NOT FOUND or NO CLOSE MATCH when it has nothing, and marks scanned passages and match strength.
- Author lines ("Author: Name (dates, description)") appear once the running update deploys.
- About 4,600 works. No Monergism editions. "I", not "we". No "trust us": show how to check.
- Sign-in accounts are held by WorkOS; search words go to Voyage AI, which is opted out of data use.
- The security review was done with AI, not an outside audit.

## Design
Plain and readable: large type (18px or more), one narrow column, high contrast, works on a phone,
light and dark, keyboard and screen-reader friendly. Nothing clever.

## State of this folder
- An empty git repository and a `.venv` with nothing installed yet (the setup was interrupted).
- Chromium for Playwright is already downloaded in `~/.cache/ms-playwright`; `pip install playwright`
  in the venv to take screenshots for your own checking.

## Things to know about working here
- Read `~/library-connector/STATUS.md` (top entries) for everything else done today.
- A four-hour index update may be running (`pgrep -f update.sh`). While it runs, do not touch the
  working tree of `~/library-work/books` or anything under `~/library-connector/indexer`.
- Merging pull requests and production deploys are blocked for Claude unless Matt says so in that
  turn. Open the pull request and ask him.
- Matt wants short answers, one best plan, and then the work done.
