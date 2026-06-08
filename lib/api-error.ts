import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'INSUFFICIENT_STOCK'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: ApiErrorCode = 'VALIDATION_ERROR'
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json({
        error: 'Ce doublon a été bloqué.',
        code: 'IDEMPOTENCY_CONFLICT'
      }, { status: 409 })
    }
    if (error.code === 'P2025') {
      return NextResponse.json({
        error: 'Enregistrement introuvable.',
        code: 'NOT_FOUND'
      }, { status: 404 })
    }
    return NextResponse.json({
      error: 'Erreur base de données.',
      code: 'SERVER_ERROR'
    }, { status: 500 })
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({
      error: 'Format de données invalide.',
      code: 'VALIDATION_ERROR'
    }, { status: 400 })
  }

  if (error instanceof Error) {
    if (error.message.includes('Stock insuffisant')) {
      return NextResponse.json({
        error: error.message,
        code: 'INSUFFICIENT_STOCK'
      }, { status: 409 })
    }
    if (error.message.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({
        error: 'Cette opération a déjà été enregistrée.',
        code: 'IDEMPOTENCY_CONFLICT'
      }, { status: 409 })
    }
  }

  console.error('[ApiError] Unhandled:', error)
  return NextResponse.json({
    error: 'Erreur serveur. Veuillez réessayer plus tard.',
    code: 'SERVER_ERROR'
  }, { status: 500 })
}

export function unauthorized(message?: string) {
  return NextResponse.json({ error: message || 'Non autorisé.', code: 'UNAUTHORIZED' }, { status: 401 })
}

export function forbidden(message?: string) {
  return NextResponse.json({ error: message || 'Droits insuffisants.', code: 'FORBIDDEN' }, { status: 403 })
}

export function notFound(message?: string) {
  return NextResponse.json({ error: message || 'Ressource introuvable.', code: 'NOT_FOUND' }, { status: 404 })
}

export function badRequest(message: string, code: ApiErrorCode = 'VALIDATION_ERROR') {
  return NextResponse.json({ error: message, code }, { status: 400 })
}

export function conflict(message: string, code: ApiErrorCode = 'CONFLICT') {
  return NextResponse.json({ error: message, code }, { status: 409 })
}
