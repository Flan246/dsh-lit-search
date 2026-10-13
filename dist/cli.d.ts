#!/usr/bin/env node
import { t as formatPapers } from "./format-GmR7gYjh.js";
import { Command } from "commander";

//#region src/cli.d.ts
declare const program: Command;
declare const CITE_STYLES: string[];
//#endregion
export { CITE_STYLES, formatPapers, program };