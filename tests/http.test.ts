import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>()
  return { ...actual, fetch: vi.fn() }
})

import { fetch as undiciFetch, ProxyAgent } from 'undici'
import { fetchJson, clearHttpCache } from '../src/core/http.js'

const mockFetch = vi.mocked(undiciFetch)

const PROXY_VARS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'] as const

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers })
}

beforeEach(() => {
  clearHttpCache()
  mockFetch.mockReset()
  for (const v of PROXY_VARS) delete process.env[v]
})

afterEach(() => {
  for (const v of PROXY_VARS) delete process.env[v]
})

describe('fetchJson', () => {
  it('returns parsed json on 200', async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ a: 1 }) as never)
    const r = await fetchJson('https://example.com/x')
    expect(r).toEqual({ ok: true, data: { a: 1 } })
  })

  it('retries once on 500 then succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('boom', { status: 500 }) as never)
      .mockResolvedValueOnce(jsonResponse({ a: 2 }) as never)
    const r = await fetchJson('https://example.com/x')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(r.ok).toBe(true)
  })

  it('maps 404 to NOT_FOUND without retry', async () => {
    mockFetch.mockResolvedValue(new Response('nope', { status: 404 }) as never)
    const r = await fetchJson('https://example.com/x')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('maps network failure to NETWORK after retry', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed') as never)
    const r = await fetchJson('https://example.com/x')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(r).toMatchObject({ ok: false, error: { code: 'NETWORK' } })
  })
})

describe('proxy support', () => {
  it('passes a ProxyAgent dispatcher when HTTPS_PROXY is set', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:7897'
    mockFetch.mockImplementation(async () => jsonResponse({ a: 1 }) as never)
    await fetchJson('https://example.com/proxy')
    const opts = mockFetch.mock.calls[0][1] as { dispatcher?: unknown }
    expect(opts.dispatcher).toBeInstanceOf(ProxyAgent)
  })

  it('honors lowercase http_proxy when higher-priority vars are absent', async () => {
    process.env.http_proxy = 'http://127.0.0.1:7897'
    mockFetch.mockImplementation(async () => jsonResponse({ a: 1 }) as never)
    await fetchJson('https://example.com/proxy')
    const opts = mockFetch.mock.calls[0][1] as { dispatcher?: unknown }
    expect(opts.dispatcher).toBeInstanceOf(ProxyAgent)
  })

  it('prefers HTTPS_PROXY over HTTP_PROXY', async () => {
    // HTTP_PROXY is deliberately invalid: if priority were wrong, constructing
    // the ProxyAgent would throw; that construction failure is caught inside
    // fetchJson and mapped to err('NETWORK'), so the result would not be ok.
    process.env.HTTPS_PROXY = 'http://127.0.0.1:1111'
    process.env.HTTP_PROXY = 'not a valid url'
    mockFetch.mockImplementation(async () => jsonResponse({ a: 1 }) as never)
    const r = await fetchJson('https://example.com/proxy-priority')
    expect(r).toEqual({ ok: true, data: { a: 1 } })
  })

  it('maps an invalid proxy URL to NETWORK instead of rejecting', async () => {
    process.env.HTTP_PROXY = 'not a valid url'
    mockFetch.mockImplementation(async () => jsonResponse({ a: 1 }) as never)
    const r = await fetchJson('https://example.com/bad-proxy')
    expect(r).toMatchObject({ ok: false, error: { code: 'NETWORK' } })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('reuses a single ProxyAgent while the proxy URL is unchanged', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:7897'
    mockFetch.mockImplementation(async () => jsonResponse({ a: 1 }) as never)
    await fetchJson('https://example.com/pool-1')
    await fetchJson('https://example.com/pool-2')
    const d1 = (mockFetch.mock.calls[0][1] as { dispatcher?: unknown }).dispatcher
    const d2 = (mockFetch.mock.calls[1][1] as { dispatcher?: unknown }).dispatcher
    expect(d1).toBeInstanceOf(ProxyAgent)
    expect(d2).toBe(d1)
  })

  it('rebuilds the ProxyAgent after clearHttpCache()', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:7897'
    mockFetch.mockImplementation(async () => jsonResponse({ a: 1 }) as never)
    await fetchJson('https://example.com/pool-3')
    clearHttpCache()
    await fetchJson('https://example.com/pool-4')
    const d1 = (mockFetch.mock.calls[0][1] as { dispatcher?: unknown }).dispatcher
    const d2 = (mockFetch.mock.calls[1][1] as { dispatcher?: unknown }).dispatcher
    expect(d1).toBeInstanceOf(ProxyAgent)
    expect(d2).toBeInstanceOf(ProxyAgent)
    expect(d2).not.toBe(d1)
  })

  it('passes no dispatcher when no proxy env vars are set', async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ a: 1 }) as never)
    await fetchJson('https://example.com/no-proxy')
    const opts = mockFetch.mock.calls[0][1] as { dispatcher?: unknown } | undefined
    expect(opts?.dispatcher).toBeUndefined()
  })
})

