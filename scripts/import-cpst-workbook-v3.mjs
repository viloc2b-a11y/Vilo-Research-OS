/**
 * Phase 4C.3B — Import CPST Workbook v3 → validated JSON bundle.
 *
 * Run: node scripts/import-cpst-workbook-v3.mjs [--input path] [--output path] [--manifest path] [--strict]
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMAS_DIR = join(ROOT, "schemas");
const DEFAULT_INPUT = join(ROOT, "templates/cpst-workbook-v3.xlsx");
const DEFAULT_MANIFEST = join(ROOT, "templates/cpst-workbook-v3.manifest.json");
const DEFAULT_OUTPUT = join(ROOT, "tmp/imports/cpst-workbook-v3.import.json");

const META_SHEETS = new Set(["Overview", "Schema_Version", "Instructions", "Controlled_Lists"]);

const SHEET_TO_DATA_KEY = {
  Study_Setup: "study_setup",
  Visit_Groups: "visit_groups",
  Visit_Templates: "visit_templates",
  Procedure_Library: "procedure_library",
  Visit_Procedure_Matrix: "visit_procedure_matrix",
  Conditional_Rules: "conditional_rules",
  Schedule_Windows: "schedule_windows",
  External_Source_Map: "external_source_map",
  Substudy_Map: "substudy_map",
  Roles_Signoff: "roles_signoff",
  Value_Lists: "value_lists",
  Field_Definitions: "field_definitions",
  Audit_and_Versioning: "audit_and_versioning",
};

const DOMAIN_SHEET_KEYS = {
  Oncology_Module: "oncology_module",
  Dose_Escalation: "dose_escalation",
  Crossover_Design: "crossover_design",
  Adaptive_Design_Rules: "adaptive_design_rules",
  Decentralized_Workflows: "decentralized_workflows",
  Imaging_Matrix: "imaging_matrix",
  Device_Trial_Controls: "device_trial_controls",
  EDC_Reconciliation: "edc_reconciliation",
  ePRO_Workflows: "epro_workflows",
  Pediatric_Consent_Assent: "pediatric_consent_assent",
  Biospecimen_Collection_Module: "biospecimen_collection_module",
};

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    manifest: DEFAULT_MANIFEST,
    strict: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") args.strict = true;
    else if (a === "--input") args.input = resolve(argv[++i]);
    else if (a === "--output") args.output = resolve(argv[++i]);
    else if (a === "--manifest") args.manifest = resolve(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/import-cpst-workbook-v3.mjs [options]
  --input <path>     Workbook (default: templates/cpst-workbook-v3.xlsx)
  --output <path>    Import JSON (default: tmp/imports/cpst-workbook-v3.import.json)
  --manifest <path>  Manifest (default: templates/cpst-workbook-v3.manifest.json)
  --strict           Exit 1 when status is invalid`);
      process.exit(0);
    }
  }
  return args;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function headerToProperty(header) {
  if (header == null) return null;
  const s = String(header).trim();
  if (!s) return null;
  return s.replace(/\s+\*$/, "").trim();
}

function isHelperRow(rowValues) {
  const first = rowValues.find((v) => v != null && String(v).trim() !== "");
  if (!first) return false;
  const t = String(first).trim();
  return t.startsWith("[EXAMPLE]") || t.startsWith("[VALIDATION]");
}

function isEmptyRow(rowValues) {
  return rowValues.every((v) => v == null || String(v).trim() === "");
}

function cellText(value) {
  if (value == null) return null;
  if (typeof value === "object") {
    if (value.text != null) return String(value.text).trim();
    if (value.result != null) return String(value.result).trim();
    if (value.richText) return value.richText.map((r) => r.text).join("").trim();
  }
  if (value instanceof Date) return value;
  return String(value).trim();
}

function findHeaderRow(worksheet, expectedColumns) {
  const expected = new Set(expectedColumns);
  for (let r = 1; r <= 15; r++) {
    const row = worksheet.getRow(r);
    const headers = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const prop = headerToProperty(cellText(cell.value));
      if (prop) headers[col] = prop;
    });
    const matched = headers.filter((h) => h && expected.has(h)).length;
    if (matched >= Math.min(2, expected.size)) return { rowNum: r, headers };
  }
  return null;
}

function getRowValues(worksheet, rowNum, maxCol) {
  const row = worksheet.getRow(rowNum);
  const values = [];
  const limit = maxCol || row.cellCount || 64;
  for (let c = 1; c <= limit; c++) {
    values[c] = cellText(row.getCell(c).value);
  }
  return values;
}

function loadCommon() {
  return loadJson(join(SCHEMAS_DIR, "common/common.schema.json"));
}

function resolveRef(prop, common) {
  if (!prop?.$ref) return { ...prop };
  const m = prop.$ref.match(/#\/\$defs\/([A-Za-z0-9_]+)$/);
  if (!m) return { ...prop };
  const def = common.$defs?.[m[1]];
  return def ? { ...def, description: prop.description ?? def.description } : { ...prop };
}

function buildPropertyTypes(schema, common) {
  const types = {};
  for (const [key, raw] of Object.entries(schema.properties ?? {})) {
    const resolved = resolveRef(raw, common);
    types[key] = {
      type: resolved.type,
      format: resolved.format,
      enum: resolved.enum,
      pattern: resolved.pattern,
      items: resolved.items,
      const: resolved.const,
    };
    if (resolved.type === "array" && resolved.items?.$ref) {
      const itemResolved = resolveRef(resolved.items, common);
      types[key].itemType = itemResolved.type;
      types[key].itemEnum = itemResolved.enum;
    }
  }
  return types;
}

function excelDateToIso(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function excelDateTimeToIso(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + value * 86400000).toISOString();
  }
  const s = String(value).trim();
  return s;
}

function coerceValue(propName, raw, typeInfo, errors, ctx) {
  if (raw == null || String(raw).trim() === "") return undefined;

  let text = raw instanceof Date ? raw : String(raw).trim();
  if (text.startsWith("[EXAMPLE]") || text.startsWith("[VALIDATION]")) return undefined;

  const { type, format, enum: enumVals, items, itemEnum } = typeInfo;

  if (enumVals?.length) {
    const lower = text.toLowerCase();
    const hit = enumVals.find((e) => String(e).toLowerCase() === lower);
    if (hit != null) return hit;
    errors.push({
      ...ctx,
      field: propName,
      error_code: "INVALID_ENUM",
      message: `Value "${text}" not in allowed enum`,
    });
    return text;
  }

  if (type === "boolean") {
    const lower = text.toLowerCase();
    if (["true", "1", "yes", "y"].includes(lower)) return true;
    if (["false", "0", "no", "n"].includes(lower)) return false;
    errors.push({
      ...ctx,
      field: propName,
      error_code: "INVALID_BOOLEAN",
      message: `Cannot coerce "${text}" to boolean`,
    });
    return undefined;
  }

  if (type === "integer") {
    const n = Number(text);
    if (Number.isInteger(n)) return n;
    if (!Number.isNaN(n) && Number.isFinite(n)) return Math.trunc(n);
    errors.push({
      ...ctx,
      field: propName,
      error_code: "INVALID_INTEGER",
      message: `Cannot coerce "${text}" to integer`,
    });
    return undefined;
  }

  if (type === "number") {
    const n = Number(text);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
    errors.push({
      ...ctx,
      field: propName,
      error_code: "INVALID_NUMBER",
      message: `Cannot coerce "${text}" to number`,
    });
    return undefined;
  }

  if (format === "date" || (type === "string" && format === "date")) {
    return excelDateToIso(raw instanceof Date ? raw : text);
  }

  if (format === "date-time") {
    return excelDateTimeToIso(raw instanceof Date ? raw : text);
  }

  if (type === "array") {
    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* fall through */
      }
    }
    if (text.includes(",")) {
      return text.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [text];
  }

  if (typeInfo.const != null) {
    return typeInfo.const;
  }

  return text;
}

