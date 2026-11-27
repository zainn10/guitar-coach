// Drawing helpers for natural-looking hands and fingers.
// Trick: draw every part's outline first (thick, darker), then every part's fill on top.
// Overlapping parts then merge into one clean silhouette instead of a pile of blobs.
import { ReactNode } from 'react';

/** A finger pointing "up" from its base at (0,0): slightly tapered, rounded tip. */
export function fingerPath(len: number, w: number) {
  const t = w * 0.86; // tip width
  return `M${-w / 2} 0 L${-t / 2} ${-len + t / 2} A${t / 2} ${t / 2} 0 0 1 ${t / 2} ${-len + t / 2} L${w / 2} 0 Z`;
}

export interface Part { d: string; transform?: string; style?: React.CSSProperties }

/** Renders parts as one skin-coloured silhouette with a single outline. */
export function Skin({ parts, outline = 3 }: { parts: Part[]; outline?: number }) {
  return (
    <g>
      {parts.map((p, i) => <path key={`o${i}`} d={p.d} transform={p.transform} style={p.style} fill="var(--skin-edge)" stroke="var(--skin-edge)" strokeWidth={outline} strokeLinejoin="round" />)}
      {parts.map((p, i) => <path key={`f${i}`} d={p.d} transform={p.transform} style={p.style} fill="var(--skin)" />)}
    </g>
  );
}

/** Nail near the tip of a finger drawn with fingerPath(len, w). */
export function Nail({ len, w, transform, style }: { len: number; w: number; transform?: string; style?: React.CSSProperties }) {
  const t = w * 0.86;
  return <path d={`M${-t * 0.32} ${-len + t * 0.9} L${-t * 0.3} ${-len + t * 0.45} A${t * 0.3} ${t * 0.3} 0 0 1 ${t * 0.3} ${-len + t * 0.45} L${t * 0.32} ${-len + t * 0.9} Q0 ${-len + t * 1.05} ${-t * 0.32} ${-len + t * 0.9} Z`}
    transform={transform} style={style} fill="var(--nail)" stroke="var(--skin-edge)" strokeWidth={0.8} />;
}

/** Faint knuckle creases across a finger. */
export function Creases({ len, w, transform, style }: { len: number; w: number; transform?: string; style?: React.CSSProperties }) {
  return (
    <g transform={transform} style={style} stroke="var(--skin-edge)" strokeWidth={1} opacity={0.45} fill="none">
      <path d={`M${-w * 0.3} ${-len * 0.36} q${w * 0.3} ${-3} ${w * 0.6} 0`} />
      <path d={`M${-w * 0.27} ${-len * 0.66} q${w * 0.27} ${-2.5} ${w * 0.54} 0`} />
    </g>
  );
}

export function Badge({ x, y, color, label, r = 11 }: { x: number; y: number; color: string; label: string; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color} stroke="var(--bg)" strokeWidth={2} />
      <text x={x} y={y + r * 0.38} textAnchor="middle" fontSize={r * 1.1} fontWeight={800} fill="#fff">{label}</text>
    </g>
  );
}

export const Defs = ({ children }: { children: ReactNode }) => <defs>{children}</defs>;

const rad = (a: number) => (a * Math.PI) / 180;
/** Point reached by going `len` from (x, y) at angle a (0 = up, 90 = right, 180 = down). */
export const go = (x: number, y: number, a: number, len: number) => ({ x: x + Math.sin(rad(a)) * len, y: y - Math.cos(rad(a)) * len });

/**
 * A finger with a bend at the middle joint, seen from the side.
 * Starts at the knuckle (kx, ky); first segment at angle a1, second at a2.
 * nailSide: 1 or -1, which side of the finger the nail is on (back of the finger).
 */
export function jointFinger(kx: number, ky: number, a1: number, l1: number, a2: number, l2: number, w: number, nailSide: 1 | -1 = 1) {
  const j = go(kx, ky, a1, l1);
  const t = go(j.x, j.y, a2, l2);
  const parts: Part[] = [
    { d: fingerPath(l1 + w * 0.45, w), transform: `translate(${kx} ${ky}) rotate(${a1})` },
    { d: fingerPath(l2, w * 0.9), transform: `translate(${j.x} ${j.y}) rotate(${a2})` },
  ];
  // nail: a thin curved plate along the back of the last segment, near the tip
  const n0 = go(j.x, j.y, a2, l2 * 0.55), n1 = go(j.x, j.y, a2, l2 - 1);
  const off = (p: { x: number; y: number }, k: number) => go(p.x, p.y, a2 + 90 * nailSide, k);
  const a = off(n0, w * 0.42), b = off(n1, w * 0.36), c = off(n1, w * 0.22), d = off(n0, w * 0.3);
  const nail = `M${a.x} ${a.y} L${b.x} ${b.y} L${c.x} ${c.y} L${d.x} ${d.y} Z`;
  return { parts, joint: j, tip: t, nail };
}

/** Metal fret wire seen from the side. */
export const FretWire = ({ x, y }: { x: number; y: number }) => (
  <g>
    <rect x={x - 3} y={y - 7} width={6} height={9} rx={3} fill="url(#fret-metal)" stroke="#8d8d8d" strokeWidth={0.8} />
  </g>
);

/** A string seen end-on (round). */
export const StringDot = ({ x, y, r, color }: { x: number; y: number; r: number; color?: string }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={color ?? 'url(#string-metal)'} stroke={color ? 'none' : '#7d7d7d'} strokeWidth={0.6} />
    {!color && <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.35} fill="#fff" opacity={0.5} />}
  </g>
);

/** Shared gradients: put once inside an <svg>. */
export const ArtDefs = () => (
  <defs>
    <linearGradient id="fret-metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9c9c9c" /><stop offset="0.45" stopColor="#f2f2f2" /><stop offset="1" stopColor="#a3a3a3" /></linearGradient>
    <radialGradient id="string-metal" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stopColor="#f4f4f4" /><stop offset="1" stopColor="#8f8f8f" /></radialGradient>
    <linearGradient id="board-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a3020" /><stop offset="1" stopColor="#2b1b10" /></linearGradient>
    <linearGradient id="neck-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8724a" /><stop offset="1" stopColor="#7a4d2c" /></linearGradient>
    <linearGradient id="top-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ecd09b" /><stop offset="1" stopColor="#d6aa68" /></linearGradient>
  </defs>
);
