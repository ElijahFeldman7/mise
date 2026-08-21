import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseIngredient, dietFlagsFor } from "../lib/ingredients";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "The service-role key is in Supabase under Settings → API Keys → Secret keys.\n" +
      "It is only used by this script. Never put it in NEXT_PUBLIC_ anything.",
  );
  process.exit(1);
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const MEALDB = "https://www.themealdb.com/api/json/v1/1";

type Meal = Record<string, string | null> & {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  strTags: string | null;
  strSource: string | null;
};

const CATEGORY_MAP: Record<string, string> = {
  Breakfast: "breakfast",
  Dessert: "dessert",
  Side: "side",
  Starter: "snack",
  Beef: "dinner",
  Chicken: "dinner",
  Lamb: "dinner",
  Pork: "dinner",
  Goat: "dinner",
  Seafood: "dinner",
  Pasta: "dinner",
  Vegetarian: "dinner",
  Vegan: "dinner",
  Miscellaneous: "dinner",
};

const GAS_MARKS: Record<string, number> = {
  "1": 275, "2": 300, "3": 325, "4": 350, "5": 375,
  "6": 400, "7": 425, "8": 450, "9": 475,
};

function ovenTemp(text: string): number | null {
  const fahrenheit = text.match(/(\d{3})\s*(?:°|degrees?)?\s*F\b/i);
  if (fahrenheit) return clampTemp(Number(fahrenheit[1]));

  const celsius = text.match(/(\d{2,3})\s*(?:°|degrees?)\s*C\b/i);
  if (celsius) return clampTemp(Math.round((Number(celsius[1]) * 9) / 5 + 32));

  const gas = text.match(/gas\s*(?:mark)?\s*(\d)/i);
  if (gas && GAS_MARKS[gas[1]]) return GAS_MARKS[gas[1]];

  const bare = text.match(/(?:oven|preheat|bake|roast)[^.]{0,40}?(\d{3})\b/i);
  if (bare) return clampTemp(Number(bare[1]));

  return null;
}

function clampTemp(value: number): number | null {
  return value >= 200 && value <= 550 ? value : null;
}

function estimateMinutes(instructions: string[], ingredientCount: number): number {
  const text = instructions.join(" ");
  let total = 0;

  for (const match of text.matchAll(/(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*(minute|min|hour|hr)/gi)) {
    const low = Number(match[1]);
    const high = match[2] ? Number(match[2]) : low;
    const value = (low + high) / 2;
    total += /hour|hr/i.test(match[3]) ? value * 60 : value;
  }

  const prep = Math.min(30, 5 + ingredientCount * 1.5);
  if (total === 0) total = instructions.length * 8;

  return Math.max(10, Math.min(480, Math.round((total + prep) / 5) * 5));
}

function effortFrom(minutes: number, steps: number): number {
  if (minutes <= 30 && steps <= 5) return 1;
  if (minutes >= 90 || steps >= 10) return 3;
  return 2;
}

function splitInstructions(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n+/)
    .flatMap((block) =>
      block.length > 320 ? block.split(/(?<=\.)\s+(?=[A-Z])/) : [block],
    )
    .map((step) => step.replace(/^\s*(?:STEP\s*)?\d+[.)]\s*/i, "").trim())
    .filter((step) => step.length > 2);
}

async function fetchLetter(letter: string): Promise<Meal[]> {
  const response = await fetch(`${MEALDB}/search.php?f=${letter}`);
  if (!response.ok) throw new Error(`TheMealDB said ${response.status} for "${letter}"`);
  const body = (await response.json()) as { meals: Meal[] | null };
  return body.meals ?? [];
}

type Prepared = {
  recipe: Record<string, unknown>;
  ingredients: Array<Record<string, unknown>>;
};

function prepareMeal(meal: Meal): Prepared | null {
  const instructions = splitInstructions(meal.strInstructions);
  if (instructions.length === 0) return null;

  const parsed = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (!name || !name.trim()) continue;
    const row = parseIngredient(measure, name, parsed.length);
    if (row) parsed.push(row);
  }
  if (parsed.length === 0) return null;

  const minutes = estimateMinutes(instructions, parsed.length);
  const keys = parsed.map((row) => row.item_key);
  const tags = (meal.strTags ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  return {
    recipe: {
      title: meal.strMeal.trim(),
      source: "themealdb",
      source_id: meal.idMeal,
      source_url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
      image_url: meal.strMealThumb,
      instructions,
      total_minutes: minutes,
      servings: 4,
      oven_temp_f: ovenTemp(instructions.join(" ")),
      cuisine: meal.strArea,
      category: CATEGORY_MAP[meal.strCategory ?? ""] ?? "dinner",
      tags,
      diet_flags: dietFlagsFor(keys),
      effort: effortFrom(minutes, instructions.length),
      is_public: true,
    },
    ingredients: parsed.map((row) => ({
      position: row.position,
      raw_text: row.raw_text,
      quantity: row.quantity,
      unit: row.unit,
      item: row.item,
      item_key: row.item_key,
      note: row.note,
      aisle: row.aisle,
      optional: row.optional,
    })),
  };
}