describe('429 backoff', () => {
  // Shape matches undici 7 fetch(): body is a standard web ReadableStream
  // (has cancel(), no dump()). We fake just what fetchJson touches.
  function fake429(headers: Record<string, string> | null = {}) {
    return {
      status: 429,
      headers: new Headers(headers === null ? {} : { 'Retry-After': '0', ...headers }),
      body: { cancel: vi.fn(async () => {}) },
    }
  }

  it('waits per Retry-After then retries once and succeeds', async () => {
    const first = fake429()
    mockFetch
      .mockResolvedValueOnce(first as never)
      .mockResolvedValueOnce(jsonResponse({ a: 3 }) as never)
    const r = await fetchJson('https://example.com/rl')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(r).toEqual({ ok: true, data: { a: 3 } })
  })

  it('cancels the first 429 response body before retrying', async () => {
    const first = fake429()
    mockFetch
      .mockResolvedValueOnce(first as never)
      .mockResolvedValueOnce(jsonResponse({ a: 5 }) as never)
    const r = await fetchJson('https://example.com/rl-drain')
    expect(r.ok).toBe(true)
    expect(first.body.cancel).toHaveBeenCalledTimes(1)
  })

  it('returns RATE_LIMITED when both attempts are 429', async () => {
    const first = fake429()
    mockFetch
      .mockResolvedValueOnce(first as never)
      .mockResolvedValueOnce(fake429() as never)
    const r = await fetchJson('https://example.com/rl2')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(r).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } })
    // body is drained only on the first attempt, before the single retry
    expect(first.body.cancel).toHaveBeenCalledTimes(1)
  })

  it('defaults to 1s backoff when Retry-After header is missing', async () => {
    vi.useFakeTimers()
    try {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
      mockFetch
        .mockResolvedValueOnce(fake429(null) as never)
        .mockResolvedValueOnce(jsonResponse({ a: 4 }) as never)
      const p = fetchJson('https://example.com/rl-default')
      await vi.advanceTimersByTimeAsync(1000)
      const r = await p
      expect(r).toEqual({ ok: true, data: { a: 4 } })
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('TTL cache', () => {
  it('serves the second identical request from cache', async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ a: 1 }) as never)
    const r1 = await fetchJson('https://example.com/cached')
    const r2 = await fetchJson('https://example.com/cached')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(r1).toEqual(r2)
  })

  it('refetches after clearHttpCache()', async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ a: 1 }) as never)
    await fetchJson('https://example.com/cached2')
    clearHttpCache()
    await fetchJson('https://example.com/cached2')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not cache error responses', async () => {
    mockFetch.mockResolvedValue(new Response('nope', { status: 404 }) as never)
    await fetchJson('https://example.com/missing')
    await fetchJson('https://example.com/missing')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
