import type { Metadata } from "next";
import BottomNav from "@/components/BottomNav";
import ViewAsBannerBar from "@/components/ViewAsBannerBar";

export const metadata: Metadata = {
  title: "Viewing as Alex Example — seeded",
  robots: { index: false, follow: false },
};

export default function SeededClientShell() {
  return (
    <div className="min-h-screen pb-24" style={{ background: "#0E1014" }}>
      <ViewAsBannerBar name="Alex Example" />
      <main className="max-w-lg mx-auto px-5 pt-5 space-y-3">
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#9BA3AF", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Seeded fixture · not a live client
        </p>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 32, color: "#F2F1ED", fontWeight: 400 }}>
          Afternoon, Alex.
        </h1>
        <section style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: 16 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "#C8965A", letterSpacing: "0.14em", textTransform: "uppercase" }}>Today · check-in</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#F2F1ED", marginTop: 8 }}>Energy 4/5 · Sleep 3/5 · ready to train.</p>
        </section>
        <section style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: 16 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "#C8965A", letterSpacing: "0.14em", textTransform: "uppercase" }}>Train</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#F2F1ED", marginTop: 8 }}>Upper strength · week 3.</p>
        </section>
        <section style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: 16 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "#C8965A", letterSpacing: "0.14em", textTransform: "uppercase" }}>Food</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#F2F1ED", marginTop: 8 }}>128g protein · 1,840 kcal logged.</p>
        </section>
        <section style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: 16 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "#C8965A", letterSpacing: "0.14em", textTransform: "uppercase" }}>Messages</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "rgba(242,241,237,0.8)", marginTop: 8, lineHeight: 1.5 }}>
            Alex: Knee felt fine on the squats today.
          </p>
        </section>
        <section style={{ background: "#171B21", borderRadius: 20, border: "1px solid #252A32", padding: 16 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "#C8965A", letterSpacing: "0.14em", textTransform: "uppercase" }}>Weight</p>
          <p style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 28, color: "#F2F1ED", marginTop: 6 }}>82.4 kg</p>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
