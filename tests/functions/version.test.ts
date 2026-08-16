import { describe, it, expect } from 'vitest'
import { compareVersions, isValidVersion, isVersionGreaterThan } from '../../src/functions/huemul-version'

describe('isValidVersion', () => {
  it('accepts a well formed x.y.z', () => {
    expect(isValidVersion('1.3.0')).toBe(true)
    expect(isValidVersion('0.0.0')).toBe(true)
    expect(isValidVersion('10.20.30')).toBe(true)
  })
  it('trims surrounding whitespace', () => {
    expect(isValidVersion('  1.3.0  ')).toBe(true)
  })
  it('rejects partial versions', () => {
    expect(isValidVersion('1.3')).toBe(false)
    expect(isValidVersion('1')).toBe(false)
    expect(isValidVersion('1.3.0.4')).toBe(false)
  })
  it('rejects non numeric segments and pre-release suffixes', () => {
    expect(isValidVersion('1.x.3')).toBe(false)
    expect(isValidVersion('1.2.3-beta')).toBe(false)
    expect(isValidVersion('v1.2.3')).toBe(false)
  })
  it('rejects empty and nullish input', () => {
    expect(isValidVersion('')).toBe(false)
    expect(isValidVersion('   ')).toBe(false)
    expect(isValidVersion(undefined as any)).toBe(false)
    expect(isValidVersion(null as any)).toBe(false)
  })
})

describe('compareVersions', () => {
  it('returns 1 when the first version is greater', () => {
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1)
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1)
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1)
  })
  it('returns -1 when the first version is lower', () => {
    expect(compareVersions('1.2.9', '1.3.0')).toBe(-1)
    expect(compareVersions('1.99.99', '2.0.0')).toBe(-1)
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1)
  })
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('0.0.0', '0.0.0')).toBe(0)
  })
  it('compares numerically, not lexicographically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1)
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1)
    expect(compareVersions('10.0.0', '9.0.0')).toBe(1)
  })
  it('treats missing segments as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1', '1.0.0')).toBe(0)
    expect(compareVersions('1.2', '1.2.1')).toBe(-1)
  })
  it('treats empty and nullish input as 0.0.0', () => {
    expect(compareVersions('', '0.0.0')).toBe(0)
    expect(compareVersions('1.0.0', '')).toBe(1)
    expect(compareVersions(undefined as any, '0.0.1')).toBe(-1)
    expect(compareVersions(null as any, null as any)).toBe(0)
  })
  it('ignores pre-release and build suffixes', () => {
    expect(compareVersions('1.2.3-beta', '1.2.3')).toBe(0)
    expect(compareVersions('1.2.3+build.5', '1.2.3')).toBe(0)
    expect(compareVersions('1.3.0-rc1', '1.2.9')).toBe(1)
  })
  it('treats unparseable segments as zero instead of throwing', () => {
    expect(compareVersions('1.x.3', '1.0.3')).toBe(0)
    expect(compareVersions('abc', '0.0.0')).toBe(0)
  })
  it('trims surrounding whitespace', () => {
    expect(compareVersions('  1.3.0  ', '1.3.0')).toBe(0)
  })
  it('is antisymmetric', () => {
    const pairs: [string, string][] = [['1.3.0', '1.2.9'], ['1.2.3', '1.2.3'], ['0.1.0', '1.0.0']]
    for (const [a, b] of pairs) {
      // `+ 0` normaliza el -0 que produce negar un 0 en JavaScript
      expect(compareVersions(a, b)).toBe(-compareVersions(b, a) + 0)
    }
  })
})

describe('isVersionGreaterThan', () => {
  it('is true only when strictly greater', () => {
    expect(isVersionGreaterThan('1.3.0', '1.2.9')).toBe(true)
    expect(isVersionGreaterThan('1.2.0', '1.2.0')).toBe(false)
    expect(isVersionGreaterThan('1.2.0', '1.2.1')).toBe(false)
  })
  it('is true for any release over an empty watermark', () => {
    expect(isVersionGreaterThan('0.0.1', '')).toBe(true)
    expect(isVersionGreaterThan('0.0.1', undefined as any)).toBe(true)
  })
  it('stays consistent with compareVersions', () => {
    const pairs: [string, string][] = [['1.3.0', '1.2.9'], ['1.2.3', '1.2.3'], ['1.9.0', '1.10.0']]
    for (const [a, b] of pairs) {
      expect(isVersionGreaterThan(a, b)).toBe(compareVersions(a, b) === 1)
    }
  })
})
