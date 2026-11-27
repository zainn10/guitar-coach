// Syncing progress between Mac and phone through the iCloud "Guitar Coach" folder.
//  - The Mac keeps Backups/latest-backup.json up to date automatically, and on opening
//    it merges in Backups/phone-backup.json if the phone has saved a newer one.
//  - The phone loads the Mac's file (file picker) and saves its own phone-backup.json (share sheet).
import { store } from './store';
import { readFolderFile, saveFile } from './folder';

export const PHONE_FILE = 'phone-backup.json';
export const MAC_FILE = 'latest-backup.json';

/** Mac: merge the phone's backup from the folder if it's newer. Returns a message or null. */
export async function syncFromFolder(interactive = false): Promise<string | null> {
  const text = await readFolderFile('Backups', PHONE_FILE, interactive);
  if (!text) return interactive ? 'No phone backup found yet in Guitar Coach / Backups.' : null;
  try {
    const r = store.mergeJson(text);
    return r.changed ? 'Synced: progress from your phone is now on this Mac.' : interactive ? 'Already up to date with your phone.' : null;
  } catch (e) { return interactive ? (e as Error).message : null; }
}

/** Phone: save this device's progress into the folder (via the share sheet). */
export function savePhoneBackup() {
  return saveFile('Backups', PHONE_FILE, new Blob([store.exportJson()], { type: 'application/json' }));
}
