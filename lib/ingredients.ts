import { parseMeasure } from "./units";

export type Aisle =
  | "produce"
  | "meat"
  | "seafood"
  | "dairy"
  | "bakery"
  | "pantry"
  | "spices"
  | "frozen"
  | "drinks"
  | "household"
  | "other";

export const AISLE_ORDER: Aisle[] = [
  "produce", "meat", "seafood", "dairy", "bakery",
  "pantry", "spices", "frozen", "drinks", "household", "other",
];

export const AISLE_LABEL: Record<Aisle, string> = {
  produce: "Produce",
  meat: "Meat",
  seafood: "Fish",
  dairy: "Dairy & eggs",
  bakery: "Bakery",
  pantry: "Pantry",
  spices: "Spices",
  frozen: "Frozen",
  drinks: "Drinks",
  household: "Household",
  other: "Everything else",
};

const DESCRIPTORS = new Set([
  "fresh", "freshly", "frozen", "dried", "dry", "ground", "whole", "half", "halved",
  "chopped", "finely", "coarsely", "roughly", "thinly", "thickly", "sliced", "diced",
  "minced", "grated", "shredded", "crushed", "peeled", "seeded", "deseeded", "cored",
  "trimmed", "rinsed", "drained", "washed", "cooked", "raw", "uncooked", "boiled",
  "roasted", "toasted", "smoked", "cured", "canned", "tinned", "jarred", "bottled",
  "large", "medium", "small", "extra", "jumbo", "baby", "mini", "ripe", "unripe",
  "organic", "free", "range", "grass", "fed", "boneless", "skinless", "bone", "in",
  "skin", "on", "off", "lean", "low", "fat", "reduced", "light", "full", "unsalted",
  "salted", "sweetened", "unsweetened", "plain", "pure", "good", "quality", "best",
  "room", "temperature", "cold", "warm", "hot", "softened", "melted", "beaten",
  "optional", "plus", "more", "taste", "needed", "serving", "garnish", "divided",
  "such", "as", "or", "and", "of", "to", "for", "the", "a", "an", "your", "any",
  "cut", "into", "wedges", "chunks", "strips", "pieces", "cubes", "matchsticks",
  "about", "approximately", "roughly", "packed", "level", "heaped", "heaping",
  "store", "bought", "homemade", "leftover", "day", "old", "stale", "thawed",
]);

const SYNONYMS: Record<string, string> = {
  "aubergine": "eggplant",
  "courgette": "zucchini",
  "coriander": "cilantro",
  "coriander leaf": "cilantro",
  "rocket": "arugula",
  "spring onion": "green onion",
  "scallion": "green onion",
  "salad onion": "green onion",
  "beetroot": "beet",
  "swede": "rutabaga",
  "mangetout": "snow pea",
  "chickpea": "chickpea",
  "garbanzo bean": "chickpea",
  "chick pea": "chickpea",
  "haricot bean": "navy bean",
  "broad bean": "fava bean",
  "sultana": "raisin",
  "caster sugar": "sugar",
  "granulated sugar": "sugar",
  "icing sugar": "powdered sugar",
  "confectioner sugar": "powdered sugar",
  "plain flour": "flour",
  "all purpose flour": "flour",
  "all-purpose flour": "flour",
  "self raising flour": "self rising flour",
  "cornflour": "cornstarch",
  "corn flour": "cornstarch",
  "bicarbonate soda": "baking soda",
  "bicarb": "baking soda",
  "double cream": "heavy cream",
  "heavy whipping cream": "heavy cream",
  "single cream": "light cream",
  "soured cream": "sour cream",
  "natural yogurt": "yogurt",
  "yoghurt": "yogurt",
  "greek yoghurt": "greek yogurt",
  "creme fraiche": "creme fraiche",
  "mince": "ground beef",
  "beef mince": "ground beef",
  "minced beef": "ground beef",
  "pork mince": "ground pork",
  "lamb mince": "ground lamb",
  "chicken mince": "ground chicken",
  "streaky bacon": "bacon",
  "back bacon": "bacon",
  "gammon": "ham",
  "prawn": "shrimp",
  "king prawn": "shrimp",
  "tiger prawn": "shrimp",
  "langoustine": "shrimp",
  "sweetcorn": "corn",
  "tomato puree": "tomato paste",
  "passata": "tomato sauce",
  "chopped tomato": "canned tomato",
  "plum tomato": "tomato",
  "cherry tomato": "cherry tomato",
  "stock cube": "stock",
  "bouillon": "stock",
  "broth": "stock",
  "chicken stock cube": "chicken stock",
  "vegetable stock cube": "vegetable stock",
  "rapeseed oil": "canola oil",
  "sunflower oil": "vegetable oil",
  "groundnut oil": "peanut oil",
  "extra virgin olive oil": "olive oil",
  "chilli": "chili",
  "chilli flake": "chili flake",
  "red pepper flake": "chili flake",
  "chile": "chili",
  "capsicum": "bell pepper",
  "pepper red": "bell pepper",
  "pepper green": "bell pepper",
  "spring green": "collard green",
  "cos lettuce": "romaine lettuce",
  "little gem": "romaine lettuce",
  "clingfilm": "plastic wrap",
  "kitchen paper": "paper towel",
  "prawn cracker": "shrimp cracker",
  "linguine": "pasta",
  "spaghetti": "pasta",
  "penne": "pasta",
  "fusilli": "pasta",
  "rigatoni": "pasta",
  "tagliatelle": "pasta",
  "macaroni": "pasta",
  "noodle": "noodle",
  "egg noodle": "noodle",
  "rice noodle": "noodle",
};

