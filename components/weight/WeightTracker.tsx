"use client";

import { useId, useState } from "react";
import {
  WEIGHT_RANGES,
  filterByRange,
  formatChange,
  formatDisplayDate,
  formatKg,
  parseISODate,
  prepareWeightHistory,
  round1,
  type WeightRange,
  type WeighIn,
} from "@/lib/weight/history";

const B = "#C8965A";
const SURFACE = "#171B21";
const BORDER = "#252A32";
const MUTED = "#9BA3AF";
const TEXT = "#F2F1ED";
const GREEN = "#34D399";
const AMBER = "#F5A623";
const inter = "Inter, sans-serif";
const fraunces = "Fraunces, Georgia, serif";

const VB_W = 320;
const VB_H = 168;
const PAD_X = 16;
const PAD_Y = 22;

type Viewer = "client" | "coach";

function changeColor(n: number): string {
  const v = round1(n);
  if (v < 0) return GREEN;
  if (v > 0) return AMBER;
  return MUTED;
}

type Dot = WeighIn & { x: number; y: number };

function plot(points: WeighIn[]): Dot[] {
  if (points.length === 0) return [];
  const times = points.map((point) => parseISODate(point.date).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const weights = points.map((point) => point.kg);
  let minW = Math.min(...weights);
  let maxW = Math.max(...weights);
  if (minW === maxW) {
    minW -= 0.5;
    maxW += 0.5;
  }
  const pad = (maxW - minW) * 0.16;
  const lo = minW - pad;
  const hi = maxW + pad;
  const xOf = (t: number) => PAD_X + ((maxT === minT ? 0.5 : (t - minT) / (maxT - minT)) * (VB_W - PAD_X * 2));
  const yOf = (w: number) => PAD_Y + (1 - (w - lo) / (hi - lo)) * (VB_H - PAD_Y * 2);
  return points.map((point) => ({
    ...point,
    x: xOf(parseISODate(point.date).getTime()),
    y: yOf(point.kg),
  }));
}

function EmptyState({ viewer, only }: { viewer: Viewer; only: WeighIn | null }) {
  const title = only ? "One weigh-in so far." : "No weigh-ins yet.";
  const body = only
    ? viewer === "coach"
      ? "Another weigh-in and the chart, the change since last time, and the weekly average will show here."
      : "Log one more on your morning check-in and the chart, the change since last time, and the weekly average will show here."
    : viewer === "coach"
      ? "Weight is saved when they log it on the morning check-in."
      : "Morning weight is saved on check-in. A second one unlocks the chart and the changes.";
  return (
    <div data-testid="weight-empty" style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
      <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.18em", margin: "0 0 12px" }}>Weight</p>
      {only ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: fraunces, fontSize: 40, color: TEXT, fontWeight: 400, lineHeight: 1 }}>{formatKg(only.kg)}</span>
          <span style={{ fontFamily: inter, fontSize: 13, color: MUTED }}>kg · {formatDisplayDate(only.date, true)}</span>
        </div>
      ) : null}
      <p style={{ fontFamily: fraunces, fontSize: 22, color: TEXT, fontWeight: 400, lineHeight: 1.2, margin: "0 0 8px" }}>{title}</p>
      <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, lineHeight: 1.5, margin: 0 }}>{body}</p>
    </div>
  );
}

