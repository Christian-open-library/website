#!/bin/bash
# Nightly (cron on homebox): refresh the Browse page's list of works and publish it if it changed.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then echo "$(date '+%F %T') skipped: uncommitted changes in $(pwd)"; exit 0; fi
git pull -q --ff-only origin main
python3 tools/update_catalog.py
# The Support page shows the connector's live cost card; keep a copy here so the site loads nothing from elsewhere.
curl -sf --max-time 30 "https://mcp.christianopenlibrary.org/support.svg?theme=site" -o docs/img/support.svg.new && grep -q "<svg" docs/img/support.svg.new && mv docs/img/support.svg.new docs/img/support.svg || rm -f docs/img/support.svg.new
# A new address for each new card, so phones don't keep showing an old copy.
v=$(sha1sum docs/img/support.svg | cut -c1-8); sed -i -E "s#img/support\.svg(\?v=[0-9a-f]+)?\"#img/support.svg?v=$v\"#" docs/support.html docs/index.html src/support.html src/index.html
# Link-preview card: redrawn from catalog.json so its "About N works" stays current. A new address when it changes,
# so X and other sites fetch the new picture.
NODE_PATH="$HOME/Projects/node_modules" node tools/icons.js --og >/dev/null
if ! git diff --quiet -- docs/img/og.png; then
  v=$(sha256sum docs/img/og.png | cut -c1-8); sed -i -E "s#img/og\.png\?v=[0-9a-f]+#img/og.png?v=$v#" docs/*.html
fi
if git diff --quiet -- docs/catalog.json docs/titles.json docs/img/support.svg docs/img/og.png docs/*.html src/support.html src/index.html; then echo "$(date '+%F %T') no change"; exit 0; fi
n=$(python3 -c "import json;print(len(json.load(open('docs/catalog.json'))['works']))")
git add docs/catalog.json docs/titles.json docs/img/support.svg docs/img/og.png docs/*.html src/support.html src/index.html
git commit -qm "Browse list: $n works, cost card, preview card (nightly refresh)"
git push -q origin main
echo "$(date '+%F %T') published: $n works"
