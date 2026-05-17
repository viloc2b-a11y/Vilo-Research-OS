/**
 * Phase 4C.3 — Generate CPST Workbook v3 from JSON Schemas.
 *
 * Requires: npm install -D exceljs
 * Run: node scripts/generate-cpst-workbook-v3.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMAS_DIR = join(ROOT, "schemas");
const TEMPLATES_DIR = join(ROOT, "templates");
const WORKBOOK_VERSION = "v3.0.0";
const GENERATOR_SCRIPT = "scripts/generate-cpst-workbook-v3.mjs";
const BIOSPECIMEN_CANONICAL_PATH = join(ROOT, "fixtures/cpst/biospecimen-canonical-template.json");

const CORE_SHEETS = [
  "Study_Setup",
  "Visit_Groups",
  "Visit_Templates",
  "Procedure_Library",
  "Visit_Procedure_Matrix",
  "Conditional_Rules",
  "Schedule_Windows",
  "External_Source_Map",
  "Substudy_Map",
  "Roles_Signoff",
  "Value_Lists",
  "Field_Definitions",
  "Audit_and_Versioning",
];

const RUNTIME_SHEETS = [
  {
    name: "Visit_Execution_Log",
    schemaPath: "core/Visit_Execution_Log.schema.json",
    banner:
      "RUNTIME SUPPORT ONLY — not canonical compiler design input. Do not use for source generation.",
  },
];

const DOMAIN_SHEETS = [
  "Oncology_Module",
  "Dose_Escalation",
  "Crossover_Design",
  "Adaptive_Design_Rules",
  "Decentralized_Workflows",
  "Imaging_Matrix",
  "Device_Trial_Controls",
  "EDC_Reconciliation",
  "ePRO_Workflows",
  "Pediatric_Consent_Assent",
  "Biospecimen_Collection_Module",
];

/** Property keys treated as technical/system IDs (ordered first). */
const TECH_ID_KEYS = [
  "study_template_id",
  "visit_group_code",
  "visit_id",
  "visit_code",
  "procedure_id",
  "procedure_code",
  "matrix_row_id",
  "rule_id",
  "window_id",
  "external_source_id",
  "substudy_map_id",
  "substudy_code",
  "role_row_id",
  "field_row_id",
  "field_key",
  "version_row_id",
  "module_row_id",
  "module_id",
  "oncology_module_id",
  "dose_escalation_id",
  "crossover_id",
  "adaptive_rule_id",
  "decentralized_workflow_id",
  "imaging_id",
  "device_module_id",
  "device_id",
  "reconciliation_id",
  "epro_id",
  "pediatric_id",
  "biospecimen_module_id",
  "workbook_id",
  "graph_id",
  "extraction_id",
  "review_id",
];

/** Common $defs enum → Controlled_Lists display name (initial seed lists). */
const SEED_CONTROLLED_LISTS = {
  "Visit Type": "VisitType",
  "Visit Mode": "VisitMode",
  "Source Type": "SourceType",
  "Requirement Status": "RequirementStatus",
  "Data Type": "DataType",
  "Rule Action": "RuleAction",
  "Role Name": "RoleName",
  "Approval State": "ApprovalState",
  "Scope Type": "ScopeType",
  "Rule Type": "RuleType",
  "Trigger Entity": "TriggerEntity",
  "Window Unit": "WindowUnit",
  "Source Origin Mode": "SourceOriginMode",
  "Detail Level": "DetailLevel",
  "Module Category": null,
  "Source Capture Strategy": "SourceType",
  "Extraction Method": null,
  "Reviewer Status": null,
};

