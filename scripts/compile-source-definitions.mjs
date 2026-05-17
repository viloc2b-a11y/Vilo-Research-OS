/**
 * Phase 4C.5 — Canonical Runtime Graph → Source Definition Compiler (skeleton).
 *
 * Run: node scripts/compile-source-definitions.mjs [--input path] [--output path] [--strict]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = join(ROOT, "tmp/compiled/cpst-runtime-graph.golden-basic.json");
const DEFAULT_OUTPUT = join(ROOT, "tmp/compiled/source-definitions.golden-basic.json");
const COMPILER_VERSION = "0.1.0";

const VISIT_PROC_EDGE_TYPES = new Set(["assigned_to_visit", "requires", "optional_for"]);
const EXTERNAL_SOURCE_TYPES = new Set(["external", "device_vendor"]);

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, strict: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") args.strict = true;
    else if (a === "--input") args.input = resolve(argv[++i]);
    else if (a === "--output") args.output = resolve(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/compile-source-definitions.mjs [--input path] [--output path] [--strict]`);
      process.exit(0);
    }
  }
  return args;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function shortHash(parts) {
  return createHash("sha256").update(parts.filter((p) => p != null).join("|")).digest("hex").slice(0, 12);
}

function detId(prefix, graphId, ...parts) {
  return `${prefix}_${graphId}_${shortHash(parts)}`;
}

function provFrom(nodeOrEdge, crg) {
  const p = nodeOrEdge.provenance ?? {};
  return {
    source_dictionary: p.source_dictionary ?? nodeOrEdge.source_dictionary,
    source_row_id: p.source_row_id ?? nodeOrEdge.source_row_id,
    source_field_refs: p.source_field_refs ?? nodeOrEdge.source_field_refs ?? [],
    schema_version: p.schema_version ?? crg.schema_version,
    input_hash: p.input_hash ?? crg.input_hash,
    crg_node_id: nodeOrEdge.id ?? null,
    crg_edge_id: nodeOrEdge.edge_id ?? null,
  };
}

class CrgIndex {
  constructor(crg) {
    this.crg = crg;
    this.nodesById = new Map(crg.nodes.map((n) => [n.id, n]));
    this.out = new Map();
    this.in = new Map();
    for (const e of crg.edges) {
      if (!this.out.has(e.from)) this.out.set(e.from, []);
      this.out.get(e.from).push(e);
      if (!this.in.has(e.to)) this.in.set(e.to, []);
      this.in.get(e.to).push(e);
    }
  }

  nodesOfType(type) {
    return this.crg.nodes.filter((n) => n.node_type === type).sort((a, b) => a.id.localeCompare(b.id));
  }

  node(id) {
    return this.nodesById.get(id);
  }

  outEdges(fromId, types = null) {
    const list = this.out.get(fromId) ?? [];
    if (!types) return list;
    const set = types instanceof Set ? types : new Set(types);
    return list.filter((e) => set.has(e.edge_type));
  }

  inEdges(toId, types = null) {
    const list = this.in.get(toId) ?? [];
    if (!types) return list;
    const set = types instanceof Set ? types : new Set(types);
    return list.filter((e) => set.has(e.edge_type));
  }
}

function matrixMarkerToRequiredness(marker) {
  if (marker === "required") return "required";
  if (marker === "optional") return "optional";
  if (marker === "conditional") return "conditional";
  return "not_applicable";
}

function isExternalSourceType(sourceType) {
  return EXTERNAL_SOURCE_TYPES.has(sourceType);
}

function findExpectation(index, visitId, procedureId) {
  return index.nodesOfType("RuntimeExpectationNode").find(
    (n) => n.payload.visit_id === visitId && n.payload.procedure_id === procedureId
  );
}

function fieldsForProcedure(index, procedureNode) {
  const procId = procedureNode.payload.procedure_id;
  const fields = new Map();
  for (const e of index.outEdges(procedureNode.id, ["belongs_to"])) {
    const n = index.node(e.to);
    if (n?.node_type === "FieldNode") fields.set(n.id, n);
  }
  for (const e of index.inEdges(procedureNode.id, ["belongs_to"])) {
    const n = index.node(e.from);
    if (n?.node_type === "FieldNode") fields.set(n.id, n);
  }
  for (const f of index.nodesOfType("FieldNode")) {
    if (f.payload.procedure_id === procId) fields.set(f.id, f);
  }
  return [...fields.values()].sort((a, b) =>
    String(a.payload.field_key).localeCompare(String(b.payload.field_key))
  );
}

function externalSourcesForProcedure(index, procedureNode) {
  const procId = procedureNode.payload.procedure_id;
  const found = new Map();
  for (const ext of index.nodesOfType("ExternalSourceNode")) {
    if (ext.payload.procedure_id === procId) found.set(ext.id, ext);
  }
  for (const e of index.outEdges(procedureNode.id, ["sourced_from"])) {
    const ext = index.node(e.to);
    if (ext?.node_type === "ExternalSourceNode") found.set(ext.id, ext);
  }
  return [...found.values()];
}

function signatureRequiredFor(index, procedureNode, expectation) {
  if (procedureNode.payload.signature_required === true) return true;
  if (expectation?.payload.signature_override === true) return true;
  const sigId = `${procedureNode.payload.procedure_id}:signature`;
  return index.nodesOfType("SignatureRequirementNode").some(
    (n) => n.source_row_id === procedureNode.payload.procedure_id || n.source_row_id?.startsWith(sigId)
  );
}

function signersForProcedure(index, procedureId) {
  return index.nodesOfType("RoleNode").filter(
    (r) => r.payload.scope_type === "procedure" && r.payload.scope_id === procedureId && r.payload.can_sign === true
  );
}

function validationNodeForField(index, fieldNode) {
  const key = `${fieldNode.source_row_id}:validation`;
  return index.nodesOfType("ValidationRuleNode").find((n) => n.source_row_id === fieldNode.source_row_id || n.id.includes("validation"));
}

const BIOSPECIMEN_MODULE_ID = "MOD-biospecimen_collection";
const BIOSPECIMEN_DICTIONARY = "Biospecimen_Collection_Module";

/** Compiler-level validation skeletons (module context; fields must exist in Field_Definitions). */
const BIOSPECIMEN_VALIDATION_SKELETONS = [
  { field_key: "consent_obtained", rule_type: "expression", expression: "consent_obtained == true", code: "BIO_CONSENT_BEFORE_COLLECTION", message: "Consent must be verified before specimen collection" },
  { field_key: "label_id", rule_type: "expression", expression: "label_id != null && label_id != ''", code: "BIO_LABEL_ID_PRESENT", message: "Unique label ID required for traceability" },
  { field_key: "quantity_collected", rule_type: "expression", expression: "quantity_collected > 0", code: "BIO_QTY_POSITIVE", message: "Quantity collected must be greater than zero" },
  { field_key: "processing_time", rule_type: "expression", expression: "processing_time >= collection_time", code: "BIO_PROCESS_AFTER_COLLECTION", message: "Processing time must be on or after collection time when same-day" },
  { field_key: "ship_date", rule_type: "expression", expression: "ship_date >= storage_date", code: "BIO_SHIP_AFTER_STORAGE", message: "Ship date must be on or after storage date when both present" },
  { field_key: "rejection_reason", rule_type: "expression", expression: "sample_rejected != true || (rejection_reason != null && rejection_reason != '')", code: "BIO_REJECTION_REASON", message: "Rejection reason required when sample is rejected" },
  { field_key: "deviation_description", rule_type: "expression", expression: "deviation_flag != true || (deviation_description != null && deviation_description != '')", code: "BIO_DEVIATION_DESC", message: "Deviation description required when deviation flag is set" },
  { field_key: "reviewed_by", rule_type: "expression", expression: "source_complete != true || (reviewed_by != null && reviewed_by != '')", code: "BIO_CLOSEOUT_REVIEWER", message: "Reviewed by required when source is complete" },
  { field_key: "reviewed_date", rule_type: "expression", expression: "source_complete != true || reviewed_date != null", code: "BIO_CLOSEOUT_REVIEW_DATE", message: "Reviewed date required when source is complete" },
];

