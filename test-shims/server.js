export class NextRequest extends Request {
  nextUrl = new URL('http://localhost')
  json = async () => ({})
  formData = async () => new FormData()
}

export class NextResponse {
  static json(body, init) {
    return {
      status: init?.status || 200,
      json: async () => body,
      headers: {
        set: (k, v) => {},
        get: (k) => undefined,
      },
    }
  }
  static redirect(url, status) {
    return { status: status || 302 }
  }
  static next() {
    return {}
  }
}
