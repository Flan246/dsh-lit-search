import { fetchJson as defaultFetchJson } from './http.js'
import { ok, type Result } from './types.js'

export type CiteStyle = 'gbt7714' | 'apa' | 'bibtex'
interface Deps { fetchJson?: typeof defaultFetchJson }

export async function citePaper(
  doi: string,
  style: CiteStyle,
  deps: Deps = {},
): Promise<Result<string>> {
  const fj = deps.fetchJson ?? defaultFetchJson
  const r = await fj(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)
  if (!r.ok) return r
  const w = (r.data as any).message
  if (style === 'gbt7714') return ok(gbt7714(w))
  if (style === 'apa') return ok(apa(w))
  return ok(bibtex(w))
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const TYPE_MAP: Record<string, string> = {
  'journal-article': 'J', 'proceedings-article': 'C', monograph: 'M',
  dissertation: 'D', 'posted-content': 'EB',
}

function names(w: any): { family: string; given: string }[] {
  return (w.author ?? []).map((a: any) => ({
    family: a.family ?? '', given: a.given ?? '',
  }))
}

function gbt7714(w: any): string {
  const ns = names(w)
  const head = ns.slice(0, 3).map((n) => `${n.family} ${n.given[0] ?? ''}`.trimEnd()).join(', ')
  const authors = ns.length > 3 ? `${head}, et al` : head
  const mark = TYPE_MAP[w.type] ?? 'J'
  const venue = w['container-title']?.[0] ?? w.publisher ?? ''
  const year = w.published?.['date-parts']?.[0]?.[0] ?? ''
  const vol = [w.volume, w.issue && `(${w.issue})`].filter(Boolean).join('')
  const tail = [venue, year, vol].filter(Boolean).join(', ')
  return `${authors ? `${authors}. ` : ''}${w.title?.[0] ?? ''}[${mark}]. ${tail}.`
}

function apa(w: any): string {
  const ns = names(w)
  const fmt = (n: { family: string; given: string }) =>
    [n.family, n.given.split(/\s+/).filter(Boolean).map((s) => s[0] + '.').join(' ')]
      .filter(Boolean).join(', ')
  const head = ns.slice(0, 3).map(fmt).filter(Boolean).join(', ')
  const authors = ns.length > 3 ? `${head}, et al.` : head
  const year = w.published?.['date-parts']?.[0]?.[0] ?? 'n.d.'
  const venue = w['container-title']?.[0] ?? w.publisher ?? ''
  return `${authors ? `${authors} ` : ''}(${year}). ${w.title?.[0] ?? ''}. ${venue}. https://doi.org/${w.DOI}`
}

function bibtex(w: any): string {
  const ns = names(w)
  const year = w.published?.['date-parts']?.[0]?.[0] ?? ''
  const firstWord = String(w.title?.[0] ?? 'untitled').split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '')
  const key = `${ns[0]?.family.toLowerCase() ?? 'unknown'}${year}${firstWord}`
  const entryType = w.type === 'journal-article' ? 'article'
    : w.type === 'proceedings-article' ? 'inproceedings' : 'misc'
  const lines = [
    `  author = {${ns.map((n) => `${n.family}, ${n.given}`.trimEnd()).join(' and ')}}`,
    `  title = {${w.title?.[0] ?? ''}}`,
    w['container-title']?.[0] ? `  ${entryType === 'article' ? 'journal' : 'booktitle'} = {${w['container-title'][0]}}` : null,
    year ? `  year = {${year}}` : null,
    w.volume ? `  volume = {${w.volume}}` : null,
    w.issue ? `  number = {${w.issue}}` : null,
    `  doi = {${w.DOI}}`,
  ].filter(Boolean)
  return `@${entryType}{${key},\n${lines.join(',\n')}\n}`
}
