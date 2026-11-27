declare const __BUILD__: string;
/** This copy's version stamp (set at build time). */
export const BUILD: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';
/** Where published versions live. */
export const RELEASE_BASE = 'https://raw.githubusercontent.com/zainn10/guitar-coach/main/release';

/** Returns the newest published version stamp, or null if offline. */
export async function latestVersion(): Promise<string | null> {
  try {
    const r = await fetch(`${RELEASE_BASE}/version.txt?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const v = (await r.text()).trim();
    return /^\d{8}-\d{4}/.test(v) ? v : null;
  } catch { return null; }
}
