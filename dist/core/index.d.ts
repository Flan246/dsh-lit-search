import { a as ok, i as err, n as Paper, r as Result, t as formatPapers } from "../format-GmR7gYjh.js";

//#region src/core/http.d.ts
declare function fetchJson(url: string): Promise<Result<unknown>>;
//#endregion
//#region src/core/search.d.ts
interface SearchOptions {
  limit?: number;
  yearFrom?: number;
  yearTo?: number;
  sort?: 'relevance' | 'citations' | 'date';
}
interface Deps$3 {
  fetchJson?: typeof fetchJson;
}
declare function searchPapers(query: string, opts?: SearchOptions, deps?: Deps$3): Promise<Result<Paper[]>>;
//#endregion
//#region src/core/cite.d.ts
type CiteStyle = 'gbt7714' | 'gbt7714-numeric' | 'apa' | 'bibtex';
interface Deps$2 {
  fetchJson?: typeof fetchJson;
}
declare function citePaper(doi: string, style: CiteStyle, deps?: Deps$2): Promise<Result<string>>;
//#endregion
//#region src/core/bib.d.ts
interface Deps$1 {
  fetchJson?: typeof fetchJson;
}
declare function bibEntries(dois: string[], deps?: Deps$1): Promise<Result<{
  entries: string;
  missing: string[];
}>>;
//#endregion
//#region src/core/related.d.ts
interface Deps {
  fetchJson?: typeof fetchJson;
}
declare function relatedPapers(doi: string, opts?: {
  limit?: number;
}, deps?: Deps): Promise<Result<Paper[]>>;
//#endregion
export { type CiteStyle, type Paper, type Result, type SearchOptions, bibEntries, citePaper, err, formatPapers, ok, relatedPapers, searchPapers };