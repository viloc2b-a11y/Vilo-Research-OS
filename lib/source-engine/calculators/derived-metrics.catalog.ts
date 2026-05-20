import type { DerivedMetricDefinition } from '@/lib/source-engine/definitions/types'

export const DERIVED_METRICS_CATALOG: DerivedMetricDefinition[] = [
  {
    id: 'bmi',
    label: 'BMI',
    targetFieldId: 'bmi',
    inputFieldIds: ['height_cm', 'weight_kg'],
    formula: 'bmi',
  },
  {
    id: 'pack_years',
    label: 'Pack-years',
    targetFieldId: 'pack_years',
    inputFieldIds: ['packs_per_day', 'years_smoked'],
    formula: 'pack_years',
  },
  {
    id: 'platelet_drop_percent',
    label: 'Platelet drop %',
    targetFieldId: 'platelet_drop_percent',
    inputFieldIds: ['platelet_baseline', 'platelet_count'],
    formula: 'platelet_drop_percent',
  },
  {
    id: 'blood_pressure_display',
    label: 'BP display',
    targetFieldId: 'bp_display',
    inputFieldIds: ['systolic_bp', 'diastolic_bp'],
    formula: 'blood_pressure_display',
  },
  {
    id: 'visit_window_status',
    label: 'Visit window status',
    targetFieldId: 'visit_window_status',
    inputFieldIds: [],
    formula: 'visit_window_status',
  },
  {
    id: 'pk_window_status',
    label: 'PK window status',
    targetFieldId: 'pk_window_status',
    inputFieldIds: ['minutes_from_ip_start'],
    formula: 'pk_window_status',
  },
  {
    id: 'cas_score',
    label: 'CAS Score',
    targetFieldId: 'cas_score',
    inputFieldIds: [],
    formula: 'cas_score',
  },
  {
    id: 'transit_time',
    label: 'Transit Time',
    targetFieldId: 'transit_time',
    inputFieldIds: [],
    formula: 'transit_time',
  },
  {
    id: 'womac_score',
    label: 'WOMAC Score',
    targetFieldId: 'womac_score',
    inputFieldIds: [],
    formula: 'womac_score',
  },
  {
    id: 'mayo_score',
    label: 'Mayo Score',
    targetFieldId: 'mayo_score',
    inputFieldIds: [],
    formula: 'mayo_score',
  },
]
