import { createClient } from "@/lib/supabase/server";
import { resolveActingClient } from "@/lib/acting-client";
import ViewAsBannerBar from "@/components/ViewAsBannerBar";

/** Renders nothing unless the signed-in admin is actually viewing a client. */
export default async function ViewAsBanner() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const view = await resolveActingClient(user.id, user.email);
    if (!view.previewing) return null;
    return <ViewAsBannerBar name={view.name ?? "Client"} />;
  } catch {
    return null;
  }
}
