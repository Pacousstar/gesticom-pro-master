import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockJson = vi.fn((...args: unknown[]) => ({ body: args[0], status: (args[1] as { status?: number })?.status ?? 200, json: () => args[0] }))

vi.mock('next/server', () => ({
  NextResponse: {
    json: (...args: unknown[]) => mockJson(...(args as [unknown, unknown])),
  },
}))

async function getModule() {
  return import('@/lib/api-response')
}

describe('api-response helpers', () => {
  beforeEach(() => {
    mockJson.mockClear()
  })

  it('successData wraps data', async () => {
    const { successData } = await getModule()
    const res = successData({ id: 1, name: 'Test' })
    const body = await res.json()
    expect(body).toEqual({ data: { id: 1, name: 'Test' } })
    expect(res.status).toBe(200)
  })

  it('successData accepts custom status', async () => {
    const { successData } = await getModule()
    const res = successData({ id: 1 }, 201)
    expect(res.status).toBe(201)
  })

  it('successList wraps data', async () => {
    const { successList } = await getModule()
    const res = successList([{ id: 1 }])
    const body = await res.json()
    expect(body).toEqual({ data: [{ id: 1 }] })
  })

  it('successList includes pagination', async () => {
    const { successList } = await getModule()
    const pagination = { page: 1, limit: 20, total: 50, totalPages: 3 }
    const res = successList([], pagination)
    const body = await res.json()
    expect(body).toEqual({ data: [], pagination })
  })

  it('successList includes totals', async () => {
    const { successList } = await getModule()
    const totals = { totalAmount: 10000 }
    const res = successList([], undefined, totals)
    const body = await res.json()
    expect(body.totals).toEqual(totals)
  })

  it('successMessage returns success true', async () => {
    const { successMessage } = await getModule()
    const res = successMessage('OK')
    const body = await res.json()
    expect(body).toEqual({ success: true, message: 'OK' })
  })

  it('errorResponse returns error with status', async () => {
    const { errorResponse } = await getModule()
    const res = errorResponse('Erreur', 422)
    const body = await res.json()
    expect(body).toEqual({ error: 'Erreur' })
    expect(res.status).toBe(422)
  })

  it('errorResponse defaults to 400', async () => {
    const { errorResponse } = await getModule()
    const res = errorResponse('Bad request')
    expect(res.status).toBe(400)
  })

  it('notFound returns 404', async () => {
    const { notFound } = await getModule()
    const res = notFound()
    const body = await res.json()
    expect(body.error).toBe('Ressource introuvable')
    expect(res.status).toBe(404)
  })

  it('unauthorized returns 401', async () => {
    const { unauthorized } = await getModule()
    const res = unauthorized()
    expect(res.status).toBe(401)
  })
})
