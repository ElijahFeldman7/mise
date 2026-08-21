import { dietFlagsFor, parseIngredientLine } from "../../lib/ingredients";
import { fingerprintOf, ovenTempF, parseServings } from "../../lib/import/normalize";
import type { SeedRecipe } from "./types";

export type Prepared = {
  recipe: Record<string, unknown>;
  ingredients: Array<Record<string, unknown>>;
  fingerprint: string;
};

export type Reject = { source: string; sourceId: string; title: string; why: string };

const MIN_INGREDIENTS = 2;
const MIN_STEPS = 2;
const MAX_UNPARSED_SHARE = 0.4;

function effortFrom(minutes: number, steps: number, ingredients: number): number {
  if (minutes <= 30 && steps <= 5 && ingredients <= 8) return 1;
  if (minutes >= 90 || steps >= 10 || ingredients >= 16) return 3;
  return 2;
}

function estimateMinutes(instructions: string[], ingredientCount: number): number {
  const text = instructions.join(" ");
  let total = 0;

  for (const match of text.matchAll(/(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*(minute|min|hour|hr)/gi)) {
    const low = Number(match[1]);
    const high = match[2] ? Number(match[2]) : low;
    total += /hour|hr/i.test(match[3]) ? ((low + high) / 2) * 60 : (low + high) / 2;
  }

  if (total === 0) total = instructions.length * 8;
  const prep = Math.min(30, 5 + ingredientCount * 1.5);
  return Math.max(10, Math.min(480, Math.round((total + prep) / 5) * 5));
}

/**
 * The gate. A recipe with one ingredient, or one whose ingredient lines mostly
 * failed to parse, is worse than no recipe at all — it turns up in searches and
 * writes nonsense onto the grocery list.
 */
export function prepare(source: string, entry: SeedRecipe): Prepared | Reject {
  const title = entry.title?.trim();
  const reject = (why: string): Reject => ({
    source,
    sourceId: entry.sourceId,
    title: title ?? "(untitled)",
    why,
  });

  if (!title) return reject("no title");

  const parsed = [];
  let failed = 0;
  for (const line of entry.ingredientLines) {
    if (!line.trim()) continue;
    const row = parseIngredientLine(line, parsed.length);
    if (row) parsed.push(row);
    else failed += 1;
  }

  const instructions = entry.instructions
    .map((step) => step.replace(/^\s*(?:step\s*)?\d+[.):]\s*/i, "").trim())
    .filter((step) => step.length > 2);

  if (parsed.length < MIN_INGREDIENTS) return reject(`only ${parsed.length} ingredients`);
  if (instructions.length < MIN_STEPS) return reject(`only ${instructions.length} steps`);

  const share = failed / (failed + parsed.length);
  if (share > MAX_UNPARSED_SHARE) {
    return reject(`${Math.round(share * 100)}% of ingredient lines unreadable`);
  }

  const keys = parsed.map((row) => row.item_key);
  const minutes = entry.totalMinutes ?? estimateMinutes(instructions, parsed.length);
  const { servings, text: yieldText } = parseServings(entry.servingsText ?? null);
  const fingerprint = fingerprintOf(title, keys);

  return {
    fingerprint,
    recipe: {
      title: title.slice(0, 160),
      description: entry.description?.slice(0, 500) ?? null,
      source,
      source_id: entry.sourceId,
      source_url: entry.sourceUrl ?? null,
      image_url: entry.imageUrl ?? null,
      instructions,
      total_minutes: minutes,
      servings,
      yield_text: yieldText,
      oven_temp_f: ovenTempF(instructions.join(" ")),
      cuisine: entry.cuisine ?? null,
      category: entry.category ?? "dinner",
      tags: (entry.tags ?? []).slice(0, 12),
      diet_flags: dietFlagsFor(keys),
      effort: effortFrom(minutes, instructions.length, parsed.length),
      fingerprint,
      is_public: true,
      updated_at: new Date().toISOString(),
    },
    ingredients: parsed.map((row, index) => ({
      position: index,
      raw_text: row.raw_text,
      quantity: row.quantity,
      unit: row.unit,
      pack_size_qty: row.pack_size_qty,
      pack_size_unit: row.pack_size_unit,
      item: row.item,
      item_key: row.item_key,
      alt_item: row.alt_item,
      note: row.note,
      aisle: row.aisle,
      optional: row.optional,
    })),
  };
}

export const isReject = (value: Prepared | Reject): value is Reject => "why" in value;
