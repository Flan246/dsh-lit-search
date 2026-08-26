#!/usr/bin/env node
import { a as searchPapers, i as citePaper, n as relatedPapers, r as bibEntries, t as formatPapers } from "./format-C-b84ykX.js";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "commander";

//#region src/cli.ts
function print(r, asJson, render) {
	if (!r.ok) {
		console.error(`error[${r.error.code}]: ${r.error.message}`);
		process.exitCode = 1;
		return;
	}
	console.log(asJson ? JSON.stringify(r.data, null, 2) : render(r.data));
}
const program = new Command();
program.name("dsh-lit-search").description("Literature search & citation tools (Crossref + OpenAlex)").option("--json", "print machine-readable JSON", false);
program.command("search").argument("<query>").option("-n, --limit <n>", "max results", "10").action(async (query, o) => {
	print(await searchPapers(query, { limit: Number(o.limit) }), program.opts().json, formatPapers);
});
program.command("cite").argument("<doi>").option("-s, --style <style>", "gbt7714|apa|bibtex", "gbt7714").action(async (doi, o) => {
	const style = o.style;
	if (![
		"gbt7714",
		"apa",
		"bibtex"
	].includes(style)) {
		console.error(`unknown style: ${o.style}`);
		process.exitCode = 2;
		return;
	}
	print(await citePaper(doi, style), program.opts().json, (s) => s);
});
program.command("bib").argument("<dois...>").action(async (dois) => {
	print(await bibEntries(dois), program.opts().json, (d) => d.entries + (d.missing.length ? `\n-- missing: ${d.missing.join(", ")}` : ""));
});
program.command("related").argument("<doi>").option("-n, --limit <n>", "max results", "10").action(async (doi, o) => {
	print(await relatedPapers(doi, { limit: Number(o.limit) }), program.opts().json, formatPapers);
});
function isMain() {
	if (!process.argv[1]) return false;
	try {
		return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
	} catch {
		return import.meta.url === pathToFileURL(process.argv[1]).href;
	}
}
if (isMain()) program.parseAsync();

//#endregion
export { formatPapers, program };