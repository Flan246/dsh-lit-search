//#region src/core/types.d.ts
interface Paper {
  doi: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  citationCount: number | null;
  source: 'crossref' | 'openalex' | 'semanticscholar';
  url: string | null;
}
type Result<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};
declare function ok<T>(data: T): Result<T>;
declare function err<T>(code: string, message: string): Result<T>;
//#endregion
//#region src/core/format.d.ts
declare function formatPapers(papers: Paper[]): string;
//#endregion
export { ok as a, err as i, Paper as n, Result as r, formatPapers as t };