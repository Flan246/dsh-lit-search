import { describe, expect, it, vi, afterEach } from 'vitest'
import { fetchJson } from '../src/core/http.js'

afterEach(() => vi.unstubAllGlobals())

describe('fetchJson', () => {
  it('returns parsed json on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"a":1}', { status: 200 })))
    const r = await fetchJson('https://example.com/x')
    expect(r).toEqual({ ok: true, data: { a: 1 } })
  })

  it('retries once on 500 then succeeds', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(new Response('{"a":2}', { status: 200 }))
    vi.stubGlobal('fetch', f)
    const r = await fetchJson('https://example.com/x')
    expect(f).toHaveBeenCalledTimes(2)
    expect(r.ok).toBe(true)
  })

  it('maps 404 to NOT_FOUND without retry', async () => {
    const f = vi.fn(async () => new Response('nope', { status: 404 }))
    vi.stubGlobal('fetch', f)
    const r = await fetchJson('https://example.com/x')
    expect(f).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('maps network failure to NETWORK after retry', async () => {
    const f = vi.fn(async () => { throw new TypeError('fetch failed') })
    vi.stubGlobal('fetch', f)
    const r = await fetchJson('https://example.com/x')
    expect(f).toHaveBeenCalledTimes(2)
    expect(r).toMatchObject({ ok: false, error: { code: 'NETWORK' } })
  })
})
