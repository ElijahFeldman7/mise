import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SOURCES, sourceByName } from "./sources";
import { isReject, prepare, type Prepared, type Reject } from "./prepare";
import { setCache } from "./cache";
import type { SeedSource } from "./types";

const flag = (name: string): string | undefined =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
const has = (name: string) => process.argv.includes(`--${name}`);

const BATCH = 100;

/** A dry run reads the sources and never needs the secret key. */
function connect(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
        "The service-role key is in Supabase under Settings → API Keys → Secret keys.\n" +
        "It is only used by this script. Never put it in NEXT_PUBLIC_ anything.",
    );
    process.exit(1);
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

let supabase: SupabaseClient;

type Counts = { written: number; skipped: number; duplicate: number; failed: number };

async function writeBatch(rows: Prepared[], counts: Counts) {
  if (!rows.length) return;

  const { data, error } = await supabase
    .from("recipes")
    .upsert(
      rows.map((row) => row.recipe),
      { onConflict: "source,source_id" },
    )
    .select("id, source, source_id");

  if (error || !data) {
    counts.failed += rows.length;
    console.warn(`  ! batch of ${rows.length} failed: ${error?.message}`);
    return;
  }

  const idFor = new Map(data.map((row) => [`${row.source}|${row.source_id}`, row.id as string]));
  const ids = [...idFor.values()];

  // Ingredients are replaced wholesale — the parser improves, the rows follow.
  await supabase.from("recipe_ingredients").delete().in("recipe_id", ids);

  const ingredients = rows.flatMap((row) => {
    const id = idFor.get(`${row.recipe.source}|${row.recipe.source_id}`);
    return id ? row.ingredients.map((line) => ({ ...line, recipe_id: id })) : [];
  });

  if (ingredients.length) {
    const { error: failure } = await supabase.from("recipe_ingredients").insert(ingredients);
    if (failure) console.warn(`  ! ingredients: ${failure.message}`);
  }

  counts.written += data.length;
}

/** Titles already in the library, so two sources don't both publish one dish. */
async function existingFingerprints(client: SupabaseClient): Promise<Map<string, string>> {
  const seen = new Map<string, string>();
  let from = 0;

  for (;;) {
    const { data } = await client
      .from("recipes")
      .select("fingerprint, source, source_id")
      .eq("is_public", true)
      .not("fingerprint", "is", null)
      .range(from, from + 999);

    if (!data?.length) break;
    for (const row of data) {
      seen.set(row.fingerprint as string, `${row.source}|${row.source_id}`);
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  return seen;
}

async function run(source: SeedSource, limit: number | undefined, dry: boolean) {
  const counts: Counts = { written: 0, skipped: 0, duplicate: 0, failed: 0 };
  const rejects: Reject[] = [];
  const fingerprints = dry ? new Map<string, string>() : await existingFingerprints(supabase);

  process.stdout.write(`${source.label} — ${source.license}\n`);

  let batch: Prepared[] = [];
  let read = 0;

  try {
    for await (const entry of source.list({ limit, letters: flag("letters") })) {
      read += 1;
      const prepared = prepare(source.name, entry);

      if (isReject(prepared)) {
        counts.skipped += 1;
        rejects.push(prepared);
        continue;
      }

      const owner = `${source.name}|${entry.sourceId}`;
      const claimed = fingerprints.get(prepared.fingerprint);
      if (claimed && claimed !== owner) {
        counts.duplicate += 1;
        continue;
      }
      fingerprints.set(prepared.fingerprint, owner);

      batch.push(prepared);
      if (batch.length >= BATCH) {
        if (!dry) await writeBatch(batch, counts);
        else counts.written += batch.length;
        batch = [];
        process.stdout.write(`  ${counts.written} written, ${read} read\r`);
      }
    }
  } catch (cause) {
    console.warn(
      `\n  ! ${source.label} stopped early after ${read}: ` +
        `${cause instanceof Error ? cause.message : cause}`,
    );
  }

  if (batch.length) {
    if (!dry) await writeBatch(batch, counts);
    else counts.written += batch.length;
  }

  console.log(
    `  ${counts.written} written, ${counts.duplicate} already known elsewhere, ` +
      `${counts.skipped} below the bar, ${counts.failed} failed          `,
  );

  return { counts, rejects };
}

async function main() {
  const wanted = flag("source");
  const limit = flag("limit") ? Number(flag("limit")) : undefined;
  const dry = has("dry-run");
  if (has("no-cache")) setCache(false);

  const sources = wanted
    ? [sourceByName(wanted)].filter((source): source is SeedSource => Boolean(source))
    : SOURCES;

  if (!sources.length) {
    console.error(`No such source. Try one of: ${SOURCES.map((s) => s.name).join(", ")}`);
    process.exit(1);
  }

  if (dry) console.log("Dry run — nothing will be written.\n");
  else supabase = connect();

  const totals: Counts = { written: 0, skipped: 0, duplicate: 0, failed: 0 };
  const rejects: Reject[] = [];

  for (const source of sources) {
    const result = await run(source, limit, dry);
    for (const key of Object.keys(totals) as Array<keyof Counts>) {
      totals[key] += result.counts[key];
    }
    rejects.push(...result.rejects);
  }

  if (rejects.length) {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    writeFileSync(
      join(process.cwd(), "data/seed-report.json"),
      JSON.stringify({ at: new Date().toISOString(), rejects }, null, 2),
    );
    console.log(`\nWhat didn't make it is in data/seed-report.json (${rejects.length} recipes).`);
  }

  console.log(
    `\nDone. ${totals.written} written, ${totals.duplicate} duplicates, ` +
      `${totals.skipped} below the bar, ${totals.failed} failed.`,
  );
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
