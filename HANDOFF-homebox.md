# Handoff to homebox (written 2026-11-16)

From a cloud session that worked on the website and connector repos. That session can't reach homebox, the office
server or christianopenlibrary.org, so the steps below have to be done here. Matt wants short answers, one best plan,
then the work done. Merging and production deploys only when Matt says so in that turn.

## First job: the catechism fix isn't live

Connector PR #2 (merged, `c0d4c27`) stops a catechism's "Q." and "A." marks counting as words. Matt ran the deploy,
but the live connector still gives the old answer:

- `check_quote` on "What is the chief end of man? Man's chief end is to glorify God, and to enjoy him for ever." (no
  author) says **FOUND, BUT WORDED DIFFERENTLY ... left out "A"**. With the fix it should say **FOUND WORD FOR WORD**
  (Westminster Assembly, *Westminster Shorter Catechism*, 1647).
- The fix itself is right. On the real file (`Creeds/Westminster Assembly - Westminster Shorter Catechism.md` in the
  books repo) `Quote::isLabel` recognizes 213 of the 215 "A" and "Q" letters as marks. One of the two exceptions is the
  word "a" in "A. A sacrament", which should stay a word. The other is the "Q. 1." just under the byline, which is
  harmless. All 305 PHP tests pass, and the GitHub test run passed.

So the release on the server isn't `c0d4c27` or later. Find out why:

1. `cd ~/library-connector && git status && git log --oneline -3`. HEAD should be `c0d4c27` or later. Check that
   `git pull` worked and that the clone is on `main`.
2. `deploy/deploy-office.sh status` shows the app release that's live. Compare it with
   `git rev-parse --short=12 HEAD` and with `"release"` in `data/deployed-office.json`.
3. If they differ, run `deploy/deploy-office.sh release` and read all of its output:
   - It now runs `tools/php tests/php/run.php` first and stops with "tests failed: nothing was released" if one fails.
     `LIBRARY_PHP=php` uses native PHP instead.
   - It then uploads, activates and runs the smoke test.
4. Confirm the fix with `deploy/deploy-office.sh smoke`. The line
   `known quote, word for word (a catechism's "A." is not a word)` must say PASS. Then run `check_quote` on the
   Westminster question.
5. The website's corrections log already says the catechism fix has been "In place from 16 November"
   (`src/corrections.html` in the website repo). If it can't go live today, change that date in the website repo
   before anyone reads it.

## What changed today (all merged)

**Connector #1:**
- The website checker keeps each answer for 24 hours. The key for that saved answer now includes the code release
  (`Mcp::version()`, with the revision a deploy writes), so a new release starts with no saved answers. Before this,
  "Be killing sin or it will be killing you" (John Owen) was shown as "worded differently" for a day after the check
  code changed. It now shows "Verified word for word".
- `.github/workflows/tests.yml` runs the PHP and indexer tests on every push.
- `deploy-office.sh release` runs the PHP tests first and releases nothing if one fails.
- `deploy/smoke.py` has `KNOWN_QUOTES`, quotations whose right answers were checked by hand, and runs them against
  the live `/check` after each deploy. With the John 3:16 check that makes 10 checks, 11 seconds apart (the visitor
  limit is 6 a minute), about 2 minutes. Add a line to it whenever a wrong answer is fixed.
- Two tests were fixed:
  - `public_check_test.php` didn't load `KeptAnswer`, so its tests failed.
  - `oauth_test.php` needed `clearstatcache()`. Native PHP caches the old file time within one run; php-wasm
    doesn't, which is why it passed here.

**Connector #2:** the catechism marks, described above. `smoke.py` checks the Westminster question.

**Website #3:** "Think this answer is wrong? Tell me" under each checker result. It opens an email to hello@ with the
quotation, the name, what the checker said and the share link. Nothing is sent from the page.

**Website #4:** a 16 November entry in the corrections log for both checker fixes.

## Worth knowing

- **The smoke test uses up checker allowance.** It now makes about 12 `/check` calls each run. From homebox they
  count as one visitor, whose limit is 60 a day. A release plus the nightly build deploy uses about 24, so more than
  about 4 smoke runs in one day will start getting refused (429). If that happens often, give the smoke test its own
  allowance on the server rather than cutting the known quotations.
- **The "Q. 1." under the byline isn't recognized.** It comes after a line with no full stop. It could be fixed by
  also counting a mark at the start of a line. That's low priority, because no quotation spans the byline.

## Ideas discussed, not started

- **An X account that replies to mentions**, answering quote checks and "do you have this book?" from the checker and
  the catalogue, with no AI writing the replies. Waiting on Matt to decide:
  - which account answers;
  - whether replies include a link (about $0.20 per reply with a link, about $0.015 without);
  - setting up the X developer account, buying credits and setting a spend cap.

  It would run on homebox. It needs its own allowance on `/check`, because the per-visitor limit would stop it.
- **Tweets for the Check a quote page** were drafted in the cloud session. The Spurgeon "a lie travels" example is the
  strongest: it isn't in any of the library's 139 Spurgeon works, and the earliest copy the library has is *The Pulpit
  Commentary* (1890), which introduces it as "quaintly said". Its share picture comes from the checker's Share image
  button.
