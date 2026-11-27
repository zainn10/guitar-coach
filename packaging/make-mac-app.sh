#!/bin/bash
# Wraps the built app (dist/index.html) into "Guitar Coach.app" for the Mac desktop.
# Usage: packaging/make-mac-app.sh <icon-png-dir> <output-dir>
set -euo pipefail
ICONS="$1"; OUT="$2"
APP="$OUT/Guitar Coach.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp dist/index.html "$APP/Contents/Resources/app.html"
cp packaging/server.pl "$APP/Contents/Resources/server.pl"
sed -n 's/.*name="guitar-coach-build" content="\([^"]*\)".*/\1/p' dist/index.html | head -1 > "$APP/Contents/Resources/version.txt"
python3 packaging/make_icns.py "$APP/Contents/Resources/AppIcon.icns" \
  ic07="$ICONS/icon128.png" ic08="$ICONS/icon256.png" ic09="$ICONS/icon512.png" ic10="$ICONS/icon1024.png"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Guitar Coach</string>
  <key>CFBundleDisplayName</key><string>Guitar Coach</string>
  <key>CFBundleIdentifier</key><string>local.guitarcoach.app</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>GuitarCoach</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
</dict>
</plist>
PLIST
cat > "$APP/Contents/MacOS/GuitarCoach" <<'SH'
#!/bin/bash
# Guitar Coach launcher.
# 1. Keeps the app page in ~/Library/Application Support/Guitar Coach and, when online,
#    downloads the newest published page from GitHub (zainn10/guitar-coach, release/ folder).
#    SAFETY: only the web page (app.html) is ever downloaded. It runs inside Chrome's sandbox.
#    Nothing that runs directly on the Mac (this script, server.pl) is ever updated online;
#    those only change when you install a new Guitar Coach.app yourself.
# 2. Serves it from a private address on this Mac (http://localhost:47819) so Chrome remembers
#    the microphone permission. Nothing is reachable from outside this Mac.
# 3. Opens it in its own Chrome window.
BUNDLE="$(cd "$(dirname "$0")/../Resources" && pwd)"
LIVE="$HOME/Library/Application Support/Guitar Coach"
BASE="https://raw.githubusercontent.com/zainn10/guitar-coach/main/release"
PORT=47819
mkdir -p "$LIVE"

if ! open -Ra "Google Chrome" >/dev/null 2>&1; then
  osascript -e 'display dialog "Guitar Coach needs Google Chrome (free) to use the microphone properly. I will open the download page now. After installing Chrome, open Guitar Coach again." buttons {"OK"} default button 1 with title "Guitar Coach"'
  open "https://www.google.com/chrome/"
  exit 0
fi

# Use the copy inside this app if it's newer than what's installed (or nothing is installed yet).
BUNDLED_V="$(cat "$BUNDLE/version.txt" 2>/dev/null)"
LIVE_V="$(cat "$LIVE/version.txt" 2>/dev/null)"
if [ ! -f "$LIVE/app.html" ] || [[ "$BUNDLED_V" > "$LIVE_V" ]]; then
  cp "$BUNDLE/app.html" "$BUNDLE/version.txt" "$LIVE/"
  LIVE_V="$BUNDLED_V"
fi

# Check for a newer published version (gives up quietly after a few seconds if offline).
REMOTE_V="$(curl -fsS -m 4 "$BASE/version.txt?t=$(date +%s)" 2>/dev/null | tr -d '[:space:]')"
if [[ "$REMOTE_V" =~ ^[0-9]{8}-[0-9]{4} ]] && [[ "$REMOTE_V" > "$LIVE_V" ]]; then
  TMP="$LIVE/download"
  rm -rf "$TMP"; mkdir -p "$TMP"
  if curl -fsS -m 60 "$BASE/app.html?t=$REMOTE_V" -o "$TMP/app.html" \
     && grep -q "guitar-coach-build\" content=\"$REMOTE_V\"" "$TMP/app.html" \
     && [ "$(wc -c < "$TMP/app.html")" -gt 100000 ]; then
    mv "$TMP/app.html" "$LIVE/app.html"
    echo "$REMOTE_V" > "$LIVE/version.txt"
  fi
  rm -rf "$TMP"
fi

# (Re)start the little private server so it serves the current version.
pkill -f guitarcoach-server >/dev/null 2>&1
nohup /usr/bin/perl "$BUNDLE/server.pl" "$PORT" "$LIVE/app.html" guitarcoach-server >/dev/null 2>&1 &
URL=""
for i in $(seq 1 40); do
  if [ "$(curl -s -m 1 "http://127.0.0.1:$PORT/ping")" = "guitar-coach" ]; then URL="http://localhost:$PORT/"; break; fi
  sleep 0.1
done
if [ -z "$URL" ]; then
  # Fallback: open the file directly (works, but Chrome will ask for the mic each time).
  URL="file://$(printf '%s' "$LIVE/app.html" | sed -e 's/%/%25/g' -e 's/ /%20/g')"
fi
open -na "Google Chrome" --args --app="$URL"
SH
chmod +x "$APP/Contents/MacOS/GuitarCoach"
echo "Built $APP"
