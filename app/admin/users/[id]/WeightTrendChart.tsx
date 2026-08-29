type Point = { date: string; weight: number };

// Compact SVG weight-trend sparkline. Oldest → newest, bronze line on the
// Edge dark surface. Renders a graceful empty state when there's < 2 points.
export default function WeightTrendChart({ points }: { points: Point[] }) {
  if (points.length < 2) {
    return (
      <div className="bg-edge-surface rounded-xl border border-white/[0.08] p-4">
        <p className="text-edge-muted text-xs font-body">
          {points.length === 1
            ? `Only one weigh-in so far (${points[0].weight}kg) — need a couple more to plot a trend.`
            : "No weigh-ins logged yet."}
        </p>
      </div>
    );
  }

  const W = 320;
  const H = 96;
  const padX = 8;
  const padY = 12;

  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const x = (i: number) => padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = (w: number) => padY + (1 - (w - min) / range) * (H - padY * 2);

  const line = points.map((p, i) => `${x(i)},${y(p.weight)}`).join(" ");
  const area = `${padX},${H - padY} ${line} ${W - padX},${H - padY}`;

  const first = points[0].weight;
  const last = points[points.length - 1].weight;
  const down = last <= first; // weight loss = good for recomp goals
  const stroke = down ? "#34D399" : "#F5A623";

  return (
    <div className="bg-edge-surface rounded-xl border border-white/[0.08] p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Weight trend from ${first}kg to ${last}kg`}
      >
        <defs>
          <linearGradient id="wt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#wt-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.weight)} r={i === points.length - 1 ? 3.5 : 2} fill={stroke} />
        ))}
      </svg>
      <div className="flex justify-between mt-2">
        <span className="text-edge-muted text-[10px] font-condensed uppercase tracking-wider">
          {new Date(points[0].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {first}kg
        </span>
        <span className="text-[10px] font-condensed uppercase tracking-wider" style={{ color: stroke }}>
          {new Date(points[points.length - 1].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {last}kg
        </span>
      </div>
    </div>
  );
}
