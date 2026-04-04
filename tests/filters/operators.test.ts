import { describe, it, expect, beforeEach } from 'vitest'
import {
  HuemulFilterString,
  HuemulFilterNumber,
  HuemulFilterBoolean,
  HuemulFilterDate,
  HuemulFilterOperators,
  HuemulColumnClass,
} from '../../src/interfaces/interface-huemul-filter'

describe('HuemulFilterString', () => {
  let filter: HuemulFilterString

  beforeEach(() => {
    filter = new HuemulFilterString(HuemulColumnClass.NORMAL)
  })

  it('starts with no values', () => {
    expect(filter.values).toHaveLength(0)
    expect(filter.hasAnyValue()).toBe(false)
    expect(filter.isEmpty()).toBe(true)
  })

  it('addFilter adds a value with an operator', () => {
    filter.addFilter('hello', HuemulFilterOperators.EQUALS)
    expect(filter.values).toHaveLength(1)
    expect(filter.values[0].value).toBe('hello')
    expect(filter.values[0].operator).toBe(HuemulFilterOperators.EQUALS)
  })

  it('getType returns String', () => {
    expect(filter.getType()).toBe(String)
  })

  it('clearValues removes all values', () => {
    filter.addFilter('a', HuemulFilterOperators.EQUALS)
    filter.clearValues()
    expect(filter.values).toHaveLength(0)
  })

  it('getValue returns the value at the specified index', () => {
    filter.addFilter('first', HuemulFilterOperators.EQUALS)
    filter.addFilter('second', HuemulFilterOperators.IN)
    expect(filter.getValue(0, 0)).toBe('first')
    expect(filter.getValue(0, 1)).toBe('second')
  })

  it('getValues returns all values as plain array', () => {
    filter.addFilter('a', HuemulFilterOperators.EQUALS)
    filter.addFilter('b', HuemulFilterOperators.IN)
    expect(filter.getValues()).toEqual(['a', 'b'])
  })

  it('addAllFilters adds multiple values at once', () => {
    filter.addAllFilters(['x', 'y', 'z'], HuemulFilterOperators.IN)
    expect(filter.values).toHaveLength(3)
  })
})

describe('HuemulFilterNumber', () => {
  let filter: HuemulFilterNumber

  beforeEach(() => {
    filter = new HuemulFilterNumber(HuemulColumnClass.NORMAL)
  })

  it('getType returns Number', () => {
    expect(filter.getType()).toBe(Number)
  })

  it('accepts GREATER_THAN and LESS_THAN operators', () => {
    filter.addFilter(10, HuemulFilterOperators.GREATER_THAN)
    filter.addFilter(100, HuemulFilterOperators.LESS_THAN)
    expect(filter.values).toHaveLength(2)
  })
})

describe('HuemulFilterBoolean', () => {
  it('getType returns Boolean', () => {
    const filter = new HuemulFilterBoolean(HuemulColumnClass.NORMAL)
    expect(filter.getType()).toBe(Boolean)
  })
})

describe('HuemulFilterDate', () => {
  it('getType returns String (dates are stored as strings)', () => {
    const filter = new HuemulFilterDate(HuemulColumnClass.NORMAL)
    expect(filter.getType()).toBe(String)
  })
})

