import { err, ok, type Result } from './types.js'

const UA = 'dsh-lit-search/0.1.0 (mailto:lit-search@users.noreply.github.com)'
const TIMEOUT_MS = 10_000

export async function fetchJson(url: string): Promise<Result<unknown>> {
  let lastErr: Result<unknown> | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.status === 404) return err('NOT_FOUND', `404: ${url}`)
      if (res.status === 429) return err('RATE_LIMITED', `429: ${url}`)
      if (!res.ok) { lastErr = err('HTTP_' + res.status, `${res.status}: ${url}`); continue }
      return ok(await res.json())
    } catch (e) {
      lastErr = err('NETWORK', e instanceof Error ? e.message : String(e))
    }
  }
  return lastErr ?? err('NETWORK', 'unreachable')
}
