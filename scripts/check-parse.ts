import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseIngredientLine } from "../lib/ingredients";

type Fixture = {
  line: string;
  q?: number | null;
  u?: string | null;
  key?: string;
  note?: string;
  alt?: string;
  opt?: boolean;
  pack?: [number, string] | null;
};

const fixtures = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/ingredient-fixtures.json"), "utf8"),
) as Fixture[];

let passed = 0;
const failures: string[] = [];

for (const fixture of fixtures) {
  const got = parseIngredientLine(fixture.line, 0);
  const problems: string[] = [];

  if (!got) {
    problems.push("parsed to nothing");
  } else {
    const check = (label: string, want: unknown, have: unknown) => {
      if (want === undefined) return;
      if (want === null ? have !== null : have !== want) {
        problems.push(`${label}: want ${JSON.stringify(want)}, got ${JSON.stringify(have)}`);
      }
    };

    check("quantity", fixture.q, got.quantity);
    check("unit", fixture.u, got.unit);
    check("item_key", fixture.key, got.item_key);
    check("optional", fixture.opt, got.optional);
    if (fixture.note !== undefined && !(got.note ?? "").includes(fixture.note)) {
      problems.push(`note: want to contain "${fixture.note}", got ${JSON.stringify(got.note)}`);
    }
    if (fixture.alt !== undefined) check("alt_item", fixture.alt, got.alt_item);
    if (fixture.pack !== undefined) {
      check("pack qty", fixture.pack?.[0] ?? null, got.pack_size_qty);
      check("pack unit", fixture.pack?.[1] ?? null, got.pack_size_unit);
    }
  }

  if (problems.length === 0) passed += 1;
  else failures.push(`  ${fixture.line}\n${problems.map((p) => `      ${p}`).join("\n")}`);
}

const rate = ((passed / fixtures.length) * 100).toFixed(1);
if (failures.length) console.log(`\n${failures.length} lines off:\n\n${failures.join("\n\n")}\n`);
console.log(`${passed}/${fixtures.length} ingredient lines parsed as expected (${rate}%)`);

process.exit(failures.length && process.argv.includes("--strict") ? 1 : 0);
