import { fetch, ProxyAgent, type RequestInit as UndiciRequestInit } from 'undici'
import { err, ok, type Result } from './types.js'

const UA = 'dsh-lit-search/0.1.2 (mailto:lit-search@users.noreply.github.com)'
const TIMEOUT_MS = 10_000
const CACHE_TTL_MS = 5 * 60_000
const CACHE_MAX = 200
const CACHE_EVICT_BATCH = 20

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const cache = new Map<string, { data: unknown; expiry: number }>()

export function clearHttpCache(): void {
  cache.clear()
  // Also drop the pooled ProxyAgent so tests (and callers) get a fully
  // clean slate without ordering coupling.
  pooledAgent = null
}

function proxyUrl(): string | undefined {
  return process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy || undefined
}

// Lazily created ProxyAgent singleton, keyed by proxy URL. Long-lived hosts
// must not accumulate a new connection pool per request; the agent is only
// rebuilt when the proxy URL changes, and dropped when proxying is disabled.
let pooledAgent: { url: string; agent: ProxyAgent } | null = null

function getDispatcher(): ProxyAgent | undefined {
  const url = proxyUrl()
  if (!url) { pooledAgent = null; return undefined }
  if (pooledAgent && pooledAgent.url === url) return pooledAgent.agent
  const agent = new ProxyAgent(url)
  pooledAgent = { url, agent }
  return agent
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

  let dispatcher: ProxyAgent | undefined
  try {
    dispatcher = getDispatcher()
  } catch (e) {
    return err('NETWORK', e instanceof Error ? e.message : String(e))
  }

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
          // Drain the body so the socket is released before retrying;
          // a failed drain must not abort the retry. undici 7 fetch()
          // returns a standard web ReadableStream body — cancel() is the
          // standard way to discard it (dump() only exists on
          // client.request's BodyReadable, not here).
          try { await res.body?.cancel() } catch { /* best-effort drain */ }
          const ra = res.headers.get('retry-after')
          let waitSec = 1
          if (ra !== null) {
            const parsed = Number(ra)
            if (Number.isFinite(parsed) && parsed >= 0) waitSec = parsed
          }
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
      // undici fetch failures are TypeErrors whose `cause` carries the real
      // reason (ECONNREFUSED / ETIMEDOUT / ENOTFOUND / UND_ERR_*); surface it
      // so connection problems are diagnosable without a debugger.
      const base = e instanceof Error ? e.message : String(e)
      const cause = (e as { cause?: { code?: string; message?: string } } | null)?.cause
      const detail = cause ? `（cause: ${cause.code ?? cause.message ?? ''}）` : ''
      lastErr = err('NETWORK', `${base}${detail}（如在使用代理，请检查 HTTPS_PROXY 设置）`)
    }
  }
  return lastErr ?? err('NETWORK', 'unreachable')
}
