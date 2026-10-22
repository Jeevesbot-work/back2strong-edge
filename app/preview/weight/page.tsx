import WeightTracker from "@/components/weight/WeightTracker";
import { SAMPLE_TODAY, SAMPLE_WEIGH_INS } from "@/lib/weight/sample";

const BG = "#0E1014";
const TEXT = "#F2F1ED";
const MUTED = "#9BA3AF";
const B = "#C8965A";
const inter = "Inter, sans-serif";
const fraunces = "Fraunces, Georgia, serif";

// Sample weigh-ins only. This page never reads the database.
export default function WeightPreviewPage({ searchParams }: { searchParams?: { view?: string } }) {
  const view = searchParams?.view === "coach" || searchParams?.view === "empty" ? searchParams.view : "client";

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT }}>
      <p style={{ fontFamily: inter, fontSize: 12, color: B, textAlign: "center", padding: "14px 16px 0", margin: 0 }}>
        Sample data only. Not a client record.
      </p>
      {view === "client" ? (
        <div style={{ maxWidth: 390, margin: "0 auto", padding: "12px 16px 48px" }}>
          <h1 style={{ fontFamily: fraunces, fontSize: 40, fontWeight: 400, lineHeight: 1, margin: "8px 0 4px" }}>Progress.</h1>
          <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, margin: "0 0 16px" }}>Client view · sample weigh-ins</p>
          <WeightTracker entries={SAMPLE_WEIGH_INS} today={SAMPLE_TODAY} viewer="client" />
        </div>
      ) : null}
      {view === "coach" ? (
        <div className="bg-edge-bg mx-auto px-4 py-6" style={{ maxWidth: 390 }}>
          <p className="text-edge-muted text-xs font-body">Coach view · sample client</p>
          <h1 className="font-condensed font-black text-2xl uppercase tracking-wide mt-1 mb-4">Sample client</h1>
          <h2 className="font-condensed font-bold text-xs uppercase tracking-widest text-edge-muted mb-3">Weight</h2>
          <WeightTracker entries={SAMPLE_WEIGH_INS} today={SAMPLE_TODAY} viewer="coach" />
        </div>
      ) : null}
      {view === "empty" ? (
        <div style={{ maxWidth: 390, margin: "0 auto", padding: "12px 16px 48px" }}>
          <h1 style={{ fontFamily: fraunces, fontSize: 32, fontWeight: 400, margin: "8px 0 16px" }}>Empty states</h1>
          <WeightTracker entries={[]} today={SAMPLE_TODAY} viewer="client" />
          <WeightTracker entries={[{ date: "2026-10-21", kg: 86.8 }]} today={SAMPLE_TODAY} viewer="coach" />
        </div>
      ) : null}
    </div>
  );
}
