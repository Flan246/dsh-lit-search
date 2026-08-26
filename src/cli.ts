#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import { Command } from 'commander'
import { searchPapers } from './core/search.js'
import { citePaper, type CiteStyle } from './core/cite.js'
import { bibEntries } from './core/bib.js'
import { relatedPapers } from './core/related.js'
import type { Paper, Result } from './core/types.js'

export function formatPapers(papers: Paper[]): string {
  if (papers.length === 0) return 'No papers found.'
  return papers.map((p, i) =>
    `${i + 1}. ${p.title} (${p.year ?? 'n.d.'}) — ${p.authors.slice(0, 3).join(', ')}` +
    `${p.venue ? ` [${p.venue}]` : ''}\n   doi:${p.doi} cited:${p.citationCount ?? '-'}`,
  ).join('\n')
}

function print<T>(r: Result<T>, asJson: boolean, render: (d: T) => string): void {
  if (!r.ok) {
    console.error(`error[${r.error.code}]: ${r.error.message}`)
    process.exitCode = 1
    return
  }
  console.log(asJson ? JSON.stringify(r.data, null, 2) : render(r.data))
}

const program = new Command()
program.name('dsh-lit-search').description('Literature search & citation tools (Crossref + OpenAlex)')
  .option('--json', 'print machine-readable JSON', false)

program.command('search').argument('<query>').option('-n, --limit <n>', 'max results', '10')
  .action(async (query: string, o: { limit: string }) => {
    print(await searchPapers(query, { limit: Number(o.limit) }), program.opts().json, formatPapers)
  })

program.command('cite').argument('<doi>').option('-s, --style <style>', 'gbt7714|apa|bibtex', 'gbt7714')
  .action(async (doi: string, o: { style: string }) => {
    const style = o.style as CiteStyle
    if (!['gbt7714', 'apa', 'bibtex'].includes(style)) {
      console.error(`unknown style: ${o.style}`); process.exitCode = 2; return
    }
    print(await citePaper(doi, style), program.opts().json, (s) => s)
  })

program.command('bib').argument('<dois...>')
  .action(async (dois: string[]) => {
    print(await bibEntries(dois), program.opts().json,
      (d) => d.entries + (d.missing.length ? `\n-- missing: ${d.missing.join(', ')}` : ''))
  })

program.command('related').argument('<doi>').option('-n, --limit <n>', 'max results', '10')
  .action(async (doi: string, o: { limit: string }) => {
    print(await relatedPapers(doi, { limit: Number(o.limit) }), program.opts().json, formatPapers)
  })

// 只在作为可执行入口时 parse（测试 import 不触发）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  program.parseAsync()
}
