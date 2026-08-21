import { isStaple, type Aisle } from "./ingredients";
import { mergeAmounts, scaleAmount } from "./units";
import type { PlanEntry, RecipeIngredient } from "./types";

export type PlannedRecipe = {
  entry: Pick<PlanEntry, "id" | "servings" | "recipe_id">;
  recipeTitle: string;
  recipeServings: number;
  ingredients: RecipeIngredient[];
};

export type GroceryRow = {
  item: string;
  item_key: string;
  quantity: number | null;
  unit: string | null;
  display_qty: string;
  aisle: Aisle;
  from_recipes: string[];
  position: number;
};

const AISLE_RANK: Record<Aisle, number> = {
  produce: 0, meat: 1, seafood: 2, dairy: 3, bakery: 4,
  pantry: 5, spices: 6, frozen: 7, drinks: 8, household: 9, other: 10,
};

export function buildGroceryRows(
  planned: PlannedRecipe[],
  pantryKeys: Set<string> = new Set(),
): GroceryRow[] {
  type Bucket = {
    item: string;
    aisle: Aisle;
    amounts: Array<{ quantity: number | null; unit: string | null }>;
    recipes: Set<string>;
  };

  const buckets = new Map<string, Bucket>();

  for (const plan of planned) {
    const factor =
      plan.recipeServings > 0 ? plan.entry.servings / plan.recipeServings : 1;

    for (const ingredient of plan.ingredients) {
      const key = ingredient.item_key;
      if (!key) continue;
      if (isStaple(key)) continue;
      if (pantryKeys.has(key)) continue;
      if (ingredient.optional) continue;

      const bucket = buckets.get(key) ?? {
        item: ingredient.item,
        aisle: ingredient.aisle,
        amounts: [],
        recipes: new Set<string>(),
      };

      if (ingredient.item.length < bucket.item.length) bucket.item = ingredient.item;
      bucket.amounts.push({
        quantity: scaleAmount(ingredient.quantity, factor),
        unit: ingredient.unit,
      });
      bucket.recipes.add(plan.recipeTitle);
      buckets.set(key, bucket);
    }
  }

  const rows: GroceryRow[] = [];
  for (const [key, bucket] of buckets) {
    const merged = mergeAmounts(bucket.amounts);
    rows.push({
      item: bucket.item,
      item_key: key,
      quantity: merged.quantity,
      unit: merged.unit,
      display_qty: merged.display,
      aisle: bucket.aisle,
      from_recipes: [...bucket.recipes],
      position: 0,
    });
  }

  rows.sort((a, b) => {
    const aisleDiff = AISLE_RANK[a.aisle] - AISLE_RANK[b.aisle];
    return aisleDiff !== 0 ? aisleDiff : a.item.localeCompare(b.item);
  });

  return rows.map((row, index) => ({ ...row, position: index }));
}

export function diffGroceryRows(
  desired: GroceryRow[],
  existing: Array<{
    id: string;
    item_key: string;
    source: string;
    checked: boolean;
    quantity: number | null;
    unit: string | null;
    display_qty: string | null;
  }>,
): {
  insert: GroceryRow[];
  update: Array<{ id: string; row: GroceryRow }>;
  remove: string[];
} {
  const existingByKey = new Map(
    existing.filter((row) => row.source === "plan").map((row) => [row.item_key, row]),
  );
  const manualKeys = new Set(
    existing.filter((row) => row.source !== "plan").map((row) => row.item_key),
  );

  const insert: GroceryRow[] = [];
  const update: Array<{ id: string; row: GroceryRow }> = [];
  const seen = new Set<string>();

  for (const row of desired) {
    seen.add(row.item_key);
    if (manualKeys.has(row.item_key)) continue;

    const current = existingByKey.get(row.item_key);
    if (!current) {
      insert.push(row);
      continue;
    }
    const changed =
      current.quantity !== row.quantity ||
      current.unit !== row.unit ||
      current.display_qty !== row.display_qty;
    if (changed && !current.checked) update.push({ id: current.id, row });
  }

  const remove = [...existingByKey.values()]
    .filter((row) => !seen.has(row.item_key) && !row.checked)
    .map((row) => row.id);

  return { insert, update, remove };
}
