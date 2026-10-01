import { ingredientName } from "./ingredients";

const IGNORE = new Set([
  "salt",
  "pepper",
  "salt and pepper",
  "black pepper",
  "sea salt",
  "water",
  "ice",
]);

const TITLE_STOP = new Set([
  "a", "an", "the", "and", "with", "for", "high", "protein", "recipe",
  "easy", "healthy", "low", "fat", "of", "to", "my", "your", "this",
]);

export interface LibraryEntry {
  title: string;
  ingredients: string[];
  sourceKey?: string | null;
  fingerprint?: string | null;
}

export interface DuplicateMatch {
  title: string;
  reason: string;
}

/** Empty when there are fewer than three meaningful ingredients — too weak to call a match. */
export function contentFingerprint(ingredients: string[]): string {
  const names = ingredients
    .map(ingredientName)
    .filter((name) => name.length > 1 && !IGNORE.has(name));
  const seen: Record<string, true> = {};
  const unique: string[] = [];
  for (const name of names) {
    if (seen[name]) continue;
    seen[name] = true;
    unique.push(name);
  }
  unique.sort();
  if (unique.length < 3) return "";
  return unique.join("|");
}

export function titleTokens(title: string): Set<string> {
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !TITLE_STOP.has(token));
  return new Set(tokens);
}

export function titleSimilarity(a: string, b: string): number {
  const left = titleTokens(a);
  const right = titleTokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  left.forEach((token) => {
    if (right.has(token)) shared += 1;
  });
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}

export function findDuplicate(
  candidate: { title: string; ingredients: string[]; sourceKey: string },
  library: LibraryEntry[],
): DuplicateMatch | null {
  for (const entry of library) {
    if (entry.sourceKey && entry.sourceKey === candidate.sourceKey) {
      return { title: entry.title, reason: "same post was already imported" };
    }
  }

  const fingerprint = contentFingerprint(candidate.ingredients);
  if (fingerprint) {
    for (const entry of library) {
      const other = entry.fingerprint || contentFingerprint(entry.ingredients);
      if (other && other === fingerprint) {
        return { title: entry.title, reason: "same ingredients as an existing recipe" };
      }
    }
  }

  for (const entry of library) {
    if (titleSimilarity(candidate.title, entry.title) >= 0.75) {
      return { title: entry.title, reason: "title is too close to an existing recipe" };
    }
  }

  return null;
}
