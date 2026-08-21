export type Dimension = "volume" | "weight" | "count";

type UnitDef = { dimension: Dimension; base: number; display: string };

const UNITS: Record<string, UnitDef> = {
  tsp:    { dimension: "volume", base: 1,        display: "tsp" },
  tbsp:   { dimension: "volume", base: 3,        display: "tbsp" },
  floz:   { dimension: "volume", base: 6,        display: "fl oz" },
  cup:    { dimension: "volume", base: 48,       display: "cup" },
  pint:   { dimension: "volume", base: 96,       display: "pint" },
  quart:  { dimension: "volume", base: 192,      display: "qt" },
  gallon: { dimension: "volume", base: 768,      display: "gal" },
  ml:     { dimension: "volume", base: 0.202884, display: "ml" },
  l:      { dimension: "volume", base: 202.884,  display: "L" },

  g:      { dimension: "weight", base: 1,        display: "g" },
  kg:     { dimension: "weight", base: 1000,     display: "kg" },
  oz:     { dimension: "weight", base: 28.3495,  display: "oz" },
  lb:     { dimension: "weight", base: 453.592,  display: "lb" },

  each:   { dimension: "count", base: 1, display: "" },
  clove:  { dimension: "count", base: 1, display: "clove" },
  head:   { dimension: "count", base: 1, display: "head" },
  bunch:  { dimension: "count", base: 1, display: "bunch" },
  can:    { dimension: "count", base: 1, display: "can" },
  jar:    { dimension: "count", base: 1, display: "jar" },
  package:{ dimension: "count", base: 1, display: "package" },
  slice:  { dimension: "count", base: 1, display: "slice" },
  sprig:  { dimension: "count", base: 1, display: "sprig" },
  stalk:  { dimension: "count", base: 1, display: "stalk" },
  handful:{ dimension: "count", base: 1, display: "handful" },
  pinch:  { dimension: "count", base: 1, display: "pinch" },
  dash:   { dimension: "count", base: 1, display: "dash" },
  loaf:   { dimension: "count", base: 1, display: "loaf" },
  sheet:  { dimension: "count", base: 1, display: "sheet" },
  ear:    { dimension: "count", base: 1, display: "ear" },
  fillet: { dimension: "count", base: 1, display: "fillet" },
  breast: { dimension: "count", base: 1, display: "breast" },
  thigh:  { dimension: "count", base: 1, display: "thigh" },
};

const ALIASES: Record<string, string> = {
  teaspoon: "tsp", teaspoons: "tsp", tsps: "tsp", t: "tsp",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsps: "tbsp", tbs: "tbsp", tb: "tbsp", T: "tbsp",
  "fluid ounce": "floz", "fluid ounces": "floz", "fl. oz": "floz", "fl oz": "floz", floz: "floz",
  cups: "cup", c: "cup",
  pints: "pint", pt: "pint",
  quarts: "quart", qt: "quart", qts: "quart",
  gallons: "gallon", gal: "gallon",
  millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml", mls: "ml", cc: "ml",
  litre: "l", litres: "l", liter: "l", liters: "l", ltr: "l",
  gram: "g", grams: "g", gr: "g", gs: "g", grammes: "g", gramme: "g",
  kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg", kgs: "kg",
  ounce: "oz", ounces: "oz", ozs: "oz",
  pound: "lb", pounds: "lb", lbs: "lb", "#": "lb",
  cloves: "clove",
  heads: "head",
  bunches: "bunch",
  cans: "can", tin: "can", tins: "can",
  jars: "jar",
  packages: "package", pkg: "package", pack: "package", packs: "package", packet: "package", packets: "package",
  slices: "slice",
  sprigs: "sprig",
  stalks: "stalk", stick: "stalk", sticks: "stalk", rib: "stalk", ribs: "stalk",
  handfuls: "handful",
  pinches: "pinch",
  dashes: "dash", splash: "dash", splashes: "dash", drizzle: "dash", glug: "dash",
  loaves: "loaf",
  sheets: "sheet",
  ears: "ear",
  fillets: "fillet", filet: "fillet", filets: "fillet",
  breasts: "breast",
  thighs: "thigh",
  whole: "each", piece: "each", pieces: "each", large: "each", medium: "each", small: "each",
};

