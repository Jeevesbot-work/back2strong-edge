// Shopping list — turns a set of hero-meal ingredient lists into one
// consolidated list. Ingredients are stored as free-text lines ("80g oats",
// "2 large eggs", "Salt and pepper"), so this parses what it confidently can
// and merges matching quantity+unit+item, and leaves everything else exactly
// as written rather than guessing. Never drops a line, never invents a merge
// it isn't sure of — a shopping list that's wrong is worse than one that's
// just slightly less tidy.

export interface ShoppingListSource {
  recipeTitle: string;
  ingredients: string[];
}

export interface ShoppingListItem {
  display: string; // what to show, e.g. "260g oats" or "Salt and pepper"
  usedIn: string[]; // recipe titles this line came from (deduped)
}

const UNIT_ALIASES: Record<string, string> = {
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  cup: "cup", cups: "cup",
  clove: "clove", cloves: "clove",
  tin: "tin", tins: "tin",
  can: "can", cans: "can",
  packet: "packet", packets: "packet", pack: "packet", packs: "packet",
  pinch: "pinch", pinches: "pinch",
  slice: "slice", slices: "slice",
  bag: "bag", bags: "bag",
  sprig: "sprig", sprigs: "sprig",
  stick: "stick", sticks: "stick",
  scoop: "scoop", scoops: "scoop",
  fillet: "fillet", fillets: "fillet",
};

const UNIT_DISPLAY: Record<string, string> = {
  g: "g", kg: "kg", ml: "ml", l: "l", tsp: "tsp", tbsp: "tbsp",
  cup: "cups", clove: "cloves", tin: "tins", can: "cans", packet: "packets",
  pinch: "pinches", slice: "slices", bag: "bags", sprig: "sprigs",
  stick: "sticks", scoop: "scoops", fillet: "fillets",
};

const LEADING_QTY_RE = /^(\d+(?:\.\d+)?\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*/;

function parseFraction(s: string): number {
  if (s.includes("/")) {
    const parts = s.split(" ");
    const wholeAndFrac = parts.length > 1 ? parts : ["0", parts[0]];
    const whole = parseFloat(wholeAndFrac[0]) || 0;
    const [num, den] = wholeAndFrac[wholeAndFrac.length - 1].split("/").map(Number);
    return whole + (den ? num / den : 0);
  }
  return parseFloat(s) || 0;
}

interface Parsed {
  qty: number | null;
  unit: string | null; // normalized key, or null if unitless/unparsed
  item: string; // remaining text, trimmed, original casing
}

function parseLine(raw: string): Parsed {
  const line = raw.trim();
  const qtyMatch = line.match(LEADING_QTY_RE);
  if (!qtyMatch) return { qty: null, unit: null, item: line };

  const qty = parseFraction(qtyMatch[1]);
  const rest = line.slice(qtyMatch[0].length);

  // Unit may be glued to the quantity ("80g") or a separate first word ("2 tsp").
  const glued = rest.match(/^([a-zA-Z]+)\b(.*)$/);
  if (glued && UNIT_ALIASES[glued[1].toLowerCase()]) {
    return { qty, unit: UNIT_ALIASES[glued[1].toLowerCase()], item: glued[2].trim() };
  }
  return { qty, unit: null, item: rest.trim() };
}

export function buildShoppingList(sources: ShoppingListSource[]): ShoppingListItem[] {
  const merged = new Map<string, { qty: number | null; unit: string | null; item: string; usedIn: Set<string> }>();

  for (const source of sources) {
    for (const raw of source.ingredients) {
      const { qty, unit, item } = parseLine(raw);
      if (!item) continue;
      const key = `${unit ?? ""}|${item.toLowerCase()}`;
      const existing = merged.get(key);
      if (existing) {
        existing.usedIn.add(source.recipeTitle);
        if (existing.qty != null && qty != null) existing.qty += qty;
        else existing.qty = null; // one of the two couldn't be quantified — don't guess, just stop counting
      } else {
        merged.set(key, { qty, unit, item, usedIn: new Set([source.recipeTitle]) });
      }
    }
  }

  const items: ShoppingListItem[] = Array.from(merged.values()).map((m) => {
    const unitLabel = m.unit ? (m.qty === 1 ? m.unit : UNIT_DISPLAY[m.unit]) : null;
    const display = m.qty != null
      ? `${trimZero(m.qty)}${unitLabel ? (m.unit === "g" || m.unit === "kg" || m.unit === "ml" || m.unit === "l" ? unitLabel : " " + unitLabel) : ""} ${m.item}`.trim()
      : m.item.charAt(0).toUpperCase() + m.item.slice(1);
    return { display, usedIn: Array.from(m.usedIn) };
  });

  return items.sort((a, b) => a.display.localeCompare(b.display));
}

function trimZero(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
