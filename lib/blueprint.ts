import { createClient, createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { isAdminViewer } from "@/lib/admin/auth";
import { resolvePreviewTarget } from "@/lib/preview-user";

// Performance Blueprint data: the day-90 scoreboard (drives the Home ring) and
// the client's blood panel + doctor debrief (drives the Your Numbers screen).
// These tables are service-role only, so reads go through the admin client and
// are ALWAYS filtered to the one user id the caller has already authorised.

export type ScoreRow = {
  metric_key: string;
  label: string;
  unit: string | null;
  baseline: number | null;
  target: number | null;
  current_value: number | null;
  direction: "down" | "up";
  sort: number;
};

export type MarkerStatus = "action" | "watch" | "in_range" | "no_range";

export type Marker = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  ref?: string;
  status: MarkerStatus;
  plain: string;
};

export type BloodPanel = {
  test_date: string | null;
  provider: string | null;
  panel_name: string | null;
  markers: Record<string, unknown>;
};

export type DoctorReport = {
  debrief_date: string | null;
  doctor_name: string | null;
  key_flags: string[] | null;
  client_notes: string[] | null;
};

/**
 * Whose Blueprint data to show: the signed-in client, or — only for a verified
 * admin — the client being previewed. Health data never follows an unverified cookie.
 */
export async function resolveBlueprintUser(): Promise<string | null> {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return null;
  const previewId = cookies().get("preview_user_id")?.value;
  return resolvePreviewTarget(user.id, previewId, await isAdminViewer(user.email));
}

/** 0–1 progress from baseline to target (0 = Day 1, 1 = target hit). */
export function metricProgress(r: ScoreRow): number | null {
  const b = num(r.baseline), t = num(r.target), c = num(r.current_value);
  if (b === null || t === null || c === null || b === t) return null;
  const p = (b - c) / (b - t);
  return Math.max(0, Math.min(1, p));
}

/** Overall Blueprint score, 0–100. Average of every metric's progress. */
export function blueprintScore(rows: ScoreRow[]): number {
  const ps = rows.map(metricProgress).filter((p): p is number => p !== null);
  if (!ps.length) return 0;
  return Math.round((ps.reduce((s, p) => s + p, 0) / ps.length) * 100);
}

export async function getScoreboard(userId: string): Promise<ScoreRow[]> {
  const db = createAdminClient();
  const [{ data: rows }, { data: lastWeight }] = await Promise.all([
    db.from("blueprint_scoreboard")
      .select("metric_key, label, unit, baseline, target, current_value, direction, sort")
      .eq("user_id", userId)
      .order("sort"),
    db.from("check_ins")
      .select("weight_kg")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .order("date", { ascending: false })
      .limit(1),
  ]);
  const w = num(lastWeight?.[0]?.weight_kg);
  return ((rows ?? []) as ScoreRow[]).map((r) =>
    r.metric_key === "weight" && w !== null ? { ...r, current_value: w } : r,
  );
}

export async function getBloodWork(userId: string): Promise<{ panel: BloodPanel | null; doctor: DoctorReport | null }> {
  const db = createAdminClient();
  const [{ data: panels }, { data: reports }] = await Promise.all([
    db.from("blood_panels").select("test_date, provider, panel_name, markers").eq("user_id", userId)
      .order("test_date", { ascending: false }).limit(1),
    db.from("doctor_reports").select("debrief_date, doctor_name, key_flags, client_notes").eq("user_id", userId)
      .order("debrief_date", { ascending: false }).limit(1),
  ]);
  return {
    panel: (panels?.[0] as BloodPanel) ?? null,
    doctor: (reports?.[0] as DoctorReport) ?? null,
  };
}

