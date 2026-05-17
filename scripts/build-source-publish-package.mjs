/**
 * Phase 4C.8 — Source definition publish package builder (file-based skeleton).
 *
 * Bundles approved source definitions with approval evidence and provenance.
 * Immutable handoff for future Phase 4A persistence. No DB writes.
 *
 * Run: node scripts/build-source-publish-package.mjs [--strict] [paths]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_VERSION = "0.1.0";
const PUBLISH_PACKAGE_BUILDER_VERSION = "0.1.0";

const DEFAULT_SOURCE_DEFINITIONS = join(ROOT, "tmp/compiled/source-definitions.golden-basic.json");
const DEFAULT_PREVIEW = join(ROOT, "tmp/compiled/source-preview.golden-basic.md");
const DEFAULT_APPROVAL = join(ROOT, "tmp/approvals/source-preview-approval.golden-basic.json");
const DEFAULT_OUTPUT = join(ROOT, "tmp/publish/source-publish-package.golden-basic.json");

const COUNT_KEYS = [
  "source_definition_versions",
  "source_sections",
  "source_fields",
  "validation_rules",
  "conditional_rules",
  "workflow_requirements",
  "signature_requirements",
  "runtime_expectations",
  "external_source_requirements",
];

function usage() {
  console.log(`Usage: node scripts/build-source-publish-package.mjs \\
  [--source-definitions <path>] \\
  [--preview <path>] \\
  [--approval <path>] \\
  [--output <path>] \\
  [--strict]`);
}

function parseArgs(argv) {
  const args = {
    sourceDefinitions: DEFAULT_SOURCE_DEFINITIONS,
    preview: DEFAULT_PREVIEW,
    approval: DEFAULT_APPROVAL,
    output: DEFAULT_OUTPUT,
    strict: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") args.strict = true;
    else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else if (a === "--source-definitions") args.sourceDefinitions = resolve(argv[++i]);
    else if (a === "--preview") args.preview = resolve(argv[++i]);
    else if (a === "--approval") args.approval = resolve(argv[++i]);
    else if (a === "--output") args.output = resolve(argv[++i]);
    else {
      console.error("Unknown argument:", a);
      usage();
      process.exit(1);
    }
  }

  return args;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fileSha256(path) {
  const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
  return `sha256:${digest}`;
}

function shortHash(parts) {
  return createHash("sha256")
    .update(parts.filter((p) => p != null).join("|"))
    .digest("hex")
    .slice(0, 12);
}

function relPath(absPath) {
  const rel = relative(ROOT, absPath);
  return rel && !rel.startsWith("..") ? rel.replace(/\\/g, "/") : absPath;
}

function check(code, pass, message, level = "fail") {
  return {
    check_code: code,
    status: pass ? "pass" : level === "warning" ? "warning" : "fail",
    message,
  };
}

function buildPackage(args) {
  const publishChecks = [];

  const pathsPresent =
    existsSync(args.sourceDefinitions) && existsSync(args.preview) && existsSync(args.approval);
  publishChecks.push(
    check(
      "ARTIFACT_PATHS_PRESENT",
      pathsPresent,
      pathsPresent
        ? "Source definitions, preview, and approval files exist"
        : "One or more input artifact paths are missing"
    )
  );

  if (!pathsPresent) {
    const pkg = {
      package_id: `pkg_${shortHash(["missing-artifacts"])}`,
      artifact_type: "source_definition_publish_package",
      package_version: PACKAGE_VERSION,
      created_at: new Date().toISOString(),
      publish_ready: false,
      graph_id: null,
      input_hash: null,
      compiler_output_id: null,
      compiler_version: null,
      approval_id: null,
      approval_decision: null,
      reviewer_user_id: null,
      reviewer_role: null,
      source_definitions_hash: null,
      preview_hash: null,
      approval_hash: null,
      artifacts: {
        source_definitions_path: relPath(args.sourceDefinitions),
        preview_path: relPath(args.preview),
        approval_path: relPath(args.approval),
      },
      counts: {},
      validation_snapshot: {},
      publish_checks: publishChecks,
      provenance: {
        source_compiler_version: null,
        approval_gate_version: null,
        publish_package_builder_version: PUBLISH_PACKAGE_BUILDER_VERSION,
      },
    };
    return { pkg, publishReady: false, earlyExit: true };
  }

  const sourceDefinitions = loadJson(args.sourceDefinitions);
  const approval = loadJson(args.approval);

  const sourceDefinitionsHash = fileSha256(args.sourceDefinitions);
  const previewHash = fileSha256(args.preview);
  const approvalHash = fileSha256(args.approval);

  const report = sourceDefinitions.validation_report ?? { errors: [], warnings: [] };
  const errors = report.errors ?? [];
  const counts = sourceDefinitions.counts ?? {};

  publishChecks.push(
    check(
      "APPROVAL_ELIGIBLE",
      approval.publish_eligible === true,
      approval.publish_eligible === true
        ? "Approval artifact publish_eligible is true"
        : "Approval artifact publish_eligible is not true"
    )
  );

  publishChecks.push(
    check(
      "APPROVAL_DECISION_APPROVED",
      approval.decision === "approved",
      approval.decision === "approved"
        ? `Approval decision is approved`
        : `Approval decision is ${approval.decision ?? "missing"}`
    )
  );

  publishChecks.push(
    check(
      "SOURCE_HASH_MATCH",
      approval.source_definitions_hash === sourceDefinitionsHash,
      approval.source_definitions_hash === sourceDefinitionsHash
        ? "Approval source_definitions_hash matches computed hash"
        : `Hash mismatch: approval=${approval.source_definitions_hash} computed=${sourceDefinitionsHash}`
    )
  );

  publishChecks.push(
    check(
      "PREVIEW_HASH_MATCH",
      approval.preview_hash === previewHash,
      approval.preview_hash === previewHash
        ? "Approval preview_hash matches computed hash"
        : `Hash mismatch: approval=${approval.preview_hash} computed=${previewHash}`
    )
  );

  publishChecks.push(
    check(
      "GRAPH_ID_MATCH",
      approval.graph_id === sourceDefinitions.graph_id,
      approval.graph_id === sourceDefinitions.graph_id
        ? `Graph ID matches (${sourceDefinitions.graph_id})`
        : `Graph ID mismatch: approval=${approval.graph_id} source=${sourceDefinitions.graph_id}`
    )
  );

  publishChecks.push(
    check(
      "INPUT_HASH_MATCH",
      approval.input_hash === sourceDefinitions.input_hash,
      approval.input_hash === sourceDefinitions.input_hash
        ? "Input hash matches between approval and source definitions"
        : `Input hash mismatch: approval=${approval.input_hash} source=${sourceDefinitions.input_hash}`
    )
  );

  publishChecks.push(
    check(
      "NO_VALIDATION_ERRORS",
      errors.length === 0,
      errors.length === 0
        ? "Source definitions validation_report has no errors"
        : `Source definitions has ${errors.length} validation error(s)`
    )
  );

  const countsPresent =
    COUNT_KEYS.every((k) => typeof counts[k] === "number") &&
    COUNT_KEYS.every((k) => counts[k] >= 0);
  const countsNonZero = counts.source_definition_versions > 0;
  publishChecks.push(
    check(
      "COUNTS_PRESENT",
      countsPresent && countsNonZero,
      countsPresent && countsNonZero
        ? `Counts present (${counts.source_definition_versions} SDV, ${counts.source_fields} fields)`
        : "Source definitions counts missing or empty"
    )
  );

  const validationStatus = report.validation_status ?? approval.validation_snapshot?.validation_status;
  if ((report.warnings ?? []).length > 0 && validationStatus === "warning") {
    publishChecks.push(
      check(
        "VALIDATION_WARNINGS_ACKNOWLEDGED",
        approval.publish_eligible === true,
        "Validation warnings present; publish allowed only with human approval (publish_eligible)",
        "warning"
      )
    );
  }

  const publishReady = publishChecks.every((c) => c.status === "pass" || c.status === "warning");

  const packageId = `pkg_${shortHash([
    sourceDefinitions.graph_id,
    sourceDefinitions.compiler_output_id,
    approval.approval_id,
    sourceDefinitionsHash,
    approvalHash,
  ])}`;

  const createdAt =
    approval.reviewed_at ?? sourceDefinitions.compiled_at ?? new Date().toISOString();

  const pkg = {
    package_id: packageId,
    artifact_type: "source_definition_publish_package",
    package_version: PACKAGE_VERSION,
    created_at: createdAt,
    publish_ready: publishReady,
    graph_id: sourceDefinitions.graph_id,
    input_hash: sourceDefinitions.input_hash,
    compiler_output_id: sourceDefinitions.compiler_output_id,
    compiler_version: sourceDefinitions.compiler_version,
    approval_id: approval.approval_id,
    approval_decision: approval.decision,
    reviewer_user_id: approval.reviewer_user_id,
    reviewer_role: approval.reviewer_role ?? null,
    source_definitions_hash: sourceDefinitionsHash,
    preview_hash: previewHash,
    approval_hash: approvalHash,
    artifacts: {
      source_definitions_path: relPath(args.sourceDefinitions),
      preview_path: relPath(args.preview),
      approval_path: relPath(args.approval),
    },
    counts: { ...counts },
    validation_snapshot: approval.validation_snapshot ?? {
      validation_status: report.validation_status,
      errors,
      warnings: report.warnings ?? [],
    },
    publish_checks: publishChecks,
    provenance: {
      source_compiler_version: sourceDefinitions.compiler_version ?? null,
      approval_gate_version: approval.provenance?.approval_gate_version ?? null,
      publish_package_builder_version: PUBLISH_PACKAGE_BUILDER_VERSION,
    },
  };

  return { pkg, publishReady };
}

function main() {
  const args = parseArgs(process.argv);
  const { pkg, publishReady, earlyExit } = buildPackage(args);

  if (earlyExit) {
    mkdirSync(dirname(args.output), { recursive: true });
    writeFileSync(args.output, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    console.error("Publish package build failed: missing artifact paths");
    process.exit(1);
  }

  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  const passed = pkg.publish_checks.filter((c) => c.status === "pass").length;
  const failed = pkg.publish_checks.filter((c) => c.status === "fail").length;
  const warned = pkg.publish_checks.filter((c) => c.status === "warning").length;

  console.log("Package ID:", pkg.package_id);
  console.log("Publish ready:", pkg.publish_ready);
  console.log("Checks: pass", passed, "warn", warned, "fail", failed);
  console.log("Graph ID:", pkg.graph_id);
  console.log("Approval ID:", pkg.approval_id);
  console.log("Source definitions hash:", pkg.source_definitions_hash);
  console.log("Preview hash:", pkg.preview_hash);
  console.log("Approval hash:", pkg.approval_hash);
  console.log("Output:", relative(ROOT, args.output));

  if (args.strict && !pkg.publish_ready) {
    console.error("Strict mode: publish_ready is false");
    for (const c of pkg.publish_checks.filter((x) => x.status === "fail")) {
      console.error(`  FAIL ${c.check_code}: ${c.message}`);
    }
    process.exit(1);
  }
}

main();
