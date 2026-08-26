import { fetchJson as defaultFetchJson } from './http.js'
import { ok, type Paper, type Result } from './types.js'

interface Deps { fetchJson?: typeof defaultFetchJson }

export async function relatedPapers(
  doi: string,
  opts: { limit?: number } = {},
  deps: Deps = {},
): Promise<Result<Paper[]>> {
  const limit = opts.limit ?? 10
  const fj = deps.fetchJson ?? defaultFetchJson
  const work = await fj(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`)
  if (!work.ok) return work
  const ids: string[] = (work.data as any)?.related_works ?? []
  const slice = ids.slice(0, limit)
  if (slice.length === 0) return ok([])
  const filter = slice.map((id) => id.replace('https://openalex.org/', '')).join('|')
  const r = await fj(`https://api.openalex.org/works?filter=openalex_id:${encodeURIComponent(filter)}&per-page=${limit}`)
  if (!r.ok) return r
  const results = (r.data as any)?.results ?? []
  return ok(results.filter((w: any) => w?.doi && w?.title).map((w: any): Paper => ({
    doi: String(w.doi).replace(/^https?:\/\/doi\.org\//i, '').toLowerCase(),
    title: String(w.title),
    authors: (w.authorships ?? []).map((a: any) => a?.author?.display_name).filter(Boolean),
    year: w.publication_year ?? null,
    venue: w.primary_location?.source?.display_name ?? null,
    citationCount: w.cited_by_count ?? null,
    source: 'openalex',
    url: w.doi ?? null,
  })))
}
