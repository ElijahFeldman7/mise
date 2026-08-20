/**
 * Reading a supermarket receipt.
 *
 * OCR runs on the phone (Tesseract, in a worker) and hands us a wall of text.
 * This module turns that into item lines, and then decides which grocery-list
 * row each one is. Confident matches tick themselves off; everything in the
 * middle asks the shopper, because a list that silently ticks the wrong thing
 * is worse than one that asks.
 */

import { itemKey } from "./ingredients";

export type ParsedReceiptLine = {
  raw: string;
  name: string;
  price: number | null;
};

export type LineMatch = {
  line: ParsedReceiptLine;
  itemId: string | null;
  itemName: string | null;
  confidence: number;
  status: "auto" | "suggested" | "unmatched";
};

/** Anything that is not something you bought. */
const NOISE = [
  /^\s*$/,
  /\b(sub)?total\b/i,
  /\btax\b/i,
  /\bchange\b/i,
  /\bcash\b/i,
  /\btender\b/i,
  /\bbalance\b/i,
  /\bdebit\b|\bcredit\b|\bvisa\b|\bmastercard\b|\bamex\b|\bdiscover\b/i,
  /\bthank you\b|\bthanks\b/i,
  /\bcustomer\b|\bcashier\b|\bstore\b|\breg(ister)?\s*#/i,
  /\bsavings?\b|\byou saved\b|\bcoupon\b|\bdiscount\b/i,
  /\bmember\b|\brewards?\b|\bpoints?\b|\bloyalty\b/i,
  /\breturn\b|\brefund\b|\bpolicy\b|\breceipt\b/i,
  /\bitems? sold\b|\bqty\b\s*$/i,
  /^\s*[\d\s\-().]+$/,                       // a phone number or a bare code
  /^\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,   // a date
  /^\s*[*=~_\-—]{3,}\s*$/,                   // a rule of asterisks
  /\bwww\.|\.com\b|\bhttp/i,
  /\bopen\b.*\b(am|pm)\b/i,
  /^\s*(visa|mc)\s/i,
];

/** Receipt-speak. Left side matches whole tokens, case-insensitively. */
const ABBREVIATIONS: Record<string, string> = {
  chkn: "chicken", chk: "chicken", chick: "chicken",
  thgh: "thigh", thghs: "thighs", brst: "breast", bnls: "boneless",
  bnin: "bone in", "bn-in": "bone in", sknls: "skinless",
  grnd: "ground", gr: "ground", grd: "ground",
  bf: "beef", prk: "pork", trky: "turkey",
  whl: "whole", wht: "white", wh: "whole",
  mlk: "milk", chz: "cheese", chse: "cheese", ched: "cheddar", mozz: "mozzarella",
  yog: "yogurt", ygrt: "yogurt", crm: "cream", buttr: "butter", btr: "butter",
  egg: "eggs", lrg: "large", md: "medium", sm: "small", xl: "large",
  org: "organic", orgnc: "organic", nat: "natural",
  veg: "vegetable", vegs: "vegetables", frsh: "fresh", frz: "frozen", frzn: "frozen",
  tom: "tomato", toms: "tomatoes", pot: "potato", pots: "potatoes",
  onn: "onion", onions: "onion", ylw: "yellow", grn: "green", rd: "red",
  ppr: "paper", pepr: "pepper", bell: "bell", jal: "jalapeno",
  brc: "broccoli", cauli: "cauliflower", spin: "spinach", let: "lettuce",
  carr: "carrot", cel: "celery", cuke: "cucumber", zuc: "zucchini",
  mush: "mushroom", mshrm: "mushroom", garl: "garlic", gng: "ginger",
  ban: "banana", bans: "bananas", appl: "apple", strwb: "strawberry",
  bluebry: "blueberry", rasp: "raspberry", avo: "avocado", avoc: "avocado",
  lem: "lemon", lim: "lime", ornge: "orange",
  brd: "bread", bgl: "bagel", tort: "tortilla", tortlla: "tortilla",
  past: "pasta", spag: "spaghetti", ric: "rice", noodl: "noodle",
  olv: "olive", ol: "oil", vin: "vinegar", sce: "sauce", sc: "sauce",
  bns: "beans", bn: "bean", chkpea: "chickpea", lentl: "lentil",
  slmn: "salmon", shrmp: "shrimp", tilap: "tilapia",
  twl: "towel", tp: "toilet paper",
  cofe: "coffee", cof: "coffee", jce: "juice",
  swt: "sweet", unslt: "unsalted", slt: "salt", pep: "pepper",
  cnd: "canned", cn: "can", pkg: "package", ct: "count", pk: "pack",
};

/** Store-brand prefixes that say nothing about what the thing is. */
const BRAND_NOISE = new Set([
  "gv", "gm", "sb", "kr", "hy", "wf", "tj", "aldi", "great", "value",
  "kirkland", "signature", "market", "pantry", "essential", "everyday",
  "simply", "nature", "365", "store", "brand", "private", "selection",
]);

