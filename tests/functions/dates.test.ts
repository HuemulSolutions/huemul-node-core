import { describe, it, expect } from 'vitest'
import {
  castDateTimeToText,
  castDateToText,
  truncateDateText,
  castTimeToText,
  getDateTimeNumber,
  getDateFromText,
  getDuration,
  getDaysFromTwoDates,
  castDateTimeToDateWithoutTz,
  castYearMonthDayToText,
  castDateTimeToDateDayOne,
  getMinutesFromTime,
  validDate,
  validateDateTimeFormat,
  validateDateTimeValue,
  validateTimeFormat,
} from '../../src/functions/huemul-functions'

const D = (iso: string) => new Date(iso)

describe('castDateTimeToText', () => {
  it('formats UTC datetime to ISO string', () => {
    expect(castDateTimeToText(D('2024-03-15T10:30:45.123Z')))
      .toBe('2024-03-15T10:30:45.123Z')
  })
  it('returns only date when onlyDate=true', () => {
    expect(castDateTimeToText(D('2024-03-15T10:30:45.123Z'), true))
      .toBe('2024-03-15')
  })
  it('pads single-digit month and day', () => {
    expect(castDateTimeToText(D('2024-01-05T00:00:00.000Z')))
      .toBe('2024-01-05T00:00:00.000Z')
  })
})

describe('castDateToText', () => {
  it('formats UTC date correctly', () => {
    expect(castDateToText(D('2024-06-20T00:00:00Z'), true))
      .toBe('2024-06-20')
  })
  it('pads month and day with zeros', () => {
    expect(castDateToText(D('2024-01-05T00:00:00Z'), true))
      .toBe('2024-01-05')
  })
})

describe('truncateDateText', () => {
  it('truncates a full ISO datetime to 10 chars for a date-only column', () => {
    expect(truncateDateText('2024-01-01T00:00:00.000Z', 10)).toBe('2024-01-01')
  })
  it('keeps the time for a datetime column (length 30)', () => {
    expect(truncateDateText('2024-01-01T10:30:45.000Z', 30)).toBe('2024-01-01T10:30:45.000Z')
  })
  it('caps to 40 when columnLength is 0 (mirrors dataTypeToPostgres varchar(40))', () => {
    const long = '2024-01-01T10:30:45.000000+00:00-extra-tail-chars'
    expect(truncateDateText(long, 0)).toBe(long.substring(0, 40))
  })
  it('caps to 40 when columnLength >= 40', () => {
    const long = '2024-01-01T10:30:45.000000+00:00-extra-tail-chars'
    expect(truncateDateText(long, 50)).toBe(long.substring(0, 40))
  })
  it('does not touch values shorter than the limit', () => {
    expect(truncateDateText('2024-01-01', 10)).toBe('2024-01-01')
  })
  it('returns non-string values unchanged', () => {
    expect(truncateDateText(undefined, 10)).toBe(undefined)
    expect(truncateDateText(null, 10)).toBe(null)
    expect(truncateDateText(123 as unknown, 10)).toBe(123)
  })
})

describe('castTimeToText', () => {
  it('formats UTC time as HH:MM', () => {
    expect(castTimeToText(D('2024-01-01T09:05:00Z'), true))
      .toBe('09:05')
  })
  it('pads hours and minutes with zeros', () => {
    expect(castTimeToText(D('2024-01-01T00:00:00Z'), true))
      .toBe('00:00')
  })
})

describe('getDateTimeNumber', () => {
  it('returns a sortable timestamp string ending in Z', () => {
    const result = getDateTimeNumber(D('2024-03-15T10:30:45.123Z'))
    expect(result).toMatch(/^\d{16,}Z$/)
    expect(result).toContain('2024')
  })
  it('pads milliseconds to 3 digits', () => {
    const result = getDateTimeNumber(D('2024-01-01T00:00:00.005Z'))
    expect(result).toMatch(/005Z$/)
  })
})

describe('getDateFromText', () => {
  it('parses a date string in yyyy-mm-dd format', () => {
    const d = getDateFromText('2024-06-15')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(5) // June = 5
    expect(d.getDate()).toBe(15)
  })
})

describe('getDuration', () => {
  it('calculates hours, minutes, seconds and totalSeconds', () => {
    const start = D('2024-01-01T00:00:00Z')
    const end   = D('2024-01-01T01:30:45Z')
    const result = getDuration(start, end)
    expect(result.hour).toBe(1)
    expect(result.minute).toBe(30)
    expect(result.second).toBe(45)
    expect(result.totalSeconds).toBe(1 * 3600 + 30 * 60 + 45)
  })
  it('returns zeros for equal dates', () => {
    const d = D('2024-01-01T00:00:00Z')
    const result = getDuration(d, d)
    expect(result).toEqual({ hour: 0, minute: 0, second: 0, totalSeconds: 0 })
  })
})

describe('getDaysFromTwoDates', () => {
  it('returns correct day difference', () => {
    expect(getDaysFromTwoDates(D('2024-01-01'), D('2024-01-08'))).toBe(7)
  })
  it('returns 0 for same day', () => {
    expect(getDaysFromTwoDates(D('2024-05-01'), D('2024-05-01'))).toBe(0)
  })
  it('returns absolute value (order does not matter)', () => {
    expect(getDaysFromTwoDates(D('2024-01-08'), D('2024-01-01'))).toBe(7)
  })
})