const AISLE_RULES: Array<[Aisle, RegExp]> = [
  ["produce", /\b(lettuce|spinach|kale|arugula|chard|cabbage|broccoli|cauliflower|carrot|celery|onion|shallot|leek|garlic|ginger|potato|yam|sweet potato|tomato|cucumber|zucchini|squash|pumpkin|eggplant|bell pepper|chili|jalapeno|mushroom|corn|pea|green bean|asparagus|beet|radish|turnip|rutabaga|parsnip|fennel|avocado|apple|banana|orange|lemon|lime|grape|berry|berries|strawberr|blueberr|raspberr|melon|mango|pineapple|peach|pear|plum|cherry|apricot|fig|date|pomegranate|herb|parsley|cilantro|basil|mint|dill|thyme|rosemary|sage|tarragon|chive|scallion|green onion|sprout|lettuce|romaine|endive|watercress|bok choy|snow pea|snap pea|okra|artichoke|olive)\b/],
  ["meat",    /\b(chicken|beef|steak|pork|lamb|veal|turkey|duck|bacon|sausage|ham|prosciutto|chorizo|salami|pepperoni|mince|brisket|ribs?|tenderloin|sirloin|chuck|thigh|drumstick|breast|ground (beef|pork|lamb|turkey|chicken))\b/],
  ["seafood", /\b(salmon|tuna|cod|halibut|haddock|tilapia|trout|bass|snapper|sardine|anchovy|mackerel|shrimp|prawn|crab|lobster|scallop|mussel|clam|oyster|squid|calamari|octopus|fish)\b/],
  ["dairy",   /\b(milk|cream|butter|cheese|cheddar|mozzarella|parmesan|feta|ricotta|gouda|brie|gruyere|yogurt|yoghurt|kefir|egg|eggs|buttermilk|creme fraiche|mascarpone|cottage cheese|half and half)\b/],
  ["bakery",  /\b(bread|baguette|roll|bun|bagel|tortilla|pita|naan|croissant|brioche|sourdough|focaccia|crumpet|muffin|pastry|puff pastry|filo|phyllo|pizza dough|cake)\b/],
  ["spices",  /\b(bay leaf|salt|pepper|paprika|cumin|coriander seed|turmeric|cinnamon|nutmeg|clove|cardamom|allspice|bay leaf|oregano|marjoram|curry powder|garam masala|chili powder|chili flake|cayenne|saffron|vanilla|star anise|fennel seed|mustard seed|sesame seed|peppercorn|za.?atar|sumac|five spice|italian seasoning|herbes de provence|seasoning|spice)\b/],
  ["frozen",  /\b(frozen|ice cream|sorbet|frozen pea|puff pastry sheet)\b/],
  ["drinks",  /\b(wine|beer|cider|vodka|rum|whisk|brandy|sherry|vermouth|juice|soda|cola|coffee|tea|sparkling water|tonic)\b/],
  ["household", /\b(paper towel|plastic wrap|foil|parchment|dish soap|detergent|sponge|trash bag|napkin|toilet paper)\b/],
  ["pantry",  /\b(miso|mirin|granola|water|gochujang|curry paste|harissa|capers|worcestershire|flour|sugar|rice|pasta|noodle|oat|quinoa|couscous|barley|lentil|bean|chickpea|stock|oil|vinegar|soy sauce|fish sauce|hoisin|sriracha|ketchup|mustard|mayonnaise|honey|syrup|molasses|jam|peanut butter|tahini|coconut milk|canned|tin|tomato paste|tomato sauce|breadcrumb|cornstarch|baking powder|baking soda|yeast|chocolate|cocoa|nut|almond|walnut|pecan|cashew|pistachio|raisin|seed|gelatin|broth)\b/],
];

export const STAPLES = new Set([
  "salt", "pepper", "black pepper", "water", "ice", "olive oil", "vegetable oil",
  "canola oil", "cooking spray", "sugar", "flour", "baking powder", "baking soda",
]);

