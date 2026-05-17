/**
 * Phase 4C.4 — Deterministic CPST → Canonical Runtime Graph compiler (skeleton).
 *
 * Run: node scripts/compile-cpst-runtime-graph.mjs [--input path] [--output path] [--strict]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = join(ROOT, "tmp/imports/cpst-workbook-v3.import.json");
const DEFAULT_OUTPUT = join(ROOT, "tmp/compiled/cpst-runtime-graph.json");
const COMPILER_VERSION = "0.1.0";

const DOMAIN_KEYS = [
  "oncology_module",
  "dose_escalation",
  "crossover_design",
  "adaptive_design_rules",
  "decentralized_workflows",
  "imaging_matrix",
  "device_trial_controls",
  "edc_reconciliation",
  "epro_workflows",
  "pediatric_consent_assent",
  "biospecimen_collection_module",
];

const DOMAIN_DICTIONARY = {
  oncology_module: "Oncology_Module",
  dose_escalation: "Dose_Escalation",
  crossover_design: "Crossover_Design",
  adaptive_design_rules: "Adaptive_Design_Rules",
  decentralized_workflows: "Decentralized_Workflows",
  imaging_matrix: "Imaging_Matrix",
  device_trial_controls: "Device_Trial_Controls",
  edc_reconciliation: "EDC_Reconciliation",
  epro_workflows: "ePRO_Workflows",
  pediatric_consent_assent: "Pediatric_Consent_Assent",
  biospecimen_collection_module: "Biospecimen_Collection_Module",
};

const BIOSPECIMEN_RUNTIME_CAPABILITIES = [
  "specimen_collection",
  "processing_tracking",
  "storage_tracking",
  "shipment_tracking",
  "chain_of_custody",
  "quality_deviation_capture",
];

function biospecimenRuntimeCapabilities(row) {
  const caps = [];
  if (row.collection_required === true || row.collection_datetime_required === true) caps.push("specimen_collection");
  if (row.processing_required === true || row.processing_time_required === true || row.aliquot_required === true) {
    caps.push("processing_tracking");
  }
  if (row.storage_required === true || row.storage_temperature_required === true || row.storage_location_required === true) {
    caps.push("storage_tracking");
  }
  if (row.shipment_required === true || row.courier_tracking_required === true || row.destination_lab_required === true) {
    caps.push("shipment_tracking");
  }
  if (row.chain_of_custody_required === true) caps.push("chain_of_custody");
  if (row.quality_check_required === true || row.deviation_capture_required === true) {
    caps.push("quality_deviation_capture");
  }
  return [...new Set(caps.length ? caps : BIOSPECIMEN_RUNTIME_CAPABILITIES)];
}

const SORT_CONFIG = {
  study_setup: "study_template_id",
  visit_groups: "visit_group_code",
  visit_templates: "visit_id",
  procedure_library: "procedure_id",
  visit_procedure_matrix: "matrix_row_id",
  conditional_rules: "rule_id",
  schedule_windows: "window_id",
  external_source_map: "external_source_id",
  substudy_map: "substudy_map_id",
  roles_signoff: "role_row_id",
  field_definitions: "field_row_id",
  audit_and_versioning: "version_row_id",
};

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, strict: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") args.strict = true;
    else if (a === "--input") args.input = resolve(argv[++i]);
    else if (a === "--output") args.output = resolve(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/compile-cpst-runtime-graph.mjs [--input path] [--output path] [--strict]`);
      process.exit(0);
    }
  }
  return args;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
}

function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith("_") || k === "x_vilo_provenance") continue;
    const n = normalizeValue(v);
    if (n !== null) out[k] = n;
  }
  return out;
}

function sortRows(rows, keyOrFn) {
  const copy = [...rows].map(normalizeRow);
  if (typeof keyOrFn === "function") {
    copy.sort(keyOrFn);
    return copy;
  }
  copy.sort((a, b) => String(a[keyOrFn] ?? "").localeCompare(String(b[keyOrFn] ?? "")));
  return copy;
}

function canonicalizeBundle(bundle) {
  const canonical = {
    schema_version: bundle.schema_version ?? "1.0.0",
    study_template_id: bundle.study_template_id ?? null,
    study_setup: sortRows(bundle.study_setup ?? [], SORT_CONFIG.study_setup),
    visit_groups: sortRows(bundle.visit_groups ?? [], SORT_CONFIG.visit_groups),
    visit_templates: sortRows(bundle.visit_templates ?? [], SORT_CONFIG.visit_templates),
    procedure_library: sortRows(bundle.procedure_library ?? [], SORT_CONFIG.procedure_library),
    visit_procedure_matrix: sortRows(bundle.visit_procedure_matrix ?? [], SORT_CONFIG.visit_procedure_matrix),
    conditional_rules: sortRows(bundle.conditional_rules ?? [], SORT_CONFIG.conditional_rules),
    schedule_windows: sortRows(bundle.schedule_windows ?? [], SORT_CONFIG.schedule_windows),
    external_source_map: sortRows(bundle.external_source_map ?? [], SORT_CONFIG.external_source_map),
    substudy_map: sortRows(bundle.substudy_map ?? [], SORT_CONFIG.substudy_map),
    roles_signoff: sortRows(bundle.roles_signoff ?? [], SORT_CONFIG.roles_signoff),
    value_lists: sortRows(bundle.value_lists ?? [], (a, b) =>
      `${a.list_code}:${a.item_code}`.localeCompare(`${b.list_code}:${b.item_code}`)
    ),
    field_definitions: sortRows(bundle.field_definitions ?? [], SORT_CONFIG.field_definitions),
    audit_and_versioning: sortRows(bundle.audit_and_versioning ?? [], SORT_CONFIG.audit_and_versioning),
    domain_modules: {},
  };
  for (const key of DOMAIN_KEYS) {
    canonical.domain_modules[key] = sortRows(bundle.domain_modules?.[key] ?? [], "module_row_id");
  }
  return canonical;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function canonicalJsonString(obj) {
  return stableStringify(obj);
}

function sha256Hex(payload) {
  return createHash("sha256").update(payload).digest("hex");
}

function inputHash(canonical) {
  return `sha256:${sha256Hex(canonicalJsonString(canonical))}`;
}

function shortHash(parts) {
  return createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 12);
}

function deterministicNodeId(nodeType, schemaVersion, dictionary, sourceRowId) {
  const h = shortHash(["node", nodeType, schemaVersion, dictionary, sourceRowId]);
  const prefix = nodeType.replace(/Node$/, "");
  return `node_${prefix}_${h}`;
}

function deterministicEdgeId(edgeType, schemaVersion, fromId, toId, sourceRowId) {
  const h = shortHash(["edge", edgeType, schemaVersion, fromId, toId, sourceRowId]);
  return `edge_${edgeType}_${h}`;
}

function graphIdFromInputHash(hash) {
  const hex = hash.replace(/^sha256:/, "").slice(0, 4).toUpperCase();
  return `CRG-${hex}`;
}

function provenance(dictionary, sourceRowId, schemaVersion, inputHashVal, fieldRefs = []) {
  return {
    source_dictionary: dictionary,
    source_row_id: sourceRowId,
    source_field_refs: fieldRefs,
    schema_version: schemaVersion,
    input_hash: inputHashVal,
  };
}

function makeNode({ id, node_type, label, source_dictionary, source_row_id, payload, schemaVersion, inputHashVal, fieldRefs = [] }) {
  return {
    id,
    node_type,
    label,
    source_dictionary,
    source_row_id,
    source_field_refs: fieldRefs,
    payload: payload ?? {},
    provenance: provenance(source_dictionary, source_row_id, schemaVersion, inputHashVal, fieldRefs),
  };
}

function makeEdge({ id, edge_type, from, to, source_dictionary, source_row_id, schemaVersion, inputHashVal }) {
  return {
    id,
    edge_type,
    from,
    to,
    source_dictionary,
    source_row_id,
    provenance: provenance(source_dictionary, source_row_id, schemaVersion, inputHashVal),
  };
}

function err(errors, code, message, context = {}) {
  errors.push({ error_code: code, message, ...context });
}

function warn(warnings, code, message, context = {}) {
  warnings.push({ error_code: code, message, ...context });
}

function countSourceRows(c) {
  let n = 0;
  for (const k of Object.keys(SORT_CONFIG)) n += (c[k] ?? []).length;
  for (const k of DOMAIN_KEYS) n += (c.domain_modules[k] ?? []).length;
  return n;
}

function hasDependentRows(c) {
  return countSourceRows(c) > (c.study_setup?.length ?? 0);
}

function compile(canonical, schemaVersion, inputHashVal) {
  const errors = [];
  const warnings = [];
  const nodes = [];
  const edges = [];
  const provenanceMap = {};
  const nodeIndex = new Map();

  const registerNode = (node) => {
    const key = `${node.node_type}:${node.source_row_id}`;
    if (nodeIndex.has(key)) {
      err(errors, "DUPLICATE_NODE", `Duplicate node for ${key}`, {
        source_dictionary: node.source_dictionary,
        source_row_id: node.source_row_id,
      });
      return null;
    }
    nodeIndex.set(key, node);
    nodes.push(node);
    provenanceMap[node.id] = node.provenance;
    return node;
  };

  const getNode = (nodeType, sourceRowId) => nodeIndex.get(`${nodeType}:${sourceRowId}`);

  const addEdge = (edge_type, fromNode, toNode, source_dictionary, source_row_id) => {
    if (!fromNode || !toNode) return;
    const id = deterministicEdgeId(edge_type, schemaVersion, fromNode.id, toNode.id, source_row_id);
    const edge = makeEdge({
      id,
      edge_type,
      from: fromNode.id,
      to: toNode.id,
      source_dictionary,
      source_row_id,
      schemaVersion,
      inputHashVal,
    });
    edges.push(edge);
    provenanceMap[edge.id] = edge.provenance;
  };

  // --- duplicate technical IDs within dictionaries ---
  const dupCheck = [
    ["study_setup", "study_template_id", "Study_Setup"],
    ["visit_groups", "visit_group_code", "Visit_Groups"],
    ["visit_templates", "visit_id", "Visit_Templates"],
    ["procedure_library", "procedure_id", "Procedure_Library"],
    ["visit_procedure_matrix", "matrix_row_id", "Visit_Procedure_Matrix"],
    ["conditional_rules", "rule_id", "Conditional_Rules"],
    ["schedule_windows", "window_id", "Schedule_Windows"],
    ["external_source_map", "external_source_id", "External_Source_Map"],
    ["substudy_map", "substudy_map_id", "Substudy_Map"],
    ["roles_signoff", "role_row_id", "Roles_Signoff"],
    ["field_definitions", "field_row_id", "Field_Definitions"],
    ["audit_and_versioning", "version_row_id", "Audit_and_Versioning"],
  ];
  for (const [arrKey, idField, dict] of dupCheck) {
    const seen = new Set();
    for (const row of canonical[arrKey] ?? []) {
      const id = row[idField];
      if (seen.has(id)) {
        err(errors, "DUPLICATE_TECHNICAL_ID", `Duplicate ${idField} "${id}" in ${dict}`, {
          source_dictionary: dict,
          source_row_id: id,
        });
      }
      seen.add(id);
    }
  }

  const rowCount = countSourceRows(canonical);
  if (rowCount === 0) {
    warn(warnings, "EMPTY_CPST_BUNDLE", "No dictionary rows in CPST bundle");
  }
  if ((canonical.study_setup?.length ?? 0) === 0 && hasDependentRows(canonical)) {
    err(errors, "MISSING_STUDY_SETUP", "Study_Setup row required when other dictionaries have rows");
  }
  if ((canonical.study_setup?.length ?? 0) === 0) {
    warn(warnings, "NO_STUDY_SETUP", "No Study_Setup row present");
  }

  const cpstVersion =
    canonical.study_setup[0]?.cpst_version ??
    canonical.audit_and_versioning[0]?.cpst_version ??
    "v0.0.0";

  // --- core nodes ---
  for (const row of canonical.study_setup) {
    const rowId = row.study_template_id;
    registerNode(
      makeNode({
        id: deterministicNodeId("StudyTemplateNode", schemaVersion, "Study_Setup", rowId),
        node_type: "StudyTemplateNode",
        label: row.protocol_number ?? rowId,
        source_dictionary: "Study_Setup",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  for (const row of canonical.audit_and_versioning) {
    const rowId = row.version_row_id;
    registerNode(
      makeNode({
        id: deterministicNodeId("VersionNode", schemaVersion, "Audit_and_Versioning", rowId),
        node_type: "VersionNode",
        label: row.cpst_version ?? rowId,
        source_dictionary: "Audit_and_Versioning",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  for (const row of canonical.visit_groups) {
    const rowId = row.visit_group_code;
    registerNode(
      makeNode({
        id: deterministicNodeId("VisitGroupNode", schemaVersion, "Visit_Groups", rowId),
        node_type: "VisitGroupNode",
        label: row.visit_group_label ?? rowId,
        source_dictionary: "Visit_Groups",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  for (const row of canonical.visit_templates) {
    const rowId = row.visit_id;
    registerNode(
      makeNode({
        id: deterministicNodeId("VisitNode", schemaVersion, "Visit_Templates", rowId),
        node_type: "VisitNode",
        label: row.visit_label ?? rowId,
        source_dictionary: "Visit_Templates",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  for (const row of canonical.procedure_library) {
    const rowId = row.procedure_id;
    registerNode(
      makeNode({
        id: deterministicNodeId("ProcedureNode", schemaVersion, "Procedure_Library", rowId),
        node_type: "ProcedureNode",
        label: row.procedure_label ?? rowId,
        source_dictionary: "Procedure_Library",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  for (const row of canonical.field_definitions) {
    const rowId = row.field_row_id;
    if (!row.procedure_id) {
      err(errors, "FIELD_MISSING_PROCEDURE", "Field_Definitions row missing procedure_id", {
        source_dictionary: "Field_Definitions",
        source_row_id: rowId,
        field: "procedure_id",
      });
    }
    registerNode(
      makeNode({
        id: deterministicNodeId("FieldNode", schemaVersion, "Field_Definitions", rowId),
        node_type: "FieldNode",
        label: row.display_label ?? row.field_key ?? rowId,
        source_dictionary: "Field_Definitions",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
        fieldRefs: ["field_key", "procedure_id"],
      })
    );
    if (row.validation_expression || row.is_required) {
      const vId = deterministicNodeId(
        "ValidationRuleNode",
        schemaVersion,
        "Field_Definitions",
        `${rowId}:validation`
      );
      registerNode(
        makeNode({
          id: vId,
          node_type: "ValidationRuleNode",
          label: `Validation:${row.field_key ?? rowId}`,
          source_dictionary: "Field_Definitions",
          source_row_id: rowId,
          payload: {
            field_row_id: rowId,
            validation_expression: row.validation_expression ?? null,
            is_required: row.is_required ?? false,
          },
          schemaVersion,
          inputHashVal,
          fieldRefs: ["validation_expression", "is_required"],
        })
      );
    }
  }

  for (const row of canonical.conditional_rules) {
    const rowId = row.rule_id;
    registerNode(
      makeNode({
        id: deterministicNodeId("RuleNode", schemaVersion, "Conditional_Rules", rowId),
        node_type: "RuleNode",
        label: row.rule_id,
        source_dictionary: "Conditional_Rules",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  for (const row of canonical.schedule_windows) {
    const rowId = row.window_id;
    if (
      row.window_min != null &&
      row.window_max != null &&
      Number(row.window_min) > Number(row.window_max)
    ) {
      err(errors, "WINDOW_MIN_GT_MAX", "Schedule_Windows window_min > window_max", {
        source_dictionary: "Schedule_Windows",
        source_row_id: rowId,
      });
    }
    registerNode(
      makeNode({
        id: deterministicNodeId("WindowNode", schemaVersion, "Schedule_Windows", rowId),
        node_type: "WindowNode",
        label: rowId,
        source_dictionary: "Schedule_Windows",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  for (const row of canonical.external_source_map) {
    const rowId = row.external_source_id;
    registerNode(
      makeNode({
        id: deterministicNodeId("ExternalSourceNode", schemaVersion, "External_Source_Map", rowId),
        node_type: "ExternalSourceNode",
        label: row.system_name ?? rowId,
        source_dictionary: "External_Source_Map",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  for (const row of canonical.substudy_map) {
    const rowId = row.substudy_map_id;
    registerNode(
      makeNode({
        id: deterministicNodeId("SubstudyNode", schemaVersion, "Substudy_Map", rowId),
        node_type: "SubstudyNode",
        label: row.substudy_code ?? rowId,
        source_dictionary: "Substudy_Map",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  for (const row of canonical.roles_signoff) {
    const rowId = row.role_row_id;
    registerNode(
      makeNode({
        id: deterministicNodeId("RoleNode", schemaVersion, "Roles_Signoff", rowId),
        node_type: "RoleNode",
        label: `${row.role_code}@${row.scope_type}:${row.scope_id}`,
        source_dictionary: "Roles_Signoff",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  for (const key of DOMAIN_KEYS) {
    const dict = DOMAIN_DICTIONARY[key];
    for (const row of canonical.domain_modules[key] ?? []) {
      const rowId = row.module_row_id;
      if (row.visit_id && !getNode("VisitNode", row.visit_id)) {
        err(errors, "DOMAIN_MISSING_VISIT", `Domain row references missing visit_id ${row.visit_id}`, {
          source_dictionary: dict,
          source_row_id: rowId,
          field: "visit_id",
        });
      }
      if (row.procedure_id && !getNode("ProcedureNode", row.procedure_id)) {
        err(errors, "DOMAIN_MISSING_PROCEDURE", `Domain row references missing procedure_id ${row.procedure_id}`, {
          source_dictionary: dict,
          source_row_id: rowId,
          field: "procedure_id",
        });
      }
      const payload =
        key === "biospecimen_collection_module"
          ? { ...row, runtime_capabilities: biospecimenRuntimeCapabilities(row) }
          : row;
      registerNode(
        makeNode({
          id: deterministicNodeId("DomainModuleNode", schemaVersion, dict, rowId),
          node_type: "DomainModuleNode",
          label: row.module_id ?? rowId,
          source_dictionary: dict,
          source_row_id: rowId,
          payload,
          schemaVersion,
          inputHashVal,
        })
      );
    }
  }

  // SignatureRequirementNode from procedures + matrix overrides
  for (const row of canonical.procedure_library) {
    if (row.signature_required === true) {
      const sigId = `${row.procedure_id}:signature`;
      registerNode(
        makeNode({
          id: deterministicNodeId("SignatureRequirementNode", schemaVersion, "Procedure_Library", sigId),
          node_type: "SignatureRequirementNode",
          label: `Sign:${row.procedure_label ?? row.procedure_id}`,
          source_dictionary: "Procedure_Library",
          source_row_id: row.procedure_id,
          payload: { procedure_id: row.procedure_id, signature_required: true },
          schemaVersion,
          inputHashVal,
          fieldRefs: ["signature_required"],
        })
      );
    }
    if (row.external_reference_required === true) {
      const hasMap = canonical.external_source_map.some((m) => m.procedure_id === row.procedure_id);
      if (!hasMap) {
        err(errors, "EXTERNAL_MAP_MISSING", "external_reference_required but no External_Source_Map row", {
          source_dictionary: "Procedure_Library",
          source_row_id: row.procedure_id,
          field: "external_reference_required",
        });
      }
    }
    if (row.source_type === "external") {
      const hasMap = canonical.external_source_map.some((m) => m.procedure_id === row.procedure_id);
      if (!hasMap) {
        warn(warnings, "EXTERNAL_SOURCE_TYPE_NO_MAP", "source_type=external without External_Source_Map row", {
          source_dictionary: "Procedure_Library",
          source_row_id: row.procedure_id,
        });
      }
    }
  }

  for (const row of canonical.visit_procedure_matrix) {
    const rowId = row.matrix_row_id;
    const visitNode = getNode("VisitNode", row.visit_id);
    const procNode = getNode("ProcedureNode", row.procedure_id);
    if (!row.visit_id) {
      err(errors, "MATRIX_MISSING_VISIT", "Visit_Procedure_Matrix missing visit_id", {
        source_dictionary: "Visit_Procedure_Matrix",
        source_row_id: rowId,
        field: "visit_id",
      });
    } else if (!visitNode) {
      err(errors, "MATRIX_VISIT_NOT_FOUND", `Visit_ID ${row.visit_id} not found in Visit_Templates`, {
        source_dictionary: "Visit_Procedure_Matrix",
        source_row_id: rowId,
        field: "visit_id",
      });
    }
    if (!row.procedure_id) {
      err(errors, "MATRIX_MISSING_PROCEDURE", "Visit_Procedure_Matrix missing procedure_id", {
        source_dictionary: "Visit_Procedure_Matrix",
        source_row_id: rowId,
        field: "procedure_id",
      });
    } else if (!procNode) {
      err(errors, "MATRIX_PROCEDURE_NOT_FOUND", `Procedure_ID ${row.procedure_id} not found in Procedure_Library`, {
        source_dictionary: "Visit_Procedure_Matrix",
        source_row_id: rowId,
        field: "procedure_id",
      });
    }
    if (
      (row.conditional_flag === true || row.matrix_marker === "conditional") &&
      !row.condition_rule_id
    ) {
      err(errors, "CONDITIONAL_WITHOUT_RULE", "Conditional matrix row missing condition_rule_id", {
        source_dictionary: "Visit_Procedure_Matrix",
        source_row_id: rowId,
        field: "condition_rule_id",
      });
    }
    if (row.signature_override === true) {
      const sigId = `${rowId}:signature_override`;
      registerNode(
        makeNode({
          id: deterministicNodeId("SignatureRequirementNode", schemaVersion, "Visit_Procedure_Matrix", sigId),
          node_type: "SignatureRequirementNode",
          label: `SignOverride:${rowId}`,
          source_dictionary: "Visit_Procedure_Matrix",
          source_row_id: rowId,
          payload: { matrix_row_id: rowId, signature_override: true },
          schemaVersion,
          inputHashVal,
          fieldRefs: ["signature_override"],
        })
      );
    }
    registerNode(
      makeNode({
        id: deterministicNodeId("RuntimeExpectationNode", schemaVersion, "Visit_Procedure_Matrix", rowId),
        node_type: "RuntimeExpectationNode",
        label: `Expect:${row.visit_id ?? "?"}×${row.procedure_id ?? "?"}`,
        source_dictionary: "Visit_Procedure_Matrix",
        source_row_id: rowId,
        payload: row,
        schemaVersion,
        inputHashVal,
      })
    );
  }

  // --- edges ---
  const studyNode = canonical.study_setup[0]
    ? getNode("StudyTemplateNode", canonical.study_setup[0].study_template_id)
    : null;

  for (const vg of canonical.visit_groups) {
    const vgNode = getNode("VisitGroupNode", vg.visit_group_code);
    if (studyNode && vgNode) {
      addEdge("contains", studyNode, vgNode, "Visit_Groups", vg.visit_group_code);
    }
    for (const vt of canonical.visit_templates) {
      if (vt.visit_group_code === vg.visit_group_code) {
        const vtNode = getNode("VisitNode", vt.visit_id);
        if (vgNode && vtNode) addEdge("contains", vgNode, vtNode, "Visit_Templates", vt.visit_id);
      }
    }
  }

  for (const proc of canonical.procedure_library) {
    const procNode = getNode("ProcedureNode", proc.procedure_id);
    if (studyNode && procNode) {
      addEdge("contains", studyNode, procNode, "Procedure_Library", proc.procedure_id);
    }
  }

  for (const row of canonical.visit_procedure_matrix) {
    const visitNode = getNode("VisitNode", row.visit_id);
    const procNode = getNode("ProcedureNode", row.procedure_id);
    const expectNode = getNode("RuntimeExpectationNode", row.matrix_row_id);
    if (visitNode && procNode) {
      let edgeType = "assigned_to_visit";
      if (row.matrix_marker === "required") edgeType = "requires";
      else if (row.matrix_marker === "optional") edgeType = "optional_for";
      addEdge(edgeType, visitNode, procNode, "Visit_Procedure_Matrix", row.matrix_row_id);
    }
    if (row.condition_rule_id) {
      const ruleNode = getNode("RuleNode", row.condition_rule_id);
      if (ruleNode && expectNode) addEdge("conditional_on", ruleNode, expectNode, "Visit_Procedure_Matrix", row.matrix_row_id);
      else if (!ruleNode) {
        err(errors, "RULE_NOT_FOUND", `Condition rule ${row.condition_rule_id} not found`, {
          source_dictionary: "Visit_Procedure_Matrix",
          source_row_id: row.matrix_row_id,
        });
      }
    }
    if (expectNode && procNode) addEdge("triggers", expectNode, procNode, "Visit_Procedure_Matrix", row.matrix_row_id);
  }

  for (const win of canonical.schedule_windows) {
    const winNode = getNode("WindowNode", win.window_id);
    const visitNode = getNode("VisitNode", win.visit_id);
    if (winNode && visitNode) addEdge("occurs_within", visitNode, winNode, "Schedule_Windows", win.window_id);
    else if (!visitNode && win.visit_id) {
      err(errors, "WINDOW_VISIT_NOT_FOUND", `Visit_ID ${win.visit_id} not found for window`, {
        source_dictionary: "Schedule_Windows",
        source_row_id: win.window_id,
      });
    }
  }

  for (const ext of canonical.external_source_map) {
    const extNode = getNode("ExternalSourceNode", ext.external_source_id);
    const procNode = getNode("ProcedureNode", ext.procedure_id);
    if (extNode && procNode) addEdge("sourced_from", procNode, extNode, "External_Source_Map", ext.external_source_id);
    else if (!procNode) {
      err(errors, "EXTERNAL_PROCEDURE_NOT_FOUND", `Procedure_ID ${ext.procedure_id} not found`, {
        source_dictionary: "External_Source_Map",
        source_row_id: ext.external_source_id,
      });
    }
  }

  for (const sub of canonical.substudy_map) {
    const subNode = getNode("SubstudyNode", sub.substudy_map_id);
    if (sub.visit_id) {
      const vt = getNode("VisitNode", sub.visit_id);
      if (subNode && vt) addEdge("applies_to_cohort", subNode, vt, "Substudy_Map", sub.substudy_map_id);
      else if (!vt) {
        err(errors, "SUBSTUDY_VISIT_NOT_FOUND", `Visit_ID ${sub.visit_id} not found`, {
          source_dictionary: "Substudy_Map",
          source_row_id: sub.substudy_map_id,
        });
      }
    }
    if (sub.procedure_id) {
      const proc = getNode("ProcedureNode", sub.procedure_id);
      if (subNode && proc) addEdge("applies_to_cohort", subNode, proc, "Substudy_Map", sub.substudy_map_id);
      else if (!proc) {
        err(errors, "SUBSTUDY_PROCEDURE_NOT_FOUND", `Procedure_ID ${sub.procedure_id} not found`, {
          source_dictionary: "Substudy_Map",
          source_row_id: sub.substudy_map_id,
        });
      }
    }
  }

  for (const rule of canonical.conditional_rules) {
    const ruleNode = getNode("RuleNode", rule.rule_id);
    if (!ruleNode) continue;
    let target = null;
    if (rule.trigger_visit_id) target = getNode("VisitNode", rule.trigger_visit_id);
    else if (rule.trigger_procedure_id) target = getNode("ProcedureNode", rule.trigger_procedure_id);
  if (target) addEdge("conditional_on", ruleNode, target, "Conditional_Rules", rule.rule_id);
    else if (rule.trigger_entity === "visit" && rule.trigger_visit_id) {
      err(errors, "RULE_TRIGGER_NOT_FOUND", `Trigger visit ${rule.trigger_visit_id} not found`, {
        source_dictionary: "Conditional_Rules",
        source_row_id: rule.rule_id,
      });
    }
  }

  const signersByScope = new Map();
  for (const role of canonical.roles_signoff) {
    if (role.can_sign === true) {
      const sk = `${role.scope_type}:${role.scope_id}`;
      if (!signersByScope.has(sk)) signersByScope.set(sk, []);
      signersByScope.get(sk).push(role);
    }
    const roleNode = getNode("RoleNode", role.role_row_id);
    if (role.can_review === true && role.scope_type === "procedure") {
      const proc = getNode("ProcedureNode", role.scope_id);
      if (roleNode && proc) addEdge("reviewed_by", proc, roleNode, "Roles_Signoff", role.role_row_id);
    }
  }

  for (const proc of canonical.procedure_library) {
    if (proc.signature_required === true) {
      const sk = `procedure:${proc.procedure_id}`;
      const signers = signersByScope.get(sk) ?? [];
      if (signers.length === 0) {
        err(errors, "SIGNATURE_NO_SIGNER", "signature_required but no Roles_Signoff can_sign for procedure scope", {
          source_dictionary: "Procedure_Library",
          source_row_id: proc.procedure_id,
        });
      }
      const sigNode = getNode("SignatureRequirementNode", `${proc.procedure_id}:signature`);
      const procNode = getNode("ProcedureNode", proc.procedure_id);
      for (const role of signers) {
        const roleNode = getNode("RoleNode", role.role_row_id);
        if (sigNode && roleNode) addEdge("signed_by", sigNode, roleNode, "Roles_Signoff", role.role_row_id);
      }
      if (sigNode && procNode) addEdge("requires", procNode, sigNode, "Procedure_Library", proc.procedure_id);
    }
  }

  for (const field of canonical.field_definitions) {
    const fieldNode = getNode("FieldNode", field.field_row_id);
    const procNode = field.procedure_id ? getNode("ProcedureNode", field.procedure_id) : null;
    if (fieldNode && procNode) addEdge("belongs_to", fieldNode, procNode, "Field_Definitions", field.field_row_id);
    else if (field.procedure_id && !procNode) {
      err(errors, "FIELD_PROCEDURE_NOT_FOUND", `procedure_id ${field.procedure_id} not found`, {
        source_dictionary: "Field_Definitions",
        source_row_id: field.field_row_id,
      });
    }
    const valNode = getNode("ValidationRuleNode", `${field.field_row_id}:validation`);
    if (fieldNode && valNode) addEdge("requires", fieldNode, valNode, "Field_Definitions", field.field_row_id);
    for (const exp of canonical.visit_procedure_matrix) {
      if (exp.procedure_id === field.procedure_id) {
        const expectNode = getNode("RuntimeExpectationNode", exp.matrix_row_id);
        if (expectNode && fieldNode) addEdge("generates_source", expectNode, fieldNode, "Field_Definitions", field.field_row_id);
      }
    }
  }

  for (const key of DOMAIN_KEYS) {
    const dict = DOMAIN_DICTIONARY[key];
    for (const row of canonical.domain_modules[key] ?? []) {
      const modNode = getNode("DomainModuleNode", row.module_row_id);
      if (!modNode) continue;
      if (row.study_template_id && studyNode) {
        addEdge("belongs_to", modNode, studyNode, dict, row.module_row_id);
        if (key === "biospecimen_collection_module") {
          addEdge("applies_to", modNode, studyNode, dict, row.module_row_id);
        }
      }
      if (row.visit_id) {
        const vt = getNode("VisitNode", row.visit_id);
        if (vt) {
          addEdge("assigned_to_visit", modNode, vt, dict, row.module_row_id);
          if (key === "biospecimen_collection_module") {
            addEdge("applies_to", modNode, vt, dict, row.module_row_id);
          }
        }
      }
      if (row.procedure_id) {
        const proc = getNode("ProcedureNode", row.procedure_id);
        if (proc) {
          addEdge("requires", modNode, proc, dict, row.module_row_id);
          if (key === "biospecimen_collection_module") {
            addEdge("applies_to", modNode, proc, dict, row.module_row_id);
          }
        }
      }
    }
  }

  for (const audit of canonical.audit_and_versioning) {
    if (!audit.supersedes_cpst_version) continue;
    const versionNode = getNode("VersionNode", audit.version_row_id);
    const prior = canonical.audit_and_versioning.find((a) => a.cpst_version === audit.supersedes_cpst_version);
    if (versionNode && prior) {
      const priorNode = getNode("VersionNode", prior.version_row_id);
      if (priorNode) addEdge("supersedes", versionNode, priorNode, "Audit_and_Versioning", audit.version_row_id);
    } else if (!prior) {
      warn(warnings, "SUPERSEDES_VERSION_NOT_FOUND", `supersedes_cpst_version ${audit.supersedes_cpst_version} not in bundle`, {
        source_dictionary: "Audit_and_Versioning",
        source_row_id: audit.version_row_id,
      });
    }
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => a.id.localeCompare(b.id));

  let validation_status = "valid";
  if (warnings.length > 0 && errors.length === 0) validation_status = "warning";
  if (errors.length > 0) validation_status = "invalid";

  const hash = inputHashVal;
  const graph_id = graphIdFromInputHash(hash);

  return {
    graph_id,
    schema_version: schemaVersion,
    cpst_version: cpstVersion,
    compiled_at: new Date().toISOString(),
    input_hash: hash,
    compiler_version: COMPILER_VERSION,
    deterministic: true,
    nodes,
    edges,
    provenance_map: provenanceMap,
    validation_report: {
      validation_status,
      errors,
      warnings,
    },
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      source_rows: rowCount,
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(args.input)) {
    console.error("Input not found:", args.input);
    process.exit(1);
  }

  const imported = loadJson(args.input);
  if (imported.status === "invalid") {
    console.error("Import JSON status is invalid; fix import before compile.");
    if (args.strict) process.exit(1);
  }

  const bundle = imported.cpst_bundle ?? imported.data;
  if (!bundle) {
    console.error("No cpst_bundle or data in import file");
    process.exit(1);
  }

  const canonical = canonicalizeBundle(bundle);
  const schemaVersion = canonical.schema_version ?? imported.schema_version ?? "1.0.0";
  const hash = inputHash(canonical);

  const graph1 = compile(canonical, schemaVersion, hash);
  const graph2 = compile(canonical, schemaVersion, hash);

  const ids1 = graph1.nodes.map((n) => n.id).join(",");
  const ids2 = graph2.nodes.map((n) => n.id).join(",");
  const e1 = graph1.edges.map((e) => e.id).join(",");
  const e2 = graph2.edges.map((e) => e.id).join(",");
  if (graph1.graph_id !== graph2.graph_id || ids1 !== ids2 || e1 !== e2) {
    console.error("Determinism check failed: repeated compile produced different graph");
    process.exit(1);
  }

  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(graph1, null, 2)}\n`, "utf8");

  console.log("Graph ID:", graph1.graph_id);
  console.log("Input hash:", graph1.input_hash);
  console.log("Validation:", graph1.validation_report.validation_status);
  console.log("Nodes:", graph1.counts.nodes, "Edges:", graph1.counts.edges);
  console.log("Errors:", graph1.validation_report.errors.length);
  console.log("Warnings:", graph1.validation_report.warnings.length);
  console.log("Output:", relative(ROOT, args.output));

  if (args.strict && graph1.validation_report.validation_status === "invalid") process.exit(1);
}

main();