const VULGAR: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75,
  "⅐": 1 / 7, "⅑": 1 / 9, "⅒": 0.1,
  "⅓": 1 / 3, "⅔": 2 / 3,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/\.$/, "").replace(/\.$/, "");
  if (!cleaned) return null;
  if (UNITS[cleaned]) return cleaned;
  const alias = ALIASES[cleaned] ?? ALIASES[raw.trim()];
  if (alias) return alias;
  const singular = cleaned.replace(/s$/, "");
  if (UNITS[singular]) return singular;
  if (ALIASES[singular]) return ALIASES[singular];
  return null;
}

export function dimensionOf(unit: string | null): Dimension {
  if (!unit) return "count";
  return UNITS[unit]?.dimension ?? "count";
}

export function parseMeasure(measure: string | null | undefined): {
  quantity: number | null;
  unit: string | null;
  note: string | null;
} {
  if (!measure) return { quantity: null, unit: null, note: null };

  let text = measure.trim().toLowerCase();
  if (!text || text === "-") return { quantity: null, unit: null, note: null };

  if (/to taste|as needed|as required|optional|for serving|to serve|for garnish/.test(text)) {
    return { quantity: null, unit: null, note: "to taste" };
  }

  const parenthetical = text.match(/\(([^)]*)\)/)?.[1] ?? null;
  text = text.replace(/\([^)]*\)/g, " ").trim();

  for (const [glyph, value] of Object.entries(VULGAR)) {
    if (text.includes(glyph)) {
      text = text.replace(new RegExp(`(\\d+)\\s*${glyph}`, "g"), (_m, whole) =>
        String(Number(whole) + value),
      );
      text = text.replaceAll(glyph, String(value));
    }
  }

  text = text.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, (_m, w, n, d) =>
    String(Number(w) + Number(n) / Number(d)),
  );
  text = text.replace(/(\d+)\s*\/\s*(\d+)/g, (_m, n, d) => String(Number(n) / Number(d)));

  text = text.replace(/(\d*\.?\d+)\s*(?:-|–|to)\s*(\d*\.?\d+)/g, (_m, a, b) =>
    String((Number(a) + Number(b)) / 2),
  );

  const match = text.match(/^\s*(\d*\.?\d+)\s*(.*)$/);
  if (!match) {
    const bareUnit = normalizeUnit(text);
    if (bareUnit) return { quantity: 1, unit: bareUnit, note: null };
    return { quantity: null, unit: null, note: text || null };
  }

  const quantity = Number(match[1]);
  const rest = match[2].trim();

  const glued = rest === "" ? text.match(/^\d*\.?\d+([a-z]+)$/)?.[1] : null;
  const unit = normalizeUnit(rest.split(/\s+/)[0] ?? glued ?? null) ?? normalizeUnit(glued);

  return {
    quantity: Number.isFinite(quantity) ? quantity : null,
    unit,
    note: parenthetical ? parenthetical.trim() : null,
  };
}

export function toBase(quantity: number, unit: string | null): number | null {
  if (!unit) return quantity;
  const def = UNITS[unit];
  if (!def) return null;
  return quantity * def.base;
}

const VOLUME_LADDER = ["gallon", "quart", "pint", "cup", "tbsp", "tsp"] as const;
const WEIGHT_LADDER = ["lb", "oz", "g"] as const;

export function fromBase(amount: number, dimension: Dimension, unitHint?: string | null): {
  quantity: number;
  unit: string | null;
} {
  if (dimension === "count") {
    return { quantity: round(amount), unit: unitHint && unitHint !== "each" ? unitHint : null };
  }

  if (unitHint === "ml" || unitHint === "l") {
    const ml = amount / UNITS.ml.base;
    return ml >= 1000 ? { quantity: round(ml / 1000), unit: "l" } : { quantity: round(ml), unit: "ml" };
  }
  if (unitHint === "g" || unitHint === "kg") {
    return amount >= 1000 ? { quantity: round(amount / 1000), unit: "kg" } : { quantity: round(amount), unit: "g" };
  }

  const ladder = dimension === "volume" ? VOLUME_LADDER : WEIGHT_LADDER;
  for (const unit of ladder) {
    const value = amount / UNITS[unit].base;
    if (value >= 1) return { quantity: round(value), unit };
  }
  const smallest = ladder[ladder.length - 1];
  return { quantity: round(amount / UNITS[smallest].base), unit: smallest };
}

