import { createClient } from "@/lib/supabase/server";
import type { Candidate, HouseholdSignal, RawEvent } from "@/lib/recommend";
import { buildHouseholdSignal, featuresOf } from "@/lib/recommend";

type CacheEntry = { candidates: Candidate[]; loadedAt: number };
let libraryCache: CacheEntry | null = null;
const CACHE_MS = 5 * 60 * 1000;
const LIBRARY_LIMIT = 1500;

type RecipeRow = {
  id: string;
  title: string;
  image_url: string | null;
  image_path: string | null;
  category: string | null;
  cuisine: string | null;
  tags: string[] | null;
  diet_flags: string[] | null;
  total_minutes: number | null;
  effort: number | null;
  is_public: boolean;
  recipe_ingredients: Array<{ item_key: string }> | null;
};

function toCandidate(row: RecipeRow): Candidate {
  return {
    id: row.id,
    title: row.title,
    image_url: row.image_url,
    image_path: row.image_path,
    category: row.category,
    cuisine: row.cuisine,
    tags: row.tags ?? [],
    diet_flags: row.diet_flags ?? [],
    total_minutes: row.total_minutes,
    effort: row.effort ?? 2,
    ingredient_keys: (row.recipe_ingredients ?? []).map((i) => i.item_key),
    is_public: row.is_public,
  };
}

const SELECT =
  "id, title, image_url, image_path, category, cuisine, tags, diet_flags, total_minutes, effort, is_public, recipe_ingredients(item_key)";

export async function loadCandidates(householdId: string): Promise<Candidate[]> {
  const supabase = await createClient();

  const fresh = libraryCache && Date.now() - libraryCache.loadedAt < CACHE_MS;

  const [library, mine] = await Promise.all([
    fresh
      ? Promise.resolve(libraryCache!.candidates)
      : supabase
          .from("recipes")
          .select(SELECT)
          .eq("is_public", true)
          .limit(LIBRARY_LIMIT)
          .then(({ data }) => {
            const candidates = ((data ?? []) as RecipeRow[]).map(toCandidate);
            libraryCache = { candidates, loadedAt: Date.now() };
            return candidates;
          }),
    supabase
      .from("recipes")
      .select(SELECT)
      .eq("household_id", householdId)
      .then(({ data }) => ((data ?? []) as RecipeRow[]).map(toCandidate)),
  ]);

  const seen = new Set(mine.map((c) => c.id));
  return [...mine, ...library.filter((c) => !seen.has(c.id))];
}

export async function loadSignal(
  householdId: string,
  candidates: Candidate[],
): Promise<HouseholdSignal> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("recipe_events")
    .select("recipe_id, kind, rating, happened_at")
    .eq("household_id", householdId)
    .order("happened_at", { ascending: false })
    .limit(600);

  const features = new Map<string, string[]>();
  for (const candidate of candidates) features.set(candidate.id, featuresOf(candidate));

  return buildHouseholdSignal((data ?? []) as RawEvent[], features);
}

export async function loadOnHand(householdId: string): Promise<Set<string>> {
  const supabase = await createClient();

  const [{ data: items }, { data: pantry }] = await Promise.all([
    supabase
      .from("grocery_items")
      .select("item_key")
      .eq("household_id", householdId),
    supabase.from("pantry_items").select("item_key").eq("household_id", householdId),
  ]);

  const keys = new Set<string>();
  for (const row of items ?? []) keys.add(row.item_key as string);
  for (const row of pantry ?? []) keys.add(row.item_key as string);
  return keys;
}

export async function loadPlannedThisWeek(
  householdId: string,
  weekStart: string,
  weekEnd: string,
): Promise<{ recipeIds: Set<string>; ingredientSets: string[][] }> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("plan_entries")
    .select("recipe_id, recipe:recipes(recipe_ingredients(item_key))")
    .eq("household_id", householdId)
    .gte("on_date", weekStart)
    .lte("on_date", weekEnd);

  const recipeIds = new Set<string>();
  const ingredientSets: string[][] = [];

  for (const row of (data ?? []) as unknown as Array<{
    recipe_id: string | null;
    recipe: { recipe_ingredients: Array<{ item_key: string }> } | null;
  }>) {
    if (row.recipe_id) recipeIds.add(row.recipe_id);
    const keys = row.recipe?.recipe_ingredients?.map((i) => i.item_key) ?? [];
    if (keys.length) ingredientSets.push(keys);
  }

  return { recipeIds, ingredientSets };
}
