const DATA_KEYS = ['data', 'charges', 'ventes', 'achats', 'produits', 'clients', 'fournisseurs', 'depenses', 'operations', 'mouvements'] as const

export function extractList<T>(response: unknown): T[] {
  if (!response) return []
  if (Array.isArray(response)) return response as T[]

  if (typeof response === 'object' && response !== null) {
    const obj = response as Record<string, unknown>

    for (const key of DATA_KEYS) {
      const val = obj[key]
      if (Array.isArray(val)) return val as T[]
    }

    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      return [obj.data] as T[]
    }
  }

  return []
}

export function extractPagination(response: unknown): { page: number; limit: number; total: number; totalPages: number } | null {
  if (!response || typeof response !== 'object') return null
  const obj = response as Record<string, unknown>
  if (!obj.pagination || typeof obj.pagination !== 'object') return null
  const p = obj.pagination as Record<string, unknown>
  return {
    page: Number(p.page) || 1,
    limit: Number(p.limit) || 0,
    total: Number(p.total) || 0,
    totalPages: Number(p.totalPages) || 0,
  }
}

export function extractTotals(response: unknown): Record<string, number> | null {
  if (!response || typeof response !== 'object') return null
  const obj = response as Record<string, unknown>
  if (!obj.totals || typeof obj.totals !== 'object') return null
  return obj.totals as Record<string, number>
}

export async function fetchList<T>(url: string, options?: RequestInit): Promise<{ data: T[]; pagination: ReturnType<typeof extractPagination>; totals: ReturnType<typeof extractTotals> }> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  const json = await res.json()
  return {
    data: extractList<T>(json),
    pagination: extractPagination(json),
    totals: extractTotals(json),
  }
}

export async function fetchOne<T>(url: string, options?: RequestInit): Promise<T | null> {
  const res = await fetch(url, options)
  if (!res.ok) return null
  const json = await res.json()
  if (json?.data && !Array.isArray(json.data)) return json.data as T
  return json as T
}
