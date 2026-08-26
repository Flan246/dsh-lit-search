//#region src/core/types.d.ts
interface Paper {
  doi: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  citationCount: number | null;
  source: 'crossref' | 'openalex';
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
//#endregion
export { Result as n, Paper as t };