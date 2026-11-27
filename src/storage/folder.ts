// "Your Guitar Coach folder": lets the app save recordings and backups straight into
// a folder you choose (e.g. Documents/Claude/Guitar Coach) instead of Downloads.
// Uses Chrome's folder-access feature; you pick the folder once and Chrome asks you to allow it.
import { downloadBlob } from '../audio/wav';

/* Minimal types for Chrome's File System Access API */
interface PermHandle { queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>; requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState> }
type DirHandle = FileSystemDirectoryHandle & PermHandle;
declare global { interface Window { showDirectoryPicker?: (o?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<DirHandle> } }

const DB = 'guitar-coach-folder';
let cached: DirHandle | null | undefined;
const subs = new Set<() => void>();

function idb<T>(fn: (s: IDBObjectStore) => IDBRequest<T>, write = false): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('kv', write ? 'readwrite' : 'readonly');
      const req = fn(tx.objectStore('kv'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}

export const folderSupported = () => typeof window !== 'undefined' && !!window.showDirectoryPicker;

export async function getFolder(): Promise<DirHandle | null> {
  if (cached !== undefined) return cached;
  try { cached = (await idb<DirHandle | undefined>(s => s.get('dir'))) ?? null; } catch { cached = null; }
  return cached;
}

export function subscribeFolder(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; }

/** Ask you to pick the folder (must be called from a button click). */
export async function chooseFolder(): Promise<DirHandle | null> {
  if (!window.showDirectoryPicker) return null;
  const dir = await window.showDirectoryPicker({ id: 'guitar-coach', mode: 'readwrite', startIn: 'documents' });
  await idb(s => s.put(dir, 'dir'), true);
  cached = dir;
  subs.forEach(f => f());
  return dir;
}

export async function forgetFolder() {
  try { await idb(s => s.delete('dir'), true); } catch { /* ignore */ }
  cached = null;
  subs.forEach(f => f());
}

/** 'granted' | 'prompt' | 'denied' | 'none' (no folder chosen) */
export async function folderPermission(): Promise<PermissionState | 'none'> {
  const dir = await getFolder();
  if (!dir) return 'none';
  try { return await dir.queryPermission({ mode: 'readwrite' }); } catch { return 'denied'; }
}

async function writeInto(dir: DirHandle, sub: string, name: string, blob: Blob) {
  const target = sub ? await dir.getDirectoryHandle(sub, { create: true }) : dir;
  const fh = await target.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

/**
 * Save a file into your Guitar Coach folder (subfolder e.g. "Recordings").
 * Falls back to a normal download if no folder is set up or Chrome won't allow it.
 * `interactive` = called from a click, so we may ask Chrome for permission.
 */
export async function saveFile(sub: string, name: string, blob: Blob, interactive = true): Promise<'folder' | 'download' | 'shared' | 'skipped'> {
  // Phones can't write into folders: open the share sheet straight away (it must happen
  // right after the tap), where "Save to Files" lets you pick the iCloud Guitar Coach folder.
  if (!folderSupported()) {
    if (!interactive) return 'skipped';
    const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); announce(`Choose "Save to Files", then your Guitar Coach folder${sub ? ' → ' + sub : ''}.`); return 'shared'; }
      catch (e) { if ((e as Error).name === 'AbortError') return 'skipped'; }
    }
    downloadBlob(blob, name);
    announce(`Saved to Downloads: ${name}`);
    return 'download';
  }
  const dir = await getFolder();
  if (dir) {
    try {
      let perm = await dir.queryPermission({ mode: 'readwrite' });
      if (perm === 'prompt' && interactive) perm = await dir.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await writeInto(dir, sub, name, blob);
        if (interactive) announce(`Saved in ${dir.name}${sub ? ' / ' + sub : ''}: ${name}`);
        return 'folder';
      }
    } catch { /* fall through */ }
  }
  if (!interactive) return 'skipped';
  downloadBlob(blob, name);
  announce(`Saved to Downloads: ${name}`);
  return 'download';
}

/** Same shape as downloadBlob(blob, name), but saves into the folder's Recordings subfolder. */
export const saveRecording = (blob: Blob, name: string) => saveFile('Recordings', name, blob);

function announce(text: string) { window.dispatchEvent(new CustomEvent('gc-saved', { detail: text })); }

/** Read a file from the Guitar Coach folder (Mac), e.g. Backups/phone-backup.json. */
export async function readFolderFile(sub: string, name: string, interactive = false): Promise<string | null> {
  const dir = await getFolder();
  if (!dir) return null;
  try {
    let perm = await dir.queryPermission({ mode: 'readwrite' });
    if (perm === 'prompt' && interactive) perm = await dir.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return null;
    const d = sub ? await dir.getDirectoryHandle(sub) : dir;
    const fh = await d.getFileHandle(name);
    return await (await fh.getFile()).text();
  } catch { return null; }
}
