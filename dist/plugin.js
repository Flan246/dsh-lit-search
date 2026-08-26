import { a as searchPapers, i as citePaper, n as relatedPapers, r as bibEntries, t as formatPapers } from "./format-DxtU5XcV.js";
import { defineTool } from "@deepseek-ai/dsh-tools";

//#region src/plugin.ts
const name = "dsh-lit-search";
const inject = ["tools"];
const asValue = (r) => {
	if (!r.ok) throw new Error(r.error.message);
	return r.data;
};
const paperLines = (papers) => [{
	type: "text",
	text: formatPapers(papers)
}];
function apply(ctx) {
	ctx.tools.register(defineTool({
		name: "lit_search",
		description: "Search academic papers on Crossref and OpenAlex by keyword. Returns merged, deduplicated results with DOI and citation counts.",
		parameters: {
			query: {
				type: "string",
				required: true,
				description: "Search keywords"
			},
			limit: {
				type: "number",
				description: "Max results (default 10)"
			}
		},
		output: {
			schema: { type: "array" },
			render: (_args, v) => paperLines(v)
		},
		async execute(args) {
			return asValue(await searchPapers(args.query, { limit: args.limit }));
		}
	}));
	ctx.tools.register(defineTool({
		name: "lit_cite",
		description: "Format a citation for a DOI. Styles: gbt7714 (Chinese standard), apa, bibtex.",
		parameters: {
			doi: {
				type: "string",
				required: true,
				description: "Paper DOI"
			},
			style: {
				type: "string",
				description: "gbt7714 | apa | bibtex (default gbt7714)"
			}
		},
		output: {
			schema: { type: "string" },
			render: (_args, v) => [{
				type: "text",
				text: String(v)
			}]
		},
		async execute(args) {
			return asValue(await citePaper(args.doi, args.style ?? "gbt7714"));
		}
	}));
	ctx.tools.register(defineTool({
		name: "lit_bib",
		description: "Generate BibTeX entries for a list of DOIs. Returns combined .bib content and the list of DOIs that failed.",
		parameters: { dois: {
			type: "array",
			required: true,
			description: "Array of DOI strings"
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, v) => [{
				type: "text",
				text: v.entries
			}]
		},
		async execute(args) {
			return asValue(await bibEntries(args.dois));
		}
	}));
	ctx.tools.register(defineTool({
		name: "lit_related",
		description: "Find related papers for a DOI via OpenAlex related_works.",
		parameters: {
			doi: {
				type: "string",
				required: true,
				description: "Paper DOI"
			},
			limit: {
				type: "number",
				description: "Max results (default 10)"
			}
		},
		output: {
			schema: { type: "array" },
			render: (_args, v) => paperLines(v)
		},
		async execute(args) {
			return asValue(await relatedPapers(args.doi, { limit: args.limit }));
		}
	}));
}

//#endregion
export { apply, inject, name };