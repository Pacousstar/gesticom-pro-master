import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@/lib/__tests__/test-utils'
import Pagination from '@/components/ui/Pagination'

describe('Pagination', () => {
  it('renders page numbers for total 5 pages', () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />
    )

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByLabelText(`Page ${i}`)).toBeInTheDocument()
    }
  })

  it('has previous button disabled on page 1', () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />
    )

    const prevButton = screen.getByLabelText('Page précédente')
    expect(prevButton).toBeDisabled()
  })

  it('has next button disabled on last page', () => {
    render(
      <Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />
    )

    const nextButton = screen.getByLabelText('Page suivante')
    expect(nextButton).toBeDisabled()
  })

  it('fires onPageChange when clicking a page number', () => {
    const onPageChange = vi.fn()
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />
    )

    fireEvent.click(screen.getByLabelText('Page 3'))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('displays total items when totalItems prop is provided', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={vi.fn()}
        totalItems={50}
        itemsPerPage={10}
      />
    )

    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('handles single page only', () => {
    render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    )

    expect(screen.getByLabelText('Page 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Page précédente')).toBeDisabled()
    expect(screen.getByLabelText('Page suivante')).toBeDisabled()
  })
})
