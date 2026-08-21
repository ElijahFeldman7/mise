import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SeedRecipe, SeedSource } from "../types";

type Entry = {
  title: string;
  description?: string;
  cuisine?: string;
  category?: string;
  tags?: string[];
  servings: number;
  total_minutes: number;
  image_url?: string | null;
  ingredients: Array<{ measure: string; item: string }>;
  instructions: string[];
};

export const curated: SeedSource = {
  name: "curated",
  label: "Hand-written",
  license: "written for this app",

  async *list({ limit }) {
    const path = resolve(process.cwd(), "data/curated-recipes.json");
    const entries = JSON.parse(readFileSync(path, "utf8")) as Entry[];

    for (const [index, entry] of entries.entries()) {
      if (limit && index >= limit) return;
      yield {
        sourceId: `curated-${index}`,
        title: entry.title,
        description: entry.description ?? null,
        imageUrl: entry.image_url ?? null,
        servingsText: String(entry.servings),
        totalMinutes: entry.total_minutes,
        cuisine: entry.cuisine ?? null,
        category: entry.category ?? "dinner",
        tags: entry.tags ?? [],
        ingredientLines: entry.ingredients.map((row) =>
          [row.measure, row.item].filter(Boolean).join(" ").trim(),
        ),
        instructions: entry.instructions,
      } satisfies SeedRecipe;
    }
  },
};
