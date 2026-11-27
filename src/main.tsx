import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { store } from './storage/store';
import { saveFile } from './storage/folder';

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
