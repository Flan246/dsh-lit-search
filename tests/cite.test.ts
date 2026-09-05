import { describe, expect, it, vi } from 'vitest'
import { citePaper } from '../src/core/cite.js'
import { ok, err } from '../src/core/types.js'

const work = {
  message: {
    DOI: '10.1000/xyz', title: ['Attention Is All You Need'],
    author: [
      { given: 'Ashish', family: 'Vaswani' },
      { given: 'Noam', family: 'Shazeer' },
      { given: 'Niki', family: 'Parmar' },
      { given: 'Jakob', family: 'Uszkoreit' },
    ],
    published: { 'date-parts': [[2017]] },
    'container-title': ['Advances in Neural Information Processing Systems'],
    volume: '30', type: 'proceedings-article',
  },
}

const fetchOk = vi.fn(async () => ok(work))

describe('citePaper', () => {
  it('formats gbt7714 with et al. after 3 authors', async () => {
    const r = await citePaper('10.1000/xyz', 'gbt7714', { fetchJson: fetchOk })
    expect(r).toEqual({
      ok: true,
      data: 'Vaswani A, Shazeer N, Parmar N, et al. Attention Is All You Need[C]. Advances in Neural Information Processing Systems, 2017, 30.',
    })
  })

  it('formats apa', async () => {
    const r = await citePaper('10.1000/xyz', 'apa', { fetchJson: fetchOk })
    expect(r.ok && r.data).toBe(
      'Vaswani, A., Shazeer, N., Parmar, N., et al. (2017). Attention Is All You Need. Advances in Neural Information Processing Systems. https://doi.org/10.1000/xyz',
    )
  })

  it('formats bibtex with derived key', async () => {
    const r = await citePaper('10.1000/xyz', 'bibtex', { fetchJson: fetchOk })
    expect(r.ok && r.data).toContain('@inproceedings{vaswani2017attention')
    expect(r.ok && r.data).toContain('doi = {10.1000/xyz}')
  })

  it('propagates NOT_FOUND', async () => {
    const r = await citePaper('10.bad/none', 'apa', {
      fetchJson: vi.fn(async () => err('NOT_FOUND', '404')),
    })
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('handles family-only institutional author without "undefined." initials', async () => {
    const org = {
      message: {
        ...work.message,
        author: [{ family: 'World Health Organization' }],
      },
    }
    const fetchOrg = vi.fn(async () => ok(org))
    const apaR = await citePaper('10.1000/xyz', 'apa', { fetchJson: fetchOrg })
    expect(apaR.ok && apaR.data).toContain('World Health Organization (2017).')
    expect(apaR.ok && apaR.data).not.toContain('undefined')
    const gbtR = await citePaper('10.1000/xyz', 'gbt7714', { fetchJson: fetchOrg })
    expect(gbtR.ok && gbtR.data).toContain('World Health Organization. Attention Is All You Need[C].')
  })

  it('omits leading punctuation when the work has no authors', async () => {
    const anon = { message: { ...work.message, author: [] } }
    const fetchAnon = vi.fn(async () => ok(anon))
    const apaR = await citePaper('10.1000/xyz', 'apa', { fetchJson: fetchAnon })
    expect(apaR.ok && apaR.data).toMatch(/^\(2017\)\. Attention Is All You Need\./)
    const gbtR = await citePaper('10.1000/xyz', 'gbt7714', { fetchJson: fetchAnon })
    expect(gbtR.ok && gbtR.data).toMatch(/^Attention Is All You Need\[C\]\./)
  })
})

describe('citePaper OpenAlex fallback', () => {
  const oaVenueWork = {
    doi: 'https://doi.org/10.48550/arxiv.2401.04088',
    title: 'Some Published Paper',
    authorships: [
      { author: { display_name: 'Jane Smith' } },
      { author: { display_name: 'John Doe' } },
    ],
    publication_year: 2024,
    primary_location: { source: { display_name: 'Journal of Testing' } },
    cited_by_count: 3,
  }
  const oaPreprint = {
    ...oaVenueWork,
    doi: 'https://doi.org/10.48550/arxiv.2412.19437',
    primary_location: { source: null },
  }

  // fetchJson mock that routes by host: Crossref always 404s, OpenAlex
  // returns the given work (or 404 when omitted).
  const fallbackFetch = (oaData?: unknown) =>
    vi.fn(async (url: string) => {
      if (url.includes('crossref.org')) return err('NOT_FOUND', '404: crossref')
      if (url.includes('openalex.org')) return oaData ? ok(oaData) : err('NOT_FOUND', '404: openalex')
      throw new Error(`unexpected url ${url}`)
    })

  it('falls back to OpenAlex on Crossref 404 and formats a venue work as journal', async () => {
    const fetchJson = fallbackFetch(oaVenueWork)
    const gbt = await citePaper('10.48550/arxiv.2401.04088', 'gbt7714', { fetchJson })
    expect(gbt.ok && gbt.data).toBe(
      'Smith J, Doe J. Some Published Paper[J]. Journal of Testing, 2024.',
    )
    const bib = await citePaper('10.48550/arxiv.2401.04088', 'bibtex', { fetchJson })
    expect(bib.ok && bib.data).toContain('@article{smith2024some')
    expect(bib.ok && bib.data).toContain('journal = {Journal of Testing}')
    expect(bib.ok && bib.data).toContain('doi = {10.48550/arxiv.2401.04088}')
    const apaR = await citePaper('10.48550/arxiv.2401.04088', 'apa', { fetchJson })
    expect(apaR.ok && apaR.data).toBe(
      'Smith, J., Doe, J. (2024). Some Published Paper. Journal of Testing. https://doi.org/10.48550/arxiv.2401.04088',
    )
  })

  it('formats an OpenAlex work without venue as preprint ([EB/OL] / @misc)', async () => {
    const fetchJson = fallbackFetch(oaPreprint)
    const gbt = await citePaper('10.48550/arxiv.2412.19437', 'gbt7714', { fetchJson })
    expect(gbt.ok && gbt.data).toBe(
      'Smith J, Doe J. Some Published Paper[EB/OL]. (2024). https://doi.org/10.48550/arxiv.2412.19437.',
    )
    const bib = await citePaper('10.48550/arxiv.2412.19437', 'bibtex', { fetchJson })
    expect(bib.ok && bib.data).toContain('@misc{smith2024some')
    expect(bib.ok && bib.data).toContain('howpublished = {arXiv preprint}')
    expect(bib.ok && bib.data).toContain('doi = {10.48550/arxiv.2412.19437}')
  })

  it('treats an arXiv primary_location source as a preprint, not a journal venue', async () => {
    const arxivSourced = {
      ...oaVenueWork,
      primary_location: { source: { display_name: 'arXiv (Cornell University)' } },
    }
    const fetchJson = fallbackFetch(arxivSourced)
    const gbt = await citePaper('10.48550/arxiv.2401.04088', 'gbt7714', { fetchJson })
    expect(gbt.ok && gbt.data).toBe(
      'Smith J, Doe J. Some Published Paper[EB/OL]. (2024). https://doi.org/10.48550/arxiv.2401.04088.',
    )
    const bib = await citePaper('10.48550/arxiv.2401.04088', 'bibtex', { fetchJson })
    expect(bib.ok && bib.data).toContain('@misc{smith2024some')
    expect(bib.ok && bib.data).toContain('howpublished = {arXiv preprint}')
  })

  it('treats a bioRxiv source as a preprint and names the server in howpublished', async () => {
    const biorxivSourced = {
      ...oaVenueWork,
      doi: 'https://doi.org/10.1101/2024.01.01.573890',
      primary_location: { source: { display_name: 'bioRxiv' } },
    }
    const fetchJson = fallbackFetch(biorxivSourced)
    const gbt = await citePaper('10.1101/2024.01.01.573890', 'gbt7714', { fetchJson })
    expect(gbt.ok && gbt.data).toBe(
      'Smith J, Doe J. Some Published Paper[EB/OL]. (2024). https://doi.org/10.1101/2024.01.01.573890.',
    )
    const bib = await citePaper('10.1101/2024.01.01.573890', 'bibtex', { fetchJson })
    expect(bib.ok && bib.data).toContain('@misc{smith2024some')
    expect(bib.ok && bib.data).toContain('howpublished = {bioRxiv preprint}')
    expect(bib.ok && bib.data).not.toContain('journal =')
    const apaR = await citePaper('10.1101/2024.01.01.573890', 'apa', { fetchJson })
    expect(apaR.ok && apaR.data).toBe(
      'Smith, J., Doe, J. (2024). Some Published Paper. https://doi.org/10.1101/2024.01.01.573890',
    )
  })

  it.each([
    ['medRxiv', 'medRxiv preprint'],
    ['SSRN', 'SSRN preprint'],
    ['ChemRxiv', 'ChemRxiv preprint'],
    ['Research Square', 'Research Square preprint'],
    ['Preprints.org', 'Preprints.org preprint'],
    ['TechRxiv', 'TechRxiv preprint'],
  ])('treats %s as a preprint server, not a journal venue', async (source, howpublished) => {
    const fetchJson = fallbackFetch({
      ...oaVenueWork,
      primary_location: { source: { display_name: source } },
    })
    const gbt = await citePaper('10.48550/arxiv.2401.04088', 'gbt7714', { fetchJson })
    expect(gbt.ok && gbt.data).toContain('[EB/OL]')
    expect(gbt.ok && gbt.data).not.toContain(source)
    const bib = await citePaper('10.48550/arxiv.2401.04088', 'bibtex', { fetchJson })
    expect(bib.ok && bib.data).toContain('@misc{smith2024some')
    expect(bib.ok && bib.data).toContain(`howpublished = {${howpublished}}`)
  })

  it('still treats a real journal source as a venue after the preprint table', async () => {
    const fetchJson = fallbackFetch({
      ...oaVenueWork,
      primary_location: { source: { display_name: 'Journal of Preprints and Archives' } },
    })
    const gbt = await citePaper('10.48550/arxiv.2401.04088', 'gbt7714', { fetchJson })
    expect(gbt.ok && gbt.data).toBe(
      'Smith J, Doe J. Some Published Paper[J]. Journal of Preprints and Archives, 2024.',
    )
  })

  it('returns NOT_FOUND when both Crossref and OpenAlex 404', async () => {
    const r = await citePaper('10.48550/arxiv.9999.99999', 'apa', { fetchJson: fallbackFetch() })
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('does not query OpenAlex when Crossref succeeds', async () => {
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes('openalex.org')) throw new Error('OpenAlex must not be requested')
      return ok(work)
    })
    const r = await citePaper('10.1000/xyz', 'gbt7714', { fetchJson })
    expect(r.ok).toBe(true)
    expect(fetchJson).toHaveBeenCalledTimes(1)
    expect(fetchJson.mock.calls.every(([url]) => !String(url).includes('openalex.org'))).toBe(true)
  })
})
