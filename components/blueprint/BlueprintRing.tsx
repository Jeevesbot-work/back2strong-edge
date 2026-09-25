"use client";

import { useEffect, useState } from "react";

// The Performance Blueprint ring. Fills from Day 1 (0) to every day-90 target hit (100).
export default function BlueprintRing({
  score,
  size = 132,
  stroke = 9,
  label = "Blueprint",
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2 - 4;
  const circ = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setShown(Math.max(0, Math.min(100, score))), 120);
    return () => clearTimeout(t);
  }, [score]);

  // Always show a sliver of bronze so Day 1 reads as "started", not "empty".
  const pct = Math.max(shown, 2) / 100;
  const offset = circ * (1 - pct);
  const c = size / 2;
  const ticks = Array.from({ length: 60 });

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="bp-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E3B887" />
            <stop offset="100%" stopColor="#A8743D" />
          </linearGradient>
        </defs>
        {ticks.map((_, i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const r1 = r + stroke / 2 + 3;
          const r2 = r1 + (i % 5 === 0 ? 4 : 2);
          return (
            <line
              key={i}
              x1={c + r1 * Math.cos(a)} y1={c + r1 * Math.sin(a)}
              x2={c + r2 * Math.cos(a)} y2={c + r2 * Math.sin(a)}
              stroke={i / ticks.length <= shown / 100 ? "rgba(200,150,90,0.55)" : "rgba(255,255,255,0.07)"}
              strokeWidth={1}
            />
          );
        })}
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx={c} cy={c} r={r} fill="none"
          stroke="url(#bp-ring)" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)", filter: "drop-shadow(0 0 6px rgba(200,150,90,0.35))" }}
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center">
        <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: size * 0.3, fontWeight: 400, color: "#F2F1ED", lineHeight: 1 }}>
          {Math.round(shown)}
        </span>
        <span style={{ fontSize: 9, color: "#C8965A", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Inter, sans-serif", marginTop: 4 }}>
          {label}
        </span>
      </div>
    </div>
  );
}
