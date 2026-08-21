import catalogFile from "@/data/pantry-catalog.json";
import { aisleFor, itemKey } from "./ingredients";
import type { Aisle, PantryStatus } from "./types";

export type CatalogItem = {
  name: string;
  key: string;
  group: string;
  groupLabel: string;
  aisle: Aisle;
};

export type CatalogGroup = { key: string; label: string; items: CatalogItem[] };

/**
 * The starter kit, so the cupboard isn't an empty screen on day one. Keys are
 * computed with the same function the recipes use — a hand-typed key that
 * drifted by one letter would silently stop matching anything.
 */
export const CATALOG: CatalogGroup[] = catalogFile.groups.map((group) => {
  const seen = new Set<string>();
  return {
    key: group.key,
    label: group.label,
    items: group.items.flatMap((name) => {
      const key = itemKey(name);
      if (!key || seen.has(key)) return [];
      seen.add(key);
      return [{ name, key, group: group.key, groupLabel: group.label, aisle: aisleFor(key) }];
    }),
  };
});

export const CATALOG_BY_KEY = new Map<string, CatalogItem>(
  CATALOG.flatMap((group) => group.items.map((item) => [item.key, item] as const)),
);

export function searchCatalog(query: string, limit = 12): CatalogItem[] {
  const text = query.trim().toLowerCase();
  if (!text) return [];

  const key = itemKey(text);
  const hits: Array<{ item: CatalogItem; rank: number }> = [];

  for (const item of CATALOG_BY_KEY.values()) {
    const name = item.name.toLowerCase();
    if (name === text || item.key === key) hits.push({ item, rank: 0 });
    else if (name.startsWith(text)) hits.push({ item, rank: 1 });
    else if (name.includes(text) || item.key.includes(key)) hits.push({ item, rank: 2 });
  }

  return hits
    .sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((hit) => hit.item);
}

export const NEXT_STATUS: Record<PantryStatus, PantryStatus> = {
  have: "low",
  low: "out",
  out: "have",
};

export const STATUS_LABEL: Record<PantryStatus, string> = {
  have: "",
  low: "running low",
  out: "out",
};

export const STATUS_COLOR: Record<PantryStatus, string> = {
  have: "var(--ink)",
  low: "var(--ink-faint)",
  out: "var(--accent)",
};
