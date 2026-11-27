# Guitar Coach: developer notes

A guitar-learning web app (nylon-string guitar, general course with flamenco lessons).
Personal context about the user is deliberately NOT kept in this public repository.

## How it's delivered
- Single self-contained HTML file (Vite + React + TypeScript, `vite-plugin-singlefile`).
- Mac app `Guitar Coach.app` (`packaging/make-mac-app.sh`): launcher starts a tiny Perl server
  (`packaging/server.pl`, 127.0.0.1:47819, so Chrome keeps mic permission) and opens Chrome in app mode.
- Auto-update: the launcher downloads `release/app.html` + `release/version.txt` from `main`.
  Only the sandboxed page auto-updates; the launcher and server.pl never do (by design).
- Publish: `npm test && npm run release`, commit `release/`, push to `main`.
- Data lives in the browser (localStorage `guitar-coach.v0`), optionally mirrored to a user-chosen
  folder via the File System Access API (Recordings/, Backups/latest-backup.json).

## Product rules (keep them)
- Microphone off by default; on only during an exercise; visible stop button; auto-off after 2 min idle
  and on page change.
- Uncertain detections show a "?" (amber/grey), never a red cross. False alarms are worse than misses.
- Octave-twin strings can't be separated in a strum; "String by string" pluck mode checks every string.
- Songs are chord progressions only: no lyrics, melodies, riffs or solos of copyrighted songs.
- "Ask Claude" uses the user's own API key, stored in the browser only, excluded from backups.
- Never commit personal information about the user to this repository.

## Where things are
- `content/`: course.json, lessons/*.md (YAML header + text with `::` visuals; see
  `src/visuals/LessonBody.tsx`), chords/*.json, songs/*.json, troubles.json, goals.json,
  config/thresholds.json (all pass marks).
- `src/audio/`: onset detection, chordCheck, stringCheck (pluck mode, note sequences), performance
  (play-along scoring), tuner, latency, synth (test guitar), engine (mic), scheduler/metronome.
- `src/engine/`: unlock rules, session builder (weak items, spaced review), quizzes.
- `src/checks/`: mastery checks. `src/screens/`: all pages.
- `tests/`: synthetic-guitar tests (incl. a "realistic" mode) and content validation.

## Known limits
- Detection thresholds are tuned on synthetic audio; refine with real recordings when available.
- Rasgueado is checked for timing only; missed up-strums are forgiven.
