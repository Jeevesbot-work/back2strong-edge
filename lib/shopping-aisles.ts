// Shopping-list aisles — groups the merged ingredient lines from
// lib/shopping-list.ts into the order you'd actually walk a UK supermarket.
// Keyword-based on purpose: simple, predictable, easy to extend. Unknown
// items fall into "Other" rather than being guessed into the wrong aisle.

import type { ShoppingListItem } from "@/lib/shopping-list";

export const AISLE_ORDER = [
  "Fruit & Veg",
  "Meat & Fish",
  "Dairy & Eggs",
  "Bakery & Grains",
  "Store Cupboard",
  "Frozen",
  "Other",
] as const;

export type Aisle = (typeof AISLE_ORDER)[number];

const KEYWORDS: Array<[Aisle, string[]]> = [
  ["Frozen", ["frozen"]],
  ["Meat & Fish", [
    "chicken", "beef", "mince", "steak", "pork", "bacon", "sausage", "turkey", "lamb", "ham", "chorizo",
    "salmon", "tuna", "cod", "prawn", "fish", "mackerel", "haddock", "sardine", "seafood",
  ]],
  ["Dairy & Eggs", [
    "egg", "milk", "cheese", "cheddar", "feta", "mozzarella", "parmesan", "halloumi", "yoghurt", "yogurt",
    "greek yog", "butter", "cream", "skyr", "cottage", "whey", "protein powder",
  ]],
  ["Fruit & Veg", [
    "onion", "garlic", "pepper", "tomato", "spinach", "kale", "broccoli", "carrot", "potato", "sweet potato",
    "courgette", "cucumber", "lettuce", "salad", "avocado", "mushroom", "leek", "celery", "cabbage", "cauliflower",
    "banana", "apple", "berries", "berry", "blueberr", "strawberr", "raspberr", "lemon", "lime", "orange", "mango",
    "ginger", "chilli", "chili", "herbs", "coriander", "parsley", "basil", "mint", "rocket", "spring onion",
    "green beans", "peas", "sweetcorn", "corn", "beetroot", "asparagus", "aubergine", "squash",
  ]],
  ["Bakery & Grains", [
    "bread", "wrap", "tortilla", "pitta", "bagel", "roll", "bun", "oats", "rice", "pasta", "noodle",
    "quinoa", "couscous", "flour", "granola", "cereal", "crackers", "rice cakes",
  ]],
  ["Store Cupboard", [
    "oil", "olive", "salt", "pepper flakes", "vinegar", "soy", "stock", "tin", "tinned", "canned", "chickpea",
    "lentil", "beans", "kidney", "black beans", "coconut milk", "passata", "paste", "curry", "spice", "cumin",
    "paprika", "turmeric", "cinnamon", "honey", "syrup", "peanut", "almond", "nut", "seeds", "chia", "tahini",
    "mustard", "ketchup", "mayo", "sauce", "sugar", "cocoa", "dark chocolate", "vanilla", "baking",
  ]],
];

export function aisleFor(display: string): Aisle {
  const s = display.toLowerCase();
  for (const [aisle, words] of KEYWORDS) {
    if (words.some((w) => s.includes(w))) return aisle;
  }
  return "Other";
}

export interface AisleGroup {
  aisle: Aisle;
  items: ShoppingListItem[];
}

export function groupByAisle(items: ShoppingListItem[]): AisleGroup[] {
  const map = new Map<Aisle, ShoppingListItem[]>();
  for (const item of items) {
    const a = aisleFor(item.display);
    if (!map.has(a)) map.set(a, []);
    map.get(a)!.push(item);
  }
  return AISLE_ORDER.filter((a) => map.has(a)).map((a) => ({
    aisle: a,
    items: map.get(a)!.sort((x, y) => x.display.localeCompare(y.display)),
  }));
}

/** Plain-text version for WhatsApp / Notes / Reminders. Ticked items are left out. */
export function formatForShare(groups: AisleGroup[], omit: Set<string>, title = "Shopping list"): string {
  const lines: string[] = [title, ""];
  for (const g of groups) {
    const rows = g.items.filter((i) => !omit.has(i.display));
    if (!rows.length) continue;
    lines.push(g.aisle.toUpperCase());
    for (const i of rows) lines.push(`- ${i.display}`);
    lines.push("");
  }
  lines.push("— Back2Strong Edge");
  return lines.join("\n").trim();
}
