import { describe, expect, it } from 'vitest'
import { formatPapers } from '../src/cli.js'
import type { Paper } from '../src/core/types.js'

const p: Paper = {
  doi: '10.1/x', title: 'T', authors: ['A B'], year: 2020,
  venue: 'V', citationCount: 7, source: 'crossref', url: null,
}

describe('formatPapers', () => {
  it('renders one line per paper with year and citations', () => {
    const out = formatPapers([p])
    expect(out).toContain('T (2020)')
    expect(out).toContain('doi:10.1/x')
    expect(out).toContain('cited:7')
  })

  it('renders empty list as friendly message', () => {
    expect(formatPapers([])).toBe('No papers found.')
  })
})
