import { useEffect, useState } from 'react'
import { useTZStore } from '../../store/useTZStore'
import { usePlatformStore } from '../../store/usePlatformStore'
import { parseFile, parseDocxHtml } from '../../services/docParser'
import { chunkByHeadings } from '../../services/chunkText'
import { runStage1, runStage2, detectSchedule, parseScheduleTables, runStage3 } from '../../services/tzPipeline'
import { parseSlaTables } from '../../services/slaParser'
import { calcAllStaffing } from '../../services/staffingHeuristic'
import { calcAllResources } from '../../services/resourcesHeuristic'
import { validateTZForApply, mapBuildings, mapSystemsData } from '../../services/platformAdapter'
import { useAppStore } from '../../store/useAppStore'
import TZUploadZone from './TZUploadZone'
import TZBuildingTabs from './TZBuildingTabs'
import TZSystemsView from './TZSystemsView'
import TZScheduleView from './TZScheduleView'
import TZStaffingView from './TZStaffingView'
import TZResourcesView from './TZResourcesView'

// ── Пайплайн-степпер ──────────────────────────────────────────────────────────
const STAGES = [
  { n: 0, label: 'Загрузка' },
  { n: 1, label: 'Объекты' },
  { n: 2, label: 'Системы' },
  { n: 3, label: 'Задачи' },
  { n: 4, label: 'График' },
  { n: 5, label: 'Ресурсы' },
  { n: 6, label: 'Интеграция' },
]

