import { ProxyAgent, fetch } from "undici";

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
const UA = "dsh-lit-search/0.1.1 (mailto:lit-search@users.noreply.github.com)";
const TIMEOUT_MS = 1e4;
const CACHE_TTL_MS = 5 * 6e4;
const CACHE_MAX = 200;
const CACHE_EVICT_BATCH = 20;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cache = /* @__PURE__ */ new Map();
function proxyUrl() {
	return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || void 0;
}
let pooledAgent = null;
function getDispatcher() {
	const url = proxyUrl();
	if (!url) {
		pooledAgent = null;
		return;
	}
	if (pooledAgent && pooledAgent.url === url) return pooledAgent.agent;
	const agent = new ProxyAgent(url);
	pooledAgent = {
		url,
		agent
	};
	return agent;
}
function cacheSet(url, data) {
	if (cache.size >= CACHE_MAX) {
		let n = 0;
		for (const key of cache.keys()) {
			cache.delete(key);
			if (++n >= CACHE_EVICT_BATCH) break;
		}
	}
	cache.set(url, {
		data,
		expiry: Date.now() + CACHE_TTL_MS
	});
}
async function fetchJson(url) {
	const hit = cache.get(url);
	if (hit && hit.expiry > Date.now()) return ok(hit.data);
	let dispatcher;
	try {
		dispatcher = getDispatcher();
	} catch (e) {
		return err("NETWORK", e instanceof Error ? e.message : String(e));
	}
	let lastErr = null;
	for (let attempt = 0; attempt < 2; attempt++) try {
		const init = {
			headers: {
				"User-Agent": UA,
				Accept: "application/json"
			},
			signal: AbortSignal.timeout(TIMEOUT_MS)
		};
		if (dispatcher) init.dispatcher = dispatcher;
		const res = await fetch(url, init);
		if (res.status === 404) return err("NOT_FOUND", `404: ${url}`);
		if (res.status === 429) {
			if (attempt === 0) {
				try {
					await res.body?.dump?.();
				} catch {}
				const ra = res.headers.get("retry-after");
				let waitSec = 1;
				if (ra !== null) {
					const parsed = Number(ra);
					if (Number.isFinite(parsed) && parsed >= 0) waitSec = parsed;
				}
				await sleep(waitSec * 1e3);
				continue;
			}
			return err("RATE_LIMITED", `429: ${url}`);
		}
		if (!res.ok) {
			lastErr = err("HTTP_" + res.status, `${res.status}: ${url}`);
			continue;
		}
		const data = await res.json();
		cacheSet(url, data);
		return ok(data);
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
	if (!cr.ok && !oa.ok) return err("ALL_SOURCES_FAILED", "both Crossref and OpenAlex are unavailable");
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
	return `${authors ? `${authors}. ` : ""}${w.title?.[0] ?? ""}[${mark}]. ${tail}.`;
}
function apa(w) {
	const ns = names(w);
	const fmt = (n) => [n.family, n.given.split(/\s+/).filter(Boolean).map((s) => s[0] + ".").join(" ")].filter(Boolean).join(", ");
	const head = ns.slice(0, 3).map(fmt).filter(Boolean).join(", ");
	const authors = ns.length > 3 ? `${head}, et al.` : head;
	const year = w.published?.["date-parts"]?.[0]?.[0] ?? "n.d.";
	const venue = w["container-title"]?.[0] ?? w.publisher ?? "";
	return `${authors ? `${authors} ` : ""}(${year}). ${w.title?.[0] ?? ""}. ${venue}. https://doi.org/${w.DOI}`;
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
//#region src/core/format.ts
function formatPapers(papers) {
	if (papers.length === 0) return "No papers found.";
	return papers.map((p, i) => `${i + 1}. ${p.title} (${p.year ?? "n.d."}) — ${p.authors.slice(0, 3).join(", ")}${p.venue ? ` [${p.venue}]` : ""}\n   doi:${p.doi} cited:${p.citationCount ?? "-"}`).join("\n");
}

//#endregion
export { searchPapers as a, citePaper as i, relatedPapers as n, bibEntries as r, formatPapers as t };