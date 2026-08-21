import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

const AGENT =
  "mise/0.1 (household meal planner; +https://github.com/) recipe-import";

export class ImportError extends Error {
  constructor(
    message: string,
    readonly kind: "url" | "network" | "blocked" | "size" | "type" = "network",
  ) {
    super(message);
  }
}

/** Ranges that live inside the network this server is sitting on. */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    if (value === "::1" || value === "::") return true;
    if (value.startsWith("fe80") || value.startsWith("fc") || value.startsWith("fd")) return true;
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }

  const [a, b] = address.split(".").map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;   // link-local, and AWS metadata
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ImportError("Only http and https links can be imported", "url");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new ImportError("That address is on this machine, not the web", "blocked");
  }

  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new ImportError("Couldn't find that site", "network");
      });

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new ImportError("That address is on a private network", "blocked");
    }
  }
}

/** utm tags and fragments are noise, and they'd defeat the duplicate check. */
export function canonicalUrl(input: string): URL {
  let text = input.trim();
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new ImportError("That doesn't look like a link", "url");
  }

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  return url;
}

export type FetchedPage = { url: string; html: string };

/**
 * Fetches a page the way a careful stranger would: no cookies, a stated name,
 * a short leash, and a fresh DNS check after every redirect — a public URL that
 * bounces to 169.254.169.254 is the whole point of checking more than once.
 */
export async function fetchPage(input: string): Promise<FetchedPage> {
  let url = canonicalUrl(input);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublic(url);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        credentials: "omit",
        headers: {
          "user-agent": AGENT,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en",
        },
      });
    } catch (cause) {
      throw new ImportError(
        cause instanceof Error && cause.name === "AbortError"
          ? "That site took too long to answer"
          : "Couldn't reach that site",
        "network",
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ImportError("That link goes nowhere", "network");
      url = canonicalUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw new ImportError(
        response.status === 403 || response.status === 401
          ? "That site won't let us read the page"
          : `That site answered ${response.status}`,
        "network",
      );
    }

    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|application\/xhtml|text\/plain/i.test(type)) {
      throw new ImportError("That link isn't a web page", "type");
    }

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) throw new ImportError("That page is too big to read", "size");

    const html = await readCapped(response);
    return { url: url.toString(), html };
  }

  throw new ImportError("That link redirects too many times", "network");
}

async function readCapped(response: Response): Promise<string> {
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new ImportError("That page is too big to read", "size");
    }
    chunks.push(value);
  }

  return new TextDecoder("utf-8").decode(
    chunks.reduce((all, chunk) => {
      const merged = new Uint8Array(all.length + chunk.length);
      merged.set(all);
      merged.set(chunk, all.length);
      return merged;
    }, new Uint8Array()),
  );
}
