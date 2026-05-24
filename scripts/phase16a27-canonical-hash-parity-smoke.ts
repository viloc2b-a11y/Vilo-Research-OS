/**
 * Phase 16A-2.7 — Canonical hash parity smoke (deterministic serialization).
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '../lib/source/integrity/canonical-serialize'
import { hashFieldValue } from '../lib/source/integrity/hash-field-value'

function hashCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value), 'utf8').digest('hex')
}

function smokeKeyOrderParity() {
  const a = { z: 1, a: 2, m: { y: 1, x: 2 } }
  const b = { a: 2, m: { x: 2, y: 1 }, z: 1 }
  assert.equal(hashCanonical(a), hashCanonical(b))
  assert.equal(
    hashFieldValue({ valueJson: a }),
    hashFieldValue({ valueJson: b }),
  )
}

function smokeNestedReorder() {
  const left = { outer: { b: 2, a: 1 }, list: [1, 2] }
  const right = { list: [1, 2], outer: { a: 1, b: 2 } }
  assert.equal(hashCanonical(left), hashCanonical(right))
}

function smokeJsonRoundTripParity() {
  const original = { a: 1, nested: { b: true, c: 'x' }, arr: [3, 2, 1] }
  const roundTripped = JSON.parse(JSON.stringify(original)) as typeof original
  assert.equal(hashCanonical(original), hashCanonical(roundTripped))
}

function smokeNullVsMissingKey() {
  const withNull = { a: null, b: 1 }
  const withoutA = { b: 1 }
  assert.notEqual(hashCanonical(withNull), hashCanonical(withoutA))
  assert.equal(
    canonicalSerialize({ a: undefined, b: 1 }, { omitUndefinedKeys: true }),
    canonicalSerialize({ b: 1 }),
  )
}

function smokeArrayOrderDistinct() {
  const first = { arr: [1, 2, 3] }
  const second = { arr: [3, 2, 1] }
  assert.notEqual(hashCanonical(first), hashCanonical(second))
}

function main() {
  smokeKeyOrderParity()
  smokeNestedReorder()
  smokeJsonRoundTripParity()
  smokeNullVsMissingKey()
  smokeArrayOrderDistinct()
  console.log('phase16a27-canonical-hash-parity-smoke: PASS')
}

main()
