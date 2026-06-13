import '@testing-library/jest-dom'

vi.mock('next/server', () => {
  const headers = new Map<string, string>()
  return {
    NextResponse: {
      json: (body: any, init?: any) => ({
        status: init?.status || 200,
        json: async () => body,
        headers: {
          set: (k: string, v: string) => headers.set(k, v),
          get: (k: string) => headers.get(k),
        },
      }),
    },
    NextRequest: class { },
  }
})