describe('HuemulFilterBase.checkValues — operator conflict prevention', () => {
  it('prevents adding a duplicate GREATER_THAN operator', () => {
    const filter = new HuemulFilterNumber(HuemulColumnClass.NORMAL)
    filter.addFilter(5, HuemulFilterOperators.GREATER_THAN)
    filter.addFilter(10, HuemulFilterOperators.GREATER_THAN) // should be ignored
    expect(filter.values).toHaveLength(1)
  })

  it('prevents adding a duplicate LESS_THAN operator', () => {
    const filter = new HuemulFilterNumber(HuemulColumnClass.NORMAL)
    filter.addFilter(5, HuemulFilterOperators.LESS_THAN)
    filter.addFilter(10, HuemulFilterOperators.LESS_THAN) // should be ignored
    expect(filter.values).toHaveLength(1)
  })

  it('allows multiple EQUALS (they will be converted to IN later)', () => {
    const filter = new HuemulFilterString(HuemulColumnClass.NORMAL)
    filter.addFilter('a', HuemulFilterOperators.EQUALS)
    filter.addFilter('b', HuemulFilterOperators.EQUALS)
    expect(filter.values).toHaveLength(2)
  })

  it('allows multiple IN values', () => {
    const filter = new HuemulFilterString(HuemulColumnClass.NORMAL)
    filter.addFilter('a', HuemulFilterOperators.IN)
    filter.addFilter('b', HuemulFilterOperators.IN)
    expect(filter.values).toHaveLength(2)
  })
})

describe('HuemulFilterBase — IS NULL / IS NOT NULL', () => {
  it('addNull adds an IS NULL filter', () => {
    const filter = new HuemulFilterString(HuemulColumnClass.NORMAL)
    filter.addNull()
    expect(filter.values[0].operator).toBe(HuemulFilterOperators.IS_NULL)
  })

  it('addNotNull adds an IS NOT NULL filter', () => {
    const filter = new HuemulFilterString(HuemulColumnClass.NORMAL)
    filter.addNotNull()
    expect(filter.values[0].operator).toBe(HuemulFilterOperators.IS_NOT_NULL)
  })

  it('prevents adding a second IS NULL', () => {
    const filter = new HuemulFilterString(HuemulColumnClass.NORMAL)
    filter.addNull()
    filter.addNull() // should be ignored
    expect(filter.values).toHaveLength(1)
  })

  it('prevents adding IS NOT NULL after IS NULL', () => {
    const filter = new HuemulFilterString(HuemulColumnClass.NORMAL)
    filter.addNull()
    filter.addNotNull() // should be ignored
    expect(filter.values).toHaveLength(1)
  })
})

describe('HuemulFilterBase — whereGroup', () => {
  it('assigns values to the correct group', () => {
    const filter = new HuemulFilterString(HuemulColumnClass.NORMAL)
    filter.addFilter('a', HuemulFilterOperators.EQUALS, 0)
    filter.addFilter('b', HuemulFilterOperators.EQUALS, 1)
    expect(filter.values.filter(v => v.whereGroup === 0)).toHaveLength(1)
    expect(filter.values.filter(v => v.whereGroup === 1)).toHaveLength(1)
  })

  it('getValue retrieves by whereGroup and index', () => {
    const filter = new HuemulFilterString(HuemulColumnClass.NORMAL)
    filter.addFilter('group0', HuemulFilterOperators.EQUALS, 0)
    filter.addFilter('group1', HuemulFilterOperators.EQUALS, 1)
    expect(filter.getValue(0, 0)).toBe('group0')
    expect(filter.getValue(1, 0)).toBe('group1')
  })
})

describe('HuemulFilterBase — addFromFilter', () => {
  it('copies values from another filter (clearing previous)', () => {
    const source = new HuemulFilterString(HuemulColumnClass.NORMAL)
    source.addFilter('copied', HuemulFilterOperators.EQUALS)

    const target = new HuemulFilterString(HuemulColumnClass.NORMAL)
    target.addFilter('old', HuemulFilterOperators.EQUALS)
    target.addFromFilter(source, true)

    expect(target.values).toHaveLength(1)
    expect(target.getValue()).toBe('copied')
  })

  it('appends values when clearPrevious=false', () => {
    const source = new HuemulFilterString(HuemulColumnClass.NORMAL)
    source.addFilter('new', HuemulFilterOperators.IN)

    const target = new HuemulFilterString(HuemulColumnClass.NORMAL)
    target.addFilter('old', HuemulFilterOperators.EQUALS)
    target.addFromFilter(source, false)

    expect(target.values).toHaveLength(2)
  })
})
