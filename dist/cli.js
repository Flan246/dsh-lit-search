#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { Command } from "commander";

//#region src/core/types.ts
function ok(data) {
	return {
		ok: true,
		data
	};
}
function err(code, message) {
	return {
		ok: false,
		error: {
			code,
			message
		}
	};
}

//#endregion
//#region src/core/http.ts
const UA = "dsh-lit-search/0.1.0 (mailto:lit-search@users.noreply.github.com)";
const TIMEOUT_MS = 1e4;
async function fetchJson(url) {
	let lastErr = null;
	for (let attempt = 0; attempt < 2; attempt++) try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": UA,
				Accept: "application/json"
			},
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (res.status === 404) return err("NOT_FOUND", `404: ${url}`);
		if (res.status === 429) return err("RATE_LIMITED", `429: ${url}`);
		if (!res.ok) {
			lastErr = err("HTTP_" + res.status, `${res.status}: ${url}`);
			continue;
		}
		return ok(await res.json());
	} catch (e) {
		lastErr = err("NETWORK", e instanceof Error ? e.message : String(e));
	}
	return lastErr ?? err("NETWORK", "unreachable");
}

//#endregion
//#region src/core/search.ts
async function searchPapers(query, opts = {}, deps = {}) {
	const limit = opts.limit ?? 10;
	const fj = deps.fetchJson ?? fetchJson;
	const q = encodeURIComponent(query);
	const [cr, oa] = await Promise.all([fj(`https://api.crossref.org/works?query=${q}&rows=${limit}&select=DOI,title,author,published,container-title,is-referenced-by-count,URL`), fj(`https://api.openalex.org/works?search=${q}&per-page=${limit}`)]);
	const byDoi = /* @__PURE__ */ new Map();
	if (cr.ok) for (const p of fromCrossref(cr.data)) byDoi.set(p.doi, p);
	if (oa.ok) {
		for (const p of fromOpenAlex(oa.data)) if (!byDoi.has(p.doi)) byDoi.set(p.doi, p);
	}
	return ok([...byDoi.values()].sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0)).slice(0, limit));
}
function fromCrossref(data) {
	const items = data?.message?.items;
	if (!Array.isArray(items)) return [];
	return items.filter((w) => w?.DOI && w?.title?.[0]).map((w) => ({
		doi: String(w.DOI).toLowerCase(),
		title: String(w.title[0]),
		authors: (w.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(" ")),
		year: w.published?.["date-parts"]?.[0]?.[0] ?? null,
		venue: w["container-title"]?.[0] ?? null,
		citationCount: w["is-referenced-by-count"] ?? null,
		source: "crossref",
		url: w.URL ?? null
	}));
}
function fromOpenAlex(data) {
	const items = data?.results;
	if (!Array.isArray(items)) return [];
	return items.filter((w) => w?.doi && w?.title).map((w) => ({
		doi: String(w.doi).replace(/^https?:\/\/doi\.org\//i, "").toLowerCase(),
		title: String(w.title),
		authors: (w.authorships ?? []).map((a) => a?.author?.display_name).filter(Boolean),
		year: w.publication_year ?? null,
		venue: w.primary_location?.source?.display_name ?? null,
		citationCount: w.cited_by_count ?? null,
		source: "openalex",
		url: w.doi ?? null
	}));
}

//#endregion
//#region src/core/cite.ts
async function citePaper(doi, style, deps = {}) {
	const r = await (deps.fetchJson ?? fetchJson)(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
	if (!r.ok) return r;
	const w = r.data.message;
	if (style === "gbt7714") return ok(gbt7714(w));
	if (style === "apa") return ok(apa(w));
	return ok(bibtex(w));
}
const TYPE_MAP = {
	"journal-article": "J",
	"proceedings-article": "C",
	monograph: "M",
	dissertation: "D",
	"posted-content": "EB"
};
function names(w) {
	return (w.author ?? []).map((a) => ({
		family: a.family ?? "",
		given: a.given ?? ""
	}));
}
function gbt7714(w) {
	const ns = names(w);
	const head = ns.slice(0, 3).map((n) => `${n.family} ${n.given[0] ?? ""}`.trimEnd()).join(", ");
	const authors = ns.length > 3 ? `${head}, et al` : head;
	const mark = TYPE_MAP[w.type] ?? "J";
	const tail = [
		w["container-title"]?.[0] ?? w.publisher ?? "",
		w.published?.["date-parts"]?.[0]?.[0] ?? "",
		[w.volume, w.issue && `(${w.issue})`].filter(Boolean).join("")
	].filter(Boolean).join(", ");
	return `${authors}. ${w.title?.[0] ?? ""}[${mark}]. ${tail}.`;
}
function apa(w) {
	const ns = names(w);
	const fmt = (n) => `${n.family}, ${n.given.split(/\s+/).map((s) => s[0] + ".").join(" ")}`;
	const head = ns.slice(0, 3).map(fmt).join(", ");
	const authors = ns.length > 3 ? `${head}, et al.` : head;
	const year = w.published?.["date-parts"]?.[0]?.[0] ?? "n.d.";
	const venue = w["container-title"]?.[0] ?? w.publisher ?? "";
	return `${authors} (${year}). ${w.title?.[0] ?? ""}. ${venue}. https://doi.org/${w.DOI}`;
}
function bibtex(w) {
	const ns = names(w);
	const year = w.published?.["date-parts"]?.[0]?.[0] ?? "";
	const firstWord = String(w.title?.[0] ?? "untitled").split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
	const key = `${ns[0]?.family.toLowerCase() ?? "unknown"}${year}${firstWord}`;
	const entryType = w.type === "journal-article" ? "article" : w.type === "proceedings-article" ? "inproceedings" : "misc";
	return `@${entryType}{${key},\n${[
		`  author = {${ns.map((n) => `${n.family}, ${n.given}`.trimEnd()).join(" and ")}}`,
		`  title = {${w.title?.[0] ?? ""}}`,
		w["container-title"]?.[0] ? `  ${entryType === "article" ? "journal" : "booktitle"} = {${w["container-title"][0]}}` : null,
		year ? `  year = {${year}}` : null,
		w.volume ? `  volume = {${w.volume}}` : null,
		w.issue ? `  number = {${w.issue}}` : null,
		`  doi = {${w.DOI}}`
	].filter(Boolean).join(",\n")}\n}`;
}

//#endregion
//#region src/core/bib.ts
async function bibEntries(dois, deps = {}) {
	const parts = [];
	const missing = [];
	for (const doi of dois) {
		const r = await citePaper(doi, "bibtex", deps);
		if (r.ok) parts.push(r.data);
		else missing.push(doi);
	}
	return ok({
		entries: parts.join("\n\n") + (parts.length ? "\n" : ""),
		missing
	});
}

//#endregion
//#region src/core/related.ts
async function relatedPapers(doi, opts = {}, deps = {}) {
	const limit = opts.limit ?? 10;
	const fj = deps.fetchJson ?? fetchJson;
	const work = await fj(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`);
	if (!work.ok) return work;
	const slice = (work.data?.related_works ?? []).slice(0, limit);
	if (slice.length === 0) return ok([]);
	const filter = slice.map((id) => id.replace("https://openalex.org/", "")).join("|");
	const r = await fj(`https://api.openalex.org/works?filter=openalex_id:${encodeURIComponent(filter)}&per-page=${limit}`);
	if (!r.ok) return r;
	return ok((r.data?.results ?? []).filter((w) => w?.doi && w?.title).map((w) => ({
		doi: String(w.doi).replace(/^https?:\/\/doi\.org\//i, "").toLowerCase(),
		title: String(w.title),
		authors: (w.authorships ?? []).map((a) => a?.author?.display_name).filter(Boolean),
		year: w.publication_year ?? null,
		venue: w.primary_location?.source?.display_name ?? null,
		citationCount: w.cited_by_count ?? null,
		source: "openalex",
		url: w.doi ?? null
	})));
}

//#endregion
//#region src/cli.ts
function formatPapers(papers) {
	if (papers.length === 0) return "No papers found.";
	return papers.map((p, i) => `${i + 1}. ${p.title} (${p.year ?? "n.d."}) — ${p.authors.slice(0, 3).join(", ")}${p.venue ? ` [${p.venue}]` : ""}\n   doi:${p.doi} cited:${p.citationCount ?? "-"}`).join("\n");
}
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) program.parseAsync();

//#endregion
export { formatPapers };