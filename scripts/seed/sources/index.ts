import { curated } from "./curated";
import { themealdb } from "./themealdb";
import { wikibooks } from "./wikibooks";
import type { SeedSource } from "../types";

/**
 * Sources that have been checked against the live endpoint. Two more were
 * planned and dropped: MyPlate (USDA, public domain) redirects scripted
 * requests to its homepage, and Project Gutenberg's cookbooks are flowing
 * Victorian prose with no ingredient lists to parse. Adding either later means
 * writing one file in this folder.
 */
export const SOURCES: SeedSource[] = [curated, themealdb, wikibooks];

export const sourceByName = (name: string): SeedSource | undefined =>
  SOURCES.find((source) => source.name === name);
