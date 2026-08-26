import { describe, expect, it, vi } from 'vitest'
import { formatPapers, program } from '../src/cli.js'
import { ok } from '../src/core/types.js'
import type { Paper } from '../src/core/types.js'

vi.mock('../src/core/search.js', () => ({
  searchPapers: vi.fn(async () => ok([])),
}))

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

describe('global --json option', () => {
  // commander 默认即允许 program 级 option 出现在子命令名前后两种位置；
  // 该用例固定此行为，防止将来误加 program.enablePositionalOptions() 破坏后置写法。
  it('is accepted both before and after the subcommand', async () => {
    program.exitOverride()
    await program.parseAsync(['--json', 'search', 'q'], { from: 'user' })
    expect(program.opts().json).toBe(true)
    await program.parseAsync(['search', 'q', '--json'], { from: 'user' })
    expect(program.opts().json).toBe(true)
  })
})
