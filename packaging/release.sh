#!/bin/bash
# Publishes a new version: builds the app and puts it in release/.
# Once committed and pushed to GitHub (main branch), every copy of Guitar Coach
# picks it up the next time it's opened.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
mkdir -p release
cp dist/index.html release/app.html
sed -n 's/.*name="guitar-coach-build" content="\([^"]*\)".*/\1/p' dist/index.html | head -1 > release/version.txt
echo "Release $(cat release/version.txt) ready in release/"