function PipelineStepper({ stage, status }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 4px' }}>
      {STAGES.map((s, i) => {
        const done = stage > s.n
        const active = stage === s.n

        const color = done ? '#059669' : active ? '#1D4ED8' : '#CBD5E1'
        const textColor = done ? '#059669' : active ? '#1D4ED8' : '#94A3B8'
        const bgColor = done ? '#ECFDF5' : active ? '#EEF2FF' : '#F8FAFC'

        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STAGES.length - 1 ? 1 : 'none' }}>
            {/* Dot + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 56 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: bgColor, border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color,
              }}>
                {done ? '✓' : s.n}
              </div>
              <div style={{ fontSize: 10, color: textColor, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>
                {s.label}
              </div>
              {active && status === 'running' && (
                <div style={{ fontSize: 9, color: '#1D4ED8', animation: 'pulse 1.2s infinite' }}>●●●</div>
              )}
            </div>
            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <div style={{
                flex: 1, height: 2,
                background: done ? '#059669' : '#E2E8F0',
                margin: '0 2px', marginBottom: 20,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Карточка предупреждений парсера ───────────────────────────────────────────
function ParseWarnings({ warnings }) {
  if (!warnings.length) return null
  return (
    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{ flex: 'none', marginTop: 1 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.55 }}>
        {warnings.map((w, i) => <div key={i}>{w}</div>)}
      </div>
    </div>
  )
}

// ── Кнопка «Запустить этап» ───────────────────────────────────────────────────
function RunButton({ label, onClick, disabled, running }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || running}
      style={{
        padding: '11px 28px', borderRadius: 10, border: 'none',
        background: disabled || running ? '#E2E8F0' : 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
        color: disabled || running ? '#94A3B8' : '#FFFFFF',
        fontSize: 14, fontWeight: 600, cursor: disabled || running ? 'not-allowed' : 'pointer',
        fontFamily: "'Golos Text',system-ui,sans-serif",
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      {running && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6-8.5"/>
        </svg>
      )}
      {running ? 'Анализирую…' : label}
    </button>
  )
}

// ── Основной компонент ────────────────────────────────────────────────────────
export default function TZAnalyzer() {
  const {
    fileName, fileSize, parseWarnings,
    chunks, stage, stageStatus, stageError,
    buildings, systems, staffingPlan, resourcesPlan,
    scheduleStatus, scheduleTableCount, scheduleTables, htmlContent,
    slaData,
    setFile, setChunks, setParseWarnings, setStage, setBuildings, setSystems,
    setHtmlContent, setScheduleStatus, setScheduleTables, setSlaData, confirmStage, setStaffingPlan, setResourcesPlan,
    reset, loadFromDB,
    tzPendingFile, clearTzPendingFile,
  } = useTZStore()

  const { applyFromTZ, applied: platformApplied, appliedAt } = usePlatformStore()
  const { setActiveSection } = useAppStore()

  const [parseError,     setParseError]     = useState(null)
  const [stage1Progress, setStage1Progress] = useState(null)
  const [stage2Progress, setStage2Progress] = useState(null)
  const [stage3Error,    setStage3Error]    = useState(null)
  const [applyRunning,   setApplyRunning]   = useState(false)

  useEffect(() => { loadFromDB() }, [loadFromDB])

  // Глобальный дроп маршрутизирует файл сюда
  useEffect(() => {
    if (tzPendingFile) {
      clearTzPendingFile()
      handleFile(tzPendingFile)
    }
  }, [tzPendingFile])

  // ── Загрузка файла (Этап 0) ─────────────────────────────────────────────────
  async function handleFile(file) {
    setParseError(null)
    setStage(0, 'running')
    try {
      // Parse text and HTML concurrently (HTML needed for Stage 3 schedule detection)
      const [{ text, warnings }, html] = await Promise.all([
        parseFile(file),
        parseDocxHtml(file),
      ])
      const ch = chunkByHeadings(text)
      await setChunks(ch)
      setParseWarnings(warnings)
      setFile(file.name, file.size)

      await setHtmlContent(html)
      if (html) {
        const { found, tableCount } = detectSchedule(html)
        await setScheduleStatus(found ? 'found' : 'not_found', tableCount)
        if (found) {
          // Parse schedule tables immediately and persist to IDB —
          // so Stage 3 works even after a page reload between Stage 0 and Stage 2 confirm.
          const tables = parseScheduleTables(html)
          await setScheduleTables(tables)
        }
        const slaResult = parseSlaTables(html)
        if (slaResult.detected) await setSlaData(slaResult)
      } else {
        await setScheduleStatus('not_found', 0)
      }

      setStage(0, 'done')
    } catch (err) {
      setParseError(err.message)
      setStage(0, 'error', err.message)
    }
  }

  // ── Этап 1: определение зданий ──────────────────────────────────────────────
  async function handleStage1() {
    setStage(1, 'running')
    setStage1Progress({ pct: 0, batch: 0, total: 0 })
    try {
      const result = await runStage1(chunks, (pct, batch, total) => {
        setStage1Progress({ pct, batch, total })
      })
      await setBuildings(result)
      setStage1Progress(null)
      setStage(1, 'checkpoint')
    } catch (err) {
      setStage1Progress(null)
      setStage(1, 'error', err.message)
    }
  }

  function confirmStage1() {
    setStage(1, 'done')
  }

  // ── Этап 2: инженерные системы ──────────────────────────────────────────────
  async function handleStage2() {
    setStage(2, 'running')
    setStage2Progress({ pct: 0, batch: 0, total: 0 })
    try {
      const result = await runStage2(buildings, chunks, (pct, batch, total) => {
        setStage2Progress({ pct, batch, total })
      }, { htmlContent })
      await setSystems(result)
      setStage2Progress(null)
      setStage(2, 'checkpoint')
    } catch (err) {
      setStage2Progress(null)
      setStage(2, 'error', err.message)
    }
  }

  async function confirmStage2() {
    // Use pre-parsed schedule tables (persisted in IDB, survives reload)
    if (scheduleTables?.length && scheduleStatus === 'found') {
      setStage3Error(null)
      setStage(3, 'running')
      try {
        const enriched = runStage3(systems, buildings, scheduleTables)
        await setSystems(enriched)
        await setScheduleStatus('merged', scheduleTableCount)
        setStage(3, 'done')
      } catch (err) {
        setStage3Error(err.message)
        setStage(3, 'error', err.message)
      }
    } else {
      // No schedule found (or not a DOCX) → stub
      setStage(3, 'no_schedule')
    }
  }

  // Stage 3 confirmed → advance to Stage 4 (show schedule matrix)
  function confirmStage3() {
    setStage(4, 'checkpoint')
  }

  // Stage 4 confirmed → persist to IDB and advance to Stage 4 done
  async function confirmStage4() {
    await confirmStage(4)
  }

  // Stage 5: compute staffing + resources deterministically (0 API) and show checkpoint
  function startStage5() {
    const staffing  = calcAllStaffing(buildings)
    const resources = calcAllResources(buildings, systems)
    setStaffingPlan(staffing)
    setResourcesPlan(resources)
    setStage(5, 'checkpoint')
  }

  // Stage 5 confirmed → persist to IDB
  async function confirmStage5() {
    await confirmStage(5)
  }

  // Пересчитать если ресурсы пустые или в устаревшей схеме (zip → spareParts)
  useEffect(() => {
    if (stage === 5 && stageStatus === 'done' && buildings.length && systems.length) {
      const stale = !resourcesPlan.length || !resourcesPlan[0]?.spareParts
      if (stale) setResourcesPlan(calcAllResources(buildings, systems))
    }
  }, [stage, stageStatus, buildings.length, systems.length, resourcesPlan.length])

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!chunks.length && stageStatus !== 'running') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC', overflow: 'hidden' }}>
        {parseError && (
          <div style={{ margin: '16px 24px 0', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#B91C1C' }}>
            {parseError}
          </div>
        )}
        <TZUploadZone onFile={handleFile} />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC', overflow: 'hidden' }}>
      {/* Хедер */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="1.8">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M8 13h8M8 17h5"/>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
          </div>
          {fileSize && (
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              {(fileSize / 1024).toFixed(0)} КБ · {chunks.length} чанк{chunks.length === 1 ? '' : chunks.length < 5 ? 'а' : 'ов'}
            </div>
          )}
        </div>
        <button
          onClick={reset}
          style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#64748B', cursor: 'pointer', fontFamily: "'Golos Text',system-ui,sans-serif" }}
        >
          Загрузить другой
        </button>
      </div>

      {/* Степпер */}
      <div style={{ background: '#FFFFFF', padding: '16px 24px 10px', borderBottom: '1px solid #E2E8F0', flex: 'none' }}>
        <PipelineStepper stage={stage} status={stageStatus} />
      </div>

      {/* Контент */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ParseWarnings warnings={parseWarnings} />

        {/* Этап 0 — файл загружен */}
        {stage === 0 && stageStatus === 'done' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>Документ загружен</div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
              Документ разбит на {chunks.length} фрагмент{chunks.length === 1 ? '' : chunks.length < 5 ? 'а' : 'ов'} для анализа.
              Запустите Этап 1 чтобы определить здания/объекты.
            </div>
            <RunButton label="Определить здания (Этап 1)" onClick={handleStage1} disabled={false} running={false} />
          </div>
        )}

        {/* Этап 1 — выполняется */}
        {stage === 1 && stageStatus === 'running' && (
          <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: stage1Progress?.total > 1 ? 12 : 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2.2" style={{ animation: 'spin 1s linear infinite', flex: 'none' }}>
                <path d="M21 12a9 9 0 1 1-6-8.5"/>
              </svg>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1E40AF' }}>Анализирую ТЗ…</div>
                <div style={{ fontSize: 12, color: '#3730A3', marginTop: 2 }}>
                  {stage1Progress?.total > 1
                    ? stage1Progress.batch === stage1Progress.total
                      ? 'Консолидация и дедупликация объектов…'
                      : `Сканирую фрагмент ${stage1Progress.batch} из ${stage1Progress.total - 1}`
                    : 'Извлекаю здания и объекты из документа'}
                </div>
              </div>
            </div>
            {stage1Progress?.total > 1 && (
              <div style={{ background: '#C7D2FE', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg,#1D4ED8,#7C3AED)',
                  width: `${stage1Progress.pct}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            )}
          </div>
        )}

        {/* Этап 1 — ошибка */}
        {stage === 1 && stageStatus === 'error' && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#B91C1C', marginBottom: 6 }}>Ошибка при анализе</div>
            <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{stageError}</div>
            <RunButton label="Повторить Этап 1" onClick={handleStage1} running={false} />
          </div>
        )}

        {/* Этап 1 — на подтверждении (чекпоинт) */}
        {stage === 1 && stageStatus === 'checkpoint' && buildings.length > 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flex: 'none' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>
                Найдено объектов: {buildings.length}
              </div>
              <div style={{ fontSize: 12, color: '#64748B' }}>— проверьте и подтвердите</div>
            </div>

            <TZBuildingTabs buildings={buildings} />

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <RunButton label="Подтвердить →" onClick={confirmStage1} running={false} />
              <button
                onClick={handleStage1}
                style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: 14, color: '#64748B', cursor: 'pointer', fontFamily: "'Golos Text',system-ui,sans-serif" }}
              >
                Повторить
              </button>
            </div>
          </div>
        )}

        {/* Этап 1 — подтверждён */}
        {stage === 1 && stageStatus === 'done' && buildings.length > 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', flex: 'none' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>Объекты подтверждены: {buildings.length}</div>
            </div>
            <TZBuildingTabs buildings={buildings} />
            <RunButton label="Определить инженерные системы (Этап 2)" onClick={handleStage2} disabled={false} running={false} />
          </div>
        )}

        {/* Этап 2 — выполняется */}
        {stage === 2 && stageStatus === 'running' && (
          <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: stage2Progress?.total > 1 ? 12 : 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2.2" style={{ animation: 'spin 1s linear infinite', flex: 'none' }}>
                <path d="M21 12a9 9 0 1 1-6-8.5"/>
              </svg>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1E40AF' }}>Извлекаю инженерные системы…</div>
                <div style={{ fontSize: 12, color: '#3730A3', marginTop: 2 }}>
                  {stage2Progress?.total > 1
                    ? stage2Progress.batch === stage2Progress.total
                      ? 'Консолидация и дедупликация систем…'
                      : `Сканирую фрагмент ${stage2Progress.batch} из ${stage2Progress.total - 1}`
                    : 'Анализирую состав инженерных систем и оборудования'}
                </div>
              </div>
            </div>
            {stage2Progress?.total > 1 && (
              <div style={{ background: '#C7D2FE', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg,#1D4ED8,#7C3AED)',
                  width: `${stage2Progress.pct}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            )}
          </div>
        )}

        {/* Этап 2 — ошибка */}
        {stage === 2 && stageStatus === 'error' && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#B91C1C', marginBottom: 6 }}>Ошибка при анализе систем</div>
            <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{stageError}</div>
            <RunButton label="Повторить Этап 2" onClick={handleStage2} running={false} />
          </div>
        )}

        {/* Этап 2 — чекпоинт */}
        {stage === 2 && stageStatus === 'checkpoint' && systems.length > 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flex: 'none' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>
                Инженерные системы извлечены — проверьте
              </div>
            </div>
            <TZSystemsView systemsData={systems} buildings={buildings} />

            {/* Schedule detector badge */}
            {scheduleStatus === 'found' && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#166534' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
                График ЭК/ТО найден в документе ({scheduleTableCount} табл.) — при подтверждении задачи будут извлечены автоматически (0 API-вызовов)
              </div>
            )}
            {scheduleStatus === 'not_found' && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400E' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                График ЭК/ТО в документе не найден — после подтверждения можно загрузить отдельный файл
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <RunButton
                label={scheduleStatus === 'found' ? 'Подтвердить → извлечь задачи' : 'Подтвердить →'}
                onClick={confirmStage2}
                running={false}
              />
              <button
                onClick={handleStage2}
                style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: 14, color: '#64748B', cursor: 'pointer', fontFamily: "'Golos Text',system-ui,sans-serif" }}
              >
                Повторить
              </button>
            </div>
          </div>
        )}

        {/* Этап 2 — подтверждён (промежуточное состояние, если Stage 3 не запустился) */}
        {stage === 2 && stageStatus === 'done' && systems.length > 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', flex: 'none' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>Инженерные системы подтверждены</div>
            </div>
            <TZSystemsView systemsData={systems} buildings={buildings} />
          </div>
        )}

        {/* Этап 3 — выполняется (детерминированный парсинг, секунды) */}
        {stage === 3 && stageStatus === 'running' && (
          <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2.2" style={{ animation: 'spin 1s linear infinite', flex: 'none' }}>
                <path d="M21 12a9 9 0 1 1-6-8.5"/>
              </svg>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1E40AF' }}>Извлекаю задачи ЭК/ТО…</div>
                <div style={{ fontSize: 12, color: '#3730A3', marginTop: 2 }}>Разбираю таблицы графика — 0 API-вызовов</div>
              </div>
            </div>
          </div>
        )}

        {/* Этап 3 — ошибка */}
        {stage === 3 && stageStatus === 'error' && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#B91C1C', marginBottom: 6 }}>Ошибка при извлечении задач</div>
            <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{stage3Error}</div>
          </div>
        )}

        {/* Этап 3 — задачи извлечены (показ систем + кнопка перехода к графику) */}
        {stage === 3 && stageStatus === 'done' && systems.length > 0 && (() => {
          const totalSystems = systems.reduce((n, b) => n + (b.systems?.length ?? 0), 0)
          const withTasks = systems.reduce((n, b) =>
            n + (b.systems?.filter(s => s.maintenanceTasks?.length > 0).length ?? 0), 0)
          return (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', flex: 'none' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>Задачи ЭК/ТО извлечены из графика</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{scheduleTableCount} таблиц · 0 API-вызовов</div>
              </div>
              <TZSystemsView systemsData={systems} buildings={buildings} />
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
                <div style={{ fontSize: 13, color: '#166534' }}>
                  Задачи привязаны к <strong>{withTasks}</strong> из {totalSystems} систем — план-график готов к проверке
                </div>
              </div>
              <RunButton label="Перейти к графику (Этап 4) →" onClick={confirmStage3} running={false} />
            </div>
          )
        })()}

        {/* Этап 4 — чекпоинт: просмотр матрицы графика */}
        {stage === 4 && stageStatus === 'checkpoint' && systems.length > 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flex: 'none' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>Сводный план-график обслуживания</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>проверьте и подтвердите</div>
            </div>
            <TZScheduleView systemsData={systems} buildings={buildings} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <RunButton label="Подтвердить →" onClick={confirmStage4} running={false} />
              <button
                onClick={confirmStage3}
                style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: 14, color: '#64748B', cursor: 'pointer', fontFamily: "'Golos Text',system-ui,sans-serif" }}
              >
                ← Назад
              </button>
            </div>
          </div>
        )}

        {/* Этап 4 — подтверждён */}
        {stage === 4 && stageStatus === 'done' && systems.length > 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', flex: 'none' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>График обслуживания подтверждён</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>{scheduleTableCount} таблиц</div>
            </div>
            <TZScheduleView systemsData={systems} buildings={buildings} />
            <RunButton label="Рассчитать штат (Этап 5) →" onClick={startStage5} running={false} />
          </div>
        )}

        {/* Этап 5 — чекпойнт: показываем план штата + ресурсы, ждём подтверждения */}
        {stage === 5 && stageStatus === 'checkpoint' && staffingPlan.length > 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D4ED8', flex: 'none' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>Этап 5 — Ресурсы</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>детерминировано · 0 API · провенанс: эталон + ТЗ</div>
            </div>
            <TZStaffingView staffingPlans={staffingPlan} />
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
                ЗИП · Расходники · Инструмент
              </div>
              <TZResourcesView resourcesPlans={resourcesPlan} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <RunButton label="Подтвердить →" onClick={confirmStage5} running={false} />
              <button
                onClick={() => setStage(4, 'done')}
                style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: 14, color: '#64748B', cursor: 'pointer', fontFamily: "'Golos Text',system-ui,sans-serif" }}
              >← Назад</button>
            </div>
          </div>
        )}

        {/* Этап 5 — подтверждён */}
        {stage === 5 && stageStatus === 'done' && staffingPlan.length > 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', flex: 'none' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>Ресурсы подтверждены</div>
              <button
                onClick={() => setStage(4, 'done')}
                style={{
                  marginLeft: 'auto', fontSize: 12, color: '#64748B',
                  background: 'none', border: '1px solid #E2E8F0',
                  borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
                  fontFamily: "'Golos Text',system-ui,sans-serif",
                }}
              >← Пересчитать</button>
            </div>
            <TZStaffingView staffingPlans={staffingPlan} />
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
                ЗИП · Расходники · Инструмент
              </div>
              <TZResourcesView resourcesPlans={resourcesPlan} />
            </div>
            {/* Этап 6 — Применить в платформу */}
            {(() => {
              const validation = validateTZForApply({ buildings, systems, staffingPlan, resourcesPlan })
              async function handleApply() {
                if (!validation.ok || applyRunning) return
                setApplyRunning(true)
                try {
                  await applyFromTZ({
                    buildings:    mapBuildings(buildings),
                    systemsData:  mapSystemsData(systems),
                    staffingPlan,
                    resourcesPlan,
                    slaData,
                  })
                  await confirmStage(6)
                  setActiveSection('dashboard')
                } finally {
                  setApplyRunning(false)
                }
              }

              return (
                <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0369A1' }}>Этап 6 — Интеграция в платформу</div>

                  {platformApplied && appliedAt && (
                    <div style={{ fontSize: 12, color: '#64748B' }}>
                      Ранее применено: {new Date(appliedAt).toLocaleString('ru-RU')} — повторное применение перезапишет данные платформы
                    </div>
                  )}

                  {/* Validation */}
                  {(validation.errors.length > 0 || validation.warnings.length > 0) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {validation.errors.map((e, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#B91C1C', display: 'flex', gap: 6 }}>
                          <span>✗</span><span>{e}</span>
                        </div>
                      ))}
                      {validation.warnings.map((w, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#D97706', display: 'flex', gap: 6 }}>
                          <span>⚠</span><span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {validation.ok && (
                    <div style={{ fontSize: 12, color: '#0369A1', lineHeight: 1.6 }}>
                      Объектов: <strong>{buildings.length}</strong> · Систем-данных: <strong>{systems.length}</strong>
                      {staffingPlan.length > 0 && <> · Штат: <strong>{staffingPlan.length} объектов</strong></>}
                    </div>
                  )}

                  <button
                    onClick={handleApply}
                    disabled={!validation.ok || applyRunning}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '10px 22px', borderRadius: 10, border: 'none', cursor: validation.ok && !applyRunning ? 'pointer' : 'not-allowed',
                      background: validation.ok ? '#1D4ED8' : '#E2E8F0',
                      color: validation.ok ? '#FFFFFF' : '#94A3B8',
                      fontSize: 14, fontWeight: 600,
                      fontFamily: "'Golos Text',system-ui,sans-serif",
                      opacity: applyRunning ? 0.7 : 1,
                    }}
                  >
                    {applyRunning ? 'Применяется…' : 'Применить в платформу →'}
                  </button>
                </div>
              )
            })()}
          </div>
        )}

        {/* Этап 6 — done-экран: данные применены, доступно повторное применение */}
        {stage === 6 && stageStatus === 'done' && (() => {
          const totalSystems = systems.reduce((n, b) => n + (b.systems?.length ?? 0), 0)
          const totalTasks   = systems.reduce((n, b) => n + (b.systems ?? []).reduce((m, s) => m + (s.maintenanceTasks?.length ?? 0), 0), 0)
          const validation   = validateTZForApply({ buildings, systems, staffingPlan, resourcesPlan })

          async function handleReApply() {
            if (applyRunning || !validation.ok) return
            setApplyRunning(true)
            try {
              await applyFromTZ({
                buildings:    mapBuildings(buildings),
                systemsData:  mapSystemsData(systems),
                staffingPlan,
                resourcesPlan,
                slaData,
              })
            } finally {
              setApplyRunning(false)
            }
          }

          return (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Applied status banner */}
              <div style={{ background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#059669' }}>Применено из ТЗ</div>
                  {appliedAt && <div style={{ fontSize: 12, color: '#6EE7B7', marginTop: 2 }}>{new Date(appliedAt).toLocaleString('ru-RU')}</div>}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#374151', flexWrap: 'wrap' }}>
                <span>Объектов: <strong>{buildings.length}</strong></span>
                <span>Систем: <strong>{totalSystems}</strong></span>
                <span>Задач ТО/ЭК: <strong>{totalTasks}</strong></span>
                {staffingPlan.length > 0 && <span>Штат: <strong>{staffingPlan.length} объектов</strong></span>}
              </div>

              {/* Validation errors blocking re-apply */}
              {!validation.ok && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {validation.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#B91C1C', display: 'flex', gap: 6 }}>
                      <span>✗</span><span>{e}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={handleReApply}
                  disabled={!validation.ok || applyRunning}
                  style={{
                    padding: '10px 22px', borderRadius: 10, border: 'none',
                    background: validation.ok ? '#1D4ED8' : '#E2E8F0',
                    color: validation.ok ? '#FFFFFF' : '#94A3B8',
                    fontSize: 14, fontWeight: 600,
                    cursor: validation.ok && !applyRunning ? 'pointer' : 'not-allowed',
                    fontFamily: "'Golos Text',system-ui,sans-serif",
                    opacity: applyRunning ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {applyRunning && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6-8.5"/>
                    </svg>
                  )}
                  {applyRunning ? 'Применяется…' : '↻ Применить повторно'}
                </button>
                <button
                  onClick={() => setActiveSection('dashboard')}
                  style={{
                    padding: '10px 22px', borderRadius: 10, border: '1px solid #A7F3D0',
                    background: '#F0FDF4', color: '#059669',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Golos Text',system-ui,sans-serif",
                  }}
                >
                  Открыть Дашборд →
                </button>
              </div>
            </div>
          )
        })()}

        {/* Этап 3 — стаб: график не найден */}
        {stage === 3 && stageStatus === 'no_schedule' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flex: 'none' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>График ЭК/ТО не найден в ТЗ</div>
            </div>
            <TZSystemsView systemsData={systems} buildings={buildings} />
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 6 }}>
                Есть отдельный файл с графиком ТО/ЭК?
              </div>
              <div style={{ fontSize: 12, color: '#B45309', marginBottom: 12, lineHeight: 1.6 }}>
                Если заказчик предоставил отдельный Excel/Word с графиком — загрузите его.
                Периодичность и месяцы будут извлечены автоматически (0 API-вызовов).
              </div>
              <div style={{ fontSize: 12, color: '#D97706', padding: '8px 12px', background: '#FEF3C7', borderRadius: 8, display: 'inline-block' }}>
                Загрузка отдельного файла графика — в разработке
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </div>
  )
}
