# Reuse rules: handoff (2026-11-14)

Drafts only. Nothing merged, deployed, pushed to .github, posted or sent.

## What changed
- **Website** (branch `reuse-rules`, worktree /mnt/photos/library-work/reuse-rules-website):
  `download.html#reuse` rewritten as Yes / No / Never, "use the originals", and each book's own
  license. No invitation to ask: "the library doesn't take requests for other uses". `setup.html#terms`
  and the home tile point to it (the old "ask first" / "ask before building on it" are gone).
  "A few" = **10 books per free project**, counted for the whole project (series, rotating sites,
  several projects by the same people count as one). Screenshot: reuse-proposals/reuse-390px.png.
- **Access form**: reuse-proposals/request-library-access.yml (diff vs live: .diff). New required
  dropdown "Will you put the books in an app, website or AI service?" (No / Yes, up to 10 books in a
  free project / Yes, more than 10, AI training or paid). Terms checkbox and intro updated.
- **Standard replies**: reuse-proposals/reply-github-invite.txt, reply-github-no-invite.txt,
  reply-email.txt (made by x/reuse_replies.py; fixed text, never the model's).
- **Watchers** (connector branch `decline-reuse`, worktree /mnt/photos/library-work/reuse-rules-connector,
  commits f897669, 2056705): new call `decline-reuse` in github_watch.py and email_watch.py with the
  standard reply attached. GitHub: Matt says "decline-reuse N" (or "decline-reuse N invite") and a
  session runs `deploy/decline-reuse.sh N [--invite]` (comment, close as not planned, optional invite).
  Email: "draft the reply to <name>" as before. approve.sh's welcome comment states the new rules.
  The email "decide" reply no longer asks people what they have in mind. Tests: 25 ok.

## Reviewer (fresh Opus subagent) and what was done
Fixed: invite now only when Matt adds `--invite` (a stranger's plea can't set it); email "decide" reply
invited requests; 10-book website/app rule disagreed between page and form/replies (now: 10 books in
any free project OK; more = no; form has three answers); own-license carve-out added to No list,
replies, checkbox; credit the source named in the file (CCEL, CC BY); Perseus lexicon = non-commercial
only, keep statement, offer changes; quoting in sold books is fine; project-splitting closed; ads ->
ads or sponsorship; no sharing download or sign-in in a church/class; own human translation OK if
marked; approve.sh no longer says "share"; email prompt may point to the rules; greeting uses a
display name only if it looks like a plain first name; judge sees earlier closed requests; form says
"If approved, we'll invite".
Rejected: banning loading the books into one's own AI tool (NotebookLM etc.) for personal study:
that would reopen Matt's "personal study: yes". Training and datasets stay banned. Matt's call.
Rejected: "promotes a paid product" in the paid line: would catch every church site.
Checked: permission documents (URCNA) are not in the books catalog.

## To make it live (only after Matt says yes)
```
# 1. website
cd ~/library-work/website && git merge --ff-only reuse-rules && git push origin main
#    (reuse-proposals/ isn't served; delete it first if you don't want it in the repo:
#     git rm -r reuse-proposals && git commit -m "drop proposals")
# 2. access form (after the website is live, so the link works)
gh api -X PUT repos/Christian-open-library/.github/contents/.github/ISSUE_TEMPLATE/request-library-access.yml \
  -f message="Access form: app/website/AI question; new reuse rules" \
  -f content="$(base64 -w0 /mnt/photos/library-work/reuse-rules-website/reuse-proposals/request-library-access.yml)" \
  -f sha="$(gh api repos/Christian-open-library/.github/contents/.github/ISSUE_TEMPLATE/request-library-access.yml --jq .sha)"
# 3. watchers (cron runs from this tree; fast-forward only)
cd ~/library-connector && git merge --ff-only decline-reuse
COL_BOOKS_TOOLS=/mnt/photos/library-work/books-sweep8/tools .venv/bin/python -m unittest indexer.tests.test_watchers
# 4. cleanup
git -C ~/library-work/website worktree remove /mnt/photos/library-work/reuse-rules-website
git -C ~/library-connector worktree remove /mnt/photos/library-work/reuse-rules-connector
```
Then update memories library-x-replies and feedback-cautious-library-grants (new rules, decline-reuse).
