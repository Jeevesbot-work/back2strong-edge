import { redirect } from "next/navigation";
import NumbersView from "@/components/blueprint/NumbersView";
import { getBloodWork, getScoreboard, resolveBlueprintUser } from "@/lib/blueprint";

export default async function NumbersPage() {
  const userId = await resolveBlueprintUser();
  if (!userId) redirect("/home");
  const [rows, { panel, doctor }] = await Promise.all([getScoreboard(userId), getBloodWork(userId)]);
  return <NumbersView rows={rows} panel={panel} doctor={doctor} />;
}