function structuralValidateRow(row, schema, typeMap, errors, ctx) {
  for (const [prop, info] of Object.entries(typeMap)) {
    const val = row[prop];
    if (val === undefined) continue;
    if (info.pattern) {
      try {
        const re = new RegExp(info.pattern);
        if (!re.test(String(val))) {
          errors.push({
            ...ctx,
            field: prop,
            error_code: "PATTERN_MISMATCH",
            message: `Value "${val}" does not match pattern ${info.pattern}`,
          });
        }
      } catch {
        /* invalid pattern in schema */
      }
    }
    if (info.enum && !info.enum.includes(val)) {
      errors.push({
        ...ctx,
        field: prop,
        error_code: "INVALID_ENUM",
        message: `Value "${val}" not in enum`,
      });
    }
  }
  if (schema.required) {
    for (const prop of schema.required) {
      if (row[prop] === undefined || row[prop] === null || row[prop] === "") {
        errors.push({
          ...ctx,
          field: prop,
          error_code: "MISSING_REQUIRED",
          message: `Required field "${prop}" is missing`,
        });
      }
    }
  }
}

function addError(errors, sheet, row, field, error_code, message) {
  errors.push({ sheet, row, field, error_code, message });
}

function addWarning(warnings, sheet, error_code, message) {
  warnings.push({ sheet, error_code, message });
}