function biospecimenModuleProvenance(dom, moduleFieldRef, generatedFieldKey, crg) {
  return {
    source_dictionary: BIOSPECIMEN_DICTIONARY,
    source_row_id: dom.source_row_id,
    source_field_refs: [moduleFieldRef],
    schema_version: dom.provenance?.schema_version ?? crg.schema_version,
    input_hash: dom.provenance?.input_hash ?? crg.input_hash,
    crg_node_id: dom.id,
    module_backed: true,
    module_field_name: generatedFieldKey,
  };
}

function applyBiospecimenModuleEnrichment({
  graphId,
  crg,
  sourceFields,
  validationRules,
  provenanceMap,
  trackId,
  index,
  warnings,
}) {
  const biospecimenModules = index
    .nodesOfType("DomainModuleNode")
    .filter((n) => n.payload.module_id === BIOSPECIMEN_MODULE_ID && n.payload.active_flag !== false);

  if (biospecimenModules.length === 0) return;

  const dom = biospecimenModules[0];
  const fieldByKey = new Map();
  for (const sf of sourceFields) {
    if (!fieldByKey.has(sf.field_key)) fieldByKey.set(sf.field_key, sf);
  }

  for (const skeleton of BIOSPECIMEN_VALIDATION_SKELETONS) {
    const sf = fieldByKey.get(skeleton.field_key);
    if (!sf) {
      warnings.push({
        code: "BIOSPECIMEN_VALIDATION_NO_FIELD",
        message: `Biospecimen validation skeleton references missing field_key: ${skeleton.field_key}`,
        path: dom.source_row_id,
      });
      continue;
    }
    const vrId = detId("vr", graphId, "bio", dom.source_row_id, skeleton.code);
    trackId(vrId, `validation_rules/biospecimen/${skeleton.code}`);
    const vr = {
      validation_rule_id: vrId,
      source_field_id: sf.source_field_id,
      field_name: skeleton.field_key,
      rule_type: skeleton.rule_type,
      expression: skeleton.expression,
      validation_code: skeleton.code,
      validation_message: skeleton.message,
      provenance: biospecimenModuleProvenance(dom, skeleton.code, skeleton.field_key, crg),
    };
    validationRules.push(vr);
    provenanceMap[vrId] = vr.provenance;
  }
}

