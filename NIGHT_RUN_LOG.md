# Night Run Log — 2026-06-30 → 2026-07-01

## Start State
- Branch: `feature/tz-analyzer`
- Last commit: `3bff1f8 feat(tz-analyzer): hierarchical building schema with sub_buildings`
- Build: ✅ green (4.99MB bundle, chunk-size warning only — cosmetic, no action needed)
- Lint: ❌ 20 errors, 4 warnings across 6 files
- Tests: ❌ none (no test runner installed)

---

## Iteration 1 — Lint fixes: TZ Analyzer files + platform-wide safe items
**Files:** `chunkText.js`, `docParser.js`, `useTZStore.js`, `TZAnalyzer.jsx`,
`BTIRecognizer.jsx`, `Dashboard.jsx`, `FloorPlan.jsx`, `ScheduleEK.jsx`, `SystemsList.jsx`

### Fixed
| File | Rule | Fix |
|------|------|-----|
| `chunkText.js:4` | no-useless-escape | removed `\` before `«` in regex |
| `docParser.js:13` | no-useless-assignment | `let text = ''` → `let text` (initial value never read) |
| `useTZStore.js:46` | no-unused-vars | removed unused `get` param from `create((set, get)...)` |
| `TZAnalyzer.jsx:26` | no-unused-vars | removed `const future = stage < s.n` (never read) |
| `TZAnalyzer.jsx:182` | no-unused-vars | removed `const isRunning = stageStatus === 'running'` (never read) |
| `TZAnalyzer.jsx:120` | react-hooks/exhaustive-deps | added `loadFromDB` to `useEffect` deps |
| `BTIRecognizer.jsx:1` | no-unused-vars | removed `useMemo` from React import |
| `Dashboard.jsx:3` | no-unused-vars | removed `BarChart, Bar, XAxis, YAxis` from recharts import |
| `FloorPlan.jsx:24` | no-unused-vars | `const [tooltip, setTooltip]` → `const [, setTooltip]` |
| `ScheduleEK.jsx:116` | no-unused-vars | removed `const sys = SYSTEMS[row.system]` (never read) |
| `SystemsList.jsx:117,237,247` | no-empty | added `/* no-op */` to 3 intentional empty catch blocks |

**Result:** 20 → 5 errors remaining (all denylist — see below)

---

## Iteration 2 — Test infrastructure + unit tests
**New files:** `vitest`, `@testing-library/react`, `jsdom` installed; `vite.config.js` wired;
`src/test/setup.js`, `src/test/fixtures/stage1Responses.js` created.

### Tests written
| File | Tests | Coverage |
|------|-------|----------|
| `chunkText.test.js` | 7 | heading split, size split, РАЗДЕЛ keyword, content preservation, custom maxChars |
| `docParser.test.js` | 12 | TXT, DOCX, PDF (pages + empty-page warning), XLSX (multi-sheet, empty sheet, single-sheet), unsupported formats |
| `tzPipeline.test.js` | 10 | single batch, two-batch dedup, progress callback, malformed JSON recovery, empty candidates, empty API response, field normalization, id reassignment, sub_buildings filter |

**Result:** 29/29 tests passing

---

## Iteration 3 — Defensive fixes + store tests
**Files:** `tzPipeline.js`, `useTZStore.test.js`

### Fixed
- `tzPipeline.js` callClaude: `data.content[0].text` → `data.content?.[0]?.text` with explicit EMPTY_RESPONSE error code (caught silently by per-batch try-catch)
- `tzPipeline.js` sub_buildings filter: `filter(Boolean)` → `filter(s => typeof s === 'string' && s.trim())` — now also strips whitespace-only strings like `'   '`
- Fixed test import: `beforeAll` → removed (wasn't used); `global.fetch` → `vi.stubGlobal('fetch', ...)`

### New tests
- Store: 9 state machine tests (setStage transitions, setParseWarnings, updateBuilding patch/miss, reset, pendingFile lifecycle, loadFromDB no-op)
- Pipeline: 2 new tests (empty chunks, EMPTY_RESPONSE guard)

**Result:** 40/40 tests passing

---

## Iteration 4 — Bug fixes: TZ drop routing + BIMViewer hooks order
**Files:** `App.jsx`, `BIMViewer.jsx`

### Bug 1: TZ file drop routing (App.jsx)
**Symptom:** Dropping a .docx/.xlsx/.pdf file while on any section OTHER than `tz-analysis` silently ignored the file. Only IFC files auto-switched sections.
**Root cause:** `onGlobalDrop` guarded TZ routing with `activeSection === 'tz-analysis'` — but when you're on another section, this condition is false.
**Fix:** Removed section guard, added `setActiveSection('tz-analysis')` alongside `setTzPendingFile(file)` to mirror the IFC→BIM pattern. BTI routing (building section + PDF/image) takes priority due to its earlier `else if` position.

### Bug 2: BIMViewer hooks order (BIMViewer.jsx)
**Symptom:** React Compiler flagged `applyFloorClip` as temporal dead zone — used in useEffect (line 317) before its `useCallback` definition (line 331). Two lint errors.
**Root cause:** `const applyFloorClip = useCallback(...)` declared AFTER the `useEffect` that references it.
**Fix:** Moved `applyFloorClip` useCallback definition before the mode-switch useEffect; added `applyFloorClip` and `floorLevel` to that effect's deps.

**Lint result after:** 20 → 3 errors remaining (all denylist setState-in-effect)

---

## Final State (3 iterations + 4 bug fixes)
- Build: ✅ green
- Tests: 40/40 passing
- Lint: 3 errors (denylist — see report)
- Commits pushed to `origin/feature/tz-analyzer`:
  - `b1c216d` — test infrastructure + lint fixes
  - `56108de` — defensive API guard + store tests
  - `26251db` — drop routing bug + BIMViewer hooks fix

---

## Denylist items (not touched, deferred to report)
1. **BTIRecognizer.jsx:303** — `setBtiPendingFile(null)` inside effect (setState-in-effect)
2. **BuildingView.jsx:247** — `setShowBTI(true)` inside effect (setState-in-effect)
3. **SystemsList.jsx:258** — `parseSystems()` calling setState inside effect (setState-in-effect)
4. **TZAnalyzer.jsx:127** — missing `clearTzPendingFile`/`handleFile` in useEffect deps (needs useCallback refactor of handleFile)
5. **Race condition: loadFromDB vs handleFile on fresh mount** — benign in practice but documented