export default function WeightTracker({
  entries,
  today,
  viewer = "client",
}: {
  entries: WeighIn[];
  today: string;
  viewer?: Viewer;
}) {
  const gradId = useId().replace(/:/g, "");
  const [range, setRange] = useState<WeightRange>("all");
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const history = prepareWeightHistory(entries, today);
  const series = history.entries;

  if (series.length < 2) {
    return <EmptyState viewer={viewer} only={series[0] ?? null} />;
  }

  const summary = history.summary;
  const rows = history.rows;
  const chartPoints = filterByRange(series, range, today);
  const drawn = plot(chartPoints);
  const selected = chartPoints.find((point) => point.date === pickedDate) ?? chartPoints[chartPoints.length - 1] ?? null;
  const selectedDot = drawn.find((dot) => dot.date === selected?.date) ?? null;

  function selectDate(date: string) {
    if (!chartPoints.some((point) => point.date === date)) setRange("all");
    setPickedDate(date);
  }

  function pickFromPointer(clientX: number, svg: SVGSVGElement) {
    if (drawn.length === 0) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const vx = ((clientX - rect.left) / rect.width) * VB_W;
    let best = drawn[0];
    let bestDist = Infinity;
    for (const dot of drawn) {
      const dist = Math.abs(dot.x - vx);
      if (dist < bestDist) {
        bestDist = dist;
        best = dot;
      }
    }
    setPickedDate(best.date);
  }

  function moveSelection(direction: -1 | 1) {
    if (chartPoints.length === 0) return;
    const index = Math.max(0, chartPoints.findIndex((point) => point.date === selected?.date));
    const next = chartPoints[Math.min(chartPoints.length - 1, Math.max(0, index + direction))];
    setPickedDate(next.date);
  }

  const line = drawn.length > 1
    ? drawn.map((dot, index) => `${index === 0 ? "M" : "L"}${dot.x.toFixed(1)},${dot.y.toFixed(1)}`).join(" ")
    : "";
  const area = line
    ? `${line} L${drawn[drawn.length - 1].x.toFixed(1)},${VB_H - 8} L${drawn[0].x.toFixed(1)},${VB_H - 8} Z`
    : "";

  return (
    <section data-testid="weight-tracker" style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
      <style>{`.weight-chart:focus-visible { outline: 1px solid ${B}; outline-offset: 3px; }`}</style>
      <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.18em", margin: "0 0 14px" }}>Weight</p>

      {summary ? (
        <div data-testid="weight-summary" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Start", value: formatKg(summary.startKg), sub: "kg", color: TEXT },
            { label: "Now", value: formatKg(summary.currentKg), sub: "kg", color: TEXT },
            { label: "Total", value: formatChange(summary.totalChangeKg), sub: "kg", color: changeColor(summary.totalChangeKg) },
            {
              label: "Per week",
              value: summary.weeklyChangeKg == null ? "—" : formatChange(summary.weeklyChangeKg),
              sub: "last 4 wks",
              color: summary.weeklyChangeKg == null ? MUTED : changeColor(summary.weeklyChangeKg),
            },
          ].map((stat) => (
            <div key={stat.label} style={{ minWidth: 0 }}>
              <p style={{ fontFamily: inter, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.2, margin: "0 0 4px" }}>{stat.label}</p>
              <p style={{ fontFamily: fraunces, fontSize: "clamp(16px, 5vw, 22px)", color: stat.color, fontWeight: 400, lineHeight: 1, margin: 0 }}>{stat.value}</p>
              <p style={{ fontFamily: inter, fontSize: 10, color: MUTED, margin: "4px 0 0" }}>{stat.sub}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div role="radiogroup" aria-label="Chart range" data-testid="weight-range" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
        {WEIGHT_RANGES.map((item) => {
          const on = range === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setRange(item.id)}
              style={{
                minHeight: 44,
                borderRadius: 12,
                border: `1px solid ${on ? B : BORDER}`,
                background: on ? B : "transparent",
                color: on ? "#0E1014" : MUTED,
                fontFamily: inter,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.02em",
                cursor: "pointer",
                padding: "0 4px",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div data-testid="weight-readout" aria-live="polite" style={{ minHeight: 52, marginBottom: 8 }}>
        {selected ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: fraunces, fontSize: 32, color: TEXT, fontWeight: 400, lineHeight: 1 }}>{formatKg(selected.kg)}</span>
              <span style={{ fontFamily: inter, fontSize: 13, color: MUTED }}>kg</span>
            </div>
            <p style={{ fontFamily: inter, fontSize: 13, color: B, margin: "4px 0 0" }}>{formatDisplayDate(selected.date, true)}</p>
          </>
        ) : (
          <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, margin: 0 }}>No weigh-ins in this range.</p>
        )}
      </div>

      {drawn.length > 0 ? (
        <>
          <svg
            data-testid="weight-chart"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width="100%"
            aria-label={selected ? `Weight chart. Selected ${formatKg(selected.kg)} kilograms on ${formatDisplayDate(selected.date, true)}.` : "Weight chart"}
            tabIndex={0}
            onClick={(event) => pickFromPointer(event.clientX, event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                moveSelection(-1);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                moveSelection(1);
              }
            }}
            style={{ display: "block", height: "auto", touchAction: "manipulation", cursor: "pointer" }}
            className="weight-chart"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={B} stopOpacity="0.28" />
                <stop offset="100%" stopColor={B} stopOpacity="0" />
              </linearGradient>
            </defs>
            {area ? <path d={area} fill={`url(#${gradId})`} /> : null}
            {line ? <path d={line} fill="none" stroke={B} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /> : null}
            {selectedDot ? (
              <line x1={selectedDot.x} y1={PAD_Y - 6} x2={selectedDot.x} y2={VB_H - 8} stroke={B} strokeOpacity={0.35} strokeWidth={1} />
            ) : null}
            {drawn.map((dot) => {
              const on = dot.date === selected?.date;
              return (
                <g key={dot.date}>
                  <circle cx={dot.x} cy={dot.y} r={16} fill="transparent" />
                  <circle cx={dot.x} cy={dot.y} r={on ? 5.5 : 3} fill={on ? B : "#0E1014"} stroke={B} strokeWidth={on ? 0 : 1.6} />
                </g>
              );
            })}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontFamily: inter, fontSize: 11, color: MUTED }}>{formatDisplayDate(chartPoints[0].date)}</span>
            <span style={{ fontFamily: inter, fontSize: 11, color: MUTED }}>{formatDisplayDate(chartPoints[chartPoints.length - 1].date)}</span>
          </div>
          <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, margin: "8px 0 0" }}>Tap a point for the exact weight and date.</p>
        </>
      ) : (
        <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, margin: "8px 0 0" }}>No weigh-ins in this range.</p>
      )}

      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.18em", margin: 0 }}>Every weigh-in</p>
          <p style={{ fontFamily: inter, fontSize: 11, color: MUTED, margin: 0 }}>{rows.length}</p>
        </div>
        <div data-testid="weight-list" style={{ maxHeight: 420, overflowY: "auto" }}>
          {rows.map((row) => {
            const on = row.date === selected?.date;
            return (
              <button
                key={row.date}
                type="button"
                onClick={() => selectDate(row.date)}
                aria-pressed={on}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: on ? "rgba(200,150,90,0.1)" : "transparent",
                  border: "none",
                  borderTop: `1px solid ${BORDER}`,
                  borderLeft: on ? `2px solid ${B}` : "2px solid transparent",
                  padding: "12px 8px",
                  cursor: "pointer",
                  contentVisibility: "auto",
                  containIntrinsicSize: "auto 64px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontFamily: inter, fontSize: 13, color: TEXT }}>{formatDisplayDate(row.date, row.date.slice(0, 4) !== today.slice(0, 4))}</span>
                  <span style={{ fontFamily: fraunces, fontSize: 18, color: TEXT, fontWeight: 400 }}>{formatKg(row.kg)} kg</span>
                </div>
                <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, margin: "4px 0 0" }}>
                  <span style={{ color: row.sincePreviousKg == null ? MUTED : changeColor(row.sincePreviousKg) }}>
                    {row.sincePreviousKg == null ? "—" : formatChange(row.sincePreviousKg)} since last
                  </span>
                  {" · "}
                  <span style={{ color: changeColor(row.sinceFirstKg) }}>{formatChange(row.sinceFirstKg)} since start</span>
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
