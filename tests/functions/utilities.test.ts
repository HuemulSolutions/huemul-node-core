import { describe, it, expect } from 'vitest'
import {
  capitalize,
  deepClone,
  getMessageErrorDataValitation,
  joinNameJsonForPostgres,
} from '../../src/functions/huemul-functions'
import { sanitizeSqlText } from '../../src/global'

describe('capitalize', () => {
  it('capitalizes the first letter of a string', () => {
    expect(capitalize('hello')).toBe('Hello')
  })
  it('does not change an already-capitalized string', () => {
    expect(capitalize('World')).toBe('World')
  })
  it('returns empty string for non-string input', () => {
    expect(capitalize(123)).toBe('')
    expect(capitalize(null)).toBe('')
    expect(capitalize(undefined)).toBe('')
  })
  it('returns empty string for empty input', () => {
    expect(capitalize('')).toBe('')
  })
  it('only capitalizes the first character', () => {
    expect(capitalize('hello world')).toBe('Hello world')
  })
})

describe('deepClone', () => {
  it('returns a copy that is deeply equal but not the same reference', () => {
    const original = { a: 1, b: { c: 2 } }
    const clone = deepClone(original)
    expect(clone).toEqual(original)
    expect(clone).not.toBe(original)
    expect(clone.b).not.toBe(original.b)
  })
  it('clones arrays correctly', () => {
    const arr = [1, 2, { x: 3 }]
    const clone = deepClone(arr)
    expect(clone).toEqual(arr)
    expect(clone).not.toBe(arr)
  })
  it('mutations to the clone do not affect the original', () => {
    const original = { a: { b: 42 } }
    const clone = deepClone(original)
    clone.a.b = 99
    expect(original.a.b).toBe(42)
  })
})

describe('getMessageErrorDataValitation', () => {
  it('returns a message with error count and joined list', () => {
    const msg = getMessageErrorDataValitation(['field1 is required', 'field2 too long'])
    expect(msg).toContain('2 errors')
    expect(msg).toContain('field1 is required')
    expect(msg).toContain('field2 too long')
  })
  it('handles a single error', () => {
    const msg = getMessageErrorDataValitation(['only one error'])
    expect(msg).toContain('1 errors')
  })
  it('handles an empty array', () => {
    const msg = getMessageErrorDataValitation([])
    expect(msg).toContain('0 errors')
  })
})

describe('joinNameJsonForPostgres', () => {
  it('returns empty string for empty array', () => {
    expect(joinNameJsonForPostgres([])).toBe('')
  })
  it('returns the single element for one-element array', () => {
    expect(joinNameJsonForPostgres(['data'])).toBe('data')
  })
  it('joins two elements with "->>"', () => {
    expect(joinNameJsonForPostgres(['data', 'name'])).toBe('data->>name')
  })
  it('joins three elements with "->" for all but last, "->>" for last', () => {
    expect(joinNameJsonForPostgres(['a', 'b', 'c'])).toBe('a->b->>c')
  })
  it('joins four elements correctly', () => {
    expect(joinNameJsonForPostgres(['a', 'b', 'c', 'd'])).toBe('a->b->c->>d')
  })
})

describe('sanitizeSqlText', () => {
  it('escapes single quotes by doubling them', () => {
    expect(sanitizeSqlText("it's")).toBe("it''s")
  })
  it('escapes multiple single quotes', () => {
    expect(sanitizeSqlText("a'b'c")).toBe("a''b''c")
  })
  it('returns the string unchanged when there are no single quotes', () => {
    expect(sanitizeSqlText('hello world')).toBe('hello world')
  })
  it('returns undefined for undefined input', () => {
    expect(sanitizeSqlText(undefined)).toBeUndefined()
  })
  it('returns empty string for empty input', () => {
    expect(sanitizeSqlText('')).toBe('')
  })
})
