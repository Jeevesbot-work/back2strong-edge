import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ADMIN_EMAILS } from "@/lib/admin/auth";
import { resolveActingClient } from "@/lib/acting-client";
import BottomNav from "@/components/BottomNav";
import ViewAsBannerBar from "@/components/ViewAsBannerBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  let profile = null;

  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const admin = createAdminClient();
      const { data: profileData } = await admin
        .from("profiles")
        .select("approved, full_name")
        .eq("id", user.id)
        .single();
      profile = profileData;
    }
  } catch {
    // Supabase unavailable — fall through to redirect
  }

  if (!user) redirect("/login");

  const isAdmin = ADMIN_EMAILS.includes(user.email ?? "");

  if (!isAdmin) {
    if (!profile?.full_name) redirect("/onboarding");
    if (!profile?.approved) redirect("/pending");
  }

  const acting = await resolveActingClient(user.id, user.email);
  const canPreview = acting.previewing;

  return (
    <div className="min-h-screen pb-20" style={{ background: "#0E1014" }}>
      {canPreview ? (
        <ViewAsBannerBar name={acting.name ?? "Client"} />
      ) : isAdmin ? (
        <a href="/admin" style={{
          display: "block", background: "#C8965A", textAlign: "center",
          padding: "8px 16px", fontFamily: "Inter, sans-serif", fontSize: 11,
          fontWeight: 700, color: "#0E1014", textTransform: "uppercase", letterSpacing: "0.15em",
        }}>
          ← Admin Panel
        </a>
      ) : null}
      {children}
      <BottomNav />
    </div>
  );
}
