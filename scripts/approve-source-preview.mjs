/**
 * Phase 4C.7 — Source preview human review / approval gate (file-based skeleton).
 *
 * Records explicit human review before source definitions are publish-eligible.
 * No auto-approval. Does not mutate compiler output.
 *
 * Run: node scripts/approve-source-preview.mjs --reviewer-user-id <id> --decision <approved|rejected|needs_changes> --reason <text> [options]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPROVAL_GATE_VERSION = "0.1.0";

const DEFAULT_SOURCE_DEFINITIONS = join(ROOT, "tmp/compiled/source-definitions.golden-basic.json");
const DEFAULT_PREVIEW = join(ROOT, "tmp/compiled/source-preview.golden-basic.md");
const DEFAULT_OUTPUT = join(ROOT, "tmp/approvals/source-preview-approval.golden-basic.json");

const VALID_DECISIONS = new Set(["approved", "rejected", "needs_changes"]);

function usage() {
  console.log(`Usage: node scripts/approve-source-preview.mjs \\
  --reviewer-user-id <id> \\
  --decision approved|rejected|needs_changes \\
  --reason <text> \\
  [--source-definitions <path>] \\
  [--preview <path>] \\
  [--output <path>] \\
  [--reviewer-role <role>] \\
  [--comments <text>]`);
}

function parseArgs(argv) {
  const args = {
    sourceDefinitions: DEFAULT_SOURCE_DEFINITIONS,
    preview: DEFAULT_PREVIEW,
    output: DEFAULT_OUTPUT,
    reviewerUserId: null,
    reviewerRole: null,
    decision: null,
    reason: null,
    comments: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else if (a === "--source-definitions") args.sourceDefinitions = resolve(argv[++i]);
    else if (a === "--preview") args.preview = resolve(argv[++i]);
    else if (a === "--output") args.output = resolve(argv[++i]);
    else if (a === "--reviewer-user-id") args.reviewerUserId = argv[++i];
    else if (a === "--reviewer-role") args.reviewerRole = argv[++i];
    else if (a === "--decision") args.decision = argv[++i];
    else if (a === "--reason") args.reason = argv[++i];
    else if (a === "--comments") args.comments = argv[++i];
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

function warningsAcknowledged(reason, comments) {
  const r = String(reason ?? "").trim();
  const c = String(comments ?? "").trim();
  if (!r && !c) return false;
  if (/warning/i.test(r) || /warning/i.test(c)) return true;
  return r.length > 0 || c.length > 0;
}

function computePublishEligible({ decision, reviewerUserId, reason, comments, sourceDefinitionsHash, previewHash, validationSnapshot }) {
  const errors = validationSnapshot.errors ?? [];
  const warnings = validationSnapshot.warnings ?? [];
  const reasonPresent = Boolean(String(reason ?? "").trim());
  const warningsOk = warnings.length === 0 || warningsAcknowledged(reason, comments);

  return (
    decision === "approved" &&
    errors.length === 0 &&
    Boolean(sourceDefinitionsHash) &&
    Boolean(previewHash) &&
    Boolean(String(reviewerUserId ?? "").trim()) &&
    reasonPresent &&
    warningsOk
  );
}

function buildApproval(args) {
  if (!args.reviewerUserId?.trim()) {
    console.error("Missing required flag: --reviewer-user-id");
    usage();
    process.exit(1);
  }
  if (!args.decision || !VALID_DECISIONS.has(args.decision)) {
    console.error("Missing or invalid required flag: --decision (approved|rejected|needs_changes)");
    usage();
    process.exit(1);
  }
  if (!args.reason?.trim()) {
    console.error("Missing required flag: --reason");
    usage();
    process.exit(1);
  }

  if (!existsSync(args.sourceDefinitions)) {
    console.error("Source definitions not found:", args.sourceDefinitions);
    process.exit(1);
  }
  if (!existsSync(args.preview)) {
    console.error("Preview not found:", args.preview);
    process.exit(1);
  }

  const sourceDefinitions = loadJson(args.sourceDefinitions);
  const report = sourceDefinitions.validation_report ?? {
    validation_status: "unknown",
    errors: [],
    warnings: [],
  };
  const errors = report.errors ?? [];
  const warnings = report.warnings ?? [];

  if (args.decision === "approved" && errors.length > 0) {
    console.error("Cannot approve: source definitions validation_report has errors.");
    for (const e of errors) {
      console.error(`  - ${e.code}: ${e.message}`);
    }
    process.exit(1);
  }

  if (args.decision === "approved" && warnings.length > 0 && !warningsAcknowledged(args.reason, args.comments)) {
    console.error(
      "Cannot approve with warnings: --reason or --comments must acknowledge warnings (e.g. mention 'warning')."
    );
    process.exit(1);
  }

  const sourceDefinitionsHash = fileSha256(args.sourceDefinitions);
  const previewHash = fileSha256(args.preview);
  const reasonHash = shortHash([args.reason]);
  const approvalId = `spa_${shortHash([sourceDefinitionsHash, args.reviewerUserId, args.decision, reasonHash])}`;
  const reviewedAt = new Date().toISOString();

  const validationSnapshot = {
    validation_status: report.validation_status ?? "unknown",
    errors,
    warnings,
  };

  const artifact = {
    approval_id: approvalId,
    artifact_type: "source_preview_approval",
    decision: args.decision,
    reviewer_user_id: args.reviewerUserId,
    reviewer_role: args.reviewerRole ?? null,
    reason: args.reason,
    comments: args.comments ?? null,
    reviewed_at: reviewedAt,
    source_definitions_path: relPath(args.sourceDefinitions),
    preview_path: relPath(args.preview),
    source_definitions_hash: sourceDefinitionsHash,
    preview_hash: previewHash,
    graph_id: sourceDefinitions.graph_id ?? null,
    input_hash: sourceDefinitions.input_hash ?? null,
    compiler_output_id: sourceDefinitions.compiler_output_id ?? null,
    compiler_version: sourceDefinitions.compiler_version ?? null,
    validation_snapshot: validationSnapshot,
    publish_eligible: false,
    provenance: {
      approval_gate_version: APPROVAL_GATE_VERSION,
    },
  };

  artifact.publish_eligible = computePublishEligible({
    decision: artifact.decision,
    reviewerUserId: artifact.reviewer_user_id,
    reason: artifact.reason,
    comments: artifact.comments,
    sourceDefinitionsHash: artifact.source_definitions_hash,
    previewHash: artifact.preview_hash,
    validationSnapshot,
  });

  return artifact;
}

function main() {
  const args = parseArgs(process.argv);
  const artifact = buildApproval(args);

  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log("Approval ID:", artifact.approval_id);
  console.log("Decision:", artifact.decision);
  console.log("Publish eligible:", artifact.publish_eligible);
  console.log("Graph ID:", artifact.graph_id);
  console.log("Source definitions hash:", artifact.source_definitions_hash);
  console.log("Preview hash:", artifact.preview_hash);
  console.log("Validation:", artifact.validation_snapshot.validation_status);
  console.log("Output:", relative(ROOT, args.output));
}

main();