const PROPERTY_TO_LIST = {
  visit_type: "Visit Type",
  delivery_mode: "Visit Mode",
  visit_mode: "Visit Mode",
  source_type: "Source Type",
  source_type_override: "Source Type",
  remote_source_type: "Source Type",
  source_capture_strategy: "Source Capture Strategy",
  matrix_marker: "Requirement Status",
  data_type: "Data Type",
  action: "Rule Action",
  role_code: "Role Name",
  owner_role: "Role Name",
  owner_role_override: "Role Name",
  image_reviewer: "Role Name",
  resolution_owner: "Role Name",
  analysis_committee: "Role Name",
  approval_state: "Approval State",
  scope_type: "Scope Type",
  rule_type: "Rule Type",
  trigger_entity: "Trigger Entity",
  window_unit: "Window Unit",
  source_origin_mode: "Source Origin Mode",
  detail_level: "Detail Level",
  module_category: "Module Category",
  extraction_method: "Extraction Method",
  reviewer_status: "Reviewer Status",
};

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadCommon() {
  return loadJson(join(SCHEMAS_DIR, "common/common.schema.json"));
}

function resolveRef(prop, common) {
  if (!prop?.$ref) return { resolved: { ...prop }, defName: null };
  const m = prop.$ref.match(/#\/\$defs\/([A-Za-z0-9_]+)$/);
  if (!m) return { resolved: { ...prop }, defName: null };
  const defName = m[1];
  const def = common.$defs?.[defName];
  if (!def) return { resolved: { ...prop }, defName };
  return {
    resolved: { ...def, description: prop.description ?? def.description },
    defName,
  };
}

function isTechnicalId(propName, resolved, defName) {
  if (TECH_ID_KEYS.includes(propName)) return true;
  if (defName && /ID$/.test(defName)) return true;
  if (propName.endsWith("_id") && defName) return true;
  return false;
}

function validationHint(resolved) {
  const parts = [];
  if (resolved.type) parts.push(`type:${resolved.type}`);
  if (resolved.format) parts.push(`format:${resolved.format}`);
  if (resolved.pattern) parts.push(`pattern:${resolved.pattern}`);
  if (resolved.minLength != null) parts.push(`minLength:${resolved.minLength}`);
  if (resolved.maxLength != null) parts.push(`maxLength:${resolved.maxLength}`);
  if (resolved.minimum != null) parts.push(`min:${resolved.minimum}`);
  if (resolved.maximum != null) parts.push(`max:${resolved.maximum}`);
  if (resolved.enum) parts.push(`enum:[${resolved.enum.join(",")}]`);
  if (resolved.const != null) parts.push(`const:${resolved.const}`);
  return parts.join("; ") || "—";
}

function exampleValue(resolved) {
  if (resolved.examples?.length) return String(resolved.examples[0]);
  if (resolved.enum?.length) return resolved.enum[0];
  if (resolved.const != null) return String(resolved.const);
  if (resolved.type === "boolean") return "TRUE/FALSE";
  if (resolved.format === "date") return "YYYY-MM-DD";
  if (resolved.format === "date-time") return "YYYY-MM-DDTHH:mm:ssZ";
  if (resolved.format === "uuid") return "00000000-0000-4000-8000-000000000000";
  if (resolved.type === "integer" || resolved.type === "number") return "0";
  if (resolved.type === "array") return "[...]";
  return "";
}

function orderPropertyKeys(properties) {
  const keys = Object.keys(properties);
  const tech = TECH_ID_KEYS.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !tech.includes(k) && k !== "x_vilo_provenance");
  const tail = keys.includes("x_vilo_provenance") ? ["x_vilo_provenance"] : [];
  return [...tech, ...rest, ...tail];
}

function buildColumnModel(schema, common) {
  const required = new Set(schema.required ?? []);
  const properties = schema.properties ?? {};
  const ordered = orderPropertyKeys(properties);

  return ordered.map((propName) => {
    const raw = properties[propName];
    const { resolved, defName } = resolveRef(raw, common);
    const listName = PROPERTY_TO_LIST[propName] ?? (defName && SEED_CONTROLLED_LISTS[defNameToListLabel(defName)]);
    return {
      key: propName,
      header: required.has(propName) ? `${propName} *` : propName,
      required: required.has(propName),
      description: raw.description ?? resolved.description ?? "",
      technicalId: isTechnicalId(propName, resolved, defName),
      enumList: resolved.enum ? `inline:${propName}` : listName ?? null,
      defName,
      resolved,
      example: exampleValue(resolved),
      validationHint: validationHint(resolved),
    };
  });
}

