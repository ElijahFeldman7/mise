/** One recipe as a source hands it over, before any of it is trusted. */
export type SeedRecipe = {
  sourceId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  servingsText?: string | null;
  totalMinutes?: number | null;
  cuisine?: string | null;
  category?: string | null;
  tags?: string[];
  ingredientLines: string[];
  instructions: string[];
};

export type SeedOptions = {
  limit?: number;
  letters?: string;
};

export type SeedSource = {
  /** Must match a value allowed by the recipes.source check constraint. */
  name: "themealdb" | "curated" | "wikibooks" | "usda" | "gutenberg";
  label: string;
  license: string;
  list(options: SeedOptions): AsyncGenerator<SeedRecipe>;
};
