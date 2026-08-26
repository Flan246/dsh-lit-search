#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Command } from 'commander'
import { searchPapers } from './core/search.js'
import { citePaper, type CiteStyle } from './core/cite.js'
import { bibEntries } from './core/bib.js'
import { relatedPapers } from './core/related.js'
import type { Result } from './core/types.js'

// formatPapers 实现位于 core/format.ts，此处 re-export 保持既有引用路径不变
import { formatPapers } from './core/format.js'
export { formatPapers }

function print<T>(r: Result<T>, asJson: boolean, render: (d: T) => string): void {
  if (!r.ok) {
    console.error(`error[${r.error.code}]: ${r.error.message}`)
    process.exitCode = 1
    return
  }
  console.log(asJson ? JSON.stringify(r.data, null, 2) : render(r.data))
}

export const program = new Command()
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

// 只在作为可执行入口时 parse（测试 import 不触发）。
// npm 全局安装会经软链调用 bin，两侧都过 realpath 再比较，
// 保证软链与直路径调用都能命中守卫；realpath 失败时回退到原始 URL 比较。
function isMain(): boolean {
  if (!process.argv[1]) return false
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href
  }
}
if (isMain()) {
  program.parseAsync()
}
