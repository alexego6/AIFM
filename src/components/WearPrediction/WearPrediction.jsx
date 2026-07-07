// Прогноз износа — рабочий раздел (замена demo-заглушки).
// Узлы деривируются из платформы на лету, замеры — IDB aifm_wear,
// тренд/ETA — wearForecast, дата следующего обхода — dayScheduler. 0 API.

import { useEffect, useMemo, useState } from 'react'
import { usePlatformStore } from '../../store/usePlatformStore'
import { useWearStore } from '../../store/useWearStore'
import { useStaffStore } from '../../store/useStaffStore'
import { useSessionStore } from '../../store/useSessionStore'
import { useTicketsStore } from '../../store/useTicketsStore'
import { deriveNodes, linearTrend, nextRoundDate, purchaseRecommendations } from '../../services/wearForecast'
import { MIN_MEASUREMENTS, WEAR_THRESHOLDS } from '../../services/wearConfig'
import { can } from '../../config/roleAccess'
import { toISODate } from '../../services/dayScheduler'

const STATUS_CFG = {
  accumulating: { label: 'Накопление данных', color: '#6B7280', bg: '#F3F4F6' },
  stable:       { label: 'Стабилен',          color: '#0891B2', bg: '#ECFEFF' },
  ok:           { label: 'Норма',             color: '#059669', bg: '#ECFDF5' },
  watch:        { label: 'Наблюдение',        color: '#D97706', bg: '#FFFBEB' },
  urgent:       { label: 'Замена скоро',      color: '#DC2626', bg: '#FEF2F2' },
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
}

function fmtMonths(m) {
  if (m == null) return null
  if (m < 1) return '< 1 мес'
  return `≈ ${Math.round(m)} мес`
}

// Spark-line истории замеров — чистый SVG, без новых библиотек
function SparkLine({ measurements, width = 140, height = 36 }) {
  const pts = [...measurements].sort((a, b) => new Date(a.date) - new Date(b.date))
  if (pts.length < 2) return null
  const xs = pts.map(p => new Date(p.date).getTime())
  const ys = pts.map(p => p.wearPct)
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const pad = 3
  const px = x => x1 === x0 ? width / 2 : pad + (x - x0) / (x1 - x0) * (width - 2 * pad)
  const py = y => height - pad - (y / 100) * (height - 2 * pad)
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(xs[i]).toFixed(1)},${py(ys[i]).toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <line x1="0" y1={py(WEAR_THRESHOLDS.critical)} x2={width} y2={py(WEAR_THRESHOLDS.critical)} stroke="#FCA5A5" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="0" y1={py(WEAR_THRESHOLDS.warning)} x2={width} y2={py(WEAR_THRESHOLDS.warning)} stroke="#FDE68A" strokeWidth="1" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke="#1D4ED8" strokeWidth="1.6" />
      <circle cx={px(xs[xs.length - 1])} cy={py(ys[ys.length - 1])} r="2.5" fill="#1D4ED8" />
    </svg>
  )
}