function emptyData() {
  return {
    study_setup: [],
    visit_groups: [],
    visit_templates: [],
    procedure_library: [],
    visit_procedure_matrix: [],
    conditional_rules: [],
    schedule_windows: [],
    external_source_map: [],
    substudy_map: [],
    roles_signoff: [],
    value_lists: [],
    field_definitions: [],
    audit_and_versioning: [],
    domain_modules: Object.fromEntries(Object.values(DOMAIN_SHEET_KEYS).map((k) => [k, []])),
    runtime_support: { visit_execution_log: [] },
  };
}

function buildCpstBundle(data, manifest) {
  const studyTemplateId =
    data.study_setup[0]?.study_template_id ??
    data.visit_groups[0]?.study_template_id ??
    null;

  return {
    schema_version: manifest.core_schema_version ?? "1.0.0",
    workbook_id: `WB-${String(Date.now()).slice(-4)}`,
    study_template_id: studyTemplateId ?? "ST-000",
    study_setup: data.study_setup,
    visit_groups: data.visit_groups,
    visit_templates: data.visit_templates,
    procedure_library: data.procedure_library,
    visit_procedure_matrix: data.visit_procedure_matrix,
    conditional_rules: data.conditional_rules,
    schedule_windows: data.schedule_windows,
    external_source_map: data.external_source_map,
    substudy_map: data.substudy_map,
    roles_signoff: data.roles_signoff,
    value_lists: data.value_lists,
    field_definitions: data.field_definitions,
    audit_and_versioning: data.audit_and_versioning,
    domain_modules: data.domain_modules,
  };
}

