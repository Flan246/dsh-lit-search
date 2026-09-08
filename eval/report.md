# dsh-eval 报告

- 开始时间：2026-09-08T07:29:37.686Z
- 通过：4/4

| 场景 | 状态 | 耗时 | 断言通过 |
|---|---|---|---|
| 文献调研串联（MoE） | passed | 251s | 3/3 |
| DOI 取 BibTeX 条目 | passed | 11s | 3/3 |
| 相关工作推荐 | passed | 76s | 2/2 |
| GB/T 7714 引用生成 | passed | 11s | 3/3 |

## 文献调研串联（MoE）

| 断言 | 结果 | 证据 |
|---|---|---|
| {"kind":"tool_called","tool":"lit_search"} | ✓ | called with {"query": "Mixture of Experts large language model", "limit": 10} |
| {"kind":"tool_called","tool":"lit_cite"} | ✓ | called with {"doi": "10.48550/arxiv.2412.19437", "style": "gbt7714"} |
| {"kind":"output_matches","pattern":"\\[(J|C|EB/OL)\\]"} | ✓ | matched /\[(J|C|EB/OL)\]/ |

## DOI 取 BibTeX 条目

| 断言 | 结果 | 证据 |
|---|---|---|
| {"kind":"tool_called","tool":"lit_bib"} | ✓ | called with {"dois": ["10.1162/neco.1991.3.1.79"]} |
| {"kind":"tool_args_contains","tool":"lit_bib","substr":"10.1162/neco.1991.3.1.79"} | ✓ | {"dois": ["10.1162/neco.1991.3.1.79"]} |
| {"kind":"output_matches","pattern":"@[a-zA-Z]+\\s*\\{"} | ✓ | matched /@[a-zA-Z]+\s*\{/ |

## 相关工作推荐

| 断言 | 结果 | 证据 |
|---|---|---|
| {"kind":"tool_called","tool":"lit_related"} | ✓ | called with {"dois": ["10.1038/nature14539"]} |
| {"kind":"output_matches","pattern":"(19|20)[0-9]{2}"} | ✓ | matched /(19|20)[0-9]{2}/ |

## GB/T 7714 引用生成

| 断言 | 结果 | 证据 |
|---|---|---|
| {"kind":"tool_called","tool":"lit_cite"} | ✓ | called with {"doi": "10.1038/nature14539", "style": "gbt7714"} |
| {"kind":"tool_args_contains","tool":"lit_cite","substr":"gbt7714"} | ✓ | {"doi": "10.1038/nature14539", "style": "gbt7714"} |
| {"kind":"output_matches","pattern":"\\[J\\]"} | ✓ | matched /\[J\]/ |
