import { describe, expect, it, vi } from 'vitest'
import { bibEntries } from '../src/core/bib.js'
import { ok, err } from '../src/core/types.js'

const work = (doi: string, title: string) => ({
  message: {
    DOI: doi, title: [title], author: [{ given: 'A', family: 'Zhang' }],
    published: { 'date-parts': [[2020]] }, 'container-title': ['J'], type: 'journal-article',
  },
})

describe('bibEntries', () => {
  it('joins entries and collects missing dois', async () => {
    const fetchJson = vi.fn(async (url: string) =>
      url.includes('10.1000%2Fbad') ? err('NOT_FOUND', '404') : ok(work('10.1000/a', 'Paper A')))
    const r = await bibEntries(['10.1000/a', '10.1000/bad'], { fetchJson })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.entries).toContain('@article{zhang2020paper')
    expect(r.data.missing).toEqual(['10.1000/bad'])
  })
})