function defNameToListLabel(defName) {
  const map = {
    VisitType: "Visit Type",
    VisitMode: "Visit Mode",
    SourceType: "Source Type",
    RequirementStatus: "Requirement Status",
    DataType: "Data Type",
    RuleAction: "Rule Action",
    RoleName: "Role Name",
  };
  return map[defName] ?? null;
}

function collectSchemaFiles() {
  const files = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".schema.json")) files.push(p);
    }
  }
  walk(SCHEMAS_DIR);
  return files.sort();
}

function buildExtraControlledLists() {
  const parser = loadJson(join(SCHEMAS_DIR, "meta/Parser_Extraction_Result.schema.json"));
  const registry = loadJson(join(SCHEMAS_DIR, "meta/Domain_Module_Registry.schema.json"));
  const extra = { ...SEED_CONTROLLED_LISTS };

  const extMethod = parser.properties?.extraction_method?.enum;
  if (extMethod) extra["Extraction Method"] = extMethod;

  const revStatus = parser.properties?.reviewer_status?.enum;
  if (revStatus) extra["Reviewer Status"] = revStatus;

  const modCat = registry.properties?.module_category?.enum;
  if (modCat) extra["Module Category"] = modCat;

  return extra;
}

function buildControlledListRows(common, extraLists) {
  const rows = [];
  let sort = 0;
  for (const [listName, defNameOrEnum] of Object.entries(extraLists)) {
    let values = [];
    if (Array.isArray(defNameOrEnum)) values = defNameOrEnum;
    else if (typeof defNameOrEnum === "string" && common.$defs[defNameOrEnum]?.enum) {
      values = common.$defs[defNameOrEnum].enum;
    }
    if (!values.length) continue;
    values.forEach((item, i) => {
      rows.push({
        list_name: listName,
        sort_order: sort + i,
        item_value: item,
        item_label: item.replace(/_/g, " "),
        notes: `From common.$defs.${defNameOrEnum ?? "inline"}`,
      });
    });
    sort += values.length;
  }
  return rows;
}

function listRanges(rows) {
  const ranges = {};
  let row = 2;
  const byList = {};
  for (const r of rows) {
    if (!byList[r.list_name]) byList[r.list_name] = [];
    byList[r.list_name].push(r);
  }
  for (const [name, items] of Object.entries(byList)) {
    const start = row;
    const end = row + items.length - 1;
    ranges[name] = { start, end };
    row = end + 1;
  }
  return ranges;
}

/**
 * Biospecimen-only supplemental sheets derived from canonical template JSON
 * (not hardcoded Excel-only text — structure lives in fixtures/cpst/biospecimen-canonical-template.json).
 */
