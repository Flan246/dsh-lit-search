---
name: dsh-lit-search
description: Search academic papers and format citations (GB/T 7714 / APA / BibTeX) via Crossref and OpenAlex. Use when the user asks to find papers, verify references, or generate .bib entries.
---

# Literature Search

Run the bundled CLI (installed as `dsh-lit-search`, or `npx dsh-lit-search`):

- `dsh-lit-search [--json] search "<keywords>" [-n 10]` — merged Crossref+OpenAlex search
- `dsh-lit-search [--json] cite <doi> [-s gbt7714|apa|bibtex]` — format one citation
- `dsh-lit-search [--json] bib <doi1> <doi2> ...` — batch BibTeX entries
- `dsh-lit-search [--json] related <doi> [-n 10]` — related works via OpenAlex

All commands print human-readable text by default; pass `--json` (before the
subcommand, e.g. `dsh-lit-search --json search "<keywords>"`) for machine
output. Prefer `--json` when chaining results into files. GB/T 7714 is the
right default for Chinese-language theses.
