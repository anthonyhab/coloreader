#!/usr/bin/env bash
# Build + AMO-sign the coloreader Firefox XPI (unlisted channel).
# Credentials: ~/.config/mozilla/web-ext-signing.env (see bb-save-amo-credentials).
# Requires a version bump in src/manifest.json BEFORE running — AMO rejects
# duplicate versions. Then publish:
#   gh release create v<version> --repo anthonyhab/coloreader \
#     --title "coloreader <version>" --notes "..." build/release/signed/*.xpi
# (AUR PKGBUILDs download the XPI from that release.)
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build:firefox

if [ ! -f ~/.config/mozilla/web-ext-signing.env ]; then
    echo "missing ~/.config/mozilla/web-ext-signing.env" >&2
    exit 1
fi
set -a
# shellcheck disable=SC1091
. ~/.config/mozilla/web-ext-signing.env
set +a

if [ -x node_modules/.bin/web-ext ]; then
    web_ext=(node_modules/.bin/web-ext)
else
    web_ext=(npx --yes web-ext)
fi

"${web_ext[@]}" sign \
    --source-dir build/release/firefox \
    --artifacts-dir build/release/signed \
    --channel unlisted

echo "Signed XPI: $(ls -t build/release/signed/*.xpi | head -1)"
