import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getMovement, type Movement } from "@/lib/data/movements";

const B = "#C8A86E";
const SURFACE = "#171B21";
const BORDER = "#252A32";
const MUTED = "#9BA3AF";
const TEXT = "#F2F1ED";
const inter = "Inter, sans-serif";
const fraunces = "Fraunces, Georgia, serif";
const GIF_TILE = "#EDE7D8";

const label: React.CSSProperties = { fontFamily: inter, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 10 };

// Words too generic to search on alone — skipping these keeps the fallback
// lookup from matching something unrelated just because it shares a common
// qualifier (e.g. "seated", "single-leg").
const STOP_WORDS = new Set([
  "single-arm", "single-leg", "single", "arm", "leg", "seated", "standing",
  "lower", "bench", "the", "a", "an", "or", "one", "side", "supported",
]);

// The coached Moves cards don't all have real photos yet, but the Exercise
// Library (55 curated rows from public.exercises) does. Rather than leave a
// card saying "demo coming soon" when a real photo already exists two taps
// away, this looks the movement up in that library and borrows its image —
// so there's one real answer to "what does this look like", not two
// half-finished ones.
async function findLibraryImage(m: Movement): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);

  // Try each alias phrase first — these are hand-written and specific
  // (e.g. "incline chest press"), so they're the most trustworthy match.
  const phrases = [...m.aliases, m.name.replace(/\s*\([^)]*\)\s*/g, "")];

  for (const phrase of phrases) {
    const cleaned = phrase.trim().toLowerCase();
    if (!cleaned) continue;
    const { data } = await supabase
      .from("exercises")
      .select("gif_url")
      .eq("in_library", true)
      .ilike("name", `%${cleaned}%`)
      .limit(1);
    if (data && data.length > 0) return data[0].gif_url as string;
  }

  // Fallback: the single most distinctive word left after stripping
  // qualifiers — catches cases like "Box Squat" -> "squat" when the exact
  // phrase isn't in the curated set.
  const words = m.name
    .toLowerCase()
    .replace(/[()]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
  for (const word of words) {
    const { data } = await supabase
      .from("exercises")
      .select("gif_url")
      .eq("in_library", true)
      .ilike("name", `%${word}%`)
      .limit(1);
    if (data && data.length > 0) return data[0].gif_url as string;
  }

  return null;
}

export default async function MovementPage({ params }: { params: { slug: string } }) {
  const m = getMovement(params.slug);
  if (!m) notFound();

  const libraryImage = m.images.length === 0 ? await findLibraryImage(m) : null;

  return (
    <div style={{ maxWidth: 512, margin: "0 auto", padding: "0 16px 40px" }}>
      {/* Back */}
      <div style={{ padding: "16px 0 8px" }}>
        <Link href="/moves" style={{ fontFamily: inter, fontSize: 13, color: MUTED, textDecoration: "none" }}>← Moves</Link>
      </div>

      {/* Title */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {m.trains.map((t) => (
          <span key={t} style={{ fontFamily: inter, fontSize: 9, color: B, textTransform: "uppercase", letterSpacing: "0.1em", background: "rgba(200,168,110,0.1)", borderRadius: 6, padding: "3px 8px" }}>{t}</span>
        ))}
      </div>
      <h1 style={{ fontFamily: fraunces, fontSize: 30, fontWeight: 400, color: TEXT, lineHeight: 1.05 }}>{m.name}</h1>
      <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 20 }}>{m.subtitle} · {m.equipment}</p>

      {/* Frame strip — the visual demo */}
      {m.images.length > 0 ? (
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {m.images.map((img) => (
            <div key={img.src} style={{ flex: 1 }}>
              <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${BORDER}`, aspectRatio: "3 / 4" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textAlign: "center", marginTop: 6, lineHeight: 1.3 }}>{img.caption}</p>
            </div>
          ))}
        </div>
      ) : libraryImage ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${BORDER}`, background: GIF_TILE }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={libraryImage} alt={m.name} style={{ width: "100%", display: "block" }} />
          </div>
          <p style={{ fontFamily: inter, fontSize: 9, color: MUTED, textAlign: "center", marginTop: 6, lineHeight: 1.3 }}>From the Exercise Library — the coaching below is Nick&apos;s, for this exact progression.</p>
        </div>
      ) : (
        <div style={{ marginBottom: 24, borderRadius: 16, border: `1px dashed ${BORDER}`, background: SURFACE, padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 26 }}>🎬</span>
          <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, textAlign: "center", lineHeight: 1.5 }}>Demo clip coming soon.<br />The coaching below is all you need in the meantime.</p>
        </div>
      )}

      {/* Why */}
      <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#252A32", border: "1px solid rgba(200,168,110,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: fraunces, fontSize: 11, color: B }}>N</span>
          </div>
          <span style={{ fontFamily: inter, fontSize: 9, color: B, textTransform: "uppercase", letterSpacing: "0.15em" }}>Why I&apos;d use it</span>
        </div>
        <p style={{ fontFamily: inter, fontSize: 14, color: "rgba(242,241,237,0.8)", lineHeight: 1.6 }}>{m.why}</p>
      </div>

      {/* How */}
      <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
        <p style={label}>How to do it</p>
        {m.steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < m.steps.length - 1 ? 12 : 0 }}>
            <span style={{ fontFamily: fraunces, fontSize: 16, color: B, lineHeight: 1.3, flexShrink: 0, width: 16 }}>{i + 1}</span>
            <p style={{ fontFamily: inter, fontSize: 14, color: "rgba(242,241,237,0.8)", lineHeight: 1.5 }}>{s}</p>
          </div>
        ))}
      </div>

      {/* Cues */}
      <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
        <p style={label}>Cues</p>
        {m.cues.map((c) => (
          <div key={c} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: B, flexShrink: 0, marginTop: 8 }} />
            <p style={{ fontFamily: fraunces, fontSize: 16, color: TEXT, lineHeight: 1.4, fontStyle: "italic" }}>&ldquo;{c}&rdquo;</p>
          </div>
        ))}
      </div>

      {/* Sets / reps + watch-outs */}
      <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 16 }}>
        <p style={label}>Prescription</p>
        <p style={{ fontFamily: fraunces, fontSize: 20, color: B, marginBottom: 16 }}>{m.setsReps}</p>
        <p style={label}>Watch-outs</p>
        {m.watchOuts.map((w) => (
          <div key={w} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            <span style={{ color: "#F5A623", fontSize: 13, flexShrink: 0 }}>!</span>
            <p style={{ fontFamily: inter, fontSize: 13, color: "rgba(242,241,237,0.75)", lineHeight: 1.5 }}>{w}</p>
          </div>
        ))}
      </div>

      {m.sourceCredit && (
        <p style={{ fontFamily: inter, fontSize: 11, color: "#3D434D", textAlign: "center" }}>{m.sourceCredit}</p>
      )}
    </div>
  );
}