describe('castDateTimeToDateWithoutTz', () => {
  it('creates a local date from "yyyy-mm-dd" string', () => {
    const d = castDateTimeToDateWithoutTz('2024-06-20')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(20)
  })
})

describe('castYearMonthDayToText', () => {
  it('formats components to ISO datetime string', () => {
    expect(castYearMonthDayToText(2024, 3, 15, 10, 30, 45))
      .toBe('2024-03-15T10:30:45.000Z')
  })
  it('pads single-digit components', () => {
    expect(castYearMonthDayToText(2024, 1, 5, 0, 0, 0))
      .toBe('2024-01-05T00:00:00.000Z')
  })
})

describe('castDateTimeToDateDayOne', () => {
  it('returns the first day of the month at midnight UTC', () => {
    expect(castDateTimeToDateDayOne('2024-03-15T10:30:00Z'))
      .toBe('2024-03-01T00:00:00.000Z')
  })
})

describe('getMinutesFromTime', () => {
  it('returns the difference in minutes between two HH:MM times', () => {
    expect(getMinutesFromTime('09:00', '10:30')).toBe(90)
    expect(getMinutesFromTime('00:00', '00:00')).toBe(0)
    expect(getMinutesFromTime('23:00', '23:59')).toBe(59)
  })
  it('returns 0 for invalid format', () => {
    expect(getMinutesFromTime('invalid', '10:00')).toBe(0)
    expect(getMinutesFromTime('10:00', 'bad')).toBe(0)
  })
  it('returns negative when "to" is earlier than "from"', () => {
    expect(getMinutesFromTime('10:00', '09:00')).toBe(-60)
  })
})

describe('validDate', () => {
  it('returns true for a normal date', () => {
    expect(validDate('2024-06-15')).toBe(true)
  })
  it('returns false for empty string', () => {
    expect(validDate('')).toBe(false)
  })
  it('returns false for sentinel start date (1900-01-01)', () => {
    expect(validDate('1900-01-01')).toBe(false)
  })
  it('returns false for sentinel end date (2099-01-01)', () => {
    expect(validDate('2099-01-01')).toBe(false)
  })
  it('returns false for any string containing "1900" or "2099"', () => {
    expect(validDate('1900-12-31T00:00:00Z')).toBe(false)
    expect(validDate('2099-06-01')).toBe(false)
  })
})

describe('validateDateTimeFormat', () => {
  it('accepts valid ISO date-only string', () => {
    expect(validateDateTimeFormat('2024-01-15')).toBe(true)
  })
  it('accepts valid ISO datetime with Z', () => {
    expect(validateDateTimeFormat('2024-01-15T10:30:45.123Z')).toBe(true)
  })
  it('rejects non-string values', () => {
    expect(validateDateTimeFormat(123)).toBe(false)
    expect(validateDateTimeFormat(null)).toBe(false)
  })
  it('rejects malformed date strings', () => {
    expect(validateDateTimeFormat('not-a-date')).toBe(false)
    expect(validateDateTimeFormat('2024/01/15')).toBe(false)
  })
  // La regex admite mes hasta 19 y día hasta 39, así que estos valores llegan al parseo y
  // producen un Invalid Date. Antes reventaban con RangeError desde toISOString().
  it('returns false (does not throw) for values that pass the regex but are not real dates', () => {
    expect(() => validateDateTimeFormat('2026-19-39')).not.toThrow()
    expect(validateDateTimeFormat('2026-19-39')).toBe(false)
    expect(validateDateTimeFormat('2026-13-45')).toBe(false)
  })
  // Comportamiento conocido que NO cambia: JS desborda las fechas de calendario imposibles
  // (2026-02-30 pasa a marzo), así que se siguen aceptando.
  it('still accepts impossible calendar dates that JS overflows', () => {
    expect(validateDateTimeFormat('2026-02-30')).toBe(true)
  })
})

describe('validateDateTimeValue', () => {
  it('returns true for a parseable date string', () => {
    expect(validateDateTimeValue('2024-01-15')).toBe(true)
    expect(validateDateTimeValue('2024-01-15T10:30:00Z')).toBe(true)
  })
  it('returns false for unparseable strings', () => {
    expect(validateDateTimeValue('not-a-date')).toBe(false)
  })
  it('returns false for non-string values', () => {
    expect(validateDateTimeValue(12345)).toBe(false)
    expect(validateDateTimeValue(null)).toBe(false)
  })
})

describe('validateTimeFormat', () => {
  it('accepts HH:MM format', () => {
    expect(validateTimeFormat('09:30')).toBe(true)
    expect(validateTimeFormat('00:00')).toBe(true)
    expect(validateTimeFormat('23:59')).toBe(true)
  })
  it('accepts HH:MM:SS format', () => {
    expect(validateTimeFormat('10:30:45')).toBe(true)
  })
  it('rejects invalid formats', () => {
    expect(validateTimeFormat('9:30')).toBe(false)   // only 1 digit for hour
    expect(validateTimeFormat('10-30')).toBe(false)  // wrong separator
    expect(validateTimeFormat('')).toBe(false)
  })
  it('does not validate hour/minute ranges (only checks HH:MM pattern)', () => {
    // The regex only checks format (\d{2}:\d{2}), not value ranges
    expect(validateTimeFormat('25:00')).toBe(true)
    expect(validateTimeFormat('99:99')).toBe(true)
  })
  it('returns false for non-string values', () => {
    expect(validateTimeFormat(null)).toBe(false)
    expect(validateTimeFormat(930)).toBe(false)
  })
})
