import { describe, it, expect } from 'vitest'
import { resolveDataFilePath } from '@/lib/resolveDataFile'

describe('resolveDataFilePath', () => {
  it('rejette un nom vide', async () => {
    const result = await resolveDataFilePath('')
    expect(result).toBeNull()
  })

  it('rejette un path traversal avec ..', async () => {
    const result = await resolveDataFilePath('../secret.txt')
    expect(result).toBeNull()
  })

  it('rejette un path traversal avec /', async () => {
    const result = await resolveDataFilePath('data/secret.txt')
    expect(result).toBeNull()
  })

  it('rejette un path traversal avec \\', async () => {
    const result = await resolveDataFilePath('data\\secret.txt')
    expect(result).toBeNull()
  })

  it('rejette les caractères non autorisés', async () => {
    const result = await resolveDataFilePath('<script>.json')
    expect(result).toBeNull()
  })

  it('retourne null pour un fichier inexistant', async () => {
    const result = await resolveDataFilePath('fichier-inexistant.json')
    expect(result).toBeNull()
  })
})
