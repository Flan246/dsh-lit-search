import { fetchJson as defaultFetchJson } from './http.js'
import { citePaper } from './cite.js'
import { ok, type Result } from './types.js'

interface Deps { fetchJson?: typeof defaultFetchJson }

export async function bibEntries(
  dois: string[],
  deps: Deps = {},
): Promise<Result<{ entries: string; missing: string[] }>> {
  const parts: string[] = []
  const missing: string[] = []
  for (const doi of dois) {
    const r = await citePaper(doi, 'bibtex', deps)
    if (r.ok) parts.push(r.data)
    else missing.push(doi)
  }
  return ok({ entries: parts.join('\n\n') + (parts.length ? '\n' : ''), missing })
}
