import { describe, it, expect, beforeEach } from 'vitest'
import { HuemulFilters, SqlWhereConnector } from '../../src/filters/huemul-filters'
import {
  HuemulFilterString,
  HuemulFilterNumber,
  HuemulFilterBoolean,
  HuemulFilterOperators,
  HuemulColumnClass,
} from '../../src/interfaces/interface-huemul-filter'

// Concrete subclass used across all tests
class TestFilters extends HuemulFilters {
  name   = new HuemulFilterString(HuemulColumnClass.NORMAL)
  status = new HuemulFilterString(HuemulColumnClass.NORMAL)
  age    = new HuemulFilterNumber(HuemulColumnClass.NORMAL)
  active = new HuemulFilterBoolean(HuemulColumnClass.NORMAL)
  id     = new HuemulFilterNumber(HuemulColumnClass.PK)
}

describe('HuemulFilters.getWhereClause — basic', () => {
  let f: TestFilters

  beforeEach(() => { f = new TestFilters() })

  it('returns empty string when no filters are set', () => {
    expect(f.getWhereClause()).toBe('')
  })

  it('generates a WHERE clause for a single EQUALS filter (NORMAL → uppercase)', () => {
    f.name.addFilter('john', HuemulFilterOperators.EQUALS)
    const sql = f.getWhereClause()
    expect(sql).toContain('WHERE'.toLowerCase()) // includes "where "
    expect(sql).toContain('UPPER')
    expect(sql).toContain('"name"')
    expect(sql).toContain("'JOHN'")
  })

  it('generates = clause for a PK number filter (no uppercase)', () => {
    f.id.addFilter(42, HuemulFilterOperators.EQUALS)
    const sql = f.getWhereClause()
    expect(sql).toContain('"id"')
    expect(sql).toContain('= 42')
    expect(sql).not.toContain('UPPER')
  })

  it('generates a boolean filter clause', () => {
    f.active.addFilter(true, HuemulFilterOperators.EQUALS)
    const sql = f.getWhereClause()
    expect(sql).toContain('"active"')
    expect(sql).toContain('true')
  })
})

describe('HuemulFilters.getWhereClause — operators', () => {
  let f: TestFilters

  beforeEach(() => { f = new TestFilters() })

  it('generates GREATER_THAN clause', () => {
    f.age.addFilter(18, HuemulFilterOperators.GREATER_THAN)
    expect(f.getWhereClause()).toContain('> 18')
  })

  it('generates LESS_THAN clause', () => {
    f.age.addFilter(65, HuemulFilterOperators.LESS_THAN)
    expect(f.getWhereClause()).toContain('< 65')
  })

  it('generates GREATER_THAN_OR_EQUAL clause', () => {
    f.age.addFilter(18, HuemulFilterOperators.GREATER_THAN_OR_EQUAL)
    expect(f.getWhereClause()).toContain('>= 18')
  })

  it('generates LESS_THAN_OR_EQUAL clause', () => {
    f.age.addFilter(100, HuemulFilterOperators.LESS_THAN_OR_EQUAL)
    expect(f.getWhereClause()).toContain('<= 100')
  })

  it('generates LIKE clause with wildcards', () => {
    f.name.addFilter('john', HuemulFilterOperators.LIKE)
    const sql = f.getWhereClause()
    expect(sql).toContain('LIKE')
    expect(sql).toContain('%JOHN%')
  })

  it('generates IS NULL clause', () => {
    f.name.addNull()
    const sql = f.getWhereClause()
    expect(sql).toContain('is null')
  })

  it('generates IS NOT NULL clause', () => {
    f.name.addNotNull()
    const sql = f.getWhereClause()
    expect(sql).toContain('is not null')
  })
})

describe('HuemulFilters.getWhereClause — LIKE on PK/FK columns', () => {
  class KeyFilters extends HuemulFilters {
    docId    = new HuemulFilterString(HuemulColumnClass.PK)
    parentId = new HuemulFilterString(HuemulColumnClass.FK)
  }

  let f: KeyFilters

  beforeEach(() => { f = new KeyFilters() })

  it('applies UPPER to a string PK column when operator is LIKE', () => {
    f.docId.addFilter('abc123', HuemulFilterOperators.LIKE)
    const sql = f.getWhereClause()
    expect(sql).toMatch(/UPPER\((?:"base"\.)?"docId"\)/)
    expect(sql).toContain("'%ABC123%'")
  })

  it('applies UPPER to a string FK column when operator is LIKE', () => {
    f.parentId.addFilter('def456', HuemulFilterOperators.LIKE)
    const sql = f.getWhereClause()
    expect(sql).toMatch(/UPPER\((?:"base"\.)?"parentId"\)/)
    expect(sql).toContain("'%DEF456%'")
  })

  it('keeps EQUALS on a string PK column case-sensitive (no UPPER)', () => {
    f.docId.addFilter('abc123', HuemulFilterOperators.EQUALS)
    const sql = f.getWhereClause()
    expect(sql).not.toContain('UPPER')
    expect(sql).toContain("'abc123'")
  })

  it('keeps IN on a string FK column case-sensitive (no UPPER)', () => {
    f.parentId.addFilter('abc', HuemulFilterOperators.IN)
    f.parentId.addFilter('def', HuemulFilterOperators.IN)
    const sql = f.getWhereClause()
    expect(sql).not.toContain('UPPER')
    expect(sql).toContain("'abc'")
    expect(sql).toContain("'def'")
  })
})

