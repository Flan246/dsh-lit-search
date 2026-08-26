import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { searchPapers } from './core/search.js'
import { citePaper } from './core/cite.js'
import { bibEntries } from './core/bib.js'
import { relatedPapers } from './core/related.js'
import { formatPapers } from './core/format.js'
import type { Paper, Result } from './core/types.js'

export const name = 'dsh-lit-search'
export const inject = ['tools']

// dsh-tools 的 execute 返回类型为 Record<string, JsonValue>，而 lit_* 工具
// 按约定直接返回 JSON 值（数组/字符串/对象），故此处返回 any。
// 业务失败按官方契约（adding-a-tool.md: throw for infrastructure failures）
// 直接 throw：注册表捕获后走正常 error-result 路径，真实 message 带给 agent，
// 且不与 output.schema 的 array/string 根类型冲突。
const asValue = <T,>(r: Result<T>): any => {
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}

const paperLines = (papers: Paper[]) => [{ type: 'text' as const, text: formatPapers(papers) }]

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'lit_search',
    description: 'Search academic papers on Crossref and OpenAlex by keyword. Returns merged, deduplicated results with DOI and citation counts.',
    parameters: {
      query: { type: 'string', required: true, description: 'Search keywords' },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
    output: {
      schema: { type: 'array' },
      render: (_args, v: any) => paperLines(v as Paper[]),
    },
    async execute(args) {
      return asValue(await searchPapers(args.query, { limit: args.limit }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'lit_cite',
    description: 'Format a citation for a DOI. Styles: gbt7714 (Chinese standard), apa, bibtex.',
    parameters: {
      doi: { type: 'string', required: true, description: 'Paper DOI' },
      style: { type: 'string', description: 'gbt7714 | apa | bibtex (default gbt7714)' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, v: any) => [{ type: 'text', text: String(v) }],
    },
    async execute(args) {
      return asValue(await citePaper(args.doi, (args.style ?? 'gbt7714') as any))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'lit_bib',
    description: 'Generate BibTeX entries for a list of DOIs. Returns combined .bib content and the list of DOIs that failed.',
    parameters: {
      dois: { type: 'array', required: true, description: 'Array of DOI strings' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, v: any) => [{ type: 'text', text: v.entries }],
    },
    async execute(args) {
      return asValue(await bibEntries(args.dois as string[]))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'lit_related',
    description: 'Find related papers for a DOI via OpenAlex related_works.',
    parameters: {
      doi: { type: 'string', required: true, description: 'Paper DOI' },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
    output: {
      schema: { type: 'array' },
      render: (_args, v: any) => paperLines(v as Paper[]),
    },
    async execute(args) {
      return asValue(await relatedPapers(args.doi, { limit: args.limit }))
    },
  }))
}
