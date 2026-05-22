/**
 * Phase 12B — source composition catalog loader and helpers.
 */

import templatesCatalog from '@/fixtures/source-composition/composition-templates.v1.json'
import type { SourceCompositionManifest } from '@/lib/source-engine/source-composition.types'

export type {
  CompositionPublishSnapshot,
  ResolvedCompositionFieldMeta,
  ResolvedCompositionSection,
  ResolvedSourceComposition,
  SourceCompositionManifest,
  SourceCompositionOmission,
  SourceCompositionSection,
} from '@/lib/source-engine/source-composition.types'

export {
  SourceCompositionResolveError,
  buildCompositionPublishSnapshot,
  resolveSourceCompositionManifest,
} from '@/lib/source-engine/source-composition-resolver'

type CompositionTemplatesCatalog = {
  catalog_version: string
  library_version: string
  templates: Record<string, SourceCompositionManifest>
}

const CATALOG = templatesCatalog as CompositionTemplatesCatalog

export const SOURCE_COMPOSITION_CATALOG_VERSION = CATALOG.catalog_version
export const SOURCE_COMPOSITION_TEMPLATE_KEYS = Object.keys(CATALOG.templates).sort()

export function loadCompositionTemplatesCatalog(): CompositionTemplatesCatalog {
  return CATALOG
}

export function getCompositionManifest(templateKey: string): SourceCompositionManifest | undefined {
  return CATALOG.templates[templateKey]
}

export function listCompositionManifests(): SourceCompositionManifest[] {
  return SOURCE_COMPOSITION_TEMPLATE_KEYS.map((key) => CATALOG.templates[key])
}
