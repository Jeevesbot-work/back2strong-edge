import type { Metadata } from "next";
import CommandCentre from "@/app/admin/CommandCentre";

export const metadata: Metadata = {
  title: "View as client — seeded preview",
  robots: { index: false, follow: false },
};

const ALEX = "11111111-1111-4111-8111-111111111111";
const SAM = "22222222-2222-4222-8222-222222222222";
const quiet = new Date(Date.now() - 5 * 86400000).toISOString();

// Fixture only. These are not live clients and this page does not read the database.
const active = [
  {
    id: ALEX,
    full_name: "Alex Example",
    email: "alex.example@example.com",
    approved: true,
    is_test: false,
    last_seen: new Date().toISOString(),
    last_check_in: new Date().toISOString().slice(0, 10),
  },
  {
    id: SAM,
    full_name: "Sam Example",
    email: "sam.example@example.com",
    approved: true,
    is_test: false,
    last_seen: quiet,
    last_check_in: quiet.slice(0, 10),
  },
];

export default function SeededViewAsPage() {
  return (
    <div>
      <p style={{ background: "#171B21", color: "#9BA3AF", fontFamily: "Inter, sans-serif", fontSize: 12, padding: "8px 16px", margin: 0 }}>
        Seeded preview. Alex Example and Sam Example are fixture profiles, not live clients.
      </p>
      <CommandCentre
        active={active}
        pending={[]}
        recentCheckIns={[]}
        recentMessages={[]}
        recentMealLogs={[]}
        recentTrainingSessions={[]}
        tasks={[]}
        coachNotes={[]}
        testFlagsReady
      />
    </div>
  );
}