const MEAT = /\b(chicken|beef|steak|pork|lamb|veal|turkey|duck|bacon|sausage|ham|prosciutto|chorizo|salami|pepperoni|gelatin|lard|brisket|venison|rabbit)\b/;
const PORK = /\b(pork|bacon|ham|prosciutto|chorizo|salami|pepperoni|pancetta|lard|gammon)\b/;
const FISH = /\b(salmon|tuna|cod|halibut|haddock|tilapia|trout|bass|snapper|sardine|anchovy|mackerel|shrimp|prawn|crab|lobster|scallop|mussel|clam|oyster|squid|calamari|octopus|fish sauce|fish|worcestershire)\b/;
const DAIRY = /\b(milk|cream|butter|cheese|cheddar|mozzarella|parmesan|feta|ricotta|gouda|brie|gruyere|yogurt|yoghurt|kefir|buttermilk|creme fraiche|mascarpone|ghee)\b/;
const GLUTEN = /\b(flour|bread|pasta|noodle|couscous|barley|rye|semolina|breadcrumb|cracker|tortilla|pita|naan|soy sauce|beer|puff pastry|filo|phyllo|cake|biscuit|wheat|farro|bulgur)\b/;
const NUTS = /\b(almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia|peanut|nut butter|praline|marzipan)\b/;
const EGG = /\b(egg|eggs|mayonnaise|meringue|aioli)\b/;

export type DietFlag =
  | "vegetarian" | "vegan" | "pescatarian"
  | "gluten_free" | "dairy_free" | "pork_free" | "nut_free" | "egg_free";

export const DIET_LABEL: Record<DietFlag, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  pork_free: "No pork",
  nut_free: "Nut allergy",
  egg_free: "No eggs",
};

const VES_PLURALS = new Set([
  "leaves", "loaves", "halves", "knives", "shelves", "wolves", "calves", "hooves", "thieves",
]);

export function itemKey(name: string): string {
  let text = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/,.*$/, " ")
    .replace(/-/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = text
    .split(" ")
    .filter((w) => w.length > 1 && !DESCRIPTORS.has(w));

  text = words.join(" ").trim();
  if (!text) text = name.toLowerCase().trim();

  text = text
    .split(" ")
    .map((word) => {
      if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
      if (VES_PLURALS.has(word)) return word.slice(0, -3) + "f";
      if (word.endsWith("ses") || word.endsWith("hes") || word.endsWith("xes")) return word.slice(0, -2);
      if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
      if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && word.length > 3) {
        return word.slice(0, -1);
      }
      return word;
    })
    .join(" ");

  return SYNONYMS[text] ?? text;
}

export function aisleFor(key: string): Aisle {
  for (const [aisle, pattern] of AISLE_RULES) {
    if (pattern.test(key)) return aisle;
  }
  return "other";
}

export function isStaple(key: string): boolean {
  return STAPLES.has(key);
}

export function dietFlagsFor(keys: string[]): DietFlag[] {
  const all = keys.join(" | ");
  const flags: DietFlag[] = [];

  const hasMeat = MEAT.test(all);
  const hasFish = FISH.test(all);
  const hasDairy = DAIRY.test(all);
  const hasEgg = EGG.test(all);

  if (!hasMeat && !hasFish) flags.push("vegetarian");
  if (!hasMeat && !hasFish && !hasDairy && !hasEgg && !/honey/.test(all)) flags.push("vegan");
  if (!hasMeat) flags.push("pescatarian");
  if (!GLUTEN.test(all)) flags.push("gluten_free");
  if (!hasDairy) flags.push("dairy_free");
  if (!PORK.test(all)) flags.push("pork_free");
  if (!NUTS.test(all)) flags.push("nut_free");
  if (!hasEgg) flags.push("egg_free");

  return flags;
}

export type ParsedIngredient = {
  position: number;
  raw_text: string;
  quantity: number | null;
  unit: string | null;
  item: string;
  item_key: string;
  note: string | null;
  aisle: Aisle;
  optional: boolean;
};

export function parseIngredient(
  measure: string | null | undefined,
  name: string,
  position: number,
): ParsedIngredient | null {
  const cleanName = name?.trim();
  if (!cleanName) return null;

  const { quantity, unit, note } = parseMeasure(measure);
  const key = itemKey(cleanName);
  if (!key) return null;

  const [baseName, ...preparation] = cleanName.split(",");
  const prep = preparation.join(",").trim();

  const optional = /optional|to taste|for (serving|garnish)/i.test(
    `${measure ?? ""} ${cleanName}`,
  );

  return {
    position,
    raw_text: [measure?.trim(), cleanName].filter(Boolean).join(" ").trim(),
    quantity,
    unit,
    item: titleCase(baseName.trim() || cleanName),
    item_key: key,
    note: prep || note,
    aisle: aisleFor(key),
    optional,
  };
}

export function parseIngredientLine(line: string, position: number): ParsedIngredient | null {
  const text = line.trim();
  if (!text) return null;

  const match = text.match(
    /^((?:\d+[\s\-\/¼½¾⅓⅔⅛⅜⅝⅞.]*)+\s*[a-zA-Z.]*\s*)(.*)$/,
  );

  if (match && match[2].trim()) {
    return parseIngredient(match[1], match[2], position);
  }
  return parseIngredient(null, text, position);
}

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function ingredientOverlap(a: string[], b: string[]): number {
  const setA = new Set(a.filter((k) => !isStaple(k)));
  const setB = new Set(b.filter((k) => !isStaple(k)));
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const key of setA) if (setB.has(key)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}
