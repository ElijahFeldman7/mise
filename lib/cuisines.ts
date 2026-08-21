/**
 * Cuisines are written down as adjectives — "French", not "France" — because a
 * filter row reads as a list of foods, not a list of passports. Sources disagree
 * about this constantly, so everything is normalised on the way in.
 */
export const CUISINES = [
  "Afghan", "Albanian", "Algerian", "American", "Argentine", "Armenian", "Australian",
  "Austrian", "Azerbaijani", "Bangladeshi", "Basque", "Belgian", "Bolivian", "Bosnian",
  "Brazilian", "British", "Bulgarian", "Burmese", "Cajun", "Cambodian", "Canadian",
  "Catalan", "Chilean", "Chinese", "Colombian", "Croatian", "Cuban", "Czech", "Danish",
  "Dutch", "Ecuadorian", "Egyptian", "English", "Estonian", "Ethiopian", "Filipino",
  "Finnish", "French", "Georgian", "German", "Ghanaian", "Greek", "Hawaiian", "Hungarian",
  "Icelandic", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian",
  "Jamaican", "Japanese", "Jordanian", "Kenyan", "Korean", "Lao", "Latvian", "Lebanese",
  "Libyan", "Lithuanian", "Malaysian", "Maltese", "Mexican", "Moroccan", "Nepalese",
  "Nigerian", "Norwegian", "Pakistani", "Palestinian", "Persian", "Peruvian", "Polish",
  "Portuguese", "Puerto Rican", "Romanian", "Russian", "Saudi", "Scottish", "Senegalese",
  "Serbian", "Sicilian", "Singaporean", "Slovak", "Slovenian", "Somali", "South African",
  "Spanish", "Sri Lankan", "Sudanese", "Swedish", "Swiss", "Syrian", "Taiwanese",
  "Tanzanian", "Thai", "Tibetan", "Tunisian", "Turkish", "Ukrainian", "Uruguayan",
  "Uzbek", "Venezuelan", "Vietnamese", "Welsh", "Yemeni",
];

/** Broad enough to be useful when nothing narrower is known. */
export const REGIONS = [
  "Southeast Asian", "Middle Eastern", "Latin American", "North African", "West African",
  "East African", "South Asian", "East Asian", "Central Asian", "Mediterranean",
  "Scandinavian", "Nordic", "Balkan", "Caribbean", "Creole", "European", "African",
  "Asian",
];

/** The places sources name instead of the cooking. */
const PLACES: Record<string, string> = {
  "united states": "American", usa: "American", us: "American", "u.s.": "American",
  america: "American", argentina: "Argentine", france: "French", italy: "Italian",
  spain: "Spanish", greece: "Greek", china: "Chinese", japan: "Japanese",
  thailand: "Thai", india: "Indian", mexico: "Mexican", vietnam: "Vietnamese",
  poland: "Polish", portugal: "Portuguese", morocco: "Moroccan", turkey: "Turkish",
  russia: "Russian", egypt: "Egyptian", ireland: "Irish", netherlands: "Dutch",
  holland: "Dutch", norway: "Norwegian", sweden: "Swedish", denmark: "Danish",
  finland: "Finnish", croatia: "Croatian", jamaica: "Jamaican", kenya: "Kenyan",
  malaysia: "Malaysian", philippines: "Filipino", canada: "Canadian",
  tunisia: "Tunisian", ukraine: "Ukrainian", uruguay: "Uruguayan", slovakia: "Slovak",
  venezuela: "Venezuelan", peru: "Peruvian", brazil: "Brazilian", germany: "German",
  britain: "British", uk: "British", "united kingdom": "British", england: "English",
  scotland: "Scottish", wales: "Welsh", lebanon: "Lebanese", israel: "Israeli",
  iran: "Iranian", iraq: "Iraqi", syria: "Syrian", "saudi arabia": "Saudi",
  "saudi arabian": "Saudi", nigeria: "Nigerian", ethiopia: "Ethiopian",
  indonesia: "Indonesian", korea: "Korean", "south korea": "Korean", taiwan: "Taiwanese",
  "sri lanka": "Sri Lankan", pakistan: "Pakistani", bangladesh: "Bangladeshi",
  hungary: "Hungarian", austria: "Austrian", switzerland: "Swiss", belgium: "Belgian",
  "czech republic": "Czech", czechia: "Czech", romania: "Romanian", bulgaria: "Bulgarian",
  serbia: "Serbian", cuba: "Cuban", colombia: "Colombian", chile: "Chilean",
  "south africa": "South African", ghana: "Ghanaian", senegal: "Senegalese",
  algeria: "Algerian", libya: "Libyan", sudan: "Sudanese", somalia: "Somali",
  yemen: "Yemeni", jordan: "Jordanian", palestine: "Palestinian", afghanistan: "Afghan",
  nepal: "Nepalese", myanmar: "Burmese", burma: "Burmese", cambodia: "Cambodian",
  laos: "Lao", singapore: "Singaporean", australia: "Australian",
  "new zealand": "New Zealand", uzbekistan: "Uzbek", georgia: "Georgian",
  armenia: "Armenian", azerbaijan: "Azerbaijani", albania: "Albanian",
  "bosnia and herzegovina": "Bosnian", slovenia: "Slovenian", estonia: "Estonian",
  latvia: "Latvian", lithuania: "Lithuanian", iceland: "Icelandic", malta: "Maltese",
  tanzania: "Tanzanian", tibet: "Tibetan", bolivia: "Bolivian", ecuador: "Ecuadorian",
  "puerto rico": "Puerto Rican",
};

const KNOWN = new Map(
  [...CUISINES, ...REGIONS].map((name) => [name.toLowerCase(), name]),
);

const NOTHING = new Set(["unknown", "other", "miscellaneous", "misc", "none", "n/a", "various"]);

/** "France" → "French", "united states" → "American", "Unknown" → nothing at all. */
export function normalizeCuisine(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim().replace(/\s+/g, " ").replace(/\.$/, "");
  if (!text || text.length > 40) return null;

  const key = text.toLowerCase();
  if (NOTHING.has(key)) return null;

  return (
    PLACES[key] ??
    KNOWN.get(key) ??
    text.charAt(0).toUpperCase() + text.slice(1)
  );
}
