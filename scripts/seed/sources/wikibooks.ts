import { getJson, pause } from "../cache";
import { courseFromCategories, cuisineFromCategories, effortFromCategories } from "../cuisines";
import type { SeedRecipe, SeedSource } from "../types";

const API = "https://en.wikibooks.org/w/api.php";
const BATCH = 20;

type Page = {
  pageid: number;
  title: string;
  revisions?: Array<{ slots: { main: { content: string } } }>;
  categories?: Array<{ title: string }>;
};

type Answer = {
  batchcomplete?: boolean;
  continue?: Record<string, string>;
  query?: { pages?: Page[] };
};

type Gathered = { pageid: number; title: string; wikitext: string; categories: string[] };

/** Wikitext into something a person wrote: links unwrapped, templates flattened. */
export function cleanWikitext(text: string): string {
  let out = text;

  // {{convert|8|oz|g|abbr=on}} → "8 oz"
  out = out.replace(/\{\{convert\|([^}|]+)\|([^}|]+)(?:\|[^}]*)?\}\}/gi, "$1 $2");
  out = out.replace(/\{\{frac\|(\d+)\|(\d+)\|(\d+)\}\}/gi, "$1 $2/$3");
  out = out.replace(/\{\{frac\|(\d+)\|(\d+)\}\}/gi, "$1/$2");
  out = out.replace(/\{\{[^{}]*\}\}/g, " ");

  // [[Cookbook:Olive Oil|olive oil]] → "olive oil"
  out = out.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1");
  out = out.replace(/\[\[(?:Cookbook:)?([^\]]*)\]\]/g, "$1");

  out = out.replace(/<ref[^>]*\/>/gi, " ");
  out = out.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ");
  out = out.replace(/<!--[\s\S]*?-->/g, " ");
  out = out.replace(/<[^>]+>/g, " ");
  out = out.replace(/'''''|'''|''/g, "");

  return out.replace(/\s+/g, " ").trim();
}

function section(text: string, names: string[]): string[] {
  for (const name of names) {
    const pattern = new RegExp(`^=+\\s*${name}\\s*=+\\s*$`, "im");
    const start = text.match(pattern);
    if (!start || start.index === undefined) continue;

    const after = text.slice(start.index + start[0].length);
    const end = after.search(/^=+[^=]+=+\s*$/m);
    const body = end === -1 ? after : after.slice(0, end);

    const lines = body
      .split(/\r?\n/)
      .filter((line) => /^\s*[*#]/.test(line))
      .map((line) => cleanWikitext(line.replace(/^\s*[*#:]+\s*/, "")))
      .filter((line) => line.length > 2);

    if (lines.length) return lines;
  }
  return [];
}

function summaryField(text: string, field: string): string | null {
  const summary = text.match(/\{\{recipesummary([\s\S]*?)\}\}/i);
  if (!summary) return null;
  const value = summary[1].match(new RegExp(`\\|\\s*${field}\\s*=\\s*([^|\\n}]+)`, "i"));
  return value ? cleanWikitext(value[1]).trim() || null : null;
}

const CATEGORY_WORDS: Array<[RegExp, string]> = [
  [/dessert|cake|cookie|pudding|pie|sweet/i, "dessert"],
  [/breakfast|pancake|porridge/i, "breakfast"],
  [/salad|side|sauce|condiment|dressing/i, "side"],
  [/snack|appetizer|appetiser|starter/i, "snack"],
  [/soup|sandwich|lunch/i, "lunch"],
  [/drink|beverage|cocktail|\btea\b|coffee|smoothie|juice/i, "drink"],
];

/**
 * MediaWiki continues the innermost query first: a page with more categories
 * than fit comes back in pieces, and only `batchcomplete` says the batch is
 * whole. Yielding before then would mean half a category list, and a Thai curry
 * filed as no cuisine at all.
 */
async function* batches(): AsyncGenerator<Gathered[]> {
  let carry: Record<string, string> = {};
  let gathered = new Map<number, Gathered>();

  for (;;) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      generator: "categorymembers",
      gcmtitle: "Category:Recipes",
      gcmnamespace: "102",
      gcmlimit: String(BATCH),
      prop: "revisions|categories",
      rvprop: "content",
      rvslots: "main",
      cllimit: "max",
      ...carry,
    });

    const answer = await getJson<Answer>(`${API}?${params.toString()}`);
    await pause(800);

    for (const page of answer.query?.pages ?? []) {
      const existing = gathered.get(page.pageid);
      const categories = (page.categories ?? []).map((row) => row.title);

      if (existing) {
        existing.categories.push(...categories);
        continue;
      }

      gathered.set(page.pageid, {
        pageid: page.pageid,
        title: page.title,
        wikitext: page.revisions?.[0]?.slots?.main?.content ?? "",
        categories,
      });
    }

    if (answer.batchcomplete) {
      yield [...gathered.values()];
      gathered = new Map();

      const next = answer.continue?.gcmcontinue;
      if (!next) return;
      carry = { gcmcontinue: next };
      continue;
    }

    if (!answer.continue) return;
    carry = { ...answer.continue };
  }
}

export const wikibooks: SeedSource = {
  name: "wikibooks",
  label: "Wikibooks Cookbook",
  license: "CC BY-SA 3.0 — every recipe keeps a link back to its page",

  async *list({ limit }) {
    let sent = 0;

    for await (const pages of batches()) {
      for (const page of pages) {
        if (!page.wikitext) continue;

        const ingredientLines = section(page.wikitext, ["Ingredients", "Ingredient"]);
        const instructions = section(page.wikitext, [
          "Procedure", "Directions", "Method", "Preparation", "Instructions", "Steps",
        ]);
        if (!ingredientLines.length || !instructions.length) continue;

        const title = page.title.replace(/^Cookbook:\s*/, "").trim();
        const { cuisine, also } = cuisineFromCategories(page.categories);
        const summaryCategory = summaryField(page.wikitext, "category") ?? "";

        const category =
          courseFromCategories(page.categories) ??
          CATEGORY_WORDS.find(([pattern]) => pattern.test(`${summaryCategory} ${title}`))?.[1] ??
          "dinner";

        const time = summaryField(page.wikitext, "time");
        const minutes = time?.match(/(\d+)\s*(hour|hr|minute|min)/i);

        yield {
          sourceId: String(page.pageid),
          title,
          sourceUrl: `https://en.wikibooks.org/wiki/${encodeURIComponent(page.title)}`,
          servingsText: summaryField(page.wikitext, "servings"),
          totalMinutes: minutes
            ? Number(minutes[1]) * (/hour|hr/i.test(minutes[2]) ? 60 : 1)
            : null,
          cuisine,
          category,
          effort: effortFromCategories(page.categories),
          tags: [
            ...also.map((name) => name.toLowerCase()),
            ...(summaryCategory ? [summaryCategory.toLowerCase().replace(/ recipes?$/, "")] : []),
          ],
          ingredientLines,
          instructions,
        } satisfies SeedRecipe;

        sent += 1;
        if (limit && sent >= limit) return;
      }
    }
  },
};
