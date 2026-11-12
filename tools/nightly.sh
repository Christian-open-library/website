#!/bin/bash
# Nightly (cron on homebox): refresh the Browse page's list of works and publish it if it changed.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then echo "$(date '+%F %T') skipped: uncommitted changes in $(pwd)"; exit 0; fi
git pull -q --ff-only origin main
python3 tools/update_catalog.py
# The Support page shows the connector's live cost card; keep a copy here so the site loads nothing from elsewhere.
curl -sf --max-time 30 https://mcp.christianopenlibrary.org/support.svg -o docs/img/support.svg.new && grep -q "<svg" docs/img/support.svg.new && mv docs/img/support.svg.new docs/img/support.svg || rm -f docs/img/support.svg.new
if git diff --quiet -- docs/catalog.json docs/titles.json docs/img/support.svg; then echo "$(date '+%F %T') no change"; exit 0; fi
n=$(python3 -c "import json;print(len(json.load(open('docs/catalog.json'))['works']))")
git add docs/catalog.json docs/titles.json docs/img/support.svg
git commit -qm "Browse list: $n works, cost card (nightly refresh)"
git push -q origin main
echo "$(date '+%F %T') published: $n works"