export function splitReceiptLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function parseReceiptLine(
  raw: string,
  context?: { index?: number; store?: string | null },
): ParsedReceiptLine | null {
  const line = raw.trim();
  if (!line) return null;
  for (const pattern of NOISE) if (pattern.test(line)) return null;

  // The masthead at the top of the receipt is the shop, not the shopping.
  if (context?.store && context.index !== undefined && context.index < 5) {
    const bare = (text: string) => text.toLowerCase().replace(/[^a-z ]/g, "").trim();
    if (bare(line) === bare(context.store)) return null;
  }

  let text = line;

  // Trailing price and any tax flag: "... 3.99 F"
  let price: number | null = null;
  const priceMatch = text.match(/(-?\d+[.,]\d{2})\s*[A-Z]{0,2}\s*$/);
  if (priceMatch) {
    price = Number(priceMatch[1].replace(",", "."));
    text = text.slice(0, priceMatch.index).trim();
  }

  // Weight lines: "1.23 lb @ $2.99/lb"
  if (/@/.test(text) && /\/\s*(lb|kg|oz|ea)/i.test(text)) return null;

  // Leading PLU or UPC
  text = text.replace(/^\d{4,}\s+/, "");
  // Trailing size codes: "10Z", "16OZ", "1G", "6RL", "2PK"
  text = text.replace(/\b\d+\s*(z|oz|lb|g|kg|ml|l|ct|pk|rl|gal|qt)\b\.?/gi, " ");
  // Leftover standalone digits
  text = text.replace(/\b\d+\b/g, " ");
  text = text.replace(/[^A-Za-z\s'&-]/g, " ").replace(/\s+/g, " ").trim();

  if (text.length < 3) return null;

  const name = expandAbbreviations(text);
  if (!name) return null;

  return { raw: line, name, price };
}

/** Fixes that only make sense once neighbouring words are known. */
const PHRASE_FIXES: Array<[RegExp, string]> = [
  [/\bpepper towel\b/g, "paper towel"],
  [/\bpaper mill\b/g, "pepper mill"],
  [/\bpaper flake\b/g, "pepper flake"],
  [/\bblack paper\b/g, "black pepper"],
];

export function expandAbbreviations(text: string): string {
  const words = text.toLowerCase().split(/[\s-]+/).filter(Boolean);
  const out: string[] = [];

  for (const word of words) {
    if (BRAND_NOISE.has(word)) continue;
    out.push(ABBREVIATIONS[word] ?? word);
  }

  let joined = out.join(" ").replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of PHRASE_FIXES) joined = joined.replace(pattern, replacement);
  return joined;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function bigrams(text: string): Set<string> {
  const padded = ` ${text.replace(/\s+/g, " ").trim()} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 1; i += 1) grams.add(padded.slice(i, i + 2));
  return grams;
}

/** Sørensen–Dice on character bigrams — forgiving about OCR slips. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  let shared = 0;
  for (const gram of gramsA) if (gramsB.has(gram)) shared += 1;
  return (2 * shared) / (gramsA.size + gramsB.size);
}

/** Does every word of the shorter name appear in the longer one? */
function containment(a: string, b: string): number {
  const wordsA = a.split(" ").filter((w) => w.length > 2);
  const wordsB = new Set(b.split(" ").filter((w) => w.length > 2));
  if (!wordsA.length || !wordsB.size) return 0;
  const hits = wordsA.filter((word) => wordsB.has(word)).length;
  return hits / Math.min(wordsA.length, wordsB.size);
}

const AUTO_THRESHOLD = 0.72;
const SUGGEST_THRESHOLD = 0.44;

export type MatchTarget = { id: string; item: string; item_key: string; checked: boolean };

export function matchReceiptLines(
  lines: ParsedReceiptLine[],
  targets: MatchTarget[],
): LineMatch[] {
  const open = targets.filter((target) => !target.checked);
  const claimed = new Set<string>();
  const matches: LineMatch[] = [];

  // Score everything first, then hand out targets best-first, so two similar
  // receipt lines cannot both claim the same row.
  const scored: Array<{ line: ParsedReceiptLine; target: MatchTarget; score: number }> = [];

  for (const line of lines) {
    const lineKey = itemKey(line.name);
    for (const target of open) {
      const byName = similarity(line.name, target.item.toLowerCase());
      const byKey = similarity(lineKey, target.item_key);
      const byWords = containment(target.item_key, line.name);
      const score = Math.max(byName, byKey, byWords * 0.95);
      if (score >= SUGGEST_THRESHOLD) scored.push({ line, target, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const matchedLines = new Set<ParsedReceiptLine>();

  for (const { line, target, score } of scored) {
    if (matchedLines.has(line) || claimed.has(target.id)) continue;
    matchedLines.add(line);
    claimed.add(target.id);
    matches.push({
      line,
      itemId: target.id,
      itemName: target.item,
      confidence: Math.round(score * 100) / 100,
      status: score >= AUTO_THRESHOLD ? "auto" : "suggested",
    });
  }

  for (const line of lines) {
    if (matchedLines.has(line)) continue;
    matches.push({ line, itemId: null, itemName: null, confidence: 0, status: "unmatched" });
  }

  // Keep receipt order so the review screen reads like the paper does.
  const order = new Map(lines.map((line, index) => [line, index]));
  matches.sort((a, b) => (order.get(a.line) ?? 0) - (order.get(b.line) ?? 0));
  return matches;
}

/** A best guess at which shop it was, from the top of the receipt. */
export function guessStore(rawText: string): string | null {
  const lines = splitReceiptLines(rawText).slice(0, 6);
  for (const line of lines) {
    const letters = line.replace(/[^A-Za-z ]/g, "").trim();
    if (letters.length >= 4 && letters.split(" ").length <= 4 && !/receipt|welcome/i.test(letters)) {
      return letters
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
  }
  return null;
}

/** A date from anywhere on the receipt. */
export function guessDate(rawText: string): string | null {
  const match = rawText.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (!match) return null;
  const [, a, b, c] = match;
  const year = c.length === 2 ? 2000 + Number(c) : Number(c);
  const month = Number(a);
  const day = Number(b);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
