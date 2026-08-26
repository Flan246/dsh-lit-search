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
