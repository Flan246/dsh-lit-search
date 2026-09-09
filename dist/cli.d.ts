#!/usr/bin/env node
import { Command } from "commander";

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
//#endregion
//#region src/core/format.d.ts
declare function formatPapers(papers: Paper[]): string;
//#endregion
//#region src/cli.d.ts
declare const program: Command;
declare const CITE_STYLES: string[];
//#endregion
export { CITE_STYLES, formatPapers, program };