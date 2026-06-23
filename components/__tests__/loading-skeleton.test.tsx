import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableSkeleton, CardSkeleton, StatsRowSkeleton, PageSkeleton } from '@/components/loading-skeleton'

describe('TableSkeleton', () => {
  it('affiche sans erreur', () => {
    const { container } = render(<TableSkeleton />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('accepte rows et cols personnalisés', () => {
    const { container } = render(<TableSkeleton rows={3} cols={4} />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })
})

describe('CardSkeleton', () => {
  it('affiche le nombre de cartes par défaut', () => {
    const { container } = render(<CardSkeleton />)
    const cards = container.querySelectorAll('.bg-white.rounded-xl')
    expect(cards.length).toBe(4)
  })

  it('accepte un count personnalisé', () => {
    const { container } = render(<CardSkeleton count={2} />)
    const cards = container.querySelectorAll('.bg-white.rounded-xl')
    expect(cards.length).toBe(2)
  })
})

describe('StatsRowSkeleton', () => {
  it('affiche 3 cartes', () => {
    const { container } = render(<StatsRowSkeleton />)
    const cards = container.querySelectorAll('.bg-white.rounded-xl')
    expect(cards.length).toBe(3)
  })
})

describe('PageSkeleton', () => {
  it('affiche sans erreur', () => {
    const { container } = render(<PageSkeleton />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })
})