function addBiospecimenCanonicalSheets(workbook, manifest) {
  if (!existsSync(BIOSPECIMEN_CANONICAL_PATH)) return;
  const canon = loadJson(BIOSPECIMEN_CANONICAL_PATH);

  const st = workbook.addWorksheet("Source_Template");
  st.views = [{ state: "frozen", ySplit: 1 }];
  st.addRow(["Section", "Field Name", "Required", "Data Type", "Example", "Notes"]);
  st.getRow(1).font = { bold: true };
  for (const row of canon.source_template ?? []) {
    st.addRow([
      row.section,
      row.field_name,
      row.required ? "Yes" : "No",
      row.data_type_label,
      row.example ?? "",
      row.notes ?? "",
    ]);
  }

  const bvl = workbook.addWorksheet("Biospecimen_Value_Lists");
  bvl.views = [{ state: "frozen", ySplit: 1 }];
  bvl.addRow(["List Name", "Value Code", "Value Label", "Active Flag", "Notes"]);
  bvl.getRow(1).font = { bold: true };
  for (const row of canon.value_lists ?? []) {
    bvl.addRow([
      row.list_name,
      row.value_code,
      row.value_label,
      row.active_flag ? "True" : "False",
      row.notes ?? "",
    ]);
  }

  let ins = workbook.getWorksheet("Instructions");
  if (!ins) {
    ins = workbook.addWorksheet("Instructions");
    ins.addRow(["Topic", "Instruction"]);
    ins.getRow(1).font = { bold: true };
  }
  ins.addRow([]);
  ins.addRow(["Biospecimen collection-only", "Operational rules from canonical template"]);
  for (const row of canon.instructions ?? []) {
    ins.addRow([row.topic, row.instruction]);
  }

  manifest.biospecimen_canonical_template = relative(ROOT, BIOSPECIMEN_CANONICAL_PATH).replace(/\\/g, "/");
  for (const sheetName of ["Source_Template", "Biospecimen_Value_Lists"]) {
    manifest.sheets.push({
      sheet_name: sheetName,
      schema_path: null,
      biospecimen_supplement: true,
      canonical_template: manifest.biospecimen_canonical_template,
    });
  }
}

