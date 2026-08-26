import { describe, expect, it, vi } from 'vitest'
import { relatedPapers } from '../src/core/related.js'
import { ok, err } from '../src/core/types.js'

describe('relatedPapers', () => {
  it('resolves related works via openalex', async () => {
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes('/works/doi:')) return ok({ related_works: ['https://openalex.org/W1'] })
      return ok({
        results: [{
          doi: 'https://doi.org/10.1/r1', title: 'Related One',
          authorships: [{ author: { display_name: 'X' } }],
          publication_year: 2021, primary_location: { source: null }, cited_by_count: 5,
        }],
      })
    })
    const r = await relatedPapers('10.1000/xyz', { limit: 5 }, { fetchJson })
    expect(r.ok && r.data[0]?.title).toBe('Related One')
  })

  it('returns empty list when no related works', async () => {
    const fetchJson = vi.fn(async () => ok({ related_works: [] }))
    const r = await relatedPapers('10.1000/xyz', {}, { fetchJson })
    expect(r).toEqual({ ok: true, data: [] })
  })

  it('propagates NOT_FOUND for unknown doi', async () => {
    const fetchJson = vi.fn(async () => err('NOT_FOUND', '404'))
    const r = await relatedPapers('10.bad/x', {}, { fetchJson })
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})
