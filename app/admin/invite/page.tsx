import { requireAdminPage } from "@/lib/admin/auth";
import InviteForm from "./InviteForm";

export default async function InvitePage() {
  await requireAdminPage();
  return <InviteForm />;
}
