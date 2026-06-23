import { describe, it, expect } from 'vitest'
import { formatDate } from '@/lib/format-date'

describe('formatDate', () => {
  it('retourne — pour null', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('retourne — pour undefined', () => {
    expect(formatDate(undefined)).toBe('—')
  })

  it('retourne — pour une chaîne vide', () => {
    expect(formatDate('')).toBe('—')
  })

  it('retourne — pour une date invalide', () => {
    expect(formatDate('pas-une-date')).toBe('—')
  })

  it('formate une date ISO en JJ/MM/AAAA', () => {
    expect(formatDate('2026-06-21')).toBe('21/06/2026')
  })

  it('formate un objet Date', () => {
    expect(formatDate(new Date(2026, 5, 21))).toBe('21/06/2026')
  })

  it('inclut l\'heure avec includeTime', () => {
    const d = new Date(2026, 5, 21, 14, 30)
    const result = formatDate(d, { includeTime: true })
    expect(result).toMatch(/21\/06\/2026 à 14:30/)
  })

  it('gère une date ISO avec heure', () => {
    expect(formatDate('2026-06-21T09:15:00', { includeTime: true })).toBe('21/06/2026 à 09:15')
  })

  it('pad les jours et mois à 2 chiffres', () => {
    expect(formatDate('2026-01-05')).toBe('05/01/2026')
  })
})
