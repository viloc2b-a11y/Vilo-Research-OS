import { describe, expect, it } from 'vitest'
import { parseNegotiationLineItems } from './load-budget-evidence-summary'

// Characterization tests: lock the EXACT current coercion behavior of
// parseNegotiationLineItems before migrating its manual checks to Zod, so the
// refactor is provably behavior-preserving. Uses a single eventType; only the
// field-level coercion (the part being refactored) is asserted.

const EVENT = 'sponsor_offer_received'

function parseOne(item: unknown) {
  return parseNegotiationLineItems(EVENT, { line_items: [item] })
}

describe('parseNegotiationLineItems (characterization)', () => {
  it('returns [] when line_items is not an array', () => {
    expect(parseNegotiationLineItems(EVENT, { line_items: 'nope' })).toEqual([])
    expect(parseNegotiationLineItems(EVENT, {})).toEqual([])
    expect(parseNegotiationLineItems(EVENT, null)).toEqual([])
    expect(parseNegotiationLineItems(EVENT, undefined)).toEqual([])
  })

  it('drops non-object / malformed items', () => {
    expect(parseNegotiationLineItems(EVENT, { line_items: ['str', 5, null, [], undefined] })).toEqual(
      [],
    )
  })

  it('drops items with missing, empty, or whitespace-only label', () => {
    expect(parseOne({ amount: 10 })).toEqual([])
    expect(parseOne({ label: '' })).toEqual([])
    expect(parseOne({ label: '   ' })).toEqual([])
    expect(parseOne({ label: 42 })).toEqual([])
  })

  it('trims label', () => {
    expect(parseOne({ label: '  Site Fee  ' })[0]).toMatchObject({ label: 'Site Fee' })
  })

  it('category: trims a string; missing → "other"; empty string stays ""', () => {
    expect(parseOne({ label: 'X', category: '  visit ' })[0]).toMatchObject({ category: 'visit' })
    expect(parseOne({ label: 'X' })[0]).toMatchObject({ category: 'other' })
    expect(parseOne({ label: 'X', category: '' })[0]).toMatchObject({ category: '' })
    expect(parseOne({ label: 'X', category: 99 })[0]).toMatchObject({ category: 'other' })
  })

  it('amount: number finite → number; numeric string → number; "" → 0; non-numeric/NaN/missing → null', () => {
    expect(parseOne({ label: 'X', amount: 100 })[0]).toMatchObject({ amount: 100 })
    expect(parseOne({ label: 'X', amount: '50' })[0]).toMatchObject({ amount: 50 })
    expect(parseOne({ label: 'X', amount: '' })[0]).toMatchObject({ amount: 0 })
    expect(parseOne({ label: 'X', amount: 'abc' })[0]).toMatchObject({ amount: null })
    expect(parseOne({ label: 'X', amount: Number.NaN })[0]).toMatchObject({ amount: null })
    expect(parseOne({ label: 'X' })[0]).toMatchObject({ amount: null })
  })

  it('currency: trimmed + uppercased, or null', () => {
    expect(parseOne({ label: 'X', currency: ' usd ' })[0]).toMatchObject({ currency: 'USD' })
    expect(parseOne({ label: 'X', currency: '' })[0]).toMatchObject({ currency: null })
    expect(parseOne({ label: 'X' })[0]).toMatchObject({ currency: null })
  })

  it('note: trimmed, or null when empty/missing', () => {
    expect(parseOne({ label: 'X', note: '  hi ' })[0]).toMatchObject({ note: 'hi' })
    expect(parseOne({ label: 'X', note: '' })[0]).toMatchObject({ note: null })
    expect(parseOne({ label: 'X' })[0]).toMatchObject({ note: null })
  })

  it('activity_code: trimmed string, or undefined when empty/missing', () => {
    expect(parseOne({ label: 'X', activity_code: ' COORD_HOUR ' })[0]).toMatchObject({
      activity_code: 'COORD_HOUR',
    })
    expect(parseOne({ label: 'X', activity_code: '' })[0].activity_code).toBeUndefined()
    expect(parseOne({ label: 'X' })[0].activity_code).toBeUndefined()
  })

  it('ignores unknown extra keys', () => {
    const result = parseOne({ label: 'X', amount: 10, bogus: 'drop me' })
    expect(result[0]).not.toHaveProperty('bogus')
  })
})