// Plain-English copy for each marker. Keep it to one line, no jargon.
const MARKERS: Record<string, { label: string; plain: string }> = {
  lipoprotein_a: { label: "Lp(a)", plain: "A heart-risk particle set by your genes. Lifestyle can't move it, so we keep everything else tight." },
  triglycerides: { label: "Triglycerides", plain: "Fat circulating in your blood. Belly fat, sugar and refined carbs push it up. This one moves fast." },
  hdl: { label: "HDL (good cholesterol)", plain: "Clears fat out of your arteries. Cardio and losing belly fat lift it." },
  tg_hdl_ratio: { label: "Triglyceride : HDL ratio", plain: "A quick read on how well your body handles fuel. Lower is better." },
  cholesterol: { label: "Total cholesterol", plain: "The overall cholesterol number." },
  ldl: { label: "LDL", plain: "The cholesterol that can build up in arteries." },
  non_hdl: { label: "Non-HDL cholesterol", plain: "All the cholesterol that isn't the good kind." },
  chol_hdl_ratio: { label: "Cholesterol : HDL ratio", plain: "Balance of total to good cholesterol." },
  apoa1: { label: "ApoA1", plain: "The protein behind good cholesterol." },
  apob: { label: "ApoB", plain: "Counts the particles that can clog arteries. The best single heart marker." },
  apob_apoa_ratio: { label: "ApoB : ApoA1 ratio", plain: "Bad-to-good particle balance." },
  testosterone: { label: "Testosterone", plain: "Drives energy, drive, strength and body shape. Sleep, lifting and fat loss are the natural levers." },
  free_testosterone: { label: "Free testosterone", plain: "The testosterone your body can actually use." },
  shbg: { label: "SHBG", plain: "The protein that holds on to testosterone." },
  cortisol: { label: "Cortisol", plain: "Your stress hormone. Context matters: time of day, sleep, stress." },
  psa: { label: "PSA", plain: "Prostate health check." },
  tsh: { label: "TSH (thyroid)", plain: "Tells the thyroid how hard to work. Slightly high means it's being pushed a bit." },
  free_t4: { label: "Free T4", plain: "Thyroid hormone in storage form." },
  free_t3: { label: "Free T3", plain: "Active thyroid hormone. Sets your metabolism." },
  anti_tpo: { label: "Thyroid antibodies", plain: "Clear means no autoimmune thyroid issue." },
  hs_crp: { label: "Inflammation (hs-CRP)", plain: "Background inflammation. Processed food, belly fat and poor sleep push it up." },
  glucose: { label: "Glucose", plain: "Blood sugar at the time of the test." },
  hba1c: { label: "HbA1c", plain: "Average blood sugar over three months. The diabetes marker." },
  b12: { label: "Vitamin B12", plain: "Energy and nerves." },
  vitamin_d: { label: "Vitamin D", plain: "Immunity, mood, bones and testosterone. Most UK men run low." },
  folate: { label: "Folate", plain: "Needed to make healthy cells." },
  magnesium: { label: "Magnesium", plain: "Sleep, muscles and recovery." },
  calcium: { label: "Calcium", plain: "Bones and muscle function." },
};

const GROUP_ALL_CLEAR: Record<string, string> = {
  liver: "Liver",
  kidney: "Kidneys",
  iron: "Iron stores",
  fbc: "Full blood count",
};

/** Flatten a panel's markers JSON into display rows plus the all-clear groups. */
export function readMarkers(markers: Record<string, unknown>): { rows: Marker[]; clearGroups: string[] } {
  const rows: Marker[] = [];
  const clearGroups: string[] = [];
  for (const [group, val] of Object.entries(markers ?? {})) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const g = val as Record<string, unknown>;
    if (GROUP_ALL_CLEAR[group] && g.status === "in_range") {
      clearGroups.push(GROUP_ALL_CLEAR[group]);
      continue;
    }
    for (const [key, m] of Object.entries(g)) {
      if (!m || typeof m !== "object") continue;
      const mm = m as Record<string, unknown>;
      if (mm.value === undefined) continue;
      const copy = MARKERS[key];
      const status = (["action", "watch", "in_range", "no_range"].includes(String(mm.status)) ? mm.status : "no_range") as MarkerStatus;
      rows.push({
        key,
        label: copy?.label ?? key.replace(/_/g, " "),
        value: String(mm.value),
        unit: mm.unit ? String(mm.unit) : undefined,
        ref: mm.ref ? String(mm.ref) : undefined,
        status,
        plain: copy?.plain ?? "",
      });
    }
  }
  return { rows, clearGroups };
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
