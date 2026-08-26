import { n as Result } from "./types-MSVWJWp4.js";
import { Context } from "@deepseek-ai/cordis";

//#region src/plugin.d.ts
declare const name = "dsh-lit-search";
declare const inject: string[];
declare const asValue: <T>(r: Result<T>) => any;
declare function apply(ctx: Context): void;
//#endregion
export { apply, asValue, inject, name };