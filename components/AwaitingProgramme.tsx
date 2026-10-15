// Shown when a client has no bespoke programme loaded yet.
export default function AwaitingProgramme() {
  return (
    <div
      className="max-w-lg mx-auto px-5 pb-28"
      style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 16px)" }}
    >
      <div style={{ paddingTop: 8, paddingBottom: 20 }}>
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 36, fontWeight: 400, color: "#F2F1ED", lineHeight: 1, marginBottom: 4 }}>
          Train.
        </h1>
      </div>

      <div
        style={{ background: "#171B21", borderRadius: 20, border: "1px solid rgba(200,150,90,0.2)", padding: "28px 22px", textAlign: "center" }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 16px", background: "rgba(200,150,90,0.1)", border: "1px solid rgba(200,150,90,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth={1.8} style={{ width: 22, height: 22 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 22, fontWeight: 400, color: "#F2F1ED", lineHeight: 1.2, marginBottom: 8 }}>
          Your plan is being prepared.
        </h2>
        <p style={{ fontSize: 13, color: "rgba(242,241,237,0.6)", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
          It will show up here when it&apos;s ready. You don&apos;t need to do anything until then.
        </p>
      </div>
    </div>
  );
}
