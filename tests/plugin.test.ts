import { describe, expect, it } from 'vitest'
import * as plugin from '../src/plugin.js'
import { err, ok } from '../src/core/types.js'

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

describe('asValue', () => {
  it('passes ok data through', () => {
    expect(plugin.asValue(ok([1, 2]))).toEqual([1, 2])
    expect(plugin.asValue(ok('text'))).toBe('text')
  })

  it('flattens err Result to an { error } value', () => {
    const v = plugin.asValue(err('HTTP_ERROR', 'boom'))
    expect(v).toEqual({ error: { code: 'HTTP_ERROR', message: 'boom' } })
  })
})

describe('tool render error branches', () => {
  const errorValue = { error: { code: 'HTTP_ERROR', message: 'boom' } }

  it('lit_search renders the error message', () => {
    const t = registeredTools().get('lit_search')
    expect(t.output.render({ query: 'x' }, errorValue))
      .toEqual([{ type: 'text', text: 'Search failed: boom' }])
  })

  it('lit_cite renders the error message', () => {
    const t = registeredTools().get('lit_cite')
    expect(t.output.render({ doi: '10.1/x' }, errorValue))
      .toEqual([{ type: 'text', text: 'Cite failed: boom' }])
  })

  it('lit_bib renders the error message', () => {
    const t = registeredTools().get('lit_bib')
    expect(t.output.render({ dois: ['10.1/x'] }, errorValue))
      .toEqual([{ type: 'text', text: 'Bib failed: boom' }])
  })

  it('lit_related renders the error message', () => {
    const t = registeredTools().get('lit_related')
    expect(t.output.render({ doi: '10.1/x' }, errorValue))
      .toEqual([{ type: 'text', text: 'Related failed: boom' }])
  })
})
