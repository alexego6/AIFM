# Night Run Log — 2026-06-30

## Start State
- Branch: `feature/tz-analyzer`
- Last commit: `3bff1f8 feat(tz-analyzer): hierarchical building schema with sub_buildings`
- Build: ✅ green (4.99MB bundle, chunk-size warning only)
- Lint: ❌ 20 errors, 4 warnings across 6 files
- Tests: ❌ none (vitest not installed)

---

## Iteration 1 — Lint fix: TZ Analyzer + services + store
**Time**: start of session

### Problems found
| File | Line | Rule | Description |
|------|------|------|-------------|
| `chunkText.js` | 4 | no-useless-escape | `\«` in regex — `«` needs no escaping |
| `docParser.js` | 13 | no-useless-assignment | `let text = ''` initial value never read (always overwritten) |
| `useTZStore.js` | 46 | no-unused-vars | `get` param in `create((set, get) => ...)` never used |
| `TZAnalyzer.jsx` | 26 | no-unused-vars | `const future = stage < s.n` — variable never read |
| `TZAnalyzer.jsx` | 182 | no-unused-vars | `const isRunning = stageStatus === 'running'` — never used |
| `TZAnalyzer.jsx` | 120 | react-hooks/exhaustive-deps | missing `loadFromDB` in dep array (warning) |

### Action
Fix all 5 errors + 1 warning in TZ Analyzer / services / store (allowlist).

---

## Iteration 2 — Lint fix: other platform components (safe subset)
TBD

## Iteration 3 — Test infrastructure: install vitest, write fixtures + unit tests
TBD

## Iteration 4+ — Test runs, fixes
TBD
