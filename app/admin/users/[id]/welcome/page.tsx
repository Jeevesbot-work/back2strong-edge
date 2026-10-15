import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminPage } from "@/lib/admin/auth";
import Link from "next/link";

const GOAL_LABEL: Record<string, string> = {
  fat: "Lose Body Fat",
  "fat loss": "Lose Body Fat",
  muscle: "Build Muscle",
  "build muscle": "Build Muscle",
  stronger: "Get Stronger",
  "get stronger": "Get Stronger",
  back: "Fix Back & Movement",
  energy: "More Energy & Vitality",
  identity: "Rebuild My Identity",
  all: "Full Transformation",
  performance: "Sport Performance",
};

const WEEK_THEMES: Record<number, { title: string; subtitle: string; bullets: string[] }> = {
  1: {
    title: "Week 1 — Foundation",
    subtitle: "Building the base",
    bullets: [
      "Learn the movement patterns — perfect form before added load.",
      "Dial in your nutrition baseline: hit your protein target every day.",
      "Check in daily inside the app so Edge can track and adapt.",
    ],
  },
  2: {
    title: "Week 2 — Build",
    subtitle: "Momentum kicks in",
    bullets: [
      "Sessions step up — you'll feel the difference.",
      "Energy and sleep scores from your check-ins shape your plan.",
      "Nutrition: keep the protein first habit locked in.",
    ],
  },
  3: {
    title: "Week 3 — Protocol",
    subtitle: "Now we refine",
    bullets: [
      "Protein first — eat protein before anything else on the plate.",
      "Training: same structure, sessions stepped up past your baseline.",
      "Socials: max 2 pints if you're out. You've come too far to undo it.",
    ],
  },
  4: {
    title: "Week 4 — Strength Unlock",
    subtitle: "The payoff week",
    bullets: [
      "Strength targets step up — you'll feel it in the first session.",
      "Recovery is faster now than Week 1. That's the programme working.",
      "The arc completes: Foundation → Build → Protocol → Unlock.",
    ],
  },
};

