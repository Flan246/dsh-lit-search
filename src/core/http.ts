import { fetch, ProxyAgent, type RequestInit as UndiciRequestInit } from 'undici'
import { err, ok, type Result } from './types.js'

const UA = 'dsh-lit-search/0.1.1 (mailto:lit-search@users.noreply.github.com)'
const TIMEOUT_MS = 10_000
const CACHE_TTL_MS = 5 * 60_000
const CACHE_MAX = 200
const CACHE_EVICT_BATCH = 20

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const cache = new Map<string, { data: unknown; expiry: number }>()

export function clearHttpCache(): void {
  cache.clear()
}

function proxyUrl(): string | undefined {
  return process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy || undefined
}

function cacheSet(url: string, data: unknown): void {
  if (cache.size >= CACHE_MAX) {
    let n = 0
    for (const key of cache.keys()) {
      cache.delete(key)
      if (++n >= CACHE_EVICT_BATCH) break
    }
  }
  cache.set(url, { data, expiry: Date.now() + CACHE_TTL_MS })
}

export async function fetchJson(url: string): Promise<Result<unknown>> {
  const hit = cache.get(url)
  if (hit && hit.expiry > Date.now()) return ok(hit.data)

  const proxy = proxyUrl()
  const dispatcher = proxy ? new ProxyAgent(proxy) : undefined

  let lastErr: Result<unknown> | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const init: UndiciRequestInit = {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
      if (dispatcher) init.dispatcher = dispatcher
      const res = await fetch(url, init)
      if (res.status === 404) return err('NOT_FOUND', `404: ${url}`)
      if (res.status === 429) {
        if (attempt === 0) {
          const retryAfter = Number(res.headers.get('retry-after'))
          const waitSec = Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : 1
          await sleep(waitSec * 1000)
          continue
        }
        return err('RATE_LIMITED', `429: ${url}`)
      }
      if (!res.ok) { lastErr = err('HTTP_' + res.status, `${res.status}: ${url}`); continue }
      const data: unknown = await res.json()
      cacheSet(url, data)
      return ok(data)
    } catch (e) {
      lastErr = err('NETWORK', e instanceof Error ? e.message : String(e))
    }
  }
  return lastErr ?? err('NETWORK', 'unreachable')
}
