import { fetchJson as defaultFetchJson } from './http.js'
import { err, ok, type Paper, type Result } from './types.js'

export interface SearchOptions {
  limit?: number
  yearFrom?: number
  yearTo?: number
  sort?: 'relevance' | 'citations' | 'date'
}

interface Deps { fetchJson?: typeof defaultFetchJson }

export async function searchPapers(
  query: string,
  opts: SearchOptions = {},
  deps: Deps = {},
): Promise<Result<Paper[]>> {
  const limit = opts.limit ?? 10
  const sort = opts.sort ?? 'citations'
  const fj = deps.fetchJson ?? defaultFetchJson
  const q = encodeURIComponent(query)

  const crFilter = opts.yearFrom || opts.yearTo
    ? `&filter=${encodeURIComponent([opts.yearFrom ? `from-pub-date:${opts.yearFrom}` : '', opts.yearTo ? `until-pub-date:${opts.yearTo}` : ''].filter(Boolean).join(','))}`
    : ''
  const crSort = sort === 'citations' ? '&sort=is-referenced-by-count&order=desc'
    : sort === 'date' ? '&sort=published&order=desc' : ''

  const oaFilter = opts.yearFrom || opts.yearTo
    ? `&filter=${encodeURIComponent([opts.yearFrom ? `from_publication_date:${opts.yearFrom}` : '', opts.yearTo ? `to_publication_date:${opts.yearTo}` : ''].filter(Boolean).join(','))}`
    : ''
  const oaSort = sort === 'citations' ? '&sort=cited_by_count:desc'
    : sort === 'date' ? '&sort=publication_date:desc' : ''

  const s2Year = opts.yearFrom || opts.yearTo
    ? `&year=${opts.yearFrom ?? ''}-${opts.yearTo ?? ''}`
    : ''

  const [cr, oa, s2] = await Promise.all([
    fj(`https://api.crossref.org/works?query=${q}&rows=${limit}&select=DOI,title,author,published,container-title,is-referenced-by-count,URL${crFilter}${crSort}`),
    fj(`https://api.openalex.org/works?search=${q}&per-page=${limit}${oaFilter}${oaSort}`),
    fj(`https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=${limit}&fields=title,authors,year,venue,citationCount,externalIds${s2Year}`),
  ])

  if (!cr.ok && !oa.ok && !s2.ok) {
    return err('ALL_SOURCES_FAILED', 'both Crossref and OpenAlex are unavailable')
  }

  const byDoi = new Map<string, Paper>()
  if (cr.ok) for (const p of fromCrossref(cr.data)) byDoi.set(p.doi, p)
  if (oa.ok) for (const p of fromOpenAlex(oa.data)) if (!byDoi.has(p.doi)) byDoi.set(p.doi, p)
  if (s2.ok) for (const p of fromSemanticScholar(s2.data)) if (!byDoi.has(p.doi)) byDoi.set(p.doi, p)

  let papers = [...byDoi.values()]
  if (sort === 'citations') papers = papers.sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0))
  else if (sort === 'date') papers = papers.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
  // relevance: 保持插入序
  return ok(papers.slice(0, limit))
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

function fromSemanticScholar(data: any): Paper[] {
  const items = data?.data
  if (!Array.isArray(items)) return []
  return items
    .filter((w) => w?.externalIds?.DOI && w?.title)
    .map((w): Paper => ({
      doi: String(w.externalIds.DOI).toLowerCase(),
      title: String(w.title),
      authors: (w.authors ?? []).map((a: any) => a?.name).filter(Boolean),
      year: w.year ?? null,
      venue: w.venue || null,
      citationCount: w.citationCount ?? null,
      source: 'semanticscholar',
      url: `https://doi.org/${w.externalIds.DOI}`,
    }))
}
