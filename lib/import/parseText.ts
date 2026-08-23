import { QUANTITY_HEAD, type RawRecipe } from "./extract";

const INGREDIENTS_HEADER =
  /^#{0,3}\s*(ingredients?|shopping list|what you('| wi)ll need|you'?ll need)\s*:?\s*$/i;
const INSTRUCTIONS_HEADER =
  /^#{0,3}\s*(instructions?|directions?|method|steps?|preparation|how to make (it|this))\s*:?\s*$/i;

const NOISE_LINE = /^\s*(https?:\/\/|www\.)/i;

function stripLeadingMarker(line: string): string {
  return line.replace(/^\s*(?:step\s*)?\d+[.):]\s*/i, "").trim();
}

function looksLikeTitle(line: string): boolean {
  return (
    line.length > 1 &&
    line.length < 100 &&
    !QUANTITY_HEAD.test(line) &&
    !NOISE_LINE.test(line) &&
    !/[.!?]$/.test(line)
  );
}

/**
 * The same regex the URL importer falls back to when a page has no structured
 * data — pointed at whatever someone pasted in by hand instead of a page.
 * "Ingredients"/"Instructions" headers are trusted first; without them, every
 * line is sorted by whether it starts like a measurement or reads like a step.
 */
export function extractRecipeFromText(raw: string): RawRecipe | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !NOISE_LINE.test(line));

  if (lines.length < 3) return null;

  const ingredientsAt = lines.findIndex((line) => INGREDIENTS_HEADER.test(line));
  const instructionsAt = lines.findIndex(
    (line, index) =>
      INSTRUCTIONS_HEADER.test(line) && (ingredientsAt < 0 || index > ingredientsAt),
  );

  let preamble: string[];
  let ingredientLines: string[];
  let instructionLines: string[];

  if (ingredientsAt >= 0) {
    preamble = lines.slice(0, ingredientsAt);
    const ingredientsEnd = instructionsAt >= 0 ? instructionsAt : lines.length;
    const between = lines.slice(ingredientsAt + 1, ingredientsEnd);

    if (instructionsAt >= 0) {
      ingredientLines = between;
      instructionLines = lines.slice(instructionsAt + 1);
    } else {
      // No explicit instructions header — split what follows "Ingredients" by shape.
      ingredientLines = between.filter((line) => QUANTITY_HEAD.test(line));
      instructionLines = between.filter((line) => !QUANTITY_HEAD.test(line) && line.length > 15);
    }
  } else {
    preamble = lines.slice(0, 1);
    const body = lines.slice(1);
    ingredientLines = body.filter((line) => QUANTITY_HEAD.test(line) && line.length < 200);
    instructionLines = body.filter((line) => !QUANTITY_HEAD.test(line) && line.length > 15);
  }

  const title = preamble.length && looksLikeTitle(preamble[0]) ? preamble[0] : null;
  const yieldText =
    preamble.find((line) => /\b(serves?|servings?|yields?|makes)\b/i.test(line)) ?? null;
  const totalTime =
    preamble.find((line) => /\b(prep|cook|bake|total|ready in)\b.*\d/i.test(line)) ?? null;

  // Only instruction lines get their step numbering stripped — an ingredient
  // like "1.5 cups flour" must never be mistaken for "1. 5 cups flour".
  const ingredients = ingredientLines.map((line) => line.trim()).filter((line) => line.length > 1);
  const instructions = instructionLines.map(stripLeadingMarker).filter((line) => line.length > 1);

  if (ingredients.length < 2 && instructions.length < 1) return null;

  return {
    title,
    description: null,
    image: null,
    yieldText,
    totalTime,
    cookTime: null,
    prepTime: null,
    cuisine: null,
    category: null,
    keywords: [],
    ingredients,
    instructions,
    author: null,
    strategy: "pasted",
  };
}