function AddMeasurementForm({ onSave, onClose }) {
  const [date, setDate] = useState(() => toISODate(new Date()))
  const [pct, setPct]   = useState('')
  const [note, setNote] = useState('')

  function submit() {
    const v = parseFloat(pct)
    if (isNaN(v)) return
    onSave({ date, wearPct: v, note: note.trim() || null })
    onClose()
  }

  const inp = { fontSize: 12, padding: '6px 9px', borderRadius: 7, border: '1px solid #E2E8F0', fontFamily: 'inherit', outline: 'none' }
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0' }}>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
      <input type="number" min="0" max="100" placeholder="износ %" value={pct}
        onChange={e => setPct(e.target.value)} style={{ ...inp, width: 80 }} autoFocus />
      <input placeholder="заметка (необязательно)" value={note} onChange={e => setNote(e.target.value)} style={{ ...inp, width: 180 }} />
      <button onClick={submit} style={{ fontSize: 12, fontWeight: 600, color: '#FFF', background: '#1D4ED8', border: 'none', borderRadius: 7, padding: '7px 13px', cursor: 'pointer', fontFamily: 'inherit' }}>
        Сохранить
      </button>
      <button onClick={onClose} style={{ fontSize: 12, color: '#6B7280', background: 'none', border: '1px solid #E2E8F0', borderRadius: 7, padding: '7px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
        Отмена
      </button>
    </div>
  )
}

function NodeCard({ node, measurements, nextRound, orphan, canRecord, onAddMeasurement }) {
  const [adding, setAdding] = useState(false)
  const trend = useMemo(() => linearTrend(measurements), [measurements])
  const cfg = STATUS_CFG[trend.status]

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8ECF5', borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8, opacity: orphan ? .75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1117' }}>{node.name}</span>
        {node.brand && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{node.brand}</span>}
        {node.qty > 1 && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: '#EEF2FF', color: '#4338CA' }}>
            парк {node.qty} единиц
          </span>
        )}
        {orphan && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: '#FEE2E2', color: '#B91C1C' }}>
            узел не найден в текущем ТЗ — замеры сохранены
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: cfg.bg, color: cfg.color }}>
          {trend.status === 'accumulating'
            ? `${cfg.label}: ${trend.count} из ${MIN_MEASUREMENTS}`
            : cfg.label}
        </span>
      </div>

      <div style={{ fontSize: 11, color: '#6B7280' }}>{node.systemName}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {trend.lastWear != null && (
          <div style={{ fontSize: 12, color: '#374151' }}>
            Износ: <strong style={{ color: trend.lastWear >= WEAR_THRESHOLDS.critical ? '#DC2626' : trend.lastWear >= WEAR_THRESHOLDS.warning ? '#D97706' : '#0D1117' }}>
              {trend.lastWear}%
            </strong>
            <span style={{ color: '#9CA3AF' }}> ({fmtDate(trend.lastDate)})</span>
          </div>
        )}
        {trend.slopePctPerMonth != null && trend.status !== 'accumulating' && trend.status !== 'stable' && (
          <div style={{ fontSize: 12, color: '#374151' }}>
            Скорость: <strong>{trend.slopePctPerMonth > 0 ? '+' : ''}{trend.slopePctPerMonth}%/мес</strong>
          </div>
        )}
        {trend.etaCriticalMonths != null && trend.status !== 'stable' && (
          <div style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>
            До {WEAR_THRESHOLDS.critical}%: {fmtMonths(trend.etaCriticalMonths)}
          </div>
        )}
        {measurements.length >= 2 && <SparkLine measurements={measurements} />}
      </div>

      {trend.status === 'accumulating' && !orphan && (
        <div style={{ fontSize: 11, color: '#6B7280' }}>
          {nextRound
            ? <>{trend.count + 1}-й обход: <strong>{fmtDate(nextRound)}</strong> (график ЭК системы)</>
            : 'В графике нет ЭК-задач по системе — вносите замеры вручную'}
        </div>
      )}

      {canRecord && !adding && (
        <button onClick={() => setAdding(true)}
          style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: '#1D4ED8', background: '#EFF6FF',
            border: '1px solid #BFDBFE', borderRadius: 7, padding: '4px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
          + замер
        </button>
      )}
      {adding && <AddMeasurementForm onClose={() => setAdding(false)}
        onSave={({ date, wearPct, note }) => onAddMeasurement(node, { date, wearPct, note })} />}
    </div>
  )
}

function WearStub({ text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: '#9CA3AF' }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.4">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#6B7280', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>{text}</div>
    </div>
  )
}

