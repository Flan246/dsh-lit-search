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
  let w: any
  if (r.ok) {
    w = (r.data as any).message
  } else {
    // Crossref does not index arXiv's DataCite DOIs (10.48550/arxiv.*);
    // OpenAlex does, so fall back to it on any Crossref failure.
    const oa = await fj(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`)
    if (!oa.ok) return oa
    w = fromOpenAlexWork(oa.data)
  }
  if (style === 'gbt7714') return ok(gbt7714(w))
  if (style === 'apa') return ok(apa(w))
  return ok(bibtex(w))
}

// Normalize an OpenAlex work into a Crossref-message-like shape so the
// formatters below can be reused. Differences handled here: `doi` is a full
// URL, authors only carry `display_name` ("given family" order — last word
// becomes family), year is `publication_year`, and the venue lives at
// `primary_location.source.display_name`. Works without a venue are pure
// preprints and are marked `posted-content` so formatters emit the
// [EB/OL] / @misc-preprint variants.
// Preprint repositories as listed by OpenAlex `source.display_name` —
// repositories, not journal venues, so works from them keep the preprint
// form ([EB/OL] / @misc). Matched as lowercase prefixes.
const PREPRINT_SERVERS = [
  'arxiv',
  'biorxiv',
  'medrxiv',
  'ssrn',
  'chemrxiv',
  'research square',
  'preprints.org',
  'techrxiv',
]

// Returns the canonical server label for bibtex `howpublished` when the
// OpenAlex source is a known preprint repository, else null. arXiv gets a
// fixed label since OpenAlex names it "arXiv (Cornell University)"; other
// servers keep their display_name casing.
function preprintServer(rawVenue: string): string | null {
  const v = rawVenue.trim()
  if (!v) return null
  const hit = PREPRINT_SERVERS.find((p) => v.toLowerCase().startsWith(p))
  if (!hit) return null
  return hit === 'arxiv' ? 'arXiv' : v
}

export function fromOpenAlexWork(w: any): any {
  const rawVenue = w.primary_location?.source?.display_name ?? ''
  const server = preprintServer(rawVenue)
  const venue = server ? '' : rawVenue
  return {
    DOI: String(w.doi ?? '').replace(/^https?:\/\/doi\.org\//i, ''),
    title: [w.title ?? ''],
    author: (w.authorships ?? []).map((a: any) => {
      const parts = String(a.author?.display_name ?? '').trim().split(/\s+/).filter(Boolean)
      return { family: parts.pop() ?? '', given: parts.join(' ') }
    }),
    published: { 'date-parts': [[w.publication_year ?? '']] },
    'container-title': venue ? [venue] : undefined,
    type: venue ? 'journal-article' : 'posted-content',
    'preprint-server': server ?? undefined,
  }
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
  const venue = w['container-title']?.[0] ?? w.publisher ?? ''
  const year = w.published?.['date-parts']?.[0]?.[0] ?? ''
  if (w.type === 'posted-content' && !venue) {
    // Pure preprint: GB/T 7714 electronic-resource form.
    const y = year ? ` (${year}).` : ''
    return `${authors ? `${authors}. ` : ''}${w.title?.[0] ?? ''}[EB/OL].${y} https://doi.org/${w.DOI}.`
  }
  const mark = TYPE_MAP[w.type] ?? 'J'
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
  return [
    `${authors ? `${authors} ` : ''}(${year}). ${w.title?.[0] ?? ''}.`,
    venue ? `${venue}.` : '',
    `https://doi.org/${w.DOI}`,
  ].filter(Boolean).join(' ')
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
    w.type === 'posted-content' && !w['container-title']?.[0]
      ? `  howpublished = {${w['preprint-server'] ?? 'arXiv'} preprint}` : null,
    `  doi = {${w.DOI}}`,
  ].filter(Boolean)
  return `@${entryType}{${key},\n${lines.join(',\n')}\n}`
}
