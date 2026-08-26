import type { Paper } from './types.js'

export function formatPapers(papers: Paper[]): string {
  if (papers.length === 0) return 'No papers found.'
  return papers.map((p, i) =>
    `${i + 1}. ${p.title} (${p.year ?? 'n.d.'}) — ${p.authors.slice(0, 3).join(', ')}` +
    `${p.venue ? ` [${p.venue}]` : ''}\n   doi:${p.doi} cited:${p.citationCount ?? '-'}`,
  ).join('\n')
}
