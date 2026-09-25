import Link from "next/link";
import BlueprintRing from "@/components/blueprint/BlueprintRing";
import {
  blueprintScore, metricProgress, readMarkers,
  type Marker, type MarkerStatus, type ScoreRow, type BloodPanel, type DoctorReport,
} from "@/lib/blueprint";

const BRONZE = "#C8965A";
const SURFACE = "#171B21";
const BORDER = "#252A32";
const MUTED = "#9BA3AF";
const TEXT = "#F2F1ED";
const inter = "Inter, sans-serif";
const fraunces = "Fraunces, Georgia, serif";

const STATUS: Record<MarkerStatus, { colour: string; label: string; fill: number }> = {
  action: { colour: "#E0795F", label: "Focus", fill: 0.9 },
  watch: { colour: "#E3B04B", label: "Watch", fill: 0.62 },
  in_range: { colour: "#5FBF8F", label: "Good", fill: 0.35 },
  no_range: { colour: MUTED, label: "Noted", fill: 0.35 },
};

const eyebrow: React.CSSProperties = { fontFamily: inter, fontSize: 9, color: BRONZE, textTransform: "uppercase", letterSpacing: "0.2em" };
const card: React.CSSProperties = { background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: 18 };

function fmt(n: number | null) {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
}

function niceDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ScoreLine({ r }: { r: ScoreRow }) {
  const p = metricProgress(r) ?? 0;
  const hit = p === 1;
  return (
    <div style={{ padding: "12px 0", borderTop: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: inter, fontSize: 13, color: TEXT }}>{r.label}</span>
        <span style={{ fontFamily: inter, fontSize: 11, color: hit ? "#5FBF8F" : MUTED }}>{hit ? "Target hit" : `${Math.round(p * 100)}%`}</span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: BORDER, margin: "8px 0 6px", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(p * 100, 3)}%`, height: "100%", borderRadius: 99, background: hit ? "#5FBF8F" : "linear-gradient(90deg, #A8743D, #E3B887)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: inter, fontSize: 10, color: MUTED }}>
        <span>Day 1: {fmt(r.baseline)} {r.unit}</span>
        <span style={{ color: TEXT }}>Now: {fmt(r.current_value)} {r.unit}</span>
        <span style={{ color: BRONZE }}>Target: {fmt(r.target)} {r.unit}</span>
      </div>
    </div>
  );
}

function MarkerRow({ m }: { m: Marker }) {
  const s = STATUS[m.status];
  return (
    <div style={{ padding: "14px 0", borderTop: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: inter, fontSize: 13, color: TEXT }}>{m.label}</span>
        <span style={{ fontFamily: fraunces, fontSize: 17, color: TEXT, whiteSpace: "nowrap" }}>
          {m.value}<span style={{ fontFamily: inter, fontSize: 10, color: MUTED, marginLeft: 3 }}>{m.unit}</span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: BORDER, overflow: "hidden" }}>
          <div style={{ width: `${s.fill * 100}%`, height: "100%", borderRadius: 99, background: s.colour }} />
        </div>
        <span style={{ fontFamily: inter, fontSize: 9, color: s.colour, textTransform: "uppercase", letterSpacing: "0.15em", minWidth: 40, textAlign: "right" }}>{s.label}</span>
      </div>
      {m.plain && <p style={{ fontFamily: inter, fontSize: 12, color: "rgba(242,241,237,0.62)", lineHeight: 1.5 }}>{m.plain}</p>}
      {m.ref && <p style={{ fontFamily: inter, fontSize: 10, color: MUTED, marginTop: 4 }}>Healthy range: {m.ref}</p>}
    </div>
  );
}

export default function NumbersView({ rows, panel, doctor }: { rows: ScoreRow[]; panel: BloodPanel | null; doctor: DoctorReport | null }) {
  const { rows: markers, clearGroups } = panel ? readMarkers(panel.markers) : { rows: [], clearGroups: [] };
  const focus = markers.filter((m) => m.status === "action");
  const watch = markers.filter((m) => m.status === "watch");
  const good = markers.filter((m) => m.status === "in_range");
  const score = blueprintScore(rows);

  return (
    <div style={{ minHeight: "100vh", background: "#0E1014" }}>
      <div className="px-5" style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 16px)" }}>
        <Link href="/home" style={{ fontFamily: inter, fontSize: 11, color: MUTED, textDecoration: "none" }}>← Home</Link>
        <p style={{ ...eyebrow, marginTop: 18 }}>Performance Blueprint</p>
        <h1 style={{ fontFamily: fraunces, fontSize: 32, fontWeight: 400, color: TEXT, lineHeight: 1.1, marginTop: 6 }}>Your numbers</h1>
        <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
          Where you started, where you are, and where we&apos;re taking you by day 90.
        </p>
      </div>

      <div className="px-5 pb-16 mt-6" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.length > 0 && (
          <div style={{ ...card, border: "1px solid rgba(200,150,90,0.28)" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 14px" }}>
              <BlueprintRing score={score} size={168} stroke={10} />
            </div>
            <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, textAlign: "center", marginBottom: 12, lineHeight: 1.5 }}>
              Every number below moves the ring. Hit every target and it&apos;s full.
            </p>
            {rows.map((r) => <ScoreLine key={r.metric_key} r={r} />)}
          </div>
        )}

        {doctor?.client_notes && doctor.client_notes.length > 0 && (
          <div style={card}>
            <p style={eyebrow}>{doctor.doctor_name ?? "Your doctor"} · debrief {niceDate(doctor.debrief_date)}</p>
            <ul style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {doctor.client_notes.map((f, i) => (
                <li key={i} style={{ display: "flex", gap: 10, fontFamily: inter, fontSize: 13, color: "rgba(242,241,237,0.85)", lineHeight: 1.5 }}>
                  <span style={{ color: BRONZE }}>—</span><span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {panel && (
          <>
            {[
              { title: "Where we focus", list: focus },
              { title: "Keep an eye on", list: watch },
              { title: "Looking good", list: good },
            ].filter((s) => s.list.length).map((s) => (
              <div key={s.title} style={card}>
                <p style={eyebrow}>{s.title}</p>
                <div style={{ marginTop: 6 }}>{s.list.map((m) => <MarkerRow key={m.key} m={m} />)}</div>
              </div>
            ))}
            {clearGroups.length > 0 && (
              <div style={card}>
                <p style={eyebrow}>All clear</p>
                <p style={{ fontFamily: inter, fontSize: 13, color: "rgba(242,241,237,0.85)", marginTop: 10, lineHeight: 1.5 }}>
                  {clearGroups.join(", ")}: all within healthy range. Nothing to do here.
                </p>
              </div>
            )}
            <p style={{ fontFamily: inter, fontSize: 10, color: MUTED, lineHeight: 1.5, textAlign: "center" }}>
              {panel.panel_name} · {panel.provider} · tested {niceDate(panel.test_date)}.<br />
              Clinical questions go to your doctor. Nick coaches the training and lifestyle side.
            </p>
          </>
        )}

        {!rows.length && !panel && (
          <div style={card}>
            <p style={{ fontFamily: inter, fontSize: 13, color: MUTED }}>Your results will appear here once they&apos;re back.</p>
          </div>
        )}
      </div>
    </div>
  );
}
