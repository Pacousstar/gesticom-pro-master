import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Composant Toast (via useToast)', () => {
  it('le hook useToast est accessible', async () => {
    const { useToast } = await import('@/hooks/useToast')
    expect(useToast).toBeDefined()
    expect(typeof useToast).toBe('function')
  })

  it('le module toast est importable', async () => {
    const toastModule = await import('@/components/ui/Toast')
    expect(toastModule).toBeDefined()
  })
})
