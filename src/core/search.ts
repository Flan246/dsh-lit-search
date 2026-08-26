import { fetchJson as defaultFetchJson } from './http.js'
import { err, ok, type Paper, type Result } from './types.js'

interface Deps { fetchJson?: typeof defaultFetchJson }

export async function searchPapers(
  query: string,
  opts: { limit?: number } = {},
  deps: Deps = {},
): Promise<Result<Paper[]>> {
  const limit = opts.limit ?? 10
  const fj = deps.fetchJson ?? defaultFetchJson
  const q = encodeURIComponent(query)
  const [cr, oa] = await Promise.all([
    fj(`https://api.crossref.org/works?query=${q}&rows=${limit}&select=DOI,title,author,published,container-title,is-referenced-by-count,URL`),
    fj(`https://api.openalex.org/works?search=${q}&per-page=${limit}`),
  ])

  if (!cr.ok && !oa.ok) {
    return err('ALL_SOURCES_FAILED', 'both Crossref and OpenAlex are unavailable')
  }

  const byDoi = new Map<string, Paper>()
  if (cr.ok) for (const p of fromCrossref(cr.data)) byDoi.set(p.doi, p)
  if (oa.ok) for (const p of fromOpenAlex(oa.data)) if (!byDoi.has(p.doi)) byDoi.set(p.doi, p)

  const papers = [...byDoi.values()]
    .sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0))
    .slice(0, limit)
  return ok(papers)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromCrossref(data: any): Paper[] {
  const items = data?.message?.items
  if (!Array.isArray(items)) return []
  return items.filter((w) => w?.DOI && w?.title?.[0]).map((w): Paper => ({
    doi: String(w.DOI).toLowerCase(),
    title: String(w.title[0]),
    authors: (w.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(' ')),
    year: w.published?.['date-parts']?.[0]?.[0] ?? null,
    venue: w['container-title']?.[0] ?? null,
    citationCount: w['is-referenced-by-count'] ?? null,
    source: 'crossref',
    url: w.URL ?? null,
  }))
}

function fromOpenAlex(data: any): Paper[] {
  const items = data?.results
  if (!Array.isArray(items)) return []
  return items.filter((w) => w?.doi && w?.title).map((w): Paper => ({
    doi: String(w.doi).replace(/^https?:\/\/doi\.org\//i, '').toLowerCase(),
    title: String(w.title),
    authors: (w.authorships ?? []).map((a: any) => a?.author?.display_name).filter(Boolean),
    year: w.publication_year ?? null,
    venue: w.primary_location?.source?.display_name ?? null,
    citationCount: w.cited_by_count ?? null,
    source: 'openalex',
    url: w.doi ?? null,
  }))
}
