import '@testing-library/jest-dom'

vi.mock('next/server', () => {
  const headers = new Map<string, string>()
  class MockNextResponse {
    readonly headers: { set: (k: string, v: string) => void; get: (k: string) => string | undefined }
    readonly status: number
    body: any
    constructor(body?: any, init?: any) {
      this.body = body
      this.status = init?.status || 200
      if (init?.headers) {
        for (const [k, v] of Object.entries(init.headers)) {
          headers.set(k, v as string)
        }
      }
      this.headers = {
        set: (k: string, v: string) => headers.set(k, v),
        get: (k: string) => headers.get(k),
      }
    }
    json = async () => this.body
    static json(body: any, init?: any) {
      const instance = new MockNextResponse(body, init)
      return instance
    }
    static redirect(url: string) {
      return new MockNextResponse(null, { status: 307 })
    }
  }
  return {
    NextResponse: MockNextResponse,
    NextRequest: class { },
  }
})
