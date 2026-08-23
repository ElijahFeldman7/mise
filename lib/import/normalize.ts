import { createHash } from "node:crypto";
import { dietFlagsFor, parseIngredientLine, type ParsedIngredient } from "@/lib/ingredients";
import { normalizeCuisine } from "@/lib/cuisines";
import type { RawRecipe } from "./extract";

export type RecipeDraft = {
  title: string;
  description: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  sourceDomain: string | null;
  servings: number;
  yieldText: string | null;
  totalMinutes: number | null;
  ovenTempF: number | null;
  cuisine: string | null;
  category: string;
  tags: string[];
  dietFlags: string[];
  effort: number;
  instructions: string[];
  ingredients: ParsedIngredient[];
  unparsed: string[];
  strategy: RawRecipe["strategy"];
  fingerprint: string;
};

/** ISO-8601 durations: PT1H30M, PT45M, P0DT0H25M. */
export function isoDurationToMinutes(value: string | null): number | null {
  if (!value) return null;

  const iso = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (iso) {
    const [, days, hours, minutes] = iso;
    const total =
      Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0);
    return total > 0 ? total : null;
  }

  const written = value.match(/(\d+)\s*(hour|hr|minute|min)/gi);
  if (written) {
    let total = 0;
    for (const part of written) {
      const amount = Number(part.match(/\d+/)?.[0] ?? 0);
      total += /hour|hr/i.test(part) ? amount * 60 : amount;
    }
    if (total > 0) return total;
  }

  const bare = Number(value);
  return Number.isFinite(bare) && bare > 0 ? bare : null;
}

/** "4 servings", "Serves 4-6", ["6"], "Makes 12 muffins". */
export function parseServings(value: string | null): { servings: number; text: string | null } {
  if (!value) return { servings: 4, text: null };
  const text = value.trim();

  const range = text.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/);
  if (range) {
    return { servings: Math.round((Number(range[1]) + Number(range[2])) / 2), text };
  }

  const single = text.match(/\d+/);
  if (single) {
    const count = Number(single[0]);
    if (count >= 1 && count <= 100) return { servings: count, text };
  }

  return { servings: 4, text };
}

const GAS_MARKS: Record<string, number> = {
  "1": 275, "2": 300, "3": 325, "4": 350, "5": 375,
  "6": 400, "7": 425, "8": 450, "9": 475,
};

export function ovenTempF(text: string): number | null {
  const fahrenheit = text.match(/(\d{3})\s*(?:°|degrees?)?\s*F\b/i);
  if (fahrenheit) return clamp(Number(fahrenheit[1]));

  const celsius =
    text.match(/(\d{2,3})\s*(?:°|degrees?)\s*C\b/i) ??
    text.match(/(?:oven|heat|preheat|bake|roast)[^.]{0,30}?(\d{2,3})\s*(?:°|degrees?)?\s*c\b/i);
  if (celsius) return clamp(Math.round((Number(celsius[1]) * 9) / 5 + 32));

  const gas = text.match(/gas\s*(?:mark)?\s*(\d)/i);
  if (gas && GAS_MARKS[gas[1]]) return GAS_MARKS[gas[1]];

  return null;
}

function clamp(value: number): number | null {
  return value >= 200 && value <= 550 ? value : null;
}

function categoryFrom(raw: string | null, tags: string[]): string {
  const text = `${raw ?? ""} ${tags.join(" ")}`.toLowerCase();
  if (/breakfast|brunch|pancake|porridge/.test(text)) return "breakfast";
  if (/dessert|cake|cookie|pudding|sweet|ice cream/.test(text)) return "dessert";
  if (/side|salad|accompaniment/.test(text)) return "side";
  if (/snack|starter|appetiser|appetizer|canape/.test(text)) return "snack";
  if (/lunch|sandwich|soup/.test(text)) return "lunch";
  if (/drink|cocktail|smoothie/.test(text)) return "drink";
  return "dinner";
}

function effortFrom(minutes: number | null, steps: number, ingredients: number): number {
  const time = minutes ?? 45;
  if (time <= 30 && steps <= 5 && ingredients <= 8) return 1;
  if (time >= 90 || steps >= 10 || ingredients >= 16) return 3;
  return 2;
}

/** Same food, same title, same recipe — however many sites published it. */
export function fingerprintOf(title: string, keys: string[]): string {
  const name = title.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const food = [...new Set(keys)].sort().join(",");
  return createHash("sha1").update(`${name}|${food}`).digest("hex").slice(0, 20);
}

export function normalizeRecipe(raw: RawRecipe, pageUrl: string | null): RecipeDraft | null {
  const title = raw.title?.trim() || (raw.strategy === "pasted" ? "Pasted recipe" : null);
  if (!title) return null;

  const ingredients: ParsedIngredient[] = [];
  const unparsed: string[] = [];

  for (const line of raw.ingredients) {
    const parsed = parseIngredientLine(line, ingredients.length);
    if (parsed) ingredients.push(parsed);
    else if (line.trim()) unparsed.push(line.trim());
  }

  const instructions = raw.instructions
    .map((step) => step.replace(/^\s*(?:step\s*)?\d+[.):]\s*/i, "").trim())
    .filter((step) => step.length > 2)
    .slice(0, 60);

  if (!ingredients.length && !instructions.length) return null;

  const { servings, text: yieldText } = parseServings(raw.yieldText);
  const parts =
    (isoDurationToMinutes(raw.cookTime) ?? 0) + (isoDurationToMinutes(raw.prepTime) ?? 0);
  const totalMinutes = isoDurationToMinutes(raw.totalTime) ?? (parts > 0 ? parts : null);

  const keys = ingredients.map((row) => row.item_key);
  const url = pageUrl ? new URL(pageUrl) : null;
  const domain = url ? url.hostname.replace(/^www\./, "") : null;

  return {
    title: title.slice(0, 160),
    description: raw.description?.slice(0, 500) ?? null,
    imageUrl: url ? absoluteImage(raw.image, url) : null,
    sourceUrl: pageUrl,
    sourceDomain: domain,
    servings,
    yieldText,
    totalMinutes: totalMinutes && totalMinutes < 2880 ? totalMinutes : null,
    ovenTempF: ovenTempF(instructions.join(" ")),
    cuisine: normalizeCuisine(raw.cuisine),
    category: categoryFrom(raw.category, raw.keywords),
    tags: raw.keywords,
    dietFlags: dietFlagsFor(keys),
    effort: effortFrom(totalMinutes, instructions.length, ingredients.length),
    instructions,
    ingredients,
    unparsed,
    strategy: raw.strategy,
    fingerprint: fingerprintOf(title, keys),
  };
}

function absoluteImage(image: string | null, base: URL): string | null {
  if (!image) return null;
  try {
    const url = new URL(image, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
