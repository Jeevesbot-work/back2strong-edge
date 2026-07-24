import Link from "next/link";
import { MOVEMENTS } from "@/lib/data/movements";

const B = "#C8A86E";
const SURFACE = "#171B21";
const BORDER = "#252A32";
const MUTED = "#9BA3AF";
const TEXT = "#F2F1ED";
const inter = "Inter, sans-serif";
const fraunces = "Fraunces, Georgia, serif";

export default function MovesPage() {
  return (
    <div style={{ maxWidth: 512, margin: "0 auto", padding: "0 16px 32px" }}>
      <div style={{ padding: "20px 0 12px" }}>
        <h1 style={{ fontFamily: fraunces, fontSize: 40, fontWeight: 400, color: TEXT, lineHeight: 1 }}>Moves.</h1>
        <p style={{ fontFamily: inter, fontSize: 13, color: MUTED, marginTop: 4 }}>
          Nick&apos;s movement library — {MOVEMENTS.length} exercise{MOVEMENTS.length === 1 ? "" : "s"}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {MOVEMENTS.map((m) => (
          <Link key={m.slug} href={`/moves/${m.slug}`} style={{ textDecoration: "none" }}>
            <div style={{ background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
              {m.images.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.images[1]?.src ?? m.images[0].src} alt={m.name} style={{ width: "100%", height: 180, objectFit: "cover", objectPosition: "center 30%", display: "block" }} />
              ) : (
                <div style={{ width: "100%", height: 96, background: "linear-gradient(135deg,#1b1f26,#12151a)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: 22 }}>🎬</span>
                  <span style={{ fontFamily: inter, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.12em" }}>Demo coming soon</span>
                </div>
              )}
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  {m.trains.map((t) => (
                    <span key={t} style={{ fontFamily: inter, fontSize: 9, color: B, textTransform: "uppercase", letterSpacing: "0.1em", background: "rgba(200,168,110,0.1)", borderRadius: 6, padding: "3px 8px" }}>{t}</span>
                  ))}
                </div>
                <p style={{ fontFamily: fraunces, fontSize: 20, color: TEXT, lineHeight: 1.1 }}>{m.name}</p>
                <p style={{ fontFamily: inter, fontSize: 12, color: MUTED, marginTop: 3 }}>{m.subtitle} · {m.equipment}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