export default function WearPrediction() {
  const { applied, systemsData, activeBuildingId } = usePlatformStore()
  const wearStore    = useWearStore()
  const staffStore   = useStaffStore()
  const ticketsStore = useTicketsStore()
  const session      = useSessionStore()
  const [inspectMsg, setInspectMsg] = useState(null)

  useEffect(() => { wearStore.loadFromDB(); staffStore.loadFromDB(); ticketsStore.loadFromDB() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const actor = { role: session.role, personId: session.personId }

  const allNodes = useMemo(() => deriveNodes(systemsData), [systemsData])
  const nodes = useMemo(() => allNodes.filter(n => n.buildingId === activeBuildingId), [allNodes, activeBuildingId])

  const systemsById = useMemo(() => {
    const map = new Map()
    for (const bs of systemsData ?? []) {
      if (bs.buildingId !== activeBuildingId) continue
      for (const s of bs.systems ?? []) map.set(s.id, s)
    }
    return map
  }, [systemsData, activeBuildingId])

  const measByNode = useMemo(() => {
    const map = new Map()
    for (const m of wearStore.measurements) {
      if (!map.has(m.nodeId)) map.set(m.nodeId, [])
      map.get(m.nodeId).push(m)
    }
    return map
  }, [wearStore.measurements])

  // Осиротевшие nodeId этого объекта (узел исчез после переприменения ТЗ)
  const orphanNodes = useMemo(() => {
    const known = new Set(nodes.map(n => n.nodeId))
    const seen = new Map()
    for (const m of wearStore.measurements) {
      if (m.buildingId === activeBuildingId && !known.has(m.nodeId) && !seen.has(m.nodeId)) {
        seen.set(m.nodeId, {
          nodeId: m.nodeId, buildingId: m.buildingId, systemId: null,
          systemName: '—', category: 'other', class: null,
          name: `Узел ${m.nodeId}`, brand: null, qty: 1,
        })
      }
    }
    return [...seen.values()]
  }, [wearStore.measurements, nodes, activeBuildingId])

  const trends = useMemo(() =>
    nodes.map(node => ({ node, trend: linearTrend(measByNode.get(node.nodeId) ?? []) })),
    [nodes, measByNode])

  const recommendations = useMemo(() => purchaseRecommendations(trends), [trends])

  if (!applied) return <WearStub text="Примените данные из Анализа ТЗ — узлы определятся автоматически" />

  async function handleInitialInspection() {
    const res = await ticketsStore.generateInitialInspections(systemsData, useStaffStore.getState().staff)
    setInspectMsg(res.created > 0
      ? `Создано ${res.created} тикетов первичной фиксации — назначены гл. инженеру, см. раздел Тикеты`
      : 'Тикеты первичной фиксации уже существуют — дубли не созданы')
  }

  function addMeasurement(node, { date, wearPct, note }) {
    wearStore.addMeasurement({
      nodeId: node.nodeId, buildingId: node.buildingId, date, wearPct, note,
      byPersonId: session.personId, source: 'manual',
    })
  }

  const canRecord = can(actor, 'recordWear')
  const statusRank = { urgent: 0, watch: 1, ok: 2, stable: 3, accumulating: 4 }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#F3F5FA' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Прогноз износа</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280' }}>
              {nodes.length} узлов · тренд по замерам (мин. {MIN_MEASUREMENTS}) · пороги {WEAR_THRESHOLDS.warning}/{WEAR_THRESHOLDS.critical}%
            </p>
          </div>
          {can(actor, 'runInitialInspection') && (
            <button onClick={handleInitialInspection}
              style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#FFFFFF', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)' }}>
              Запустить первичную фиксацию износа
            </button>
          )}
        </div>

        {inspectMsg && (
          <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#0369A1' }}>
            {inspectMsg}
          </div>
        )}

        {/* Рекомендации закупки — замыкание на ЗИП */}
        {recommendations.length > 0 && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
              Рекомендуется закупка ({recommendations.length})
            </div>
            {recommendations.map(r => (
              <div key={r.nodeId} style={{ fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>
                <strong>{r.nodeName}</strong>
                {r.etaDate && <> — к дате <strong>{fmtDate(r.etaDate)}</strong></>}
                <span style={{ color: '#B45309' }}> · {STATUS_CFG[r.status].label}</span>
                <div style={{ color: '#92400E' }}>{r.items.join(' · ')}</div>
                <span style={{ fontSize: 10, color: '#D6A22A' }}>источник: прогноз износа</span>
              </div>
            ))}
          </div>
        )}

        {nodes.length === 0 && orphanNodes.length === 0 && (
          <WearStub text="В оборудовании применённого ТЗ нет трекаемых узлов" />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...trends]
            .sort((a, b) => (statusRank[a.trend.status] ?? 9) - (statusRank[b.trend.status] ?? 9))
            .map(({ node }) => (
              <NodeCard key={node.nodeId}
                node={node}
                measurements={measByNode.get(node.nodeId) ?? []}
                nextRound={node.systemId ? nextRoundDate(systemsById.get(node.systemId), node.buildingId) : null}
                orphan={false}
                canRecord={canRecord}
                onAddMeasurement={addMeasurement}
              />
            ))}

          {orphanNodes.map(node => (
            <NodeCard key={node.nodeId}
              node={node}
              measurements={measByNode.get(node.nodeId) ?? []}
              nextRound={null}
              orphan
              canRecord={canRecord}
              onAddMeasurement={addMeasurement}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
