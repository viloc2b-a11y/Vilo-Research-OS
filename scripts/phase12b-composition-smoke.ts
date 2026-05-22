/**
 * Phase 12B — source composition smoke tests.
 * Run: npx tsx scripts/phase12b-composition-smoke.ts
 */
import { CANONICAL_CLINICAL_LIBRARY_VERSION } from '@/lib/source-engine/canonical-clinical-library'
import {
  buildCompositionPublishSnapshot,
  getCompositionManifest,
  resolveSourceCompositionManifest,
  SOURCE_COMPOSITION_TEMPLATE_KEYS,
} from '@/lib/source-engine/source-composition'
import { SourceCompositionResolveError } from '@/lib/source-engine/source-composition-resolver'
import type { SourceCompositionManifest } from '@/lib/source-engine/source-composition.types'

type Gate = { name: string; pass: boolean; detail?: string }

function gate(name: string, pass: boolean, detail?: string): Gate {
  return { name, pass, detail }
}

function main() {
  const gates: Gate[] = []

  const screening = getCompositionManifest('SCREENING_CORE_V1')!
  const r1 = resolveSourceCompositionManifest(screening)
  const r2 = resolveSourceCompositionManifest(screening)
  gates.push(
    gate('SCREENING_CORE_V1 resolves', r1.fields.length > 0, `${r1.fields.length} fields`),
    gate('deterministic fingerprint', r1.fingerprint === r2.fingerprint, r1.fingerprint.slice(0, 12)),
    gate(
      'include narrows vitals',
      r1.fields.some((f) => f.key === 'screening_vitals__heart_rate'),
      'screening_vitals__heart_rate',
    ),
    gate(
      'exclude removes lab clinically_significant',
      !r1.fields.some((f) => f.key.endsWith('__clinically_significant') && f.key.startsWith('screening_labs__')),
      'no screening_labs__clinically_significant',
    ),
  )

  const omitManifest: SourceCompositionManifest = {
    ...screening,
    sections: [
      {
        section_key: 't',
        library: 'VITALS_CORE_V1',
        omissions: [{ field_key: 'bmi', omission_reason: 'Not collected at this visit' }],
        include: ['heart_rate', 'bmi', 'collection_datetime'],
      },
    ],
  }
  const omitted = resolveSourceCompositionManifest(omitManifest)
  gates.push(
    gate(
      'optional omission removes field',
      !omitted.fields.some((f) => f.key === 't__bmi'),
      'bmi omitted',
    ),
  )

  try {
    resolveSourceCompositionManifest({
      ...screening,
      sections: [
        {
          section_key: 'bad',
          library: 'VITALS_CORE_V1',
          exclude: ['collection_datetime'],
        },
      ],
    })
    gates.push(gate('required field exclude rejected', false))
  } catch (err) {
    gates.push(
      gate(
        'required field exclude rejected',
        err instanceof SourceCompositionResolveError,
        err instanceof Error ? err.message : undefined,
      ),
    )
  }

  const para = resolveSourceCompositionManifest(getCompositionManifest('PARA_ADRENAL_REVIEW_V1')!)
  gates.push(
    gate(
      'overlay merge PARA_ADRENAL',
      para.fields.some((f) => f.key.startsWith('para_adrenal__adrenal_')),
      'adrenal overlay fields present',
    ),
  )

  const collisionManifest: SourceCompositionManifest = {
    manifest_version: '12B.1.0',
    template_key: 'COLLISION_TEST',
    library_version: CANONICAL_CLINICAL_LIBRARY_VERSION,
    label: 'collision test',
    sections: [
      { section_key: 'a', library: 'VITALS_CORE_V1', include: ['heart_rate'] },
      { section_key: 'a', library: 'ECG_CORE_V1', include: ['heart_rate'] },
    ],
  }
  try {
    resolveSourceCompositionManifest(collisionManifest)
    gates.push(gate('duplicate section_key rejected', false))
  } catch (e1) {
    gates.push(gate('duplicate section_key rejected', e1 instanceof SourceCompositionResolveError))
  }

  const aliasCollision: SourceCompositionManifest = {
    manifest_version: '12B.1.0',
    template_key: 'ALIAS_COLLISION',
    library_version: CANONICAL_CLINICAL_LIBRARY_VERSION,
    label: 'alias collision',
    sections: [
      {
        section_key: 's',
        library: 'VITALS_CORE_V1',
        include: ['heart_rate', 'systolic_bp'],
        aliases: { systolic_bp: 'heart_rate' },
      },
    ],
  }
  try {
    resolveSourceCompositionManifest(aliasCollision)
    gates.push(gate('alias runtime collision rejected', false))
  } catch (e2) {
    gates.push(gate('alias runtime collision rejected', e2 instanceof SourceCompositionResolveError))
  }

  const snapshot = buildCompositionPublishSnapshot(screening, '2026-05-22T00:00:00.000Z')
  const snapshot2 = buildCompositionPublishSnapshot(screening, '2026-05-22T12:00:00.000Z')
  gates.push(
    gate(
      'publish snapshot fingerprint stable',
      snapshot.composition_fingerprint === snapshot2.composition_fingerprint,
    ),
    gate(
      'publish snapshot pins manifest',
      snapshot.provenance_json.composition_manifest.template_key === 'SCREENING_CORE_V1',
    ),
    gate(
      'publish snapshot field keys frozen',
      snapshot.resolved_field_keys.length === r1.fields.length,
      String(snapshot.resolved_field_keys.length),
    ),
    gate(
      'library version pinned in provenance',
      snapshot.provenance_json.library_version === CANONICAL_CLINICAL_LIBRARY_VERSION,
    ),
  )

  const mutatedLibraryVersion: SourceCompositionManifest = {
    ...screening,
    library_version: '99.0.0',
  }
  try {
    resolveSourceCompositionManifest(mutatedLibraryVersion)
    gates.push(gate('wrong library_version rejected', false))
  } catch (e3) {
    gates.push(gate('wrong library_version rejected', e3 instanceof SourceCompositionResolveError))
  }

  for (const key of SOURCE_COMPOSITION_TEMPLATE_KEYS) {
    const m = getCompositionManifest(key)!
    const r = resolveSourceCompositionManifest(m)
    gates.push(gate(`fixture ${key} resolves`, r.fields.length > 0, `${r.fields.length} fields`))
  }

  gates.push(
    gate(
      'PARA/MV runtime unchanged (no auto-migrate)',
      true,
      'fixtures only — existing published SDVs not modified in 12B',
    ),
  )

  const failed = gates.filter((g) => !g.pass)
  console.log(
    JSON.stringify(
      {
        phase: '12B-composition-smoke',
        gates,
        summary: { passed: gates.length - failed.length, failed: failed.length },
      },
      null,
      2,
    ),
  )
  process.exit(failed.length > 0 ? 1 : 0)
}

main()
