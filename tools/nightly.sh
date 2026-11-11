#!/bin/bash
# Nightly (cron on homebox): refresh the Browse page's list of works and publish it if it changed.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then echo "$(date '+%F %T') skipped: uncommitted changes in $(pwd)"; exit 0; fi
git pull -q --ff-only origin main
python3 tools/update_catalog.py
if git diff --quiet -- docs/catalog.json; then echo "$(date '+%F %T') no change"; exit 0; fi
n=$(python3 -c "import json;print(len(json.load(open('docs/catalog.json'))['works']))")
git add docs/catalog.json
git commit -qm "Browse list: $n works (nightly refresh)"
git push -q origin main
echo "$(date '+%F %T') published: $n works"
