import { describe, expect, it, vi } from 'vitest'
import { searchPapers } from '../src/core/search.js'
import { ok } from '../src/core/types.js'

const crossrefPayload = {
  message: {
    items: [
      {
        DOI: '10.1000/xyz', title: ['Attention Is All You Need'],
        author: [{ given: 'Ashish', family: 'Vaswani' }],
        published: { 'date-parts': [[2017]] },
        'container-title': ['NeurIPS'], 'is-referenced-by-count': 100000,
        URL: 'https://doi.org/10.1000/xyz',
      },
    ],
  },
}

const openalexPayload = {
  results: [
    {
      doi: 'https://doi.org/10.1000/xyz', title: 'Attention Is All You Need',
      authorships: [{ author: { display_name: 'A Vaswani' } }],
      publication_year: 2017, primary_location: { source: { display_name: 'NeurIPS' } },
      cited_by_count: 100000,
    },
    {
      doi: 'https://doi.org/10.1000/abc', title: 'BERT',
      authorships: [{ author: { display_name: 'J Devlin' } }],
      publication_year: 2019, primary_location: { source: { display_name: 'NAACL' } },
      cited_by_count: 80000,
    },
  ],
}

describe('searchPapers', () => {
  it('merges both sources and dedupes by doi', async () => {
    const fetchJson = vi.fn(async (url: string) =>
      url.includes('crossref') ? ok(crossrefPayload) : ok(openalexPayload))
    const r = await searchPapers('attention', { limit: 10 }, { fetchJson })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).toHaveLength(2)
    expect(r.data.map((p) => p.doi).sort()).toEqual(['10.1000/abc', '10.1000/xyz'])
  })

  it('still returns results when one source fails', async () => {
    const fetchJson = vi.fn(async (url: string) =>
      url.includes('crossref')
        ? { ok: false as const, error: { code: 'NETWORK', message: 'down' } }
        : ok(openalexPayload))
    const r = await searchPapers('attention', {}, { fetchJson })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).toHaveLength(2)
  })

  it('returns ALL_SOURCES_FAILED when both sources fail', async () => {
    const fetchJson = vi.fn(async () =>
      ({ ok: false as const, error: { code: 'NETWORK', message: 'down' } }))
    const r = await searchPapers('attention', {}, { fetchJson })
    expect(r).toMatchObject({
      ok: false,
      error: { code: 'ALL_SOURCES_FAILED', message: 'both Crossref and OpenAlex are unavailable' },
    })
  })

  it('returns ok([]) when both sources succeed with no results', async () => {
    const fetchJson = vi.fn(async (url: string) =>
      url.includes('crossref') ? ok({ message: { items: [] } }) : ok({ results: [] }))
    const r = await searchPapers('nonexistent-xyz', {}, { fetchJson })
    expect(r).toEqual({ ok: true, data: [] })
  })
})

describe('searchPapers filters, sort and third source', () => {
  const crItem = { message: { items: [] } }
  const s2Payload = {
    data: [
      {
        title: 'S2 Paper', year: 2024, venue: 'NeurIPS', citationCount: 42,
        externalIds: { DOI: '10.9999/s2paper' },
        authors: [{ name: 'Alice Smith' }],
      },
      { title: 'No DOI paper', year: 2024 },  // 无 DOI 应被丢弃
    ],
  }

  it('adds year filter params to crossref and openalex urls', async () => {
    const urls: string[] = []
    const fetchJson = vi.fn(async (url: string) => { urls.push(url); return ok(crItem) })
    await searchPapers('moe', { yearFrom: 2024, yearTo: 2026 }, { fetchJson })
    expect(urls.find((u) => u.includes('crossref'))).toContain('from-pub-date%3A2024')
    expect(urls.find((u) => u.includes('openalex'))).toContain('from_publication_date%3A2024')
  })

  it('merges semantic scholar results and dedupes by doi', async () => {
    const fetchJson = vi.fn(async (url: string) =>
      url.includes('semanticscholar') ? ok(s2Payload) : ok(crItem))
    const r = await searchPapers('moe', {}, { fetchJson })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).toHaveLength(1)
    expect(r.data[0]).toMatchObject({ doi: '10.9999/s2paper', source: 'semanticscholar', citationCount: 42 })
  })

  it('sort=date orders by year descending', async () => {
    const payload = {
      results: [
        { doi: 'https://doi.org/10.1/old', title: 'Old', publication_year: 2020, authorships: [], primary_location: { source: null }, cited_by_count: 9 },
        { doi: 'https://doi.org/10.1/new', title: 'New', publication_year: 2026, authorships: [], primary_location: { source: null }, cited_by_count: 1 },
      ],
    }
    const fetchJson = vi.fn(async (url: string) =>
      url.includes('openalex') ? ok(payload) : ok(crItem))
    const r = await searchPapers('x', { sort: 'date' }, { fetchJson })
    expect(r.ok && r.data[0]?.title).toBe('New')
  })

  it('semantic scholar failure alone does not break the search', async () => {
    const fetchJson = vi.fn(async (url: string) =>
      url.includes('semanticscholar')
        ? { ok: false as const, error: { code: 'RATE_LIMITED', message: 'slow down' } }
        : ok(crItem))
    const r = await searchPapers('x', {}, { fetchJson })
    expect(r.ok).toBe(true)
  })

  it('all three sources failing returns ALL_SOURCES_FAILED', async () => {
    const fetchJson = vi.fn(async () => ({ ok: false as const, error: { code: 'NETWORK', message: 'down' } }))
    const r = await searchPapers('x', {}, { fetchJson })
    expect(r).toMatchObject({ ok: false, error: { code: 'ALL_SOURCES_FAILED' } })
  })
})
