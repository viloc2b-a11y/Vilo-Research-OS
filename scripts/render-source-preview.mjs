/**
 * Phase 4C.6 — Source Definition Compiler output → human-readable Markdown preview.
 *
 * Review-only artifact. Not the regulatory source of record.
 *
 * Run: node scripts/render-source-preview.mjs [--input path] [--output path]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = join(ROOT, "tmp/compiled/source-definitions.golden-basic.json");
const DEFAULT_OUTPUT = join(ROOT, "tmp/compiled/source-preview.golden-basic.md");
const BIOSPECIMEN_CANONICAL_PATH = join(ROOT, "fixtures/cpst/biospecimen-canonical-template.json");

const BIOSPECIMEN_SECTION_ORDER = [
  "header",
  "consent",
  "specimen",
  "processing",
  "storage",
  "shipping",
  "quality",
  "closeout",
];

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") args.input = resolve(argv[++i]);
    else if (a === "--output") args.output = resolve(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/render-source-preview.mjs [--input path] [--output path]");
      process.exit(0);
    }
  }
  return args;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function esc(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function fmtProv(p) {
  if (!p) return "_none_";
  const parts = [];
  if (p.source_dictionary) parts.push(p.source_dictionary);
  if (p.source_row_id) parts.push(`row:${p.source_row_id}`);
  if (p.crg_node_id) parts.push(`node:${p.crg_node_id}`);
  if (p.crg_edge_id) parts.push(`edge:${p.crg_edge_id}`);
  return parts.length ? parts.join(" · ") : "_none_";
}

function yn(v) {
  return v === true ? "yes" : v === false ? "no" : "—";
}

function indexBy(arr, key) {
  const map = new Map();
  for (const item of arr ?? []) {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

function render(out) {
  const lines = [];
  const counts = out.counts ?? {};
  const report = out.validation_report ?? { validation_status: "unknown", errors: [], warnings: [] };
  const generatedAt = out.compiled_at ?? out.source_definition_versions?.[0]?.generated_at ?? new Date().toISOString();

  lines.push("# Source Definition Preview");
  lines.push("");
  lines.push("> **Review-only.** This preview is generated from compiler output for human review before publish.");
  lines.push("> It is **not** the regulatory source of record. Approved source definitions live in Phase 4A persistence after publish.");
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push("| Property | Value |");
  lines.push("|----------|-------|");
  lines.push(`| Generated at | ${esc(generatedAt)} |`);
  lines.push(`| Compiler output ID | \`${esc(out.compiler_output_id)}\` |`);
  lines.push(`| Graph ID | \`${esc(out.graph_id)}\` |`);
  lines.push(`| Input hash | \`${esc(out.input_hash)}\` |`);
  lines.push(`| Compiler version | ${esc(out.compiler_version)} |`);
  lines.push(`| Study template | ${esc(out.study_template_id)} |`);
  lines.push(`| CPST version | ${esc(out.cpst_version)} |`);
  lines.push(`| Validation status | **${esc(report.validation_status)}** |`);
  lines.push(`| Errors | ${(report.errors ?? []).length} |`);
  lines.push(`| Warnings | ${(report.warnings ?? []).length} |`);
  lines.push("");
  lines.push("### Counts");
  lines.push("");
  lines.push("| Artifact | Count |");
  lines.push("|----------|------:|");
  lines.push(`| Source definitions (visits) | ${counts.source_definition_versions ?? 0} |`);
  lines.push(`| Sections | ${counts.source_sections ?? 0} |`);
  lines.push(`| Fields | ${counts.source_fields ?? 0} |`);
  lines.push(`| Validation rules | ${counts.validation_rules ?? 0} |`);
  lines.push(`| Conditional rules | ${counts.conditional_rules ?? 0} |`);
  lines.push(`| Workflow requirements | ${counts.workflow_requirements ?? 0} |`);
  lines.push(`| Signature requirements | ${counts.signature_requirements ?? 0} |`);
  lines.push(`| External source requirements | ${counts.external_source_requirements ?? 0} |`);
  lines.push(`| Runtime expectations | ${counts.runtime_expectations ?? 0} |`);
  lines.push("");

  if (out.study_template_id === "ST-BIO-001" && existsSync(BIOSPECIMEN_CANONICAL_PATH)) {
    const canon = loadJson(BIOSPECIMEN_CANONICAL_PATH);
    lines.push("## Biospecimen source document (operational)");
    lines.push("");
    lines.push("Collection-centric workflow: consent before collection, specimen traceability, processing/storage/shipment chain, quality/deviations, review/closeout.");
    lines.push("");
    lines.push("### Operational instructions");
    lines.push("");
    for (const row of canon.instructions ?? []) {
      lines.push(`- **${esc(row.topic)}** — ${esc(row.instruction)}`);
    }
    lines.push("");
    lines.push("### Section model");
    lines.push("");
    lines.push("| Order | Section |");
    lines.push("|------:|---------|");
    BIOSPECIMEN_SECTION_ORDER.forEach((code, i) => {
      const label = code.charAt(0).toUpperCase() + code.slice(1);
      lines.push(`| ${i + 1} | ${label} |`);
    });
    lines.push("");
  }

  const errors = report.errors ?? [];
  const warnings = report.warnings ?? [];
  if (errors.length > 0 || warnings.length > 0) {
    lines.push("## Validation issues");
    lines.push("");
    if (errors.length > 0) {
      lines.push("### Errors");
      lines.push("");
      for (const e of errors) {
        lines.push(`- **${esc(e.code)}** — ${esc(e.message)}${e.path ? ` (\`${esc(e.path)}\`)` : ""}`);
      }
      lines.push("");
    }
    if (warnings.length > 0) {
      lines.push("### Warnings");
      lines.push("");
      for (const w of warnings) {
        lines.push(`- **${esc(w.code)}** — ${esc(w.message)}${w.path ? ` (\`${esc(w.path)}\`)` : ""}`);
      }
      lines.push("");
    }
  }

  const sdvs = [...(out.source_definition_versions ?? [])].sort((a, b) => {
    const ac = a.visit_code ?? a.visit_id ?? "";
    const bc = b.visit_code ?? b.visit_id ?? "";
    return String(ac).localeCompare(String(bc));
  });

  const sectionsBySdv = indexBy(out.source_sections, "source_definition_version_id");
  const fieldsBySection = indexBy(out.source_fields, "source_section_id");
  const extBySection = indexBy(out.external_source_requirements, "source_section_id");
  const sigBySection = indexBy(out.signature_requirements, "source_section_id");
  const validationByFieldId = new Map();
  for (const vr of out.validation_rules ?? []) {
    if (vr.source_field_id) validationByFieldId.set(vr.source_field_id, vr);
  }

  if (sdvs.length === 0) {
    lines.push("## Visits");
    lines.push("");
    lines.push("> **Warning:** No source definition versions in compiler output (`EMPTY_SOURCE_DEFINITIONS`).");
    lines.push("");
  }

  for (const sdv of sdvs) {
    const visitLabel = sdv.visit_name ?? sdv.visit_code ?? sdv.visit_id ?? "Visit";
    const visitCode = sdv.visit_code ?? sdv.visit_id ?? "—";

    lines.push(`## Visit: ${esc(visitLabel)} (\`${esc(visitCode)}\`)`);
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|----------|-------|");
    lines.push(`| Source definition version ID | \`${esc(sdv.source_definition_version_id)}\` |`);
    lines.push(`| Visit ID | \`${esc(sdv.visit_id)}\` |`);
    lines.push(`| Graph ID | \`${esc(sdv.graph_id ?? out.graph_id)}\` |`);
    lines.push(`| Source status | ${esc(sdv.source_status)} |`);
    lines.push(`| Input hash | \`${esc(sdv.input_hash ?? out.input_hash)}\` |`);
    lines.push(`| Compiler version | ${esc(sdv.compiler_version ?? out.compiler_version)} |`);
    lines.push(`| Provenance | ${fmtProv(sdv.provenance)} |`);
    lines.push("");

    const sections = (sectionsBySdv.get(sdv.source_definition_version_id) ?? []).sort(
      (a, b) => (a.section_order ?? 0) - (b.section_order ?? 0) || String(a.section_name).localeCompare(String(b.section_name))
    );

    if (sections.length === 0) {
      lines.push("_No sections for this visit._");
      lines.push("");
      continue;
    }

    for (const sec of sections) {
      lines.push(`### Section: ${esc(sec.section_name)} (\`${esc(sec.procedure_id ?? sec.section_code)}\`)`);
      lines.push("");
      lines.push("| Property | Value |");
      lines.push("|----------|-------|");
      lines.push(`| Section ID | \`${esc(sec.source_section_id)}\` |`);
      lines.push(`| Section order | ${sec.section_order ?? sec.sort_order ?? "—"} |`);
      lines.push(`| Source type | ${esc(sec.source_type)} |`);
      lines.push(`| Required status | ${esc(sec.required_status)} |`);
      lines.push(`| Detailed capture required | ${yn(sec.detailed_capture_required)} |`);
      lines.push(`| External reference required | ${yn(sec.external_reference_required)} |`);
      lines.push(`| Owner role | ${esc(sec.owner_role) || "—"} |`);
      lines.push(`| Signature required | ${yn(sec.signature_required)} |`);
      lines.push(`| Provenance | ${fmtProv(sec.provenance)} |`);
      lines.push("");

      const extReqs = extBySection.get(sec.source_section_id) ?? [];
      if (extReqs.length > 0) {
        lines.push("#### External source requirements");
        lines.push("");
        for (const ext of extReqs) {
          lines.push(`- **${esc(ext.external_source_name)}** (${esc(ext.external_system_type)})`);
          lines.push(`  - Ref ID field: ${esc(ext.ref_id_field) || "—"} · Status field: ${esc(ext.status_field) || "—"}`);
          lines.push(`  - Attachment allowed: ${yn(ext.attachment_allowed)} · Audit: ${yn(ext.audit_requirement)}`);
          lines.push(`  - Capture strategy: \`${esc(ext.capture_strategy)}\``);
          lines.push(`  - Provenance: ${fmtProv(ext.provenance)}`);
        }
        lines.push("");
      }

      const sigReqs = sigBySection.get(sec.source_section_id) ?? [];
      if (sigReqs.length > 0) {
        lines.push("#### Signature requirements");
        lines.push("");
        for (const sig of sigReqs) {
          lines.push(`- Role \`${esc(sig.role_code)}\` · meaning \`${esc(sig.signature_meaning_code)}\` · ${fmtProv(sig.provenance)}`);
        }
        lines.push("");
      }

      const fields = (fieldsBySection.get(sec.source_section_id) ?? []).sort((a, b) => {
        const ai = BIOSPECIMEN_SECTION_ORDER.indexOf(a.section_code ?? "");
        const bi = BIOSPECIMEN_SECTION_ORDER.indexOf(b.section_code ?? "");
        if (ai !== bi && ai >= 0 && bi >= 0) return ai - bi;
        return String(a.field_name).localeCompare(String(b.field_name));
      });

      if (fields.length === 0) {
        lines.push("_No fields for this section._");
        lines.push("");
      } else {
        lines.push("#### Fields");
        lines.push("");
        lines.push("| Label | Field | Type | Req | List | Validation | Visibility | Export | Provenance |");
        lines.push("|-------|-------|------|-----|------|------------|------------|--------|------------|");
        for (const f of fields) {
          const vr = f.validation_rule ? validationByFieldId.get(f.source_field_id) : null;
          const valRef = vr
            ? `${vr.rule_type}${vr.expression ? `: ${esc(vr.expression)}` : ""}`
            : f.validation_rule
              ? `\`${esc(f.validation_rule)}\``
              : "—";
          lines.push(
            `| ${esc(f.display_label)} | \`${esc(f.field_name)}\` | ${esc(f.data_type)} | ${yn(f.required ?? f.is_required)} | ${esc(f.allowed_list_name) || "—"} | ${valRef} | ${esc(f.conditional_visibility) || "—"} | ${esc(f.export_name) || "—"} | ${fmtProv(f.provenance)} |`
          );
        }
        lines.push("");
      }
    }
  }

  const conditionalRules = out.conditional_rules ?? [];
  if (conditionalRules.length > 0) {
    lines.push("## Study-wide conditional rules");
    lines.push("");
    for (const cr of conditionalRules) {
      lines.push(`### Rule \`${esc(cr.rule_id ?? cr.rule_name)}\``);
      lines.push("");
      lines.push("| Property | Value |");
      lines.push("|----------|-------|");
      lines.push(`| Trigger type | ${esc(cr.trigger_type)} |`);
      lines.push(`| Trigger field | ${esc(cr.trigger_field) || "—"} |`);
      lines.push(`| Operator | ${esc(cr.operator)} |`);
      lines.push(`| Trigger value | ${esc(cr.trigger_value) || "—"} |`);
      lines.push(`| Expression | ${esc(cr.expression) || "—"} |`);
      lines.push(`| Then action | ${esc(cr.then_action)} |`);
      lines.push(`| Applies to | ${esc(cr.applies_to)} / \`${esc(cr.applies_to_id)}\` |`);
      lines.push(`| Hard stop | ${yn(cr.hard_stop)} |`);
      lines.push(`| Requires review | ${yn(cr.requires_review)} |`);
      lines.push(`| Provenance | ${fmtProv(cr.provenance)} |`);
      lines.push("");
    }
  }

  const workflows = out.workflow_requirements ?? [];
  if (workflows.length > 0) {
    lines.push("## Workflow requirements");
    lines.push("");
    for (const wf of workflows) {
      const trigger = wf.trigger_expression ?? wf.workflow_type ?? "—";
      lines.push(`- **${esc(wf.workflow_type)}** — trigger: \`${esc(trigger)}\` · review: ${yn(wf.requires_review)} · ${fmtProv(wf.provenance)}`);
    }
    lines.push("");
  }

  const runtimeExpectations = out.runtime_expectations ?? [];
  if (runtimeExpectations.length > 0) {
    lines.push("## Runtime expectations (summary)");
    lines.push("");
    lines.push("| Visit | Procedure | Requiredness | Order | Source type | Section |");
    lines.push("|-------|-----------|--------------|------:|-------------|---------|");
    const sorted = [...runtimeExpectations].sort(
      (a, b) =>
        String(a.visit_id).localeCompare(String(b.visit_id)) ||
        (a.execution_order ?? 0) - (b.execution_order ?? 0)
    );
    for (const rex of sorted) {
      lines.push(
        `| \`${esc(rex.visit_id)}\` | \`${esc(rex.procedure_id)}\` | ${esc(rex.requiredness)} | ${rex.execution_order ?? "—"} | ${esc(rex.source_type)} | \`${esc(rex.expected_section_id)}\` |`
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("_End of preview. Compiler output was not modified._");
  lines.push("");

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(args.input)) {
    console.error("Input not found:", args.input);
    process.exit(1);
  }

  const out = loadJson(args.input);
  const md = render(out);

  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, md, "utf8");

  const sdvCount = out.source_definition_versions?.length ?? 0;
  const report = out.validation_report ?? {};

  console.log("Preview written:", relative(ROOT, args.output));
  console.log("Visits:", sdvCount);
  console.log("Sections:", out.counts?.source_sections ?? 0);
  console.log("Fields:", out.counts?.source_fields ?? 0);
  console.log("Validation:", report.validation_status ?? "unknown");
  console.log("Warnings:", (report.warnings ?? []).length);
  console.log("Errors:", (report.errors ?? []).length);
}

main();