function colLetter(n) {
  let s = "";
  let num = n;
  while (num > 0) {
    const mod = (num - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

async function main() {
  let ExcelJS;
  try {
    ExcelJS = (await import("exceljs")).default;
  } catch {
    console.error(
      "exceljs is not installed. Install then re-run:\n  npm install -D exceljs\n  node scripts/generate-cpst-workbook-v3.mjs"
    );
    writeManifestOnly();
    process.exit(2);
  }

  mkdirSync(TEMPLATES_DIR, { recursive: true });
  const common = loadCommon();
  const extraLists = buildExtraControlledLists();
  const controlledRows = buildControlledListRows(common, extraLists);
  const listRangeMap = listRanges(controlledRows);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vilo Research OS";
  workbook.created = new Date();

  const manifest = {
    workbook_version: WORKBOOK_VERSION,
    generated_at: new Date().toISOString(),
    generator_script: GENERATOR_SCRIPT,
    core_schema_version: common["x-vilo-schema-version"] ?? "1.0.0",
    domain_schema_versions: {},
    schema_file_paths: [],
    schema_hashes: {},
    sheets: [],
  };

  // Overview
  addOverviewSheet(workbook);

  // Schema_Version (populated after hashes)
  const schemaVersionSheet = workbook.addWorksheet("Schema_Version");

  // Instructions (+ biospecimen operational rules appended when canonical template present)
  addInstructionsSheet(workbook);
  addBiospecimenCanonicalSheets(workbook, manifest);

  // Controlled_Lists
  addControlledListsSheet(workbook, controlledRows, listRangeMap);

  // Core sheets
  for (const name of CORE_SHEETS) {
    const schemaPath = `core/${name}.schema.json`;
    const fullPath = join(SCHEMAS_DIR, schemaPath);
    const schema = loadJson(fullPath);
    const columns = buildColumnModel(schema, common);
    addDictionarySheet(workbook, {
      name,
      schemaPath,
      columns,
      runtime: false,
      banner: null,
      listRangeMap,
    });
    manifest.sheets.push(sheetManifestEntry(name, schemaPath, fullPath, columns));
    manifest.schema_file_paths.push(relative(ROOT, fullPath).replace(/\\/g, "/"));
    manifest.schema_hashes[schemaPath] = sha256File(fullPath);
  }

  // Runtime
  for (const rt of RUNTIME_SHEETS) {
    const fullPath = join(SCHEMAS_DIR, rt.schemaPath);
    const schema = loadJson(fullPath);
    const columns = buildColumnModel(schema, common);
    addDictionarySheet(workbook, {
      name: rt.name,
      schemaPath: rt.schemaPath,
      columns,
      runtime: true,
      banner: rt.banner,
      listRangeMap,
    });
    manifest.sheets.push(sheetManifestEntry(rt.name, rt.schemaPath, fullPath, columns, { runtime_only: true }));
    manifest.schema_file_paths.push(relative(ROOT, fullPath).replace(/\\/g, "/"));
    manifest.schema_hashes[rt.schemaPath] = sha256File(fullPath);
  }

  // Domain
  for (const name of DOMAIN_SHEETS) {
    const schemaPath = `domain/${name}.schema.json`;
    const fullPath = join(SCHEMAS_DIR, schemaPath);
    const schema = loadJson(fullPath);
    const columns = buildColumnModel(schema, common);
    manifest.domain_schema_versions[name] = schema["x-vilo-schema-version"] ?? "1.0.0";
    addDictionarySheet(workbook, {
      name,
      schemaPath,
      columns,
      runtime: false,
      banner: "Optional domain module overlay — attach only when module is active in registry.",
      listRangeMap,
      tabColor: "E8EAF6",
    });
    manifest.sheets.push(sheetManifestEntry(name, schemaPath, fullPath, columns, { domain_module: true }));
    manifest.schema_file_paths.push(relative(ROOT, fullPath).replace(/\\/g, "/"));
    manifest.schema_hashes[schemaPath] = sha256File(fullPath);
  }

  // common hash
  const commonPath = join(SCHEMAS_DIR, "common/common.schema.json");
  manifest.schema_hashes["common/common.schema.json"] = sha256File(commonPath);
  manifest.schema_file_paths.push(relative(ROOT, commonPath).replace(/\\/g, "/"));

  populateSchemaVersionSheet(schemaVersionSheet, manifest);

  const xlsxPath = join(TEMPLATES_DIR, "cpst-workbook-v3.xlsx");
  await workbook.xlsx.writeFile(xlsxPath);

  const manifestPath = join(TEMPLATES_DIR, "cpst-workbook-v3.manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log("Wrote", relative(ROOT, xlsxPath));
  console.log("Wrote", relative(ROOT, manifestPath));
  console.log("Sheets:", workbook.worksheets.map((w) => w.name).join(", "));
}

function sheetManifestEntry(sheetName, schemaPath, fullPath, columns, extra = {}) {
  return {
    sheet_name: sheetName,
    schema_path: schemaPath,
    schema_hash: sha256File(fullPath),
    columns: columns.map((c) => c.key),
    required_columns: columns.filter((c) => c.required).map((c) => c.key),
    property_descriptions: Object.fromEntries(columns.map((c) => [c.key, c.description])),
    enum_fields: Object.fromEntries(
      columns.filter((c) => c.enumList).map((c) => [c.key, c.enumList])
    ),
    technical_id_columns: columns.filter((c) => c.technicalId).map((c) => c.key),
    ...extra,
  };
}

function writeManifestOnly() {
  const common = loadCommon();
  const manifest = {
    workbook_version: WORKBOOK_VERSION,
    generated_at: new Date().toISOString(),
    generator_script: GENERATOR_SCRIPT,
    note: "Workbook XLSX not generated — exceljs missing. Run npm install -D exceljs",
    core_schema_version: common["x-vilo-schema-version"] ?? "1.0.0",
    sheets: [],
  };
  for (const name of CORE_SHEETS) {
    const schemaPath = `core/${name}.schema.json`;
    const fullPath = join(SCHEMAS_DIR, schemaPath);
    const schema = loadJson(fullPath);
    const columns = buildColumnModel(schema, common);
    manifest.sheets.push(sheetManifestEntry(name, schemaPath, fullPath, columns));
  }
  mkdirSync(TEMPLATES_DIR, { recursive: true });
  const manifestPath = join(TEMPLATES_DIR, "cpst-workbook-v3.manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log("Wrote manifest only:", relative(ROOT, manifestPath));
}

function addOverviewSheet(workbook) {
  const ws = workbook.addWorksheet("Overview");
  const lines = [
    ["CPST Workbook v3 (Generated)"],
    [""],
    ["This workbook is generated from JSON Schemas (Phase 4C.2). Schemas are the source of truth."],
    ["Regenerate: node scripts/generate-cpst-workbook-v3.mjs"],
    [""],
    ["Sheet groups:"],
    ["  Core dictionaries — required for protocol-to-source compilation"],
    ["  Visit_Execution_Log — RUNTIME SUPPORT ONLY (not compiler design input)"],
    ["  Domain modules — optional overlays"],
    [""],
    ["Do not edit published templates retroactively. See Instructions sheet."],
  ];
  lines.forEach((row, i) => {
    ws.getRow(i + 1).values = row;
  });
  ws.getColumn(1).width = 100;
}

function addInstructionsSheet(workbook) {
  const ws = workbook.addWorksheet("Instructions");
  const lines = [
    "CPST Workbook v3 — Instructions",
    "",
    "1. This workbook is GENERATED from JSON Schemas. Schemas are the source of truth.",
    "2. Manual entry uses this workbook structure; protocol/PDF/AI ingestion must map into the same columns.",
    "3. Required fields are marked with * in column headers.",
    "4. Controlled lists must not be bypassed — use dropdowns on Controlled_Lists sheet.",
    "5. Technical ID columns (system IDs) — do not edit after publish.",
    "6. Visit_Execution_Log is RUNTIME SUPPORT ONLY — not compiler design input.",
    "7. Domain module sheets are optional overlays; enable via Domain Module Registry.",
    "8. No source generation until dictionary validation + human approval (Audit_and_Versioning).",
    "9. Published generated source definitions are immutable; amendments require new CPST version.",
    "",
    "Row layout on dictionary sheets:",
    "  Row 1 — Column headers (* = required)",
    "  Row 2 — EXAMPLE values from schema",
    "  Row 3 — VALIDATION hints from schema",
    "  Row 4+ — Data entry rows",
  ];
  lines.forEach((line, i) => {
    ws.getCell(i + 1, 1).value = line;
  });
  ws.getColumn(1).width = 110;
}

function addControlledListsSheet(workbook, rows, listRangeMap) {
  const ws = workbook.addWorksheet("Controlled_Lists");
  const headers = ["list_name", "sort_order", "item_value", "item_label", "notes"];
  ws.getRow(1).values = headers;
  styleHeaderRow(ws.getRow(1));
  rows.forEach((r, i) => {
    ws.getRow(i + 2).values = [r.list_name, r.sort_order, r.item_value, r.item_label, r.notes];
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  [28, 12, 24, 28, 40].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Dropdowns reference Controlled_Lists ranges directly (exceljs definedNames API is address-oriented).
}

function populateSchemaVersionSheet(ws, manifest) {
  const rows = [
    ["workbook_version", manifest.workbook_version],
    ["generated_at", manifest.generated_at],
    ["generator_script", manifest.generator_script],
    ["core_schema_version", manifest.core_schema_version],
    ["domain_schema_versions", JSON.stringify(manifest.domain_schema_versions)],
    ["notes", "Schemas are source of truth. Workbook is a generated editing interface."],
    [""],
    ["schema_path", "sha256"],
  ];
  rows.forEach((r, i) => ws.getRow(i + 1).values = r);
  let r = rows.length + 1;
  for (const [path, hash] of Object.entries(manifest.schema_hashes)) {
    ws.getRow(r).values = [path, hash];
    r += 1;
  }
  ws.getColumn(1).width = 48;
  ws.getColumn(2).width = 72;
}

function addDictionarySheet(
  workbook,
  { name, schemaPath, columns, runtime, banner, listRangeMap, tabColor }
) {
  const ws = workbook.addWorksheet(name);
  if (tabColor) ws.properties.tabColor = { argb: `FF${tabColor}` };
  if (runtime) ws.properties.tabColor = { argb: "FFFFF3E0" };

  let startRow = 1;
  if (banner) {
    ws.mergeCells(1, 1, 1, Math.max(columns.length, 1));
    const cell = ws.getCell(1, 1);
    cell.value = banner;
    cell.font = { bold: true, color: { argb: "FFB71C1C" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBEE" } };
    startRow = 2;
  }

  const headerRow = ws.getRow(startRow);
  headerRow.values = columns.map((c) => c.header);
  styleHeaderRow(headerRow, columns);

  const exampleRow = ws.getRow(startRow + 1);
  exampleRow.values = columns.map((c) => (c.example ? `[EXAMPLE] ${c.example}` : ""));
  exampleRow.font = { italic: true, color: { argb: "FF1565C0" } };

  const hintRow = ws.getRow(startRow + 2);
  hintRow.values = columns.map((c) => (c.validationHint ? `[VALIDATION] ${c.validationHint}` : ""));
  hintRow.font = { italic: true, color: { argb: "FF6A1B9A" } };

  columns.forEach((col, idx) => {
    const letter = colLetter(idx + 1);
    const colObj = ws.getColumn(idx + 1);
    colObj.width = Math.min(Math.max(col.key.length + 4, 14), 36);
    if (col.description) {
      try {
        ws.getCell(startRow, idx + 1).note = col.description;
      } catch {
        /* notes unsupported in some environments */
      }
    }
    if (col.enumList && !col.enumList.startsWith("inline:") && listRangeMap[col.enumList]) {
      const range = listRangeMap[col.enumList];
      const formulae = [`'Controlled_Lists'!$C$${range.start}:$C$${range.end}`];
      const fromRow = startRow + 3;
      const validationEndRow = startRow + 5002;
      ws.dataValidations.add(`${letter}${fromRow}:${letter}${validationEndRow}`, {
        type: "list",
        allowBlank: !col.required,
        formulae,
        showErrorMessage: true,
        error: `Select a value from controlled list: ${col.enumList}`,
      });
    } else if (col.resolved.enum) {
      const formulae = [`"${col.resolved.enum.join(",")}"`];
      const fromRow = startRow + 3;
      const validationEndRow = startRow + 5002;
      ws.dataValidations.add(`${letter}${fromRow}:${letter}${validationEndRow}`, {
        type: "list",
        allowBlank: !col.required,
        formulae,
      });
    } else if (col.resolved.type === "boolean") {
      const fromRow = startRow + 3;
      const validationEndRow = startRow + 5002;
      ws.dataValidations.add(`${letter}${fromRow}:${letter}${validationEndRow}`, {
        type: "list",
        allowBlank: !col.required,
        formulae: ['"TRUE,FALSE"'],
      });
    }
    if (col.technicalId) {
      for (let r = startRow + 3; r <= startRow + 200; r++) {
        const cell = ws.getCell(r, idx + 1);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFECEFF1" },
        };
        cell.protection = { locked: true };
      }
      headerRow.getCell(idx + 1).font = {
        ...(headerRow.getCell(idx + 1).font || {}),
        bold: true,
        color: { argb: "FF37474F" },
      };
    }
  });

  ws.views = [{ state: "frozen", ySplit: startRow + 2, activeCell: `A${startRow + 3}` }];

  // Light sheet protection for technical ID columns (user can unprotect to edit drafts)
  ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    formatColumns: true,
    formatRows: true,
  });
}

function styleHeaderRow(row, columns = []) {
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };
  if (columns.length) {
    columns.forEach((col, idx) => {
      if (col.required) {
        row.getCell(idx + 1).font = { bold: true, color: { argb: "FFC62828" } };
      }
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
