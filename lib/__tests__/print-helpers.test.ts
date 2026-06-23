import { describe, it, expect } from 'vitest'
import { paginateArray, chunkArray, paginateForPrint } from '@/lib/print-helpers'

describe('paginateArray', () => {
  it('retourne un tableau vide pour un tableau vide', () => {
    expect(paginateArray([], 5, 5)).toEqual([])
  })

  it('première page avec firstSize éléments', () => {
    const result = paginateArray([1, 2, 3, 4, 5], 2, 3)
    expect(result[0]).toEqual([1, 2])
    expect(result).toHaveLength(2)
  })

  it('pages suivantes avec otherSize éléments', () => {
    const result = paginateArray([1, 2, 3, 4, 5, 6, 7], 2, 3)
    expect(result[0]).toEqual([1, 2])
    expect(result[1]).toEqual([3, 4, 5])
    expect(result[2]).toEqual([6, 7])
  })

  it('un seul chunk si le tableau tient dans firstSize', () => {
    const result = paginateArray([1, 2], 5, 3)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual([1, 2])
  })
})

describe('chunkArray', () => {
  it('retourne un tableau vide pour un tableau vide', () => {
    expect(chunkArray([], 3)).toEqual([])
  })

  it('découpe en chunks de taille égale', () => {
    const result = chunkArray([1, 2, 3, 4, 5, 6], 2)
    expect(result).toEqual([[1, 2], [3, 4], [5, 6]])
  })

  it('dernier chunk plus petit si besoin', () => {
    const result = chunkArray([1, 2, 3, 4, 5], 2)
    expect(result).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('paginateForPrint', () => {
  it('utilise les valeurs par défaut', () => {
    const items = Array.from({ length: 50 }, (_, i) => i + 1)
    const result = paginateForPrint(items)
    expect(result[0]).toHaveLength(22)
    expect(result[1]).toHaveLength(28)
    expect(result).toHaveLength(2)
  })

  it('accepte des tailles personnalisées', () => {
    const items = [1, 2, 3, 4, 5]
    const result = paginateForPrint(items, { firstPageSize: 2, otherPagesSize: 2 })
    expect(result).toEqual([[1, 2], [3, 4], [5]])
  })
})
