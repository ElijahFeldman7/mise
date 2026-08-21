"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ImportError, canonicalUrl, fetchPage } from "@/lib/import/fetch";
import { extractRecipe, readableLines } from "@/lib/import/extract";
import { normalizeRecipe, type RecipeDraft } from "@/lib/import/normalize";
import type { Aisle } from "@/lib/types";

export type ImportResult =
  | { ok: true; draft: RecipeDraft }
  | { ok: true; existing: { id: string; title: string } }
  | { ok: false; error: string; lines?: string[]; url?: string };

const hashOf = (url: string) => createHash("sha256").update(url).digest("hex").slice(0, 40);

/**
 * Reads a recipe off a page and hands back a draft. Nothing is written to the
 * library here — the review screen saves, so no scrape lands unseen.
 */
export async function importRecipeFromUrl(input: string): Promise<ImportResult> {
  const session = await requireSession();
  const supabase = await createClient();

  let url: string;
  try {
    url = canonicalUrl(input).toString();
  } catch (cause) {
    return { ok: false, error: cause instanceof ImportError ? cause.message : "That doesn't look like a link" };
  }

  // Pasted twice? Open the one already here.
  const { data: seen } = await supabase
    .from("recipe_imports")
    .select("recipe_id, recipes(id, title)")
    .eq("household_id", session.household.id)
    .eq("url_hash", hashOf(url))
    .eq("status", "ok")
    .maybeSingle();

  const already = seen?.recipes as unknown as { id: string; title: string } | null;
  if (already?.id) return { ok: true, existing: already };

  let page: { url: string; html: string };
  try {
    page = await fetchPage(url);
  } catch (cause) {
    const message = cause instanceof ImportError ? cause.message : "Couldn't read that page";
    await note(supabase, session.household.id, session.userId, url, null, message);
    return { ok: false, error: message, url };
  }

  const raw = extractRecipe(page.html, page.url);
  const draft = raw ? normalizeRecipe(raw, page.url) : null;

  if (!draft) {
    await note(supabase, session.household.id, session.userId, url, null, "no recipe found");
    return {
      ok: false,
      error: "No recipe on that page — paste the ingredients instead",
      lines: readableLines(page.html).slice(0, 60),
      url: page.url,
    };
  }

  return { ok: true, draft };
}

/** Saves a reviewed draft into the household's own shelf. */
export async function saveImportedRecipe(draft: RecipeDraft) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      title: draft.title,
      description: draft.description,
      source: "import",
      source_url: draft.sourceUrl,
      import_domain: draft.sourceDomain,
      fingerprint: draft.fingerprint,
      image_url: draft.imageUrl,
      instructions: draft.instructions,
      total_minutes: draft.totalMinutes,
      servings: draft.servings,
      yield_text: draft.yieldText,
      oven_temp_f: draft.ovenTempF,
      cuisine: draft.cuisine,
      category: draft.category,
      tags: draft.tags,
      diet_flags: draft.dietFlags,
      effort: draft.effort,
      is_public: false,
      owner_id: session.userId,
      household_id: session.household.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  const recipeId = recipe.id as string;

  if (draft.ingredients.length) {
    await supabase.from("recipe_ingredients").insert(
      draft.ingredients.map((row, index) => ({
        recipe_id: recipeId,
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
        aisle: row.aisle as Aisle,
        optional: row.optional,
      })),
    );
  }

  await supabase.from("recipe_imports").upsert(
    {
      household_id: session.household.id,
      url: draft.sourceUrl,
      url_hash: hashOf(draft.sourceUrl),
      domain: draft.sourceDomain,
      recipe_id: recipeId,
      strategy: draft.strategy,
      status: "ok",
      imported_by: session.userId,
    },
    { onConflict: "household_id,url_hash" },
  );

  revalidatePath("/recipes");
  return { ok: true, id: recipeId };
}

async function note(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  userId: string,
  url: string,
  recipeId: string | null,
  error: string,
) {
  await supabase.from("recipe_imports").upsert(
    {
      household_id: householdId,
      url,
      url_hash: hashOf(url),
      domain: safeDomain(url),
      recipe_id: recipeId,
      status: "failed",
      error: error.slice(0, 200),
      imported_by: userId,
    },
    { onConflict: "household_id,url_hash" },
  );
}

function safeDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