export default async function WelcomePage({ params }: { params: { id: string } }) {
  await requireAdminPage();

  const admin = createAdminClient();
  const [{ data: profile }, { data: programme }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", params.id).single(),
    admin.from("programme_state").select("*").eq("user_id", params.id).single(),
  ]);

  const firstName = (profile?.full_name ?? "").split(" ")[0] || "There";
  const email = profile?.email ?? "";
  const goal = GOAL_LABEL[profile?.goal ?? ""] ?? profile?.goal ?? "Performance";
  const protein = profile?.protein_target ?? Math.round((profile?.body_weight ?? 80) * 2);
  const calories = profile?.calorie_target ?? Math.round((profile?.body_weight ?? 80) * 33);
  const startWeek = programme?.current_week ?? 1;
  const weekInfo = WEEK_THEMES[startWeek] ?? WEEK_THEMES[1];
  const nextWeek = startWeek + 1;
  const nextWeekInfo = WEEK_THEMES[nextWeek];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F2F1ED] font-sans">
      {/* Admin nav bar — hidden on print */}
      <div className="print:hidden bg-[#111318] border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <Link
          href={`/admin/users/${params.id}`}
          className="text-xs text-[#6B7280] hover:text-white transition-colors"
        >
          ← Back to {profile?.full_name ?? "Client"}
        </Link>
        <span className="text-white/20">|</span>
        <span className="text-xs text-[#C8965A]">Welcome Pack Preview</span>
        <button
          onClick={undefined}
          className="ml-auto text-xs bg-[#C8965A] text-[#0A0A0A] font-bold px-4 py-1.5 rounded-lg"
          id="print-btn"
        />
      </div>

      {/* Print trigger script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.getElementById('print-btn') && (document.getElementById('print-btn').textContent = 'Save as PDF');
            document.getElementById('print-btn')?.addEventListener('click', () => window.print());
          `,
        }}
      />

      {/* Document */}
      <div className="max-w-[680px] mx-auto px-10 py-12">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-12">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#0A0A0A] font-bold text-lg"
            style={{ background: "#C8965A", fontFamily: "Georgia, serif" }}
          >
            B
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider">Back2Strong · Edge</div>
            <div className="text-[10px] text-[#6B7280] tracking-[0.2em] uppercase mt-0.5">Your personal coaching app</div>
          </div>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <div className="text-[10px] text-[#C8965A] tracking-[0.2em] uppercase mb-3">Week {startWeek} Unlocked</div>
          <h1 className="text-4xl mb-4 leading-tight" style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>
            {firstName}, you&apos;ve earned<br />
            <span className="text-[#C8965A]">what&apos;s next.</span>
          </h1>
          <p className="text-[15px] text-[#F2F1ED]/70 leading-relaxed">
            Your programme is live and ready inside the app. Here&apos;s everything you need to log in and get after it.
          </p>
        </div>

        <div className="h-px bg-white/[0.08] mb-8" />

        {/* Login box */}
        <div className="text-[10px] text-[#C8965A] tracking-[0.2em] uppercase mb-5">Your Login</div>
        <div
          className="rounded-xl p-6 mb-8"
          style={{ background: "#111318", border: "1px solid rgba(200,150,90,0.2)" }}
        >
          <div className="space-y-4">
            <div>
              <div className="text-[10px] text-[#6B7280] uppercase tracking-[0.15em] mb-1">App URL</div>
              <div className="text-[15px] font-medium text-[#C8965A]">app.back2strong.online</div>
            </div>
            <div>
              <div className="text-[10px] text-[#6B7280] uppercase tracking-[0.15em] mb-1">Your Email</div>
              <div className="text-[15px] font-medium">{email}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#6B7280] uppercase tracking-[0.15em] mb-1">How to log in</div>
              <div className="text-[13px] text-[#F2F1ED]/70 leading-relaxed">
                No password needed. Enter your email → check inbox for magic link → tap it → you&apos;re in. Link expires in 10 minutes.
              </div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="text-[10px] text-[#C8965A] tracking-[0.2em] uppercase mb-5">Getting Started</div>
        <ol className="space-y-4 mb-8 list-none p-0">
          {[
            <>Go to <strong className="text-[#C8965A]">app.back2strong.online</strong> on your phone</>,
            <>Enter <strong className="text-[#C8965A]">{email}</strong> and tap Send Link</>,
            <>Check your email — tap the magic link within 10 minutes</>,
            <>Tap <strong className="text-[#C8965A]">Train</strong> — your Week {startWeek} plan is right there waiting</>,
            <>Add it to your home screen: tap Share → Add to Home Screen for instant access</>,
          ].map((text, i) => (
            <li key={i} className="flex gap-4 items-start">
              <span
                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-[#C8965A] mt-0.5"
                style={{ background: "rgba(200,150,90,0.15)", border: "1px solid rgba(200,150,90,0.3)" }}
              >
                {i + 1}
              </span>
              <span className="text-[14px] text-[#F2F1ED]/80 leading-relaxed">{text}</span>
            </li>
          ))}
        </ol>

        {/* Nutrition snapshot */}
        <div
          className="rounded-xl p-5 mb-8"
          style={{ background: "rgba(200,150,90,0.08)", border: "1px solid rgba(200,150,90,0.2)" }}
        >
          <div className="text-[10px] text-[#C8965A] tracking-[0.2em] uppercase mb-3">Your Daily Targets — {goal}</div>
          <div className="flex gap-8">
            <div>
              <div className="text-2xl font-bold text-[#C8965A]">{protein}g</div>
              <div className="text-[11px] text-[#6B7280] uppercase tracking-wider mt-0.5">Protein</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#F2F1ED]">{calories}</div>
              <div className="text-[11px] text-[#6B7280] uppercase tracking-wider mt-0.5">Calories</div>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/[0.08] mb-8" />

        {/* Week cards */}
        <div className="text-[10px] text-[#C8965A] tracking-[0.2em] uppercase mb-5">What&apos;s in the App</div>

        <div
          className="rounded-xl p-6 mb-4"
          style={{ background: "#111318", borderLeft: "3px solid #C8965A" }}
        >
          <div className="text-[22px] text-[#C8965A] mb-1" style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>
            {weekInfo.title}
          </div>
          <div className="text-[11px] text-[#6B7280] uppercase tracking-[0.15em] mb-4">{weekInfo.subtitle}</div>
          <ul className="space-y-2 pl-4">
            {weekInfo.bullets.map((b, i) => (
              <li key={i} className="text-[14px] text-[#F2F1ED]/75 leading-relaxed list-disc">{b}</li>
            ))}
          </ul>
        </div>

        {nextWeekInfo && (
          <div
            className="rounded-xl p-6 mb-6"
            style={{ background: "#111318", borderLeft: "3px solid rgba(200,150,90,0.4)" }}
          >
            <div className="text-[22px] text-[#F2F1ED]/80 mb-1" style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>
              {nextWeekInfo.title}
            </div>
            <div className="text-[11px] text-[#6B7280] uppercase tracking-[0.15em] mb-4">{nextWeekInfo.subtitle}</div>
            <ul className="space-y-2 pl-4">
              {nextWeekInfo.bullets.map((b, i) => (
                <li key={i} className="text-[14px] text-[#F2F1ED]/60 leading-relaxed list-disc">{b}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Nick reviews callout */}
        <div
          className="rounded-xl p-5 mb-12"
          style={{ background: "rgba(200,150,90,0.08)", border: "1px solid rgba(200,150,90,0.2)" }}
        >
          <p className="text-[14px] text-[#F2F1ED]/80 leading-relaxed">
            The app tracks everything — your check-ins, your energy, your sessions.{" "}
            <strong className="text-[#C8965A]">Nick reviews it every morning</strong> and adjusts as needed.
            You&apos;re not doing this alone. Log in, check in, and let the system do the rest.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] pt-6 text-center">
          <div className="text-[11px] text-[#6B7280] tracking-[0.1em] uppercase">
            Back2Strong · Edge App · app.back2strong.online
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { background: #0A0A0A !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
