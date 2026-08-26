import { describe, expect, it, vi } from 'vitest'
import { searchPapers } from '../src/core/search.js'
import { citePaper } from '../src/core/cite.js'
import { bibEntries } from '../src/core/bib.js'
import { relatedPapers } from '../src/core/related.js'
import * as plugin from '../src/plugin.js'
import { err } from '../src/core/types.js'

vi.mock('../src/core/search.js', () => ({ searchPapers: vi.fn() }))
vi.mock('../src/core/cite.js', () => ({ citePaper: vi.fn() }))
vi.mock('../src/core/bib.js', () => ({ bibEntries: vi.fn() }))
vi.mock('../src/core/related.js', () => ({ relatedPapers: vi.fn() }))

const registeredTools = () => {
  const registered: any[] = []
  const ctx = { tools: { register: (t: any) => registered.push(t) } }
  plugin.apply(ctx as any)
  return new Map(registered.map((t) => [t.name, t]))
}

describe('plugin', () => {
  it('exports cordis plugin contract', () => {
    expect(plugin.name).toBe('dsh-lit-search')
    expect(plugin.inject).toEqual(['tools'])
    expect(typeof plugin.apply).toBe('function')
  })

  it('registers 4 tools on apply', async () => {
    const tools = registeredTools()
    expect([...tools.keys()].sort()).toEqual(
      ['lit_bib', 'lit_cite', 'lit_related', 'lit_search'])
  })

  it('declares honest output schema root types', () => {
    const tools = registeredTools()
    // lit_search/lit_related 返回数组，lit_cite 返回字符串，lit_bib 返回对象
    expect(tools.get('lit_search').output.schema.type).toBe('array')
    expect(tools.get('lit_related').output.schema.type).toBe('array')
    expect(tools.get('lit_cite').output.schema.type).toBe('string')
    expect(tools.get('lit_bib').output.schema.type).toBe('object')
  })
})

// 业务失败按官方契约 throw：注册表捕获后走 error-result 路径，
// 真实 message 带给 agent，且不与 output.schema 根类型冲突。
describe('tool execute throws on business failure', () => {
  it('lit_search throws the core error message', async () => {
    vi.mocked(searchPapers).mockResolvedValue(err('HTTP_ERROR', 'search boom'))
    const t = registeredTools().get('lit_search')
    await expect(t.execute({ query: 'x' })).rejects.toThrow('search boom')
  })

  it('lit_cite throws the core error message', async () => {
    vi.mocked(citePaper).mockResolvedValue(err('NOT_FOUND', 'cite boom'))
    const t = registeredTools().get('lit_cite')
    await expect(t.execute({ doi: '10.1/x' })).rejects.toThrow('cite boom')
  })

  it('lit_bib throws the core error message', async () => {
    vi.mocked(bibEntries).mockResolvedValue(err('HTTP_ERROR', 'bib boom'))
    const t = registeredTools().get('lit_bib')
    await expect(t.execute({ dois: ['10.1/x'] })).rejects.toThrow('bib boom')
  })

  it('lit_related throws the core error message', async () => {
    vi.mocked(relatedPapers).mockResolvedValue(err('HTTP_ERROR', 'related boom'))
    const t = registeredTools().get('lit_related')
    await expect(t.execute({ doi: '10.1/x' })).rejects.toThrow('related boom')
  })
})
