#!/bin/bash
# Nightly (cron on homebox): refresh the Browse page's list of works and publish it if it changed.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then echo "$(date '+%F %T') skipped: uncommitted changes in $(pwd)"; exit 0; fi
git pull -q --ff-only origin main
python3 tools/update_catalog.py
# Link-preview card: redrawn from catalog.json so its "About N works" stays current. A new address when it changes,
# so X and other sites fetch the new picture.
NODE_PATH="$HOME/Projects/node_modules" node tools/icons.js --og >/dev/null
if ! git diff --quiet -- docs/img/og.png; then
  v=$(sha256sum docs/img/og.png | cut -c1-8); sed -i -E "s#img/og\.png\?v=[0-9a-f]+#img/og.png?v=$v#" docs/*.html
fi
if git diff --quiet -- docs/catalog.json docs/titles.json docs/img/og.png docs/*.html; then echo "$(date '+%F %T') no change"; exit 0; fi
n=$(python3 -c "import json;print(len(json.load(open('docs/catalog.json'))['works']))")
git add docs/catalog.json docs/titles.json docs/img/og.png docs/*.html
git commit -qm "Browse list: $n works, preview card (nightly refresh)"
git push -q origin main
echo "$(date '+%F %T') published: $n works"