function round(n: number): number {
  if (n >= 10) return Math.round(n);
  if (n >= 1) return Math.round(n * 4) / 4;
  return Math.round(n * 8) / 8;
}

const NICE_FRACTIONS: Array<[number, string]> = [
  [0.125, "⅛"], [0.25, "¼"], [0.333, "⅓"], [0.375, "⅜"], [0.5, "½"],
  [0.625, "⅝"], [0.667, "⅔"], [0.75, "¾"], [0.875, "⅞"],
];

export function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return "";
  const whole = Math.floor(quantity);
  const frac = quantity - whole;

  let number: string;
  if (frac < 0.05) {
    number = String(whole);
  } else {
    const nice = NICE_FRACTIONS.find(([value]) => Math.abs(value - frac) < 0.04);
    number = nice ? `${whole > 0 ? whole : ""}${nice[1]}` : String(Math.round(quantity * 100) / 100);
  }

  const display = unit ? (UNITS[unit]?.display ?? unit) : "";
  return display ? `${number} ${display}`.trim() : number;
}

export function mergeAmounts(
  parts: Array<{ quantity: number | null; unit: string | null }>,
): { quantity: number | null; unit: string | null; display: string } {
  const usable = parts.filter((p) => p.quantity !== null);
  if (usable.length === 0) return { quantity: null, unit: null, display: "" };

  const byDimension = new Map<Dimension, Array<{ quantity: number; unit: string | null }>>();
  for (const part of usable) {
    const dim = dimensionOf(part.unit);
    const bucket = byDimension.get(dim) ?? [];
    bucket.push({ quantity: part.quantity!, unit: part.unit });
    byDimension.set(dim, bucket);
  }

  const priority: Dimension[] = ["weight", "volume", "count"];
  const dominant = [...byDimension.keys()].sort((a, b) => {
    const sizeDiff = byDimension.get(b)!.length - byDimension.get(a)!.length;
    return sizeDiff !== 0 ? sizeDiff : priority.indexOf(a) - priority.indexOf(b);
  })[0];

  const main = byDimension.get(dominant)!;
  const hint = main.find((p) => p.unit)?.unit ?? null;

  let total = 0;
  const stragglers: string[] = [];
  for (const part of main) {
    const base = toBase(part.quantity, part.unit);
    if (base === null) stragglers.push(formatQuantity(part.quantity, part.unit));
    else total += base;
  }

  if (dominant === "count") {
    const groups = new Map<string, number>();
    for (const part of main) {
      const key = part.unit ?? "each";
      groups.set(key, (groups.get(key) ?? 0) + part.quantity);
    }
    const entries = [...groups.entries()].sort((a, b) => b[1] - a[1]);
    const [primaryUnit, primaryQty] = entries[0];
    const extras = entries.slice(1).map(([u, q]) => formatQuantity(q, u === "each" ? null : u));
    for (const [dim, bucket] of byDimension) {
      if (dim === dominant) continue;
      for (const part of bucket) extras.push(formatQuantity(part.quantity, part.unit));
    }
    const quantity = round(primaryQty);
    const unit = primaryUnit === "each" ? null : primaryUnit;
    return {
      quantity,
      unit,
      display: [formatQuantity(quantity, unit), ...extras].filter(Boolean).join(" + "),
    };
  }

  const merged = fromBase(total, dominant, hint);
  const extras = [...stragglers];
  for (const [dim, bucket] of byDimension) {
    if (dim === dominant) continue;
    for (const part of bucket) extras.push(formatQuantity(part.quantity, part.unit));
  }

  return {
    quantity: merged.quantity,
    unit: merged.unit,
    display: [formatQuantity(merged.quantity, merged.unit), ...extras].filter(Boolean).join(" + "),
  };
}

export function scaleAmount(quantity: number | null, factor: number): number | null {
  if (quantity === null) return null;
  return Math.round(quantity * factor * 100) / 100;
}
