import { parse, type HTMLElement } from "node-html-parser";

/** What a page gave up, before any of it is believed. */
export type RawRecipe = {
  title: string | null;
  description: string | null;
  image: string | null;
  yieldText: string | null;
  totalTime: string | null;
  cookTime: string | null;
  prepTime: string | null;
  cuisine: string | null;
  category: string | null;
  keywords: string[];
  ingredients: string[];
  instructions: string[];
  author: string | null;
  strategy: "json-ld" | "microdata" | "heuristic" | "pasted";
};

type Json = Record<string, unknown>;

const asText = (value: unknown): string | null => {
  if (typeof value === "string") return clean(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const first = value.map(asText).filter(Boolean);
    return first.length ? first.join(", ") : null;
  }
  if (value && typeof value === "object") {
    const node = value as Json;
    return asText(node.name ?? node.text ?? node["@value"] ?? node.url);
  }
  return null;
};

function clean(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  frac12: "½", frac14: "¼", frac34: "¾", frac13: "⅓", frac23: "⅔",
  deg: "°", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z][a-z0-9]*);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole);
}

const listOf = (value: unknown): string[] => {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map(asText).filter((line): line is string => Boolean(line && line.length > 1));
};

/** Instructions arrive as prose, as steps, or as sections holding steps. */
function flattenInstructions(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === "string") {
    const text = clean(value);
    if (!text) return [];
    return text.length > 200
      ? text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter((s) => s.length > 2)
      : [text];
  }

  if (Array.isArray(value)) return value.flatMap(flattenInstructions);

  const node = value as Json;
  const type = String(node["@type"] ?? "");
  if (type.includes("HowToSection")) {
    const heading = asText(node.name);
    const steps = flattenInstructions(node.itemListElement ?? node.steps);
    return heading && steps.length ? [`${heading}:`, ...steps] : steps;
  }
  if (node.itemListElement) return flattenInstructions(node.itemListElement);

  const text = asText(node.text ?? node.name);
  return text && text.length > 2 ? [text] : [];
}

function everyNode(value: unknown, found: Json[] = []): Json[] {
  if (Array.isArray(value)) {
    for (const item of value) everyNode(item, found);
    return found;
  }
  if (value && typeof value === "object") {
    const node = value as Json;
    found.push(node);
    for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement"]) {
      if (node[key]) everyNode(node[key], found);
    }
    return found;
  }
  return found;
}

function isRecipeNode(node: Json): boolean {
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && t.toLowerCase().endsWith("recipe"));
}

function fromJsonLd(root: HTMLElement): RawRecipe | null {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    let payload: unknown;
    try {
      payload = JSON.parse(script.rawText.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "").trim());
    } catch {
      continue;
    }

    const node = everyNode(payload).find(isRecipeNode);
    if (!node) continue;

    const ingredients = listOf(node.recipeIngredient ?? node.ingredients);
    const instructions = flattenInstructions(node.recipeInstructions);
    if (!ingredients.length && !instructions.length) continue;

    return {
      title: asText(node.name ?? node.headline),
      description: asText(node.description),
      image: firstImage(node.image),
      yieldText: asText(node.recipeYield ?? node.yield),
      totalTime: asText(node.totalTime),
      cookTime: asText(node.cookTime),
      prepTime: asText(node.prepTime),
      cuisine: asText(node.recipeCuisine),
      category: asText(node.recipeCategory),
      keywords: splitKeywords(node.keywords),
      ingredients,
      instructions,
      author: asText(node.author),
      strategy: "json-ld",
    };
  }
  return null;
}

function firstImage(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstImage(item);
      if (found) return found;
    }
    return null;
  }
  const node = value as Json;
  return firstImage(node.url ?? node.contentUrl ?? node["@id"]);
}

function splitKeywords(value: unknown): string[] {
  const text = asText(value);
  if (!text) return [];
  return text
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 1 && word.length < 40)
    .slice(0, 12);
}

