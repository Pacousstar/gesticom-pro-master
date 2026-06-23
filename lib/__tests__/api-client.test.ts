import { describe, it, expect } from 'vitest'
import { extractList, extractPagination, extractTotals } from '@/lib/api-client'

describe('extractList', () => {
  it('returns [] for null or undefined', () => {
    expect(extractList(null)).toEqual([])
    expect(extractList(undefined)).toEqual([])
  })

  it('returns the array directly if response is an array', () => {
    const arr = [{ id: 1 }, { id: 2 }]
    expect(extractList(arr)).toBe(arr)
  })

  it('returns [] for empty object', () => {
    expect(extractList({})).toEqual([])
  })

  it('extracts from data key', () => {
    const items = [{ id: 1 }]
    expect(extractList({ data: items })).toBe(items)
  })

  it('extracts from charges key (backward compat)', () => {
    const items = [{ id: 1 }]
    expect(extractList({ charges: items })).toBe(items)
  })

  it('extracts from ventes key (backward compat)', () => {
    const items = [{ id: 1 }]
    expect(extractList({ ventes: items })).toBe(items)
  })

  it('extracts from achats key (backward compat)', () => {
    const items = [{ id: 1 }]
    expect(extractList({ achats: items })).toBe(items)
  })

  it('extracts from produits key', () => {
    const items = [{ id: 1 }]
    expect(extractList({ produits: items })).toBe(items)
  })

  it('extracts from clients key', () => {
    const items = [{ id: 1 }]
    expect(extractList({ clients: items })).toBe(items)
  })

  it('extracts from fournisseurs key', () => {
    const items = [{ id: 1 }]
    expect(extractList({ fournisseurs: items })).toBe(items)
  })

  it('extracts from depenses key', () => {
    const items = [{ id: 1 }]
    expect(extractList({ depenses: items })).toBe(items)
  })

  it('extracts from operations key', () => {
    const items = [{ id: 1 }]
    expect(extractList({ operations: items })).toBe(items)
  })

  it('extracts from mouvements key', () => {
    const items = [{ id: 1 }]
    expect(extractList({ mouvements: items })).toBe(items)
  })

  it('returns data key first when multiple keys exist', () => {
    const dataArr = [{ id: 1 }]
    const chargesArr = [{ id: 2 }]
    expect(extractList({ data: dataArr, charges: chargesArr })).toBe(dataArr)
  })

  it('wraps single object in data into array', () => {
    const obj = { id: 1 }
    expect(extractList({ data: obj })).toEqual([obj])
  })

  it('returns [] when data is a non-array non-object', () => {
    expect(extractList({ data: 'string' })).toEqual([])
  })

  it('returns [] when data is a number', () => {
    expect(extractList({ data: 42 })).toEqual([])
  })

  it('returns [] for primitive response', () => {
    expect(extractList('hello')).toEqual([])
    expect(extractList(42)).toEqual([])
  })

  it('generic type parameter works correctly', () => {
    interface User { id: number; name: string }
    const users = [{ id: 1, name: 'Alice' }]
    const result = extractList<User>({ data: users })
    expect(result[0].name).toBe('Alice')
  })
})

describe('extractPagination', () => {
  it('returns null for null or undefined', () => {
    expect(extractPagination(null)).toBeNull()
    expect(extractPagination(undefined)).toBeNull()
  })

  it('returns null if no pagination key', () => {
    expect(extractPagination({ data: [] })).toBeNull()
  })

  it('extracts pagination object', () => {
    const result = extractPagination({ pagination: { page: 2, limit: 20, total: 100, totalPages: 5 } })
    expect(result).toEqual({ page: 2, limit: 20, total: 100, totalPages: 5 })
  })

  it('defaults missing numeric fields', () => {
    const result = extractPagination({ pagination: {} })
    expect(result).toEqual({ page: 1, limit: 0, total: 0, totalPages: 0 })
  })

  it('coerces string values to numbers', () => {
    const result = extractPagination({ pagination: { page: '2', limit: '20', total: '100', totalPages: '5' } })
    expect(result).toEqual({ page: 2, limit: 20, total: 100, totalPages: 5 })
  })
})

describe('extractTotals', () => {
  it('returns null for null or undefined', () => {
    expect(extractTotals(null)).toBeNull()
    expect(extractTotals(undefined)).toBeNull()
  })

  it('returns null if no totals key', () => {
    expect(extractTotals({ data: [] })).toBeNull()
  })

  it('extracts totals object', () => {
    const totals = { totalAmount: 5000, totalCount: 10 }
    expect(extractTotals({ totals })).toEqual(totals)
  })
})
