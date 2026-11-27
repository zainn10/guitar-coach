import { speakable, chunks } from '../src/speech';

describe('read-aloud text', () => {
  it('says chord names in words', () => {
    expect(speakable('Play Em, then Am7 → Dsus2.')).toBe('Play E minor, then A minor seven to D sus two.');
    expect(speakable('Em (E minor)')).toBe('E minor');
    expect(speakable('F#m and Bb and Fmaj7 and E5')).toBe('F sharp minor and B flat and F major seven and E five');
  });
  it('leaves ordinary words and plain letters alone', () => {
    expect(speakable('A chord is easy. Do it again. Be calm. The E string. Cb')).toBe('A chord is easy. Do it again. Be calm. The E string. C flat');
    expect(speakable('Begin at 60 bpm')).toBe('Begin at 60 beats per minute');
  });
  it('reads finger letters and drops emoji', () => {
    expect(speakable('Use p-i-m-a 🎸 ✓')).toBe('Use p, i, m, a');
    expect(speakable('G ⇄ C · slowly')).toBe('G to and back to C, slowly');
  });
  it('reads progressions, time signatures and shorthand', () => {
    expect(speakable('In G: G-Em-C-D (3/4 time).')).toBe('In G: G, E minor, C, D (3 4 time).');
    expect(speakable('a = ring (anular)')).toBe('A is ring (anular)');
    expect(speakable('1, then 1+2, then 1+2+3…')).toBe('1, then 1 and 2, then 1 and 2 and 3.');
    expect(speakable('A7 A7 | D7 E7')).toBe('A seven A seven. D seven E seven');
    expect(speakable('Count: 1 &, 2 &')).toBe('Count: 1 and, 2 and');
  });
  it('splits long text into short pieces', () => {
    const long = 'One. ' + 'word, '.repeat(80) + 'end.';
    const c = chunks(long, 100);
    expect(c[0]).toBe('One.');
    expect(c.every(x => x.length <= 110)).toBe(true);
    expect(c.join(' ').replace(/\s+/g, ' ')).toBe(long.trim());
  });
});
