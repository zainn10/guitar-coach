/** True when running as the private Mac app (served from this computer), false on the public web/phone version. */
export const isLocalApp = typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');
