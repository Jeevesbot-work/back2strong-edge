// TEMPORARY no-login preview of the Exercise Library, for phone review of the
// PR before merge. Lives outside the (app) auth group so it opens without a
// magic-link login (which can't complete on a preview domain). Only renders the
// world-readable exercises data — no client/user data is exposed.
//
// DELETE THIS ROUTE before merging PR #3.
import BottomNav from "@/components/BottomNav";
import ExercisesPage from "../../(app)/exercises/page";

export default function PreviewExercisesInApp() {
  return (
    <div className="min-h-screen pb-20" style={{ background: "#0E1014" }}>
      <ExercisesPage />
      <BottomNav />
    </div>
  );
}
