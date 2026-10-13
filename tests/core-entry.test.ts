import { describe, it, expect } from 'vitest'
import * as core from '../src/core/index.js'

describe('core public entry', () => {
  it('exports the five core functions', () => {
    for (const fn of ['searchPapers', 'citePaper', 'bibEntries', 'relatedPapers', 'formatPapers']) {
      expect(typeof (core as any)[fn]).toBe('function')
    }
  })
})
