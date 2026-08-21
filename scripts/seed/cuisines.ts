import { CUISINES, REGIONS } from "../../lib/cuisines";

/**
 * Wikibooks files national dishes under "Category:Thai recipes", right next to
 * "Category:Easy recipes" and "Category:Boiled recipes" — so the only reliable
 * way to tell a cuisine from a cooking method is to know the nationalities.
 */
const CUISINE_SET = new Map(CUISINES.map((name) => [name.toLowerCase(), name]));
const REGION_SET = new Map(REGIONS.map((name) => [name.toLowerCase(), name]));

/**
 * Pulls the cuisine out of a page's categories. A dish claimed by three
 * countries keeps the first as its cuisine and the rest as tags — Chicken Tikka
 * Masala is filed under English, Indian and Pakistani, and all three are true.
 */
export function cuisineFromCategories(categories: string[]): {
  cuisine: string | null;
  also: string[];
} {
  const specific: string[] = [];
  const regions: string[] = [];

  for (const raw of categories) {
    const match = raw.replace(/^Category:/, "").match(/^(.+?)\s+recipes$/i);
    if (!match) continue;
    const name = match[1].trim().toLowerCase();

    const exact = CUISINE_SET.get(name);
    if (exact) {
      specific.push(exact);
      continue;
    }
    const region = REGION_SET.get(name);
    if (region && !regions.includes(region)) regions.push(region);
  }

  if (specific.length) return { cuisine: specific[0], also: [...specific.slice(1), ...regions] };
  if (regions.length) return { cuisine: regions[0], also: regions.slice(1) };
  return { cuisine: null, also: [] };
}

const COURSES: Array<[RegExp, string]> = [
  [/^dessert|^cake|^cookie|^pudding|^pie|^candy|^confection/i, "dessert"],
  [/^breakfast|^brunch/i, "breakfast"],
  [/^main course|^dinner|^entree/i, "dinner"],
  [/^side dish|^side|^salad|^sauce|^condiment|^dressing|^dip/i, "side"],
  [/^snack|^appetizer|^appetiser|^starter|^bar\b/i, "snack"],
  [/^soup|^sandwich|^lunch/i, "lunch"],
  [/^drink|^beverage|^cocktail|^smoothie/i, "drink"],
  [/^bread|^baking/i, "side"],
];

/** "Category:Recipes for dessert" and "Category:Main course recipes". */
export function courseFromCategories(categories: string[]): string | null {
  for (const raw of categories) {
    const name = raw.replace(/^Category:/, "").trim();

    const forSomething = name.match(/^Recipes for (.+)$/i);
    if (forSomething) {
      const hit = COURSES.find(([pattern]) => pattern.test(forSomething[1]));
      if (hit) return hit[1];
    }

    const somethingRecipes = name.match(/^(.+?)\s+recipes$/i);
    if (somethingRecipes) {
      const hit = COURSES.find(([pattern]) => pattern.test(somethingRecipes[1]));
      if (hit) return hit[1];
    }
  }
  return null;
}

/** The page says how hard it is; believe it over counting steps. */
export function effortFromCategories(categories: string[]): number | null {
  const text = categories.join(" | ").toLowerCase();
  if (/\beasy recipes\b/.test(text)) return 1;
  if (/\bmedium difficulty recipes\b/.test(text)) return 2;
  if (/\bdifficult recipes\b/.test(text)) return 3;
  return null;
}
