// Turning lesson text into something a speech voice reads naturally:
// chord symbols become words ("Em" -> "E minor"), arrows and symbols become words,
// emoji are dropped, and long text is cut into sentence-sized pieces (Chrome's voices
// stop by themselves if one piece runs much longer than about 15 seconds).

const SUFFIX: Record<string, string> = {
  '': '', m: ' minor', '7': ' seven', maj7: ' major seven', m7: ' minor seven', '5': ' five',
  sus2: ' sus two', sus4: ' sus four', dim: ' diminished', add9: ' add nine', '6': ' six', '9': ' nine',
};

export function chordWords(letter: string, acc: string | undefined, suffix: string | undefined) {
  const a = acc === '#' || acc === '♯' ? ' sharp' : acc === 'b' || acc === '♭' ? ' flat' : '';
  return `${letter}${a}${SUFFIX[suffix ?? ''] ?? ''}`;
}

export function speakable(text: string): string {
  let t = ` ${text} `;
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️✓✕✦]/gu, ' ');
  // finger letters on their own ("a = ring") are said as capital letters so "a" isn't read as a word
  t = t.replace(/(?<![\w])([pimae])(?= = )/g, m => m.toUpperCase());
  // chord progressions written with dashes: G-Em-C-D
  const CH = '[A-G](?:#|♯|b|♭)?(?:maj7|m7|m|7|5)?';
  t = t.replace(new RegExp(`(^|[\\s(,:])(${CH}(?:-${CH})+)(?![\\w])`, 'g'), (_, pre, seq) => pre + seq.split('-').join(', '));
  // time signatures
  t = t.replace(/\b(2|3|4|6|12)\/(4|8)\b/g, '$1 $2');
  // chord symbols with an accidental or a suffix (plain "A", "E" are left as letters)
  t = t.replace(/(?<![\w-])([A-G])(#|♯|b|♭)?(maj7|m7|sus2|sus4|add9|dim|m|7|5|6|9)?(?![\w#♯♭])/g, (all, l, acc, suf) => (acc || suf ? chordWords(l, acc, suf) : all));
  // right-hand finger letters written as p-i-m-a
  t = t.replace(/(?<![\w])([pimae](?:-[pimae])+)(?![\w])/g, m => m.split('-').join(', '));
  t = t
    .replace(/⇄/g, ' to and back to ')
    .replace(/→/g, ' to ')
    .replace(/↓/g, ' down ')
    .replace(/↑/g, ' up ')
    .replace(/×/g, ' times ')
    .replace(/[·•]/g, ', ')
    .replace(/\s[–—]\s/g, ', ')
    .replace(/♯/g, ' sharp').replace(/♭/g, ' flat')
    .replace(/(\d)\s?bpm\b/gi, '$1 beats per minute').replace(/\bbpm\b/gi, 'beats per minute')
    .replace(/\be\.g\./gi, 'for example').replace(/\bi\.e\./gi, 'that is')
    .replace(/\s=\s/g, ' is ')
    .replace(/(\d)\+(?=\d)/g, '$1 and ')
    .replace(/…/g, '.')
    .replace(/\s\|\s/g, '. ')
    .replace(/\s?&\s?/g, ' and ')
    .replace(/°/g, ' degrees')
    .replace(/["“”*_`]/g, '');
  // "E minor (E minor)" after expanding "Em (E minor)": say it once
  t = t.replace(/\b([A-G][\w ]*?) \(\1\)/g, '$1');
  return t.replace(/\s+([,.!?:;])/g, '$1').replace(/\s{2,}/g, ' ').replace(/,(\s*,)+/g, ',').trim();
}

/** Split into pieces of at most ~maxLen characters, at sentence ends, then commas. */
export function chunks(text: string, maxLen = 220): string[] {
  const out: string[] = [];
  for (const s of text.split(/(?<=[.!?;])\s+/)) {
    if (s.length <= maxLen) { if (s.trim()) out.push(s.trim()); continue; }
    let cur = '';
    for (const part of s.split(/(?<=,)\s+/)) {
      if ((cur + ' ' + part).length > maxLen && cur) { out.push(cur.trim()); cur = part; } else cur = cur ? `${cur} ${part}` : part;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}