function fromMicrodata(root: HTMLElement): RawRecipe | null {
  const scope =
    root.querySelector('[itemtype*="schema.org/Recipe" i]') ??
    root.querySelector('[typeof*="Recipe" i]');
  if (!scope) return null;

  const prop = (name: string) =>
    scope.querySelectorAll(`[itemprop="${name}"], [property="${name}"]`);

  const valueOf = (node: HTMLElement): string =>
    clean(
      node.getAttribute("content") ??
        node.getAttribute("datetime") ??
        node.getAttribute("value") ??
        node.text,
    );

  const ingredients = [...prop("recipeIngredient"), ...prop("ingredients")]
    .map(valueOf)
    .filter((line) => line.length > 1);

  const instructions = prop("recipeInstructions")
    .flatMap((node) => {
      const steps = node.querySelectorAll("li, p");
      return steps.length ? steps.map(valueOf) : [valueOf(node)];
    })
    .filter((step) => step.length > 2);

  if (!ingredients.length && !instructions.length) return null;

  const one = (name: string) => {
    const node = prop(name)[0];
    return node ? valueOf(node) || null : null;
  };

  return {
    title: one("name") ?? clean(root.querySelector("h1")?.text ?? ""),
    description: one("description"),
    image: prop("image")[0]?.getAttribute("src") ?? prop("image")[0]?.getAttribute("content") ?? null,
    yieldText: one("recipeYield"),
    totalTime: one("totalTime"),
    cookTime: one("cookTime"),
    prepTime: one("prepTime"),
    cuisine: one("recipeCuisine"),
    category: one("recipeCategory"),
    keywords: splitKeywords(one("keywords")),
    ingredients,
    instructions,
    author: one("author"),
    strategy: "microdata",
  };
}

export const QUANTITY_HEAD = /^\s*(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞]|a |an |one |two |three |four |half )/i;

/**
 * Last resort, for pages with no structured data: the list whose items mostly
 * look like measurements is the ingredients, and the ordered list of sentences
 * is the method.
 */
function fromHeuristics(root: HTMLElement): RawRecipe | null {
  let best: { score: number; lines: string[] } | null = null;

  for (const list of root.querySelectorAll("ul, ol")) {
    const lines = list
      .querySelectorAll("li")
      .map((item) => clean(item.text))
      .filter((line) => line.length > 2 && line.length < 200);

    if (lines.length < 3) continue;
    const measured = lines.filter((line) => QUANTITY_HEAD.test(line)).length;
    const score = measured / lines.length;
    if (score < 0.5) continue;
    if (!best || score * lines.length > best.score * best.lines.length) {
      best = { score, lines };
    }
  }

  if (!best) return null;

  const steps = root
    .querySelectorAll("ol li, .instructions li, .directions li, [class*='instruction'] p")
    .map((node) => clean(node.text))
    .filter((line) => line.length > 40 && !best!.lines.includes(line))
    .slice(0, 40);

  return {
    title: clean(root.querySelector("h1")?.text ?? ""),
    description:
      root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? null,
    image: root.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null,
    yieldText: null,
    totalTime: null,
    cookTime: null,
    prepTime: null,
    cuisine: null,
    category: null,
    keywords: [],
    ingredients: best.lines,
    instructions: steps,
    author: null,
    strategy: "heuristic",
  };
}

export type Adapter = (root: HTMLElement, url: URL) => RawRecipe | null;

const ADAPTERS = new Map<string, Adapter>();

/** For sites whose markup lies. Empty until one earns its place. */
export function registerAdapter(hostname: string, adapter: Adapter) {
  ADAPTERS.set(hostname.replace(/^www\./, ""), adapter);
}

export function extractRecipe(html: string, pageUrl: string): RawRecipe | null {
  const root = parse(html, { blockTextElements: { script: true, style: false } });
  const url = new URL(pageUrl);

  const adapter = ADAPTERS.get(url.hostname.replace(/^www\./, ""));
  const found =
    (adapter ? adapter(root, url) : null) ??
    fromJsonLd(root) ??
    fromMicrodata(root) ??
    fromHeuristics(root);

  if (!found) return null;
  if (!found.title) found.title = clean(root.querySelector("h1")?.text ?? "") || null;
  return found;
}

/** Handed back when nothing structured turns up, so the paste box isn't empty. */
export function readableLines(html: string): string[] {
  const root = parse(html);
  for (const node of root.querySelectorAll("script, style, nav, header, footer")) node.remove();
  return clean(root.text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 3)
    .slice(0, 200);
}
