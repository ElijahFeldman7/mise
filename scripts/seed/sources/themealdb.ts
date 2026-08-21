import { getJson, pause } from "../cache";
import type { SeedRecipe, SeedSource } from "../types";

const API = "https://www.themealdb.com/api/json/v1/1";

type Meal = Record<string, string | null> & {
  idMeal: string;
  strMeal: string;
};

const CATEGORY_MAP: Record<string, string> = {
  Breakfast: "breakfast", Dessert: "dessert", Side: "side", Starter: "snack",
  Beef: "dinner", Chicken: "dinner", Lamb: "dinner", Pork: "dinner", Goat: "dinner",
  Seafood: "dinner", Pasta: "dinner", Vegetarian: "dinner", Vegan: "dinner",
  Miscellaneous: "dinner",
};

function splitInstructions(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n+/)
    .flatMap((block) => (block.length > 320 ? block.split(/(?<=\.)\s+(?=[A-Z])/) : [block]))
    .map((step) => step.trim())
    .filter((step) => step.length > 2);
}

export const themealdb: SeedSource = {
  name: "themealdb",
  label: "TheMealDB",
  license: "free public API",

  async *list({ limit, letters }) {
    const alphabet = (letters ?? "abcdefghijklmnopqrstuvwxyz").split("");
    let sent = 0;

    for (const letter of alphabet) {
      const body = await getJson<{ meals: Meal[] | null }>(`${API}/search.php?f=${letter}`);
      await pause(200);

      for (const meal of body.meals ?? []) {
        const lines: string[] = [];
        for (let i = 1; i <= 20; i += 1) {
          const name = meal[`strIngredient${i}`];
          const measure = meal[`strMeasure${i}`];
          if (!name?.trim()) continue;
          lines.push([measure?.trim(), name.trim()].filter(Boolean).join(" "));
        }

        const recipe: SeedRecipe = {
          sourceId: meal.idMeal,
          title: meal.strMeal.trim(),
          imageUrl: meal.strMealThumb,
          sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
          cuisine: meal.strArea,
          category: CATEGORY_MAP[meal.strCategory ?? ""] ?? "dinner",
          tags: (meal.strTags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
          servingsText: "4",
          ingredientLines: lines,
          instructions: splitInstructions(meal.strInstructions),
        };

        yield recipe;
        sent += 1;
        if (limit && sent >= limit) return;
      }
    }
  },
};
