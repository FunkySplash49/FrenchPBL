#!/usr/bin/env bash
# Build and deploy the game lab (alesia-game-lab on Vercel), including La Percée's class-board function.
#
#   tools/deploy-lab.sh            → stage .deploy/alesia-game-lab and deploy to production
#   tools/deploy-lab.sh --dry-run  → stage only (inspect .deploy/alesia-game-lab, nothing is uploaded)
#
# The deploy folder is not in git; it keeps only .vercel (the project link) and .gitignore between runs.
# Needs on the Vercel project: KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL +
# UPSTASH_REDIS_REST_TOKEN), set by the Upstash integration; optional ADMIN_KEY enables DELETE /api/board.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.deploy/alesia-game-lab"
[ -d "$OUT/.vercel" ] || { echo "missing $OUT/.vercel (link it first: cd $OUT && vercel link)"; exit 1; }

cd "$ROOT"
node game-lab-api/test.mjs >/dev/null
npm run build

find "$OUT" -mindepth 1 -maxdepth 1 ! -name .vercel ! -name .gitignore -exec rm -rf {} +
cp -R dist/. "$OUT/"
rm "$OUT/index.html" "$OUT/sw.js"   # the offline copy belongs to the main site only
mv "$OUT/game-lab.html" "$OUT/index.html"
mkdir -p "$OUT/api"
cp game-lab-api/board.mjs "$OUT/api/board.mjs"
cp vercel.json "$OUT/vercel.json"   # long cache for the hashed files, so a return visit downloads nothing

echo "staged: $OUT"
if [ "${1:-}" = "--dry-run" ]; then exit 0; fi
cd "$OUT" && vercel deploy --prod --yes
