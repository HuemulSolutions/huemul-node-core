import { describe, it, expect } from 'vitest'
import { dataTypeToPostgres } from '../../src/gen-postgres-base'

describe('dataTypeToPostgres — string', () => {
  // When no length is provided the fallback is 99999, which is > 8000, so TEXT is returned
  it('returns TEXT for string with no explicit length', () => {
    expect(dataTypeToPostgres('string')).toBe('TEXT')
    expect(dataTypeToPostgres('string', undefined, undefined, true)).toBe('TEXT')
  })

  it('returns varchar(N) for string with explicit length ≤ 8000', () => {
    expect(dataTypeToPostgres('string', 255)).toBe('varchar(255)')
    expect(dataTypeToPostgres('string', 8000)).toBe('varchar(8000)')
  })

  it('returns TEXT for string with length > 8000', () => {
    expect(dataTypeToPostgres('string', 8001)).toBe('TEXT')
    expect(dataTypeToPostgres('string', 99999)).toBe('TEXT')
  })
})

describe('dataTypeToPostgres — boolean', () => {
  it('returns "boolean" for boolean type (case-insensitive)', () => {
    expect(dataTypeToPostgres('boolean')).toBe('boolean')
    expect(dataTypeToPostgres('Boolean')).toBe('boolean')
    expect(dataTypeToPostgres('BOOLEAN')).toBe('boolean')
  })
})

describe('dataTypeToPostgres — Date', () => {
  it('returns varchar(40) for Date with no length', () => {
    expect(dataTypeToPostgres('Date')).toBe('varchar(40)')
  })

  it('returns varchar(40) for Date with length >= 40', () => {
    expect(dataTypeToPostgres('Date', 40)).toBe('varchar(40)')
    expect(dataTypeToPostgres('Date', 100)).toBe('varchar(40)')
  })

  it('returns varchar(N) for Date with 0 < length < 40', () => {
    expect(dataTypeToPostgres('Date', 20)).toBe('varchar(20)')
  })

  it('is case-insensitive', () => {
    expect(dataTypeToPostgres('date')).toBe('varchar(40)')
    expect(dataTypeToPostgres('DATE')).toBe('varchar(40)')
  })
})

describe('dataTypeToPostgres — Time', () => {
  it('returns "time" for Time type', () => {
    expect(dataTypeToPostgres('Time')).toBe('time')
    expect(dataTypeToPostgres('time')).toBe('time')
    expect(dataTypeToPostgres('TIME')).toBe('time')
  })
})

describe('dataTypeToPostgres — timestamptz', () => {
  it('returns "timestamptz" for a native timestamp-with-timezone column', () => {
    expect(dataTypeToPostgres('timestamptz')).toBe('timestamptz')
    expect(dataTypeToPostgres('TimestampTZ')).toBe('timestamptz')
    expect(dataTypeToPostgres('TIMESTAMPTZ')).toBe('timestamptz')
  })
})

describe('dataTypeToPostgres — number', () => {
  it('returns INT when no precision is given', () => {
    expect(dataTypeToPostgres('number')).toBe('INT')
    expect(dataTypeToPostgres('number', 10, 0)).toBe('INT')
  })

  it('returns NUMERIC with default dimensions when precision > 0 and no length', () => {
    expect(dataTypeToPostgres('number', 0, 2)).toBe('NUMERIC(15, 2)')
  })

  it('returns NUMERIC with explicit length and precision', () => {
    expect(dataTypeToPostgres('number', 10, 3)).toBe('NUMERIC(10, 3)')
  })

  it('is case-insensitive', () => {
    expect(dataTypeToPostgres('NUMBER')).toBe('INT')
    expect(dataTypeToPostgres('Number', 0, 4)).toBe('NUMERIC(15, 4)')
  })
})

describe('dataTypeToPostgres — file / image', () => {
  it('returns varchar(100) for file type', () => {
    expect(dataTypeToPostgres('file')).toBe('varchar(100)')
    expect(dataTypeToPostgres('FILE')).toBe('varchar(100)')
  })

  it('returns varchar(100) for image type', () => {
    expect(dataTypeToPostgres('image')).toBe('varchar(100)')
    expect(dataTypeToPostgres('IMAGE')).toBe('varchar(100)')
  })
})

describe('dataTypeToPostgres — picker', () => {
  it('returns varchar(20) for picker with no length', () => {
    expect(dataTypeToPostgres('picker')).toBe('varchar(20)')
  })

  it('returns varchar(N) for picker with explicit length', () => {
    expect(dataTypeToPostgres('picker', 50)).toBe('varchar(50)')
  })
})

describe('dataTypeToPostgres — color', () => {
  it('returns varchar(10) for color type', () => {
    expect(dataTypeToPostgres('color')).toBe('varchar(10)')
    expect(dataTypeToPostgres('COLOR')).toBe('varchar(10)')
  })
})

describe('dataTypeToPostgres — unknown type (passthrough)', () => {
  it('returns the dataType as-is for unrecognized types', () => {
    expect(dataTypeToPostgres('json')).toBe('json')
    expect(dataTypeToPostgres('uuid')).toBe('uuid')
  })
})
