import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProtocolView, { type Protocol } from "@/components/ProtocolView";

export default async function ProtocolPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("protocols")
    .select("slug, title, subtitle, category, intro, steps, after_notes, total_time_label")
    .eq("slug", params.slug)
    .eq("published", true)
    .single();
  if (!data) notFound();
  return <ProtocolView p={data as Protocol} />;
}
