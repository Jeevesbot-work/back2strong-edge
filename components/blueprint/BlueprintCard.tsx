import Link from "next/link";
import BlueprintRing from "./BlueprintRing";
import { blueprintScore, metricProgress, type ScoreRow } from "@/lib/blueprint";

function fmt(n: number | null, unit: string | null) {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  const s = String(Number(v.toFixed(v < 10 ? 2 : 1)));
  return unit ? `${s}${unit === "kg" || unit === "in" ? unit : ""}` : s;
}

// Home-screen card: the ring, the day count, and the three headline numbers.
export default function BlueprintCard({ rows, day }: { rows: ScoreRow[]; day: number }) {
  const score = blueprintScore(rows);
  const headline = rows.slice(0, 3);
  const onTarget = rows.filter((r) => metricProgress(r) === 1).length;

  return (
    <Link href="/numbers" className="pressable" style={{ textDecoration: "none", display: "block" }}>
      <div style={{ background: "linear-gradient(160deg, #1B2027 0%, #14171C 100%)", borderRadius: 22, border: "1px solid rgba(200,150,90,0.28)", padding: "18px 16px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,150,90,0.12), transparent 70%)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif" }}>
            Performance Blueprint
          </p>
          <p style={{ fontSize: 10, color: "#9BA3AF", fontFamily: "Inter, sans-serif" }}>
            Day {Math.min(day, 90)} of 90
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <BlueprintRing score={score} size={116} stroke={8} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {headline.map((r) => {
              const p = metricProgress(r) ?? 0;
              return (
                <div key={r.metric_key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "rgba(242,241,237,0.8)", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                    <span style={{ fontSize: 10, color: "#9BA3AF", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>
                      {fmt(r.current_value, r.unit)} <span style={{ color: "#C8965A" }}>→ {fmt(r.target, r.unit)}</span>
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 99, background: "#252A32", marginTop: 5, overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(p * 100, 3)}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #A8743D, #E3B887)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid #252A32" }}>
          <span style={{ fontSize: 11, color: "#9BA3AF", fontFamily: "Inter, sans-serif" }}>
            {onTarget} of {rows.length} targets hit
          </span>
          <span style={{ fontSize: 11, color: "#C8965A", fontFamily: "Inter, sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em" }}>
            Your numbers →
          </span>
        </div>
      </div>
    </Link>
  );
}