function compile(crg) {
  const errors = [];
  const warnings = [];
  const provenanceMap = {};
  const seenIds = new Set();

  const trackId = (id, ctx) => {
    if (seenIds.has(id)) {
      errors.push({
        code: "DUPLICATE_GENERATED_ID",
        message: `Duplicate generated id: ${id}`,
        path: ctx,
      });
    }
    seenIds.add(id);
  };

  const index = new CrgIndex(crg);
  const graphId = crg.graph_id;
  const inputHash = crg.input_hash;
  const compiledAt = crg.compiled_at ?? new Date().toISOString();

  const studyNode = index.nodesOfType("StudyTemplateNode")[0];
  const studyTemplateId = studyNode?.payload.study_template_id ?? "ST-000";
  const protocolVersion = studyNode?.payload.protocol_version ?? null;

  const sourceDefinitionVersions = [];
  const sourceSections = [];
  const sourceFields = [];
  const validationRules = [];
  const conditionalRules = [];
  const workflowRequirements = [];
  const signatureRequirements = [];
  const runtimeExpectations = [];
  const externalSourceRequirements = [];

  if (crg.nodes.length === 0) {
    warnings.push({
      code: "EMPTY_RUNTIME_GRAPH",
      message: "Runtime graph has zero nodes",
    });
  }

  const visitNodes = index.nodesOfType("VisitNode");

  for (const visitNode of visitNodes) {
    const visitId = visitNode.payload.visit_id;
    const visitCode = visitNode.payload.visit_code ?? visitId;
    const visitLabel = visitNode.payload.visit_label ?? visitCode;

    const sdvId = detId("sdv", graphId, visitNode.id, visitId);
    trackId(sdvId, `source_definition_versions/${visitId}`);

    const sdv = {
      source_definition_version_id: sdvId,
      graph_id: graphId,
      visit_node_id: visitNode.id,
      visit_id: visitId,
      visit_code: visitCode,
      visit_name: visitLabel,
      study_template_id: studyTemplateId,
      protocol_version: protocolVersion,
      cpst_version: crg.cpst_version,
      source_status: "draft_generated",
      generated_at: compiledAt,
      compiler_version: COMPILER_VERSION,
      input_hash: inputHash,
      provenance: provFrom(visitNode, crg),
      instrument_code: visitCode,
      version_label: crg.cpst_version ?? "v1.0.0",
      status: "draft",
    };
    sourceDefinitionVersions.push(sdv);
    provenanceMap[sdvId] = sdv.provenance;

    const procLinks = [];
    for (const e of index.outEdges(visitNode.id, VISIT_PROC_EDGE_TYPES)) {
      const proc = index.node(e.to);
      if (proc?.node_type === "ProcedureNode") {
        procLinks.push({ procedure: proc, edge: e });
      }
    }
    procLinks.sort((a, b) =>
      String(a.procedure.payload.procedure_id).localeCompare(String(b.procedure.payload.procedure_id))
    );

    if (procLinks.length === 0) {
      warnings.push({
        code: "VISIT_NO_PROCEDURES",
        message: `Visit ${visitId} has no assigned procedures`,
        path: visitNode.id,
      });
    }

    for (const { procedure: procNode, edge: visitProcEdge } of procLinks) {
      const procId = procNode.payload.procedure_id;
      const expectation = findExpectation(index, visitId, procId);
      const matrixMarker = expectation?.payload.matrix_marker ?? visitProcEdge.edge_type.replace("optional_for", "optional");
      const requiredStatus = matrixMarkerToRequiredness(matrixMarker);
      const sourceType = procNode.payload.source_type;
      const sigRequired = signatureRequiredFor(index, procNode, expectation);
      const fields = fieldsForProcedure(index, procNode);
      const detailedCapture = sourceType === "internal" || !isExternalSourceType(sourceType);

      const sectionId = detId("sec", graphId, sdvId, procNode.id);
      trackId(sectionId, `source_sections/${visitId}/${procId}`);

      const section = {
        source_section_id: sectionId,
        source_definition_version_id: sdvId,
        procedure_node_id: procNode.id,
        procedure_id: procId,
        section_code: procNode.payload.procedure_code ?? procId,
        section_name: procNode.payload.procedure_label ?? procId,
        section_order: expectation?.payload.execution_order ?? 0,
        source_type: sourceType,
        required_status: requiredStatus,
        detailed_capture_required: detailedCapture,
        external_reference_required: procNode.payload.external_reference_required === true,
        owner_role: procNode.payload.owner_role ?? null,
        signature_required: sigRequired,
        provenance: provFrom(procNode, crg),
        label: procNode.payload.procedure_label,
        sort_order: expectation?.payload.execution_order ?? 0,
      };
      sourceSections.push(section);
      provenanceMap[sectionId] = section.provenance;

      if (detailedCapture && fields.length === 0) {
        warnings.push({
          code: "SECTION_NO_FIELDS",
          message: `Procedure ${procId} on visit ${visitId} has detailed_capture_required but no FieldNodes`,
          path: sectionId,
        });
      }

      if (isExternalSourceType(sourceType)) {
        const extNodes = externalSourcesForProcedure(index, procNode);
        if (extNodes.length === 0) {
          errors.push({
            code: "EXTERNAL_SOURCE_MISSING",
            message: `External procedure ${procId} missing ExternalSourceNode / requirement`,
            path: sectionId,
          });
        }
        for (const ext of extNodes) {
          const extReqId = detId("ext", graphId, sectionId, ext.id);
          trackId(extReqId, `external_source_requirements/${ext.source_row_id}`);
          const extReq = {
            external_source_requirement_id: extReqId,
            source_definition_version_id: sdvId,
            source_section_id: sectionId,
            procedure_node_id: procNode.id,
            procedure_id: procId,
            external_source_name: ext.payload.system_name,
            external_system_type: sourceType,
            ref_id_field: ext.payload.reference_required ? "external_reference_id" : null,
            status_field: ext.payload.status_required ? "external_status" : null,
            attachment_allowed: ext.payload.attachment_allowed === true,
            audit_requirement: true,
            capture_strategy: "metadata_reference_only",
            provenance: provFrom(ext, crg),
          };
          externalSourceRequirements.push(extReq);
          provenanceMap[extReqId] = extReq.provenance;
        }
      }

      for (const fieldNode of fields) {
        const p = fieldNode.payload;
        if (!p.display_label || !p.data_type) {
          errors.push({
            code: "FIELD_MISSING_META",
            message: `Field ${p.field_key} missing display_label or data_type`,
            path: fieldNode.id,
          });
        }

        const fieldId = detId("fld", graphId, sectionId, fieldNode.id);
        trackId(fieldId, `source_fields/${p.field_key}`);

        const valNode = validationNodeForField(index, fieldNode);
        let validationRuleRef = null;
        if (valNode || p.validation_expression || p.is_required) {
          const vrId = detId("vr", graphId, sectionId, fieldNode.id);
          trackId(vrId, `validation_rules/${p.field_key}`);
          const vr = {
            validation_rule_id: vrId,
            source_field_id: fieldId,
            field_name: p.field_key,
            rule_type: p.is_required ? "required" : "expression",
            expression: p.validation_expression ?? valNode?.payload.validation_expression ?? null,
            provenance: provFrom(fieldNode, crg),
          };
          validationRules.push(vr);
          provenanceMap[vrId] = vr.provenance;
          validationRuleRef = vrId;
        }

        const sf = {
          source_field_id: fieldId,
          source_section_id: sectionId,
          source_definition_version_id: sdvId,
          field_name: p.field_key,
          field_key: p.field_key,
          display_label: p.display_label,
          data_type: p.data_type,
          input_type: p.data_type,
          required: p.is_required === true,
          is_required: p.is_required === true,
          min_value: p.min_value ?? null,
          max_value: p.max_value ?? null,
          min_length: p.min_length ?? null,
          max_length: p.max_length ?? null,
          allowed_list_name: p.option_list_code ?? null,
          options_manifest_key: p.option_list_code ?? null,
          default_value: p.default_value ?? null,
          validation_rule: validationRuleRef,
          conditional_visibility: p.conditional_visibility_rule_id ?? null,
          read_only: p.read_only === true,
          repeatable: p.repeatable === true,
          export_name: p.export_name ?? null,
          source_origin_mode: p.source_origin_mode ?? null,
          procedure_id: procId,
          section_code: p.section_code,
          label: p.display_label,
          provenance: provFrom(fieldNode, crg),
        };
        sourceFields.push(sf);
        provenanceMap[fieldId] = sf.provenance;
      }

      if (sigRequired) {
        const signers = signersForProcedure(index, procId);
        if (signers.length === 0) {
          errors.push({
            code: "SIGNATURE_NO_SIGNER",
            message: `Signature required for ${procId} on visit ${visitId} but no signer role`,
            path: sectionId,
          });
        }
        for (const role of signers) {
          const sigReqId = detId("sig", graphId, sectionId, role.id);
          trackId(sigReqId, `signature_requirements/${procId}/${role.source_row_id}`);
          const sigReq = {
            signature_requirement_id: sigReqId,
            source_definition_version_id: sdvId,
            source_section_id: sectionId,
            procedure_id: procId,
            role_code: role.payload.role_code,
            signature_meaning_code: role.payload.signature_meaning_code ?? "REVIEWED",
            provenance: provFrom(role, crg),
          };
          signatureRequirements.push(sigReq);
          provenanceMap[sigReqId] = sigReq.provenance;
        }
      }

      if (expectation) {
        const rexId = detId("rex", graphId, expectation.id);
        trackId(rexId, `runtime_expectations/${expectation.source_row_id}`);
        const rex = {
          runtime_expectation_id: rexId,
          source_definition_version_id: sdvId,
          source_section_id: sectionId,
          visit_id: visitId,
          procedure_id: procId,
          requiredness: requiredStatus,
          execution_order: expectation.payload.execution_order ?? 0,
          source_type: sourceType,
          expected_section_id: sectionId,
          conditionality: expectation.payload.condition_rule_id
            ? { conditional: true, rule_id: expectation.payload.condition_rule_id }
            : { conditional: false },
          provenance: provFrom(expectation, crg),
        };
        runtimeExpectations.push(rex);
        provenanceMap[rexId] = rex.provenance;
      }
    }
  }

  applyBiospecimenModuleEnrichment({
    graphId,
    crg,
    sourceFields,
    validationRules,
    provenanceMap,
    trackId,
    index,
    warnings,
  });

  for (const ruleNode of index.nodesOfType("RuleNode")) {
    const p = ruleNode.payload;
    const crId = detId("cr", graphId, ruleNode.id);
    trackId(crId, `conditional_rules/${p.rule_id}`);

    let appliesTo = p.trigger_entity ?? "study";
    let appliesToId = p.trigger_visit_id ?? p.trigger_procedure_id ?? studyTemplateId;

    const cond = {
      conditional_rule_id: crId,
      rule_id: p.rule_id,
      rule_name: p.rule_id,
      trigger_type: p.rule_type,
      trigger_field: p.trigger_procedure_id ? `procedure:${p.trigger_procedure_id}` : null,
      operator: "expr",
      trigger_value: null,
      expression: p.expression,
      then_action: p.action,
      applies_to: appliesTo,
      applies_to_id: appliesToId,
      priority: 100,
      hard_stop: p.action === "block",
      requires_review: p.workflow_hook != null || p.rule_type === "safety",
      provenance: provFrom(ruleNode, crg),
    };
    conditionalRules.push(cond);
    provenanceMap[crId] = cond.provenance;

    if (p.workflow_hook) {
      const wfId = detId("wf", graphId, ruleNode.id, p.workflow_hook);
      trackId(wfId, `workflow_requirements/${p.rule_id}`);
      const wf = {
        workflow_requirement_id: wfId,
        rule_id: p.rule_id,
        workflow_type: p.workflow_hook,
        trigger_expression: p.expression,
        requires_review: true,
        provenance: provFrom(ruleNode, crg),
      };
      workflowRequirements.push(wf);
      provenanceMap[wfId] = wf.provenance;
    }

    if (p.trigger_visit_id && !index.nodesOfType("VisitNode").some((v) => v.payload.visit_id === p.trigger_visit_id)) {
      errors.push({
        code: "CONDITIONAL_TARGET_MISSING",
        message: `Rule ${p.rule_id} trigger visit ${p.trigger_visit_id} not found`,
        path: crId,
      });
    }
    if (p.target_procedure_id && !index.nodesOfType("ProcedureNode").some((pr) => pr.payload.procedure_id === p.target_procedure_id)) {
      warnings.push({
        code: "CONDITIONAL_TARGET_PROCEDURE",
        message: `Rule ${p.rule_id} target procedure ${p.target_procedure_id} reference only`,
        path: crId,
      });
    }
  }

  for (const dom of index.nodesOfType("DomainModuleNode")) {
    if (dom.payload.module_id === BIOSPECIMEN_MODULE_ID && dom.payload.reviewer_required === true) {
      const wfId = detId("wf", graphId, dom.id, "biospecimen_review");
      if (!seenIds.has(wfId)) {
        trackId(wfId, `workflow_requirements/domain/${dom.source_row_id}`);
        const wf = {
          workflow_requirement_id: wfId,
          module_id: dom.payload.module_id,
          workflow_type: "BIOSPECIMEN_REVIEW",
          requires_review: true,
          provenance: biospecimenModuleProvenance(dom, "reviewer_required", "source_complete", crg),
        };
        workflowRequirements.push(wf);
        provenanceMap[wfId] = wf.provenance;
      }
    }
    if (dom.payload.rescue_workflow_required || dom.payload.module_id?.includes("epro")) {
      const wfId = detId("wf", graphId, dom.id, "domain");
      if (!seenIds.has(wfId)) {
        trackId(wfId, `workflow_requirements/domain/${dom.source_row_id}`);
        const wf = {
          workflow_requirement_id: wfId,
          module_id: dom.payload.module_id,
          workflow_type: "EPRO_RESCUE",
          requires_review: dom.payload.rescue_workflow_required === true,
          provenance: provFrom(dom, crg),
        };
        workflowRequirements.push(wf);
        provenanceMap[wfId] = wf.provenance;
      }
    }
  }

  const sortById = (a, b) => {
    const ka = a.source_definition_version_id ?? a.validation_rule_id ?? a.conditional_rule_id ?? a.workflow_requirement_id ?? a.signature_requirement_id ?? a.runtime_expectation_id ?? a.external_source_requirement_id ?? a.source_field_id ?? a.source_section_id ?? "";
    const kb = b.source_definition_version_id ?? b.validation_rule_id ?? b.conditional_rule_id ?? b.workflow_requirement_id ?? b.signature_requirement_id ?? b.runtime_expectation_id ?? b.external_source_requirement_id ?? b.source_field_id ?? b.source_section_id ?? "";
    return String(ka).localeCompare(String(kb));
  };

  sourceDefinitionVersions.sort((a, b) => a.source_definition_version_id.localeCompare(b.source_definition_version_id));
  sourceSections.sort((a, b) => a.source_section_id.localeCompare(b.source_section_id));
  sourceFields.sort((a, b) => a.source_field_id.localeCompare(b.source_field_id));
  validationRules.sort((a, b) => a.validation_rule_id.localeCompare(b.validation_rule_id));
  conditionalRules.sort((a, b) => a.conditional_rule_id.localeCompare(b.conditional_rule_id));
  workflowRequirements.sort((a, b) => a.workflow_requirement_id.localeCompare(b.workflow_requirement_id));
  signatureRequirements.sort((a, b) => a.signature_requirement_id.localeCompare(b.signature_requirement_id));
  runtimeExpectations.sort((a, b) => a.runtime_expectation_id.localeCompare(b.runtime_expectation_id));
  externalSourceRequirements.sort((a, b) =>
    a.external_source_requirement_id.localeCompare(b.external_source_requirement_id)
  );

  let validation_status = "valid";
  if (warnings.length > 0 && errors.length === 0) validation_status = "warning";
  if (errors.length > 0) validation_status = "invalid";

  const compilerOutputId = detId("cout", graphId, inputHash);
  const crgHash = `sha256:${shortHash([graphId, inputHash, String(crg.nodes.length), String(crg.edges.length)])}`;

  return {
    compiler_output_id: compilerOutputId,
    graph_id: graphId,
    input_hash: inputHash,
    crg_hash: crgHash,
    compiler_version: COMPILER_VERSION,
    schema_version: crg.schema_version,
    cpst_version: crg.cpst_version,
    study_template_id: studyTemplateId,
    compiled_at: compiledAt,
    deterministic: true,
    source_definition_versions: sourceDefinitionVersions,
    source_sections: sourceSections,
    source_fields: sourceFields,
    validation_rules: validationRules,
    conditional_rules: conditionalRules,
    workflow_requirements: workflowRequirements,
    signature_requirements: signatureRequirements,
    runtime_expectations: runtimeExpectations,
    external_source_requirements: externalSourceRequirements,
    provenance_map: provenanceMap,
    validation_report: {
      validation_status,
      passed: errors.length === 0,
      errors,
      warnings,
    },
    counts: {
      source_definition_versions: sourceDefinitionVersions.length,
      source_sections: sourceSections.length,
      source_fields: sourceFields.length,
      validation_rules: validationRules.length,
      conditional_rules: conditionalRules.length,
      workflow_requirements: workflowRequirements.length,
      signature_requirements: signatureRequirements.length,
      runtime_expectations: runtimeExpectations.length,
      external_source_requirements: externalSourceRequirements.length,
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(args.input)) {
    console.error("Input CRG not found:", args.input);
    process.exit(1);
  }

  const crg = loadJson(args.input);
  const out1 = compile(crg);
  const out2 = compile(crg);

  const sig1 = JSON.stringify({
    id: out1.compiler_output_id,
    sdv: out1.source_definition_versions.map((x) => x.source_definition_version_id),
    fld: out1.source_fields.map((x) => x.source_field_id),
  });
  const sig2 = JSON.stringify({
    id: out2.compiler_output_id,
    sdv: out2.source_definition_versions.map((x) => x.source_definition_version_id),
    fld: out2.source_fields.map((x) => x.source_field_id),
  });

  if (sig1 !== sig2) {
    console.error("Determinism check failed");
    process.exit(1);
  }

  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(out1, null, 2)}\n`, "utf8");

  console.log("Compiler output ID:", out1.compiler_output_id);
  console.log("Validation:", out1.validation_report.validation_status);
  console.log("SDV:", out1.counts.source_definition_versions);
  console.log("Sections:", out1.counts.source_sections);
  console.log("Fields:", out1.counts.source_fields);
  console.log("Errors:", out1.validation_report.errors.length);
  console.log("Warnings:", out1.validation_report.warnings.length);
  console.log("Output:", relative(ROOT, args.output));

  if (args.strict && out1.validation_report.validation_status === "invalid") process.exit(1);
}

main();
