import { describe, it, expect } from 'vitest'
import { stopCronJobs } from '@/lib/cron'

describe('stopCronJobs', () => {
  it('ne lance pas d\'exception', () => {
    expect(() => stopCronJobs()).not.toThrow()
  })
})
