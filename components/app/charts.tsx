"use client";

import { useId } from "react";

/* ── Mini view-activity sparkline (bespoke inline SVG) ─────────────────────── */
export function Sparkline({
  data,
  color = "var(--color-primary)",
  width = 72,
  height = 24,
  className,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const pad = 2;
  const max = Math.max(...data, 1);
  const step = (width - pad * 2) / Math.max(data.length - 1, 1);
  const allZero = data.every((d) => d === 0);
  const pts = data.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - v / max) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  if (allZero) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={className} style={{ width, height }} aria-hidden>
        <line x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} stroke="var(--color-border)" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} style={{ width, height }} aria-hidden>
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.8" fill={color} />
    </svg>
  );
}

/* ── Acceptance area chart: two stacked series (sent vs accepted) ──────────── */
export function AcceptanceChart({
  data,
  height = 170,
}: {
  data: { label: string; sent: number; accepted: number }[];
  height?: number;
}) {
  const id = useId().replace(/:/g, "");
  const w = 560;
  const h = height;
  const padX = 8;
  const padTop = 12;
  const padBottom = 24;
  const max = Math.max(...data.map((d) => d.sent)) * 1.1;
  const span = max || 1;
  const step = (w - padX * 2) / (data.length - 1);

  const toPts = (key: "sent" | "accepted") =>
    data.map((d, i) => {
      const x = padX + i * step;
      const y = padTop + (1 - d[key] / span) * (h - padTop - padBottom);
      return [x, y] as const;
    });

  const sentPts = toPts("sent");
  const accPts = toPts("accepted");
  const baseY = h - padBottom;

  const lineOf = (pts: readonly (readonly [number, number])[]) =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaOf = (pts: readonly (readonly [number, number])[]) =>
    `${lineOf(pts)} L${pts[pts.length - 1][0].toFixed(1)} ${baseY} L${pts[0][0].toFixed(1)} ${baseY} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sent-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--seg-3)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--seg-3)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`acc-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={padX} x2={w - padX} y1={padTop + g * (h - padTop - padBottom)} y2={padTop + g * (h - padTop - padBottom)} stroke="var(--color-border)" strokeWidth="1" />
      ))}
      <path d={areaOf(sentPts)} fill={`url(#sent-${id})`} />
      <path d={lineOf(sentPts)} fill="none" stroke="var(--seg-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" strokeDasharray="5 4" />
      <path d={areaOf(accPts)} fill={`url(#acc-${id})`} />
      <path d={lineOf(accPts)} fill="none" stroke="var(--color-primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {accPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === accPts.length - 1 ? 3.4 : 2.2} fill="var(--color-card)" stroke="var(--color-primary)" strokeWidth="1.6" />
      ))}
      {data.map((d, i) => (
        <text key={d.label} x={padX + i * step} y={h - 6} textAnchor="middle" fontSize="9.5" fill="var(--color-muted-foreground)" fontFamily="var(--font-mono)">
          {d.label}
        </text>
      ))}
    </svg>
  );
}

/* ── Radial win-rate gauge ─────────────────────────────────────────────────── */
export function WinGauge({ pct, size = 92 }: { pct: number; size?: number }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-muted)" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#wingrad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
        <defs>
          <linearGradient id="wingrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(58% 0.21 278)" />
            <stop offset="100%" stopColor="oklch(56% 0.22 312)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="tnum absolute inset-0 grid place-items-center text-lg font-bold">{pct}%</span>
    </div>
  );
}
