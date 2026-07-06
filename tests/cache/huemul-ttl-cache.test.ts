import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {HuemulTtlCache} from '../../src/cache/huemul-ttl-cache'

describe('HuemulTtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls fetch on a cache miss and returns its value', async () => {
    const cache = new HuemulTtlCache<number>(60)
    const fetch = vi.fn().mockResolvedValue(42)

    const result = await cache.getOrFetch('orgA', fetch)

    expect(result).toBe(42)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns the cached value without calling fetch again within the ttl', async () => {
    const cache = new HuemulTtlCache<number>(60)
    const fetch = vi.fn().mockResolvedValue(42)

    await cache.getOrFetch('orgA', fetch)
    vi.advanceTimersByTime(30_000)
    const result = await cache.getOrFetch('orgA', fetch)

    expect(result).toBe(42)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('refetches once the ttl has expired', async () => {
    const cache = new HuemulTtlCache<number>(60)
    const fetch = vi.fn().mockResolvedValueOnce(42).mockResolvedValueOnce(43)

    await cache.getOrFetch('orgA', fetch)
    vi.advanceTimersByTime(61_000)
    const result = await cache.getOrFetch('orgA', fetch)

    expect(result).toBe(43)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('caches independently per key', async () => {
    const cache = new HuemulTtlCache<string>(60)
    const fetchA = vi.fn().mockResolvedValue('a')
    const fetchB = vi.fn().mockResolvedValue('b')

    const resultA = await cache.getOrFetch('orgA', fetchA)
    const resultB = await cache.getOrFetch('orgB', fetchB)

    expect(resultA).toBe('a')
    expect(resultB).toBe('b')
  })

  it('invalidate forces the next getOrFetch to refetch', async () => {
    const cache = new HuemulTtlCache<number>(60)
    const fetch = vi.fn().mockResolvedValueOnce(42).mockResolvedValueOnce(43)

    await cache.getOrFetch('orgA', fetch)
    cache.invalidate('orgA')
    const result = await cache.getOrFetch('orgA', fetch)

    expect(result).toBe(43)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('clear forces every key to refetch', async () => {
    const cache = new HuemulTtlCache<number>(60)
    const fetch = vi.fn().mockResolvedValueOnce(42).mockResolvedValueOnce(43)

    await cache.getOrFetch('orgA', fetch)
    cache.clear()
    const result = await cache.getOrFetch('orgA', fetch)

    expect(result).toBe(43)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
