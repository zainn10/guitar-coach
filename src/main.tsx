// Refuse to run inside another website's frame (stops other sites embedding the app to trick you into allowing the mic).
if (window.top !== window.self) {
  document.documentElement.textContent = 'Guitar Coach can only be opened directly, not inside another website.';
  throw new Error('framed');
}
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { store } from './storage/store';
import { saveFile } from './storage/folder';
import { syncFromFolder } from './storage/sync';

// Keep Backups/latest-backup.json in your Guitar Coach folder up to date (silently;
// only if you've already allowed the folder, so it never pops up a permission box).
let backupTimer: ReturnType<typeof setTimeout> | undefined;
store.subscribe(() => {
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    saveFile('Backups', 'latest-backup.json', new Blob([store.exportJson()], { type: 'application/json' }), false).catch(() => {});
  }, 3000);
});

createRoot(document.getElementById('root')!).render(<App />);

// On the Mac: pick up progress saved from the phone into the iCloud folder.
setTimeout(() => {
  syncFromFolder(false).then(msg => { if (msg) window.dispatchEvent(new CustomEvent('gc-saved', { detail: msg })); });
}, 1500);