async function tryAjvValidate(bundle, manifest, errors, warnings) {
  let Ajv;
  let addFormats;
  try {
    Ajv = (await import("ajv")).default;
    addFormats = (await import("ajv-formats")).default;
  } catch {
    warnings.push({
      sheet: null,
      error_code: "AJV_DEFERRED",
      message: "Full JSON Schema validation deferred. Install: npm install -D ajv ajv-formats",
    });
    return false;
  }

  let ajv;
  try {
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
  } catch (e) {
    warnings.push({
      sheet: null,
      error_code: "AJV_DEFERRED",
      message: `AJV init failed (${e.message}). Use matching ajv@8 + ajv-formats@2.`,
    });
    return false;
  }

  const schemaIds = new Map();
  function registerSchema(relPath) {
    const full = join(SCHEMAS_DIR, relPath);
    const schema = loadJson(full);
    const id = schema.$id || relPath;
    if (!schemaIds.has(id)) {
      ajv.addSchema(schema, id);
      schemaIds.set(id, true);
    }
    return schema;
  }

  registerSchema("common/common.schema.json");
  for (const sheet of manifest.sheets) {
    registerSchema(sheet.schema_path);
  }
  registerSchema("meta/CPST_Workbook.schema.json");

  const rowValidators = new Map();
  for (const sheet of manifest.sheets) {
    const schema = loadJson(join(SCHEMAS_DIR, sheet.schema_path));
    const id = schema.$id || sheet.schema_path;
    rowValidators.set(sheet.sheet_name, ajv.getSchema(id) || ajv.compile(schema));
  }

  const collections = [
    ["Study_Setup", bundle.data.study_setup],
    ["Visit_Groups", bundle.data.visit_groups],
    ["Visit_Templates", bundle.data.visit_templates],
    ["Procedure_Library", bundle.data.procedure_library],
    ["Visit_Procedure_Matrix", bundle.data.visit_procedure_matrix],
    ["Conditional_Rules", bundle.data.conditional_rules],
    ["Schedule_Windows", bundle.data.schedule_windows],
    ["External_Source_Map", bundle.data.external_source_map],
    ["Substudy_Map", bundle.data.substudy_map],
    ["Roles_Signoff", bundle.data.roles_signoff],
    ["Value_Lists", bundle.data.value_lists],
    ["Field_Definitions", bundle.data.field_definitions],
    ["Audit_and_Versioning", bundle.data.audit_and_versioning],
    ["Visit_Execution_Log", bundle.data.runtime_support.visit_execution_log],
  ];

  for (const [domainSheet, key] of Object.entries(DOMAIN_SHEET_KEYS)) {
    collections.push([domainSheet, bundle.data.domain_modules[key]]);
  }

  let ok = true;
  for (const [sheetName, rows] of collections) {
    const validate = rowValidators.get(sheetName);
    if (!validate) continue;
    rows.forEach((row, idx) => {
      if (!validate(row)) {
        ok = false;
        for (const err of validate.errors ?? []) {
          errors.push({
            sheet: sheetName,
            row: row._provenance_key ? undefined : idx + 1,
            field: err.instancePath?.replace(/^\//, "") || err.params?.missingProperty,
            error_code: "AJV_SCHEMA",
            message: err.message ?? "Schema validation failed",
          });
        }
      }
    });
  }

  const cpstPayload = buildCpstBundle(bundle.data, manifest);
  if (cpstPayload.study_setup.length === 0) {
    warnings.push({
      sheet: "CPST_Bundle",
      error_code: "BUNDLE_SKIPPED_EMPTY",
      message: "CPST_Workbook bundle validation skipped (no study_setup rows; empty template)",
    });
    return ok;
  }

  const bundleSchema = loadJson(join(SCHEMAS_DIR, "meta/CPST_Workbook.schema.json"));
  const validateBundle = ajv.getSchema(bundleSchema.$id) || ajv.compile(bundleSchema);
  if (!validateBundle(cpstPayload)) {
    ok = false;
    for (const err of validateBundle.errors ?? []) {
      errors.push({
        sheet: "CPST_Bundle",
        row: null,
        field: err.instancePath?.replace(/^\//, ""),
        error_code: "AJV_BUNDLE",
        message: err.message ?? "Bundle validation failed",
      });
    }
  }

  return ok;
}

async function main() {
  const args = parseArgs(process.argv);
  const importedAt = new Date().toISOString();

  if (!existsSync(args.input)) {
    console.error("Input workbook not found:", args.input);
    process.exit(1);
  }
  if (!existsSync(args.manifest)) {
    console.error("Manifest not found:", args.manifest);
    process.exit(1);
  }

  const manifest = loadJson(args.manifest);
  const common = loadCommon();
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(args.input);

  const errors = [];
  const warnings = [];
  const provenanceMap = {};
  const data = emptyData();
  let rowsImported = 0;
  let sheetsProcessed = 0;

  const manifestSheetNames = new Set(manifest.sheets.map((s) => s.sheet_name));
  const workbookSheetNames = new Set(workbook.worksheets.map((w) => w.name));

  for (const name of workbookSheetNames) {
    if (META_SHEETS.has(name)) continue;
    if (!manifestSheetNames.has(name) && !DOMAIN_SHEET_KEYS[name] && name !== "Visit_Execution_Log") {
      addWarning(warnings, name, "UNKNOWN_SHEET", `Sheet "${name}" is not in manifest`);
    }
  }

  for (const sheetMeta of manifest.sheets) {
    const sheetName = sheetMeta.sheet_name;
    const ws = workbook.getWorksheet(sheetName);
    if (!ws) {
      addWarning(warnings, sheetName, "MISSING_SHEET", `Expected sheet "${sheetName}" not found in workbook`);
      continue;
    }

    const schema = loadJson(join(SCHEMAS_DIR, sheetMeta.schema_path));
    const typeMap = buildPropertyTypes(schema, common);
    const headerInfo = findHeaderRow(ws, sheetMeta.columns);
    if (!headerInfo) {
      addError(errors, sheetName, null, null, "NO_HEADER", "Could not locate header row");
      continue;
    }

    const { rowNum: headerRowNum, headers } = headerInfo;
    const colToProp = {};
    headers.forEach((prop, col) => {
      if (prop) colToProp[col] = prop;
    });

    sheetsProcessed += 1;
    const importedRows = [];
    const maxCol = Math.max(...Object.keys(colToProp).map(Number), sheetMeta.columns.length, 1);
    const MAX_SCAN_ROWS = 500;
    const EMPTY_ROW_STOP = 25;
    let consecutiveEmpty = 0;

    for (let r = headerRowNum + 1; r <= headerRowNum + MAX_SCAN_ROWS; r++) {
      const rawValues = getRowValues(ws, r, maxCol);
      if (isHelperRow(rawValues)) continue;
      if (isEmptyRow(rawValues)) {
        consecutiveEmpty += 1;
        if (consecutiveEmpty >= EMPTY_ROW_STOP) break;
        continue;
      }
      consecutiveEmpty = 0;

      const rowObj = {};
      let hasPopulation = false;

      for (const [col, prop] of Object.entries(colToProp)) {
        const raw = rawValues[Number(col)];
        if (raw == null || String(raw).trim() === "") continue;
        hasPopulation = true;
        const ctx = { sheet: sheetName, row: r };
        const coerced = coerceValue(prop, raw, typeMap[prop] ?? { type: "string" }, errors, ctx);
        if (coerced !== undefined) rowObj[prop] = coerced;
      }

      if (!hasPopulation) continue;

      for (const req of sheetMeta.required_columns ?? []) {
        if (rowObj[req] === undefined || rowObj[req] === null || rowObj[req] === "") {
          addError(errors, sheetName, r, req, "MISSING_REQUIRED", `Required field "${req}" is empty`);
        }
      }

      structuralValidateRow(rowObj, schema, typeMap, errors, { sheet: sheetName, row: r });

      const provKey = `${sheetName}:${r}`;
      provenanceMap[provKey] = {
        workbook_sheet: sheetName,
        workbook_row: r,
        imported_at: importedAt,
      };

      importedRows.push(rowObj);
      rowsImported += 1;
    }

    if (sheetName === "Visit_Execution_Log") {
      data.runtime_support.visit_execution_log = importedRows;
    } else if (DOMAIN_SHEET_KEYS[sheetName]) {
      data.domain_modules[DOMAIN_SHEET_KEYS[sheetName]] = importedRows;
    } else if (SHEET_TO_DATA_KEY[sheetName]) {
      data[SHEET_TO_DATA_KEY[sheetName]] = importedRows;
    }
  }

  const result = {
    import_id: randomUUID(),
    imported_at: importedAt,
    source_workbook: relative(ROOT, args.input).replace(/\\/g, "/"),
    manifest_path: relative(ROOT, args.manifest).replace(/\\/g, "/"),
    schema_version: manifest.core_schema_version ?? "1.0.0",
    status: "valid",
    counts: {
      sheets_processed: sheetsProcessed,
      rows_imported: rowsImported,
      errors: 0,
      warnings: 0,
    },
    data,
    provenance_map: provenanceMap,
    cpst_bundle: buildCpstBundle(data, manifest),
    errors: [],
    warnings: [],
    validation: {
      structural: true,
      ajv: false,
    },
  };

  result.errors = errors;
  result.warnings = warnings;
  result.counts.errors = errors.length;
  result.counts.warnings = warnings.length;

  const ajvOk = await tryAjvValidate(result, manifest, errors, warnings);
  result.validation.ajv = ajvOk;
  result.counts.errors = errors.length;
  result.counts.warnings = warnings.length;

  if (errors.length > 0) result.status = "invalid";

  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log("Import status:", result.status);
  console.log("Rows imported:", rowsImported);
  console.log("Errors:", errors.length);
  console.log("Warnings:", warnings.length);
  console.log("Output:", relative(ROOT, args.output));

  if (args.strict && result.status === "invalid") process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
