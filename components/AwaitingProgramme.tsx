// Shown when a client has no programme loaded yet.
export default function AwaitingProgramme({
  firstName,
  greeting,
  dateLine,
}: {
  firstName?: string;
  greeting?: string;
  dateLine?: string;
}) {
  const isHome = Boolean(firstName && greeting);

  return (
    <div
      className="max-w-lg mx-auto px-5 pb-28"
      style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 16px)" }}
    >
      <div style={{ paddingTop: 8, paddingBottom: 20 }}>
        {isHome ? (
          <>
            <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 32, fontWeight: 400, color: "#F2F1ED", lineHeight: 1.1, marginBottom: 4 }}>
              {greeting}, {firstName}.
            </h1>
            {dateLine && (
              <p style={{ fontSize: 12, color: "#9BA3AF", fontFamily: "Inter, sans-serif" }}>{dateLine}</p>
            )}
          </>
        ) : (
          <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 36, fontWeight: 400, color: "#F2F1ED", lineHeight: 1, marginBottom: 4 }}>
            Train.
          </h1>
        )}
      </div>

      <div
        style={{ background: "#171B21", borderRadius: 20, border: "1px solid rgba(200,150,90,0.2)", padding: "28px 22px" }}
      >
        <p style={{ fontSize: 9, color: "#C8965A", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "Inter, sans-serif", marginBottom: 10 }}>
          From Nick
        </p>
        <h2 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 26, fontWeight: 400, color: "#F2F1ED", lineHeight: 1.2, marginBottom: 10 }}>
          Your programme is being built by Nick.
        </h2>
        <p style={{ fontSize: 14, color: "rgba(242,241,237,0.65)", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
          {firstName ? `${firstName}, you're in. ` : "You're in. "}
          He&apos;ll load it on Train when it&apos;s ready. You don&apos;t need to do anything until then.
        </p>
      </div>
    </div>
  );
}
