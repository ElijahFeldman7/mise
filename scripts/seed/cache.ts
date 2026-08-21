import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), ".cache", "seed");
const AGENT =
  "mise-seeder/0.1 (personal meal-planner library seeding; run locally, results not republished)";

const RETRIES = 4;

let enabled = true;
export function setCache(on: boolean) {
  enabled = on;
}

/** Re-running the seeder shouldn't cost the sources anything. */
export async function getJson<T>(url: string): Promise<T> {
  return JSON.parse(await getText(url)) as T;
}

export async function getText(url: string): Promise<string> {
  const file = join(DIR, `${createHash("sha1").update(url).digest("hex")}.txt`);

  if (enabled && existsSync(file)) return readFileSync(file, "utf8");

  let body: string | null = null;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": AGENT, accept: "*/*" } });

    if (response.ok) {
      body = await response.text();
      break;
    }

    // Wikimedia and friends say "slow down" with a 429; the polite answer is to.
    if (response.status === 429 || response.status === 503) {
      const stated = Number(response.headers.get("retry-after") ?? 0);
      const wait = stated > 0 ? stated * 1000 : Math.min(30_000, 2000 * 2 ** attempt);
      process.stdout.write(`\n  (backing off ${Math.round(wait / 1000)}s — ${response.status})\n`);
      await pause(wait);
      continue;
    }

    throw new Error(`${response.status} from ${url}`);
  }

  if (body === null) throw new Error(`gave up after ${RETRIES} retries on ${url}`);

  if (enabled) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(file, body);
  }
  return body;
}

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
