// Small single-series charts (one hue, thin marks, recessive grid, hover tooltips).
import { useState } from 'react';

export interface Point { x: string; y: number; label?: string }

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export function BarChart({ data, unit, height = 180, target }: { data: Point[]; unit: string; height?: number; target?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, L = 36, B = 24, T = 10;
  const max = niceMax(Math.max(target ?? 0, ...data.map(d => d.y)));
  const bw = (W - L - 8) / Math.max(1, data.length);
  const y = (v: number) => T + (height - T - B) * (1 - v / max);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`Bar chart: ${data.map(d => `${d.x} ${d.y} ${unit}`).join(', ')}`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={L} x2={W - 4} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth={1} />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{Math.round(max * f)}</text>
          </g>
        ))}
        {target !== undefined && <g><line x1={L} x2={W - 4} y1={y(target)} y2={y(target)} stroke="var(--muted)" strokeDasharray="4 4" /><text x={W - 6} y={y(target) - 4} textAnchor="end" fontSize={11} fill="var(--muted)">goal {target}</text></g>}
        {data.map((d, i) => {
          const h = Math.max(0, y(0) - y(d.y));
          const x = L + i * bw + 1;
          const w = Math.max(2, bw - 2);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={L + i * bw} y={T} width={bw} height={height - T - B} fill="transparent" />
              {h > 0 && <path d={`M${x} ${y(0)} V${y(d.y) + Math.min(4, h)} q0 -${Math.min(4, h)} ${Math.min(4, w / 2)} -${Math.min(4, h)} H${x + w - Math.min(4, w / 2)} q${Math.min(4, w / 2)} 0 ${Math.min(4, w / 2)} ${Math.min(4, h)} V${y(0)} Z`} fill="var(--f1)" opacity={hover === null || hover === i ? 1 : 0.55} />}
              {(data.length <= 14 || i % Math.ceil(data.length / 10) === 0) && <text x={L + i * bw + bw / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">{d.x}</text>}
            </g>
          );
        })}
        <line x1={L} x2={W - 4} y1={y(0)} y2={y(0)} stroke="var(--fret)" strokeWidth={1.5} />
      </svg>
      {hover !== null && <div className="tip" role="status">{data[hover].label ?? data[hover].x}: <strong>{data[hover].y} {unit}</strong></div>}
    </div>
  );
}

export function LineChart({ data, unit, height = 180, max: fixedMax, target }: { data: Point[]; unit: string; height?: number; max?: number; target?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, L = 36, B = 24, T = 12, R = 14;
  const max = fixedMax ?? niceMax(Math.max(target ?? 0, ...data.map(d => d.y)));
  const x = (i: number) => L + (data.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (data.length - 1));
  const y = (v: number) => T + (height - T - B) * (1 - v / max);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.y)}`).join(' ');
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`Line chart: ${data.map(d => `${d.x} ${d.y} ${unit}`).join(', ')}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          data.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
          setHover(best);
        }}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth={1} />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{Math.round(max * f)}</text>
          </g>
        ))}
        {target !== undefined && <g><line x1={L} x2={W - R} y1={y(target)} y2={y(target)} stroke="var(--muted)" strokeDasharray="4 4" /><text x={W - R} y={y(target) - 4} textAnchor="end" fontSize={11} fill="var(--muted)">goal {target}</text></g>}
        <path d={`${path} L${x(data.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="var(--f1)" opacity={0.1} />
        <path d={path} fill="none" stroke="var(--f1)" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="var(--muted)" strokeWidth={1} />}
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.y)} r={i === data.length - 1 || hover === i ? 5 : 3} fill="var(--f1)" stroke="var(--surface)" strokeWidth={2} />)}
        {data.map((d, i) => (data.length <= 10 || i % Math.ceil(data.length / 8) === 0) && <text key={`t${i}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">{d.x}</text>)}
      </svg>
      {hover !== null && <div className="tip" role="status">{data[hover].label ?? data[hover].x}: <strong>{data[hover].y} {unit}</strong></div>}
    </div>
  );
}
