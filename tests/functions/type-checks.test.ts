import { describe, it, expect } from 'vitest'
import {
  isEmpty,
  isNotEmpty,
  hasValue,
  isBoolean,
  toBoolean,
  isEmptyForRequest,
  defaultValueIfEmpty,
  sqlInjectionValidation,
} from '../../src/functions/huemul-functions'

describe('isEmpty', () => {
  it('returns true for null', () => expect(isEmpty(null)).toBe(true))
  it('returns true for undefined', () => expect(isEmpty(undefined)).toBe(true))
  it('returns true for empty string', () => expect(isEmpty('')).toBe(true))
  it('returns true for whitespace string', () => expect(isEmpty('   ')).toBe(true))
  it('returns false for non-empty string', () => expect(isEmpty('hello')).toBe(false))
  it('returns false for number 42', () => expect(isEmpty(42)).toBe(false))
  it('returns false for number 0', () => expect(isEmpty(0)).toBe(false))
  it('returns false for boolean false', () => expect(isEmpty(false)).toBe(false))
  it('returns false for boolean true', () => expect(isEmpty(true)).toBe(false))
  it('returns false for plain object', () => expect(isEmpty({})).toBe(false))
})

describe('isNotEmpty / hasValue', () => {
  it('isNotEmpty is the inverse of isEmpty', () => {
    expect(isNotEmpty('hello')).toBe(true)
    expect(isNotEmpty('')).toBe(false)
    expect(isNotEmpty(null)).toBe(false)
  })
  it('hasValue behaves identically to isNotEmpty', () => {
    expect(hasValue('x')).toBe(true)
    expect(hasValue(0)).toBe(true)
    expect(hasValue(undefined)).toBe(false)
  })
})

describe('isEmptyForRequest', () => {
  it('returns true for null and undefined', () => {
    expect(isEmptyForRequest(null)).toBe(true)
    expect(isEmptyForRequest(undefined)).toBe(true)
  })
  it('returns true for strings "NULL" and "UNDEFINED" (case-insensitive)', () => {
    expect(isEmptyForRequest('NULL')).toBe(true)
    expect(isEmptyForRequest('null')).toBe(true)
    expect(isEmptyForRequest('UNDEFINED')).toBe(true)
    expect(isEmptyForRequest('undefined')).toBe(true)
  })
  it('returns true for empty and whitespace strings', () => {
    expect(isEmptyForRequest('')).toBe(true)
    expect(isEmptyForRequest('   ')).toBe(true)
  })
  it('returns false for normal string values', () => {
    expect(isEmptyForRequest('hello')).toBe(false)
    expect(isEmptyForRequest('0')).toBe(false)
  })
})

describe('defaultValueIfEmpty', () => {
  it('returns defaultValue when currentValue is null', () => {
    expect(defaultValueIfEmpty(null, 'default')).toBe('default')
  })
  it('returns defaultValue when currentValue is undefined', () => {
    expect(defaultValueIfEmpty(undefined, 42)).toBe(42)
  })
  it('returns currentValue when it has a value', () => {
    expect(defaultValueIfEmpty('hello', 'default')).toBe('hello')
    expect(defaultValueIfEmpty(0, 99)).toBe(0)
    expect(defaultValueIfEmpty(false, true)).toBe(false)
  })
})

describe('isBoolean', () => {
  it('returns true for native boolean true/false', () => {
    expect(isBoolean(true)).toBe(true)
    expect(isBoolean(false)).toBe(true)
  })
  it('returns true for string "true"/"false" (case-insensitive)', () => {
    expect(isBoolean('true')).toBe(true)
    expect(isBoolean('false')).toBe(true)
    expect(isBoolean('TRUE')).toBe(true)
    expect(isBoolean('FALSE')).toBe(true)
  })
  it('returns true for numbers 0 and 1', () => {
    expect(isBoolean(0)).toBe(true)
    expect(isBoolean(1)).toBe(true)
  })
  it('returns false for number 2', () => expect(isBoolean(2)).toBe(false))
  it('returns false for null/undefined', () => {
    expect(isBoolean(null)).toBe(false)
    expect(isBoolean(undefined)).toBe(false)
  })
  it('returns false for empty string', () => expect(isBoolean('')).toBe(false))
  it('returns false for arbitrary string', () => expect(isBoolean('yes')).toBe(false))
})

describe('toBoolean', () => {
  it('returns null for empty values', () => {
    expect(toBoolean(null)).toBeNull()
    expect(toBoolean(undefined)).toBeNull()
    expect(toBoolean('')).toBeNull()
  })
  it('returns the native boolean as-is', () => {
    expect(toBoolean(true)).toBe(true)
    expect(toBoolean(false)).toBe(false)
  })
  it('converts string "true"/"false" correctly', () => {
    expect(toBoolean('true')).toBe(true)
    expect(toBoolean('false')).toBe(false)
    expect(toBoolean('TRUE')).toBe(true)
    expect(toBoolean('FALSE')).toBe(false)
  })
  it('converts number 0 → false and 1 → true', () => {
    expect(toBoolean(0)).toBe(false)
    expect(toBoolean(1)).toBe(true)
  })
  it('returns null for unrecognized values', () => {
    expect(toBoolean(2)).toBeNull()
    expect(toBoolean('yes')).toBeNull()
    expect(toBoolean({})).toBeNull()
  })
})

describe('sqlInjectionValidation', () => {
  it('returns true for clean strings', () => {
    expect(sqlInjectionValidation('hello world')).toBe(true)
  })
  it('returns false for strings containing a single quote', () => {
    expect(sqlInjectionValidation("it's")).toBe(false)
    expect(sqlInjectionValidation("' OR '1'='1")).toBe(false)
  })
  it('returns true for numbers and booleans', () => {
    expect(sqlInjectionValidation(42)).toBe(true)
    expect(sqlInjectionValidation(true)).toBe(true)
  })
  it('returns true for null/undefined', () => {
    expect(sqlInjectionValidation(null)).toBe(true)
    expect(sqlInjectionValidation(undefined)).toBe(true)
  })
  it('returns false for objects', () => {
    expect(sqlInjectionValidation({})).toBe(false)
  })
})
