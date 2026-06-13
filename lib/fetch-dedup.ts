const inflight = new Map<string, Promise<any>>()

function dedupKey(input: RequestInfo | URL, init?: RequestInit): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url + (init?.method || 'GET')
}

export async function dedupFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const key = dedupKey(input, init)
  if (init?.method && init.method !== 'GET') {
    return fetch(input, init)
  }
  if (inflight.has(key)) {
    return inflight.get(key)!.then(r => r.clone())
  }
  const promise = fetch(input, init).finally(() => { inflight.delete(key) })
  inflight.set(key, promise)
  return promise
}
