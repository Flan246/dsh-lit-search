# dsh-lit-search

Academic literature search, citation and BibTeX tools for DeepSeek Harness and
any agent. One package, three forms: dsh Cordis plugin, standalone CLI, and an
agent skill.

## Features

- **Merged search** — keyword search across Crossref and OpenAlex, deduplicated
  by DOI, with title/authors/year/venue/citation counts.
- **Citation formatting** — GB/T 7714 (default, for Chinese theses), APA, BibTeX.
- **Batch BibTeX** — generate a combined `.bib` for a list of DOIs, with the
  failed DOIs reported separately.
- **Related works** — related papers for a DOI via OpenAlex `related_works`.

## Usage

### 1. dsh plugin

```bash
dsh plugin add dsh-lit-search
```

Registers four agent tools: `lit_search`, `lit_cite`, `lit_bib`, `lit_related`.

### 2. Standalone CLI

```bash
npx dsh-lit-search search "attention is all you need" -n 5
npx dsh-lit-search cite 10.1038/nature14539 -s bibtex
npx dsh-lit-search bib 10.1038/nature14539 10.48550/arXiv.1706.03762
npx dsh-lit-search related 10.1038/nature14539 -n 5
```

All commands print human-readable text by default; pass `--json` before the
subcommand (e.g. `npx dsh-lit-search --json search "transformers"`) for
machine output. Exit codes: `0` success, `1` business error, `2` usage error.

### 3. Agent skill

Copy `skill/` into `~/.agents/skills/dsh-lit-search/` (or your agent's skill
directory). The skill tells the agent to run the CLI above.

## Data sources

- [Crossref](https://www.crossref.org/) — DOI metadata and works search.
- [OpenAlex](https://openalex.org/) — works search, citation counts, related works.

Both are free public APIs; no API key required. HTTP goes through a single
layer with a 10s timeout, one retry on 5xx/network errors, and a polite
`mailto:` User-Agent.

## License

MIT
