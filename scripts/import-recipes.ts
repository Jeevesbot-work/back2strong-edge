import { formatSummary, runRecipeImport } from "../lib/recipe-import/run";

// Weekly recipe import.
//   npm run recipes:dry      fixture only, writes nothing
//   npm run recipes:import   scrape, rewrite, insert unpublished drafts

async function main() {
  const dry = process.argv.includes("--dry") || process.env.RECIPE_IMPORT_DRY === "1";
  const report = await runRecipeImport({ dry });
  console.log(formatSummary(report));
  console.log("\n--- json ---");
  console.log(JSON.stringify(report, null, 2));
  if (!dry && report.errors.some((error) => /is not set|columns are missing/i.test(error))) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
