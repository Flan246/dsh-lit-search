import { describe, expect, it, vi } from 'vitest'
import * as plugin from '../src/plugin.js'

describe('plugin', () => {
  it('exports cordis plugin contract', () => {
    expect(plugin.name).toBe('dsh-lit-search')
    expect(plugin.inject).toEqual(['tools'])
    expect(typeof plugin.apply).toBe('function')
  })

  it('registers 4 tools on apply', async () => {
    const registered: any[] = []
    const ctx = { tools: { register: (t: any) => registered.push(t) } }
    plugin.apply(ctx as any)
    expect(registered.map((t) => t.name).sort()).toEqual(
      ['lit_bib', 'lit_cite', 'lit_related', 'lit_search'])
  })
})
