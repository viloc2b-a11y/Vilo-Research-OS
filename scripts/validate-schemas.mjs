/**
 * Phase 4C.2 schema validation (syntax + optional AJV).
 *
 * Syntax check (no dependencies):
 *   node scripts/validate-schemas.mjs
 *
 * Full Draft 2020-12 validation requires AJV (not bundled):
 *   npm install -D ajv ajv-formats
 *   node scripts/validate-schemas.mjs --ajv
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMAS = join(ROOT, "schemas");

function walkJson(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkJson(p, acc);
    else if (name.endsWith(".json")) acc.push(p);
  }
  return acc;
}

const files = walkJson(SCHEMAS);
let failed = 0;

for (const file of files) {
  try {
    JSON.parse(readFileSync(file, "utf8"));
    console.log("OK (syntax)", file.replace(ROOT + "\\", "").replace(ROOT + "/", ""));
  } catch (e) {
    failed += 1;
    console.error("FAIL (syntax)", file, e.message);
  }
}

const useAjv = process.argv.includes("--ajv");
if (useAjv) {
  try {
    const Ajv = (await import("ajv")).default;
    const addFormats = (await import("ajv-formats")).default;
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    for (const file of files) {
      const schema = JSON.parse(readFileSync(file, "utf8"));
      try {
        ajv.compile(schema);
        console.log("OK (compile)", file.replace(ROOT + "\\", "").replace(ROOT + "/", ""));
      } catch (e) {
        failed += 1;
        console.error("FAIL (compile)", file, e.message);
      }
    }
  } catch {
    console.error(
      "AJV not installed. Run: npm install -D ajv ajv-formats\nThen: node scripts/validate-schemas.mjs --ajv"
    );
    process.exit(2);
  }
} else {
  console.log("\nTip: install ajv + ajv-formats for compile validation: node scripts/validate-schemas.mjs --ajv");
}

process.exit(failed > 0 ? 1 : 0);
