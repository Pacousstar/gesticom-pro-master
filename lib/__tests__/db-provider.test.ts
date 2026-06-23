import { describe, it, expect } from 'vitest'

describe('isPostgres / isSQLite', () => {
  it('isPostgres retourne true si DATABASE_URL commence par postgresql', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost'
    const { isPostgres } = await import('@/lib/db-provider')
    expect(isPostgres()).toBe(true)
  })

  it('isPostgres retourne false sinon', async () => {
    process.env.DATABASE_URL = 'file:./dev.db'
    const { isPostgres } = await import('@/lib/db-provider')
    expect(isPostgres()).toBe(false)
  })

  it('isSQLite retourne true si DATABASE_URL commence par file:', async () => {
    process.env.DATABASE_URL = 'file:./dev.db'
    const { isSQLite } = await import('@/lib/db-provider')
    expect(isSQLite()).toBe(true)
  })

  it('isSQLite retourne false sinon', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost'
    const { isSQLite } = await import('@/lib/db-provider')
    expect(isSQLite()).toBe(false)
  })
})
