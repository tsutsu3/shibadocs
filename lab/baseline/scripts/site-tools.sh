#!/usr/bin/env bash
# Produce PDFs from the Docusaurus site with the three site-based tools.
# The site must already be served: (cd site && pnpm build && pnpm serve)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${URL:-http://localhost:3100/docs/intro}"
cd "$ROOT"

# Puppeteer would download its own Chrome. Use the Chromium Playwright installed.
export PUPPETEER_SKIP_DOWNLOAD=1 PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
PUPPETEER_EXECUTABLE_PATH="$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome | head -1)"
export PUPPETEER_EXECUTABLE_PATH

# Prince is installed locally by hand (see README).
export PATH="$ROOT/.bin/prince/bin:$PATH"

echo "== docusaurus-prince-pdf"
# 1.2.1 uses `import ... assert { type: 'json' }`, which Node 22 removed.
mkdir -p .work/prince
npx -y node@20 "$ROOT/node_modules/docusaurus-prince-pdf/index.js" \
  -u "$URL" --include-index -d .work/prince -o out/docusaurus-prince.pdf

echo "== docs-to-pdf"
npx -y docs-to-pdf@1.4.0 docusaurus \
  --initialDocURLs="$URL" --outputPDFFilename=out/docs-to-pdf.pdf \
  --paperFormat=A4 --coverTitle="在庫管理システム"

echo "== mr-pdf"
npx -y mr-pdf@1.1.0 \
  --initialDocURLs="$URL" --contentSelector=article \
  --paginationSelector="a.pagination-nav__link--next" \
  --outputPDFFilename=out/mr-pdf.pdf
