import { redirect } from "next/navigation";

// The bulk auto-generated exercise library was pulled from the client app:
// its third-party GIFs mismatched exercise variations (e.g. a single-leg
// movement showing a double-leg clip), which is worse than no demo. Coached,
// hand-verified movement cards live in /moves instead. This route now sends
// anyone who lands here to the curated library.
export default function ExercisesRedirect() {
  redirect("/moves");
}
