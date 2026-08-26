import { Context } from "@deepseek-ai/cordis";

//#region src/plugin.d.ts
declare const name = "dsh-lit-search";
declare const inject: string[];
declare function apply(ctx: Context): void;
//#endregion
export { apply, inject, name };