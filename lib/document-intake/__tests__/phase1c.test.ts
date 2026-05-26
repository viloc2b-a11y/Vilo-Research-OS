import { describe, expect, it } from 'vitest'
import { validateObligationInput } from '../validate-obligation-input'
import {
  ACKNOWLEDGEMENT_TYPE,
  OBLIGATION_TYPE,
  SIGNATURE_MEANING,
} from '../obligation-types'
import * as auditLedger from '../audit-ledger'

describe('document intake phase 1c', () => {
  it('validates signature obligation input', () => {
    const result = validateObligationInput({
      obligation_type: OBLIGATION_TYPE.SIGNATURE,
      signature_meaning: SIGNATURE_MEANING.REVIEWED,
      assigned_role: 'research_coordinator',
    })
    expect(result.ok).toBe(true)
  })

  it('validates acknowledgement obligation input', () => {
    const result = validateObligationInput({
      obligation_type: OBLIGATION_TYPE.ACKNOWLEDGEMENT,
      acknowledgement_type: ACKNOWLEDGEMENT_TYPE.OPERATIONAL,
      assigned_user_id: '00000000-0000-4000-8000-000000000900',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects obligation without assignee', () => {
    const result = validateObligationInput({
      obligation_type: OBLIGATION_TYPE.SIGNATURE,
      signature_meaning: SIGNATURE_MEANING.REVIEWED,
    })
    expect(result.ok).toBe(false)
  })

  it('audit ledger remains append-only', () => {
    expect(Object.keys(auditLedger)).toEqual(['appendComplianceAuditEvent'])
  })
})
