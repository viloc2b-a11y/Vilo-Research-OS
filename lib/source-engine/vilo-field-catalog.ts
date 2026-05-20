/**
 * Vilo canonical field catalog — study-agnostic FieldSpec registry.
 * Studies compose templates from these specs; extend via config.library + phase templates.
 */

import { Domain, FieldType, type FieldSpec } from '@/lib/source-engine/canonical'

export const VILO_FIELD_CATALOG: FieldSpec[] = [
  // DEMOGRAPHICS
  {
    id: 'birth_year',
    domain: Domain.DEMO,
    label: 'Birth Year',
    type: FieldType.NUMBER,
    required: true,
    sourcePath: 'demo.birth_year',
  },
  {
    id: 'sex',
    domain: Domain.DEMO,
    label: 'Sex at Birth',
    type: FieldType.ENUM,
    required: true,
    options: ['Male', 'Female'],
    sourcePath: 'demo.sex',
  },
  {
    id: 'childbearing_potential',
    domain: Domain.ELIGIBILITY,
    label: 'Childbearing potential',
    type: FieldType.ENUM,
    required: false,
    options: ['Yes', 'No'],
    conditional: { dependsOn: 'sex', equals: 'Female' },
    sourcePath: 'demo.childbearing_potential',
  },
  {
    id: 'pregnancy_test_result',
    domain: Domain.PREGNANCY,
    label: 'Pregnancy test result',
    type: FieldType.ENUM,
    required: false,
    options: ['Negative', 'Positive', 'Not done'],
    conditional: { dependsOn: 'childbearing_potential', equals: 'Yes' },
    sourcePath: 'pregnancy.result',
  },

  // VITALS
  {
    id: 'sys_bp',
    domain: Domain.VITALS,
    label: 'Systolic BP (mmHg)',
    type: FieldType.NUMBER,
    required: true,
    validation: { min: 70, max: 250 },
    sourcePath: 'vitals.sys_bp',
  },
  {
    id: 'weight_kg',
    domain: Domain.VITALS,
    label: 'Weight (kg)',
    type: FieldType.NUMBER,
    required: true,
    sourcePath: 'vitals.weight',
  },
  {
    id: 'height_cm',
    domain: Domain.VITALS,
    label: 'Height (cm)',
    type: FieldType.NUMBER,
    required: true,
    sourcePath: 'vitals.height',
  },
  {
    id: 'bmi',
    domain: Domain.VITALS,
    label: 'BMI (kg/m²)',
    type: FieldType.NUMBER,
    required: false,
    sourcePath: 'vitals.bmi',
  },

  // PROCEDURES & FINDINGS
  {
    id: 'bbps_right',
    domain: Domain.PROCEDURES,
    label: 'BBPS Right',
    type: FieldType.ENUM,
    required: true,
    options: ['0', '1', '2', '3'],
    sourcePath: 'proc.bbps_right',
  },
  {
    id: 'bbps_transverse',
    domain: Domain.PROCEDURES,
    label: 'BBPS Transverse',
    type: FieldType.ENUM,
    required: true,
    options: ['0', '1', '2', '3'],
    sourcePath: 'proc.bbps_transverse',
  },
  {
    id: 'bbps_left',
    domain: Domain.PROCEDURES,
    label: 'BBPS Left',
    type: FieldType.ENUM,
    required: true,
    options: ['0', '1', '2', '3'],
    sourcePath: 'proc.bbps_left',
  },
  {
    id: 'bbps_total',
    domain: Domain.PROCEDURES,
    label: 'BBPS Total',
    type: FieldType.NUMBER,
    required: false,
    sourcePath: 'proc.bbps_total',
  },
  {
    id: 'finding_type',
    domain: Domain.FINDINGS,
    label: 'Finding Type',
    type: FieldType.ENUM,
    required: true,
    options: ['POLYP', 'AA', 'CRC', 'OTHER'],
    sourcePath: 'finding.type',
  },
  {
    id: 'tnm_m_status',
    domain: Domain.TNM,
    label: 'TNM M Status',
    type: FieldType.ENUM,
    required: true,
    options: ['M0', 'M1', 'M1a', 'M1b', 'Mx'],
    sourcePath: 'tnm.m',
  },

  // PLASMA & LABS
  {
    id: 'hemolysis_grade',
    domain: Domain.LABS_CENTRAL,
    label: 'Hemolysis Grade',
    type: FieldType.ENUM,
    required: true,
    options: ['1_NONE', '2_SLIGHT', '3_MODERATE', '4_HEMOLYZED'],
    sourcePath: 'lab.hemolysis',
  },
  {
    id: 'aliquot_count',
    domain: Domain.LABS_CENTRAL,
    label: 'Aliquots Prepared',
    type: FieldType.NUMBER,
    required: true,
    validation: { min: 1, max: 10 },
    sourcePath: 'lab.aliquot_count',
  },

  // SITE & SUPPLY
  {
    id: 'ip_kit_id',
    domain: Domain.IRT_SUPPLY,
    label: 'IP Kit ID',
    type: FieldType.TEXT,
    required: true,
    sourcePath: 'supply.kit_id',
  },
  {
    id: 'delegation_role',
    domain: Domain.SITE_COMPLIANCE,
    label: 'Delegated Role',
    type: FieldType.ENUM,
    required: true,
    options: ['PI', 'SUB-I', 'CRC', 'Pharmacist'],
    sourcePath: 'site.delegation.role',
  },
]

const byId = new Map(VILO_FIELD_CATALOG.map((field) => [field.id, field]))

export function getViloCatalogField(id: string): FieldSpec | undefined {
  return byId.get(id)
}

export function getViloCatalogFieldsByDomain(domain: Domain): FieldSpec[] {
  return VILO_FIELD_CATALOG.filter((field) => field.domain === domain)
}

export function pickViloCatalogFields(ids: string[]): FieldSpec[] {
  return ids
    .map((id) => byId.get(id))
    .filter((field): field is FieldSpec => Boolean(field))
}
