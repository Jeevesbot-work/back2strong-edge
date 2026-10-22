"use client";

import { useRef, useState } from "react";

const B = "#C8965A";
const SURFACE = "#171B21";
const BORDER = "#252A32";
const MUTED = "#9BA3AF";
const TEXT = "#F2F1ED";
const GREEN = "#34D399";
const inter = "Inter, sans-serif";
const fraunces = "Fraunces, Georgia, serif";

const PRESETS = [20, 30, 45];

export default function WalkLogger({ initialMinutes = 0, readOnly = false }: { initialMinutes?: number; readOnly?: boolean }) {
  const [total, setTotal] = useState(initialMinutes);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  // setState does not disable the button until the next paint, so a second tap
  // in the same gesture would send a second request. The ref closes that gap.
  const busyRef = useRef(false);

  async function log(minutes: number) {
    if (readOnly) { setError("Viewing as a client is read-only."); return; }
    if (busyRef.current || !minutes || minutes <= 0) return;
    busyRef.current = true;
    setBusy(minutes);
    try {
      const res = await fetch("/api/walk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Couldn't save that walk."); return; }
      if (res.ok) {
        setTotal(data.totalToday ?? total + minutes);
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1800);
        setCustom(false);
        setCustomVal("");
      }
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  return (
    <div style={{ background: SURFACE, borderRadius: 20, border: "1px solid " + BORDER, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🚶</span>
          <div>
            <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.15em" }}>Log a walk</p>
            <p style={{ fontFamily: fraunces, fontSize: 18, color: TEXT, lineHeight: 1.1 }}>
              {total > 0 ? <>{total}<span style={{ fontFamily: inter, fontSize: 12, color: MUTED }}> min today</span></> : "Tap to log"}
            </p>
          </div>
        </div>
        {error && <p style={{ fontFamily: inter, fontSize: 12, color: "#F5A623", marginBottom: 10 }}>{error}</p>}
        {justAdded && (
          <span style={{ fontFamily: inter, fontSize: 11, fontWeight: 600, color: GREEN, display: "flex", alignItems: "center", gap: 4 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={3} style={{ width: 13, height: 13 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Logged
          </span>
        )}
      </div>

      {!custom ? (
        <div style={{ display: "flex", gap: 8 }}>
          {PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => log(m)}
              disabled={busy !== null}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer",
                background: busy === m ? "rgba(200,150,90,0.25)" : "rgba(200,150,90,0.1)",
                border: "1px solid rgba(200,150,90,0.3)",
                fontFamily: inter, fontSize: 14, fontWeight: 700, color: B,
                opacity: busy !== null && busy !== m ? 0.5 : 1,
              }}
            >
              {busy === m ? "…" : `${m} min`}
            </button>
          ))}
          <button
            onClick={() => setCustom(true)}
            disabled={busy !== null}
            style={{
              width: 48, padding: "12px 0", borderRadius: 12, cursor: "pointer",
              background: "transparent", border: "1px solid " + BORDER,
              fontFamily: inter, fontSize: 18, fontWeight: 400, color: MUTED,
            }}
            aria-label="Custom minutes"
          >
            +
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            placeholder="Minutes"
            style={{
              flex: 1, padding: "12px 14px", borderRadius: 12,
              background: "rgba(0,0,0,0.3)", border: "1px solid " + BORDER,
              color: TEXT, fontFamily: inter, fontSize: 14, outline: "none",
            }}
          />
          <button
            onClick={() => log(parseInt(customVal, 10))}
            disabled={busy !== null || !customVal}
            style={{
              padding: "0 18px", borderRadius: 12, cursor: "pointer",
              background: B, border: "none", color: "#0E1014",
              fontFamily: inter, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
              opacity: !customVal ? 0.5 : 1,
            }}
          >
            Log
          </button>
          <button
            onClick={() => { setCustom(false); setCustomVal(""); }}
            style={{ padding: "0 14px", borderRadius: 12, cursor: "pointer", background: "transparent", border: "1px solid " + BORDER, color: MUTED, fontFamily: inter, fontSize: 13 }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
