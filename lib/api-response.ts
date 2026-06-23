import { NextResponse } from 'next/server'

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function successData<T>(data: T, status: number = 200) {
  return NextResponse.json({ data }, { status })
}

export function successList<T>(
  data: T[],
  pagination?: PaginationMeta,
  totals?: Record<string, number>,
) {
  const body: Record<string, unknown> = { data }
  if (pagination) body.pagination = pagination
  if (totals) body.totals = totals
  return NextResponse.json(body)
}

export function successMessage(message: string, status: number = 200) {
  return NextResponse.json({ success: true, message }, { status })
}

export function errorResponse(error: string, status: number = 400) {
  return NextResponse.json({ error }, { status })
}

export function notFound(message: string = 'Ressource introuvable') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function unauthorized(message: string = 'Non autorisé') {
  return NextResponse.json({ error: message }, { status: 401 })
}