describe('HuemulFilters.getWhereClause — IN / NOT IN', () => {
  let f: TestFilters

  beforeEach(() => { f = new TestFilters() })

  it('generates IN clause for explicit IN operator', () => {
    f.name.addFilter('alice', HuemulFilterOperators.IN)
    f.name.addFilter('bob', HuemulFilterOperators.IN)
    const sql = f.getWhereClause()
    expect(sql).toContain('IN')
    expect(sql).toContain("'ALICE'")
    expect(sql).toContain("'BOB'")
  })

  it('converts multiple EQUALS to IN automatically', () => {
    f.name.addFilter('alice', HuemulFilterOperators.EQUALS)
    f.name.addFilter('bob', HuemulFilterOperators.EQUALS)
    const sql = f.getWhereClause()
    expect(sql).toContain('IN')
  })

  it('generates NOT IN clause', () => {
    f.status.addFilter('inactive', HuemulFilterOperators.NOT_IN)
    f.status.addFilter('deleted', HuemulFilterOperators.NOT_IN)
    const sql = f.getWhereClause()
    expect(sql).toContain('NOT IN')
  })

  it('generates IN clause for numbers', () => {
    f.age.addAllFilters([18, 21, 30], HuemulFilterOperators.IN)
    const sql = f.getWhereClause()
    expect(sql).toContain('IN')
    expect(sql).toContain('18')
    expect(sql).toContain('21')
    expect(sql).toContain('30')
  })
})

describe('HuemulFilters.getWhereClause — SQL injection protection', () => {
  let f: TestFilters

  beforeEach(() => { f = new TestFilters() })

  it("escapes single quotes to prevent SQL injection", () => {
    f.name.addFilter("O'Reilly", HuemulFilterOperators.EQUALS)
    const sql = f.getWhereClause()
    // Single quote must be escaped as '' in the output
    expect(sql).toContain("O''REILLY")
    expect(sql).not.toMatch(/'[^']O'[^']/) // no unescaped single quote
  })
})

describe('HuemulFilters.getWhereClause — SqlWhereConnector', () => {
  let f: TestFilters

  beforeEach(() => {
    f = new TestFilters()
    f.name.addFilter('test', HuemulFilterOperators.EQUALS)
  })

  it('prefixes with "where " by default', () => {
    expect(f.getWhereClause()).toMatch(/^where /i)
  })

  it('prefixes with " and " when INCLUDE_AND is specified', () => {
    expect(f.getWhereClause(undefined, undefined, SqlWhereConnector.INCLUDE_AND))
      .toMatch(/^ and /i)
  })

  it('has no prefix when INCLUDE_NONE is specified', () => {
    const sql = f.getWhereClause(undefined, undefined, SqlWhereConnector.INCLUDE_NONE)
    expect(sql).not.toMatch(/^(where| and)/i)
  })
})

describe('HuemulFilters.getWhereClause — include/exclude column lists', () => {
  let f: TestFilters

  beforeEach(() => {
    f = new TestFilters()
    f.name.addFilter('alice', HuemulFilterOperators.EQUALS)
    f.age.addFilter(30, HuemulFilterOperators.EQUALS)
  })

  it('only includes specified columns', () => {
    const sql = f.getWhereClause(['name'])
    expect(sql).toContain('"name"')
    expect(sql).not.toContain('"age"')
  })

  it('excludes specified columns', () => {
    const sql = f.getWhereClause(undefined, ['age'])
    expect(sql).toContain('"name"')
    expect(sql).not.toContain('"age"')
  })
})

describe('HuemulFilters.isValidFilter', () => {
  it('returns true for a HuemulFilterBase instance', () => {
    const f = new TestFilters()
    expect(f.isValidFilter(f.name)).toBe(true)
  })

  it('returns false for a plain object without "values" property', () => {
    const f = new TestFilters()
    expect(f.isValidFilter({ foo: 'bar' })).toBe(false)
  })

  it('returns false for null', () => {
    const f = new TestFilters()
    expect(f.isValidFilter(null)).toBe(false)
  })

  it('returns false for a string', () => {
    const f = new TestFilters()
    expect(f.isValidFilter('test')).toBe(false)
  })
})

describe('HuemulFilters.sqlInjectionCheck', () => {
  it('returns empty array when all values are clean', () => {
    const f = new TestFilters()
    f.name.addFilter('alice', HuemulFilterOperators.EQUALS)
    expect(f.sqlInjectionCheck()).toHaveLength(0)
  })

  it('returns errors for values containing single quotes', () => {
    const f = new TestFilters()
    f.name.addFilter("O'Malley", HuemulFilterOperators.EQUALS)
    const errors = f.sqlInjectionCheck()
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].column).toBe('name')
  })
})

describe('HuemulFilters.operatorStrToHuemul', () => {
  const f = new TestFilters()

  it.each([
    ['EQ',    HuemulFilterOperators.EQUALS],
    ['NEQ',   HuemulFilterOperators.NOT_EQUALS],
    ['GT',    HuemulFilterOperators.GREATER_THAN],
    ['GTE',   HuemulFilterOperators.GREATER_THAN_OR_EQUAL],
    ['LT',    HuemulFilterOperators.LESS_THAN],
    ['LTE',   HuemulFilterOperators.LESS_THAN_OR_EQUAL],
    ['LIKE',  HuemulFilterOperators.LIKE],
    ['IN',    HuemulFilterOperators.IN],
    ['NIN',   HuemulFilterOperators.NOT_IN],
    ['NULL',  HuemulFilterOperators.IS_NULL],
    ['NNULL', HuemulFilterOperators.IS_NOT_NULL],
  ])('maps "%s" → %s', (str, expected) => {
    expect(f.operatorStrToHuemul(str)).toBe(expected)
  })

  it('throws for unknown operator string', () => {
    expect(() => f.operatorStrToHuemul('UNKNOWN')).toThrow()
  })
})
