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
})