type Curated = {
  title: string;
  description?: string;
  cuisine?: string;
  category?: string;
  tags?: string[];
  servings: number;
  total_minutes: number;
  oven_temp_f?: number | null;
  image_url?: string | null;
  ingredients: Array<{ measure: string; item: string }>;
  instructions: string[];
};

function prepareCurated(entry: Curated, index: number): Prepared | null {
  const parsed = entry.ingredients
    .map((row, position) => parseIngredient(row.measure, row.item, position))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (!parsed.length) return null;
  const keys = parsed.map((row) => row.item_key);

  return {
    recipe: {
      title: entry.title,
      description: entry.description ?? null,
      source: "curated",
      source_id: `curated-${index}`,
      image_url: entry.image_url ?? null,
      instructions: entry.instructions,
      total_minutes: entry.total_minutes,
      servings: entry.servings,
      oven_temp_f: entry.oven_temp_f ?? null,
      cuisine: entry.cuisine ?? null,
      category: entry.category ?? "dinner",
      tags: entry.tags ?? [],
      diet_flags: dietFlagsFor(keys),
      effort: effortFrom(entry.total_minutes, entry.instructions.length),
      is_public: true,
    },
    ingredients: parsed.map((row) => ({
      position: row.position,
      raw_text: row.raw_text,
      quantity: row.quantity,
      unit: row.unit,
      item: row.item,
      item_key: row.item_key,
      note: row.note,
      aisle: row.aisle,
      optional: row.optional,
    })),
  };
}

async function upsert(prepared: Prepared): Promise<"new" | "updated" | "failed"> {
  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("source", prepared.recipe.source as string)
    .eq("source_id", prepared.recipe.source_id as string)
    .maybeSingle();

  let recipeId: string;

  if (existing) {
    recipeId = existing.id as string;
    const { error } = await supabase
      .from("recipes")
      .update({ ...prepared.recipe, updated_at: new Date().toISOString() })
      .eq("id", recipeId);
    if (error) {
      console.warn(`  ! ${prepared.recipe.title}: ${error.message}`);
      return "failed";
    }
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
  } else {
    const { data, error } = await supabase
      .from("recipes")
      .insert(prepared.recipe)
      .select("id")
      .single();
    if (error || !data) {
      console.warn(`  ! ${prepared.recipe.title}: ${error?.message}`);
      return "failed";
    }
    recipeId = data.id as string;
  }

  const { error: ingredientError } = await supabase
    .from("recipe_ingredients")
    .insert(prepared.ingredients.map((row) => ({ ...row, recipe_id: recipeId })));

  if (ingredientError) {
    console.warn(`  ! ${prepared.recipe.title} ingredients: ${ingredientError.message}`);
    return "failed";
  }

  return existing ? "updated" : "new";
}

async function main() {
  const lettersArg = process.argv.find((arg) => arg.startsWith("--letters="));
  const letters = (lettersArg?.split("=")[1] ?? "abcdefghijklmnopqrstuvwxyz").split("");

  const counts = { new: 0, updated: 0, failed: 0, skipped: 0 };

  console.log("Curated set…");
  try {
    const path = resolve(process.cwd(), "data/curated-recipes.json");
    const curated = JSON.parse(readFileSync(path, "utf8")) as Curated[];
    for (const [index, entry] of curated.entries()) {
      const prepared = prepareCurated(entry, index);
      if (!prepared) {
        counts.skipped += 1;
        continue;
      }
      counts[await upsert(prepared)] += 1;
    }
    console.log(`  ${curated.length} hand-written recipes`);
  } catch (cause) {
    console.warn(`  skipped: ${cause instanceof Error ? cause.message : cause}`);
  }

  for (const letter of letters) {
    process.stdout.write(`TheMealDB "${letter}"… `);
    let meals: Meal[] = [];
    try {
      meals = await fetchLetter(letter);
    } catch (cause) {
      console.log(`failed (${cause instanceof Error ? cause.message : cause})`);
      continue;
    }

    for (const meal of meals) {
      const prepared = prepareMeal(meal);
      if (!prepared) {
        counts.skipped += 1;
        continue;
      }
      counts[await upsert(prepared)] += 1;
    }
    console.log(`${meals.length} meals`);
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(
    `\nDone. ${counts.new} new, ${counts.updated} updated, ${counts.skipped} skipped, ${counts.failed} failed.`,
  );
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
