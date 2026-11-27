# Guitar Coach

A personal guitar-learning app: a six-stage course (with flamenco corners), mastery checks that listen through the microphone, practice sessions built around your weakest areas, play-alongs with song maps, and progress tracking. See CLAUDE.md for the full picture.

## Using it
Double-click **Guitar Coach.app** (Mac). It starts a tiny private web server (`packaging/server.pl`, only reachable from this Mac at http://localhost:47819, so Chrome remembers the microphone permission) and opens the app in its own Google Chrome window.
Everything runs on your computer; nothing is uploaded. Progress is stored inside Chrome
on this computer (Setup → "Save backup file" makes a copy).

To rebuild the Mac app after changes: `npm run build && packaging/make-mac-app.sh packaging/icons <output-folder>`

## For development
```bash
npm install
npm test          # synthetic-audio tests for the detectors
npm run build     # makes dist/index.html (one self-contained file)
npm run release   # build + copy to release/ (commit and push to publish an update)
npm run dev       # live dev server at http://localhost:5173
```

## Where things live
- `content/` — chords, songs and pass marks (`config/thresholds.json`). Edit these, not the code.
- `src/audio/` — listening: onset (strum) detection, chord check, tuner, timing, latency, synth.
- `src/visuals/` — chord diagram, song map.
- `src/screens/` — the pages.
- `tests/audio/` — tests that use a synthetic nylon guitar to check detection.
