import { getJson, pause } from "../cache";
import type { SeedRecipe, SeedSource } from "../types";

const API = "https://en.wikibooks.org/w/api.php";
const BATCH = 40;

type Page = { pageid: number; title: string; revisions?: Array<{ slots: { main: { content: string } } }> };
type Answer = {
  batchcomplete?: unknown;
  continue?: { gcmcontinue?: string; continue?: string };
  query?: { pages?: Page[] };
};

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

export const wikibooks: SeedSource = {
  name: "wikibooks",
  label: "Wikibooks Cookbook",
  license: "CC BY-SA 3.0 — every recipe keeps a link back to its page",

  async *list({ limit }) {
    let cursor: string | undefined;
    let sent = 0;

    do {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        generator: "categorymembers",
        gcmtitle: "Category:Recipes",
        gcmnamespace: "102",
        gcmlimit: String(BATCH),
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
      });
      if (cursor) params.set("gcmcontinue", cursor);

      const answer = await getJson<Answer>(`${API}?${params.toString()}`);
      await pause(800);

      for (const page of answer.query?.pages ?? []) {
        const wikitext = page.revisions?.[0]?.slots?.main?.content;
        if (!wikitext) continue;

        const ingredientLines = section(wikitext, ["Ingredients", "Ingredient"]);
        const instructions = section(wikitext, [
          "Procedure", "Directions", "Method", "Preparation", "Instructions", "Steps",
        ]);
        if (!ingredientLines.length || !instructions.length) continue;

        const title = page.title.replace(/^Cookbook:\s*/, "").trim();
        const categoryHint = summaryField(wikitext, "category") ?? "";
        const category =
          CATEGORY_WORDS.find(([pattern]) => pattern.test(`${categoryHint} ${title}`))?.[1] ??
          "dinner";

        const time = summaryField(wikitext, "time");
        const minutes = time?.match(/(\d+)\s*(hour|hr|minute|min)/i);

        yield {
          sourceId: String(page.pageid),
          title,
          sourceUrl: `https://en.wikibooks.org/wiki/${encodeURIComponent(page.title)}`,
          servingsText: summaryField(wikitext, "servings"),
          totalMinutes: minutes
            ? Number(minutes[1]) * (/hour|hr/i.test(minutes[2]) ? 60 : 1)
            : null,
          category,
          tags: categoryHint ? [categoryHint.toLowerCase().replace(/ recipes?$/, "")] : [],
          ingredientLines,
          instructions,
        } satisfies SeedRecipe;

        sent += 1;
        if (limit && sent >= limit) return;
      }

      cursor = answer.continue?.gcmcontinue;
    } while (cursor);
  },
};
