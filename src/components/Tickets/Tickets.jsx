// Тикеты — дневной наряд активного объекта.
// Генерация из графиков ЭК/ТО платформы (день по хэшу, см. dayScheduler),
// раскладка по исполнителям (ticketPlanner), аварийные заявки с SLA-таймером.
// Никаких моков: без применённого ТЗ — честная заглушка.

import { useEffect, useMemo, useState } from 'react'
import { usePlatformStore } from '../../store/usePlatformStore'
import { useStaffStore, shiftForDate } from '../../store/useStaffStore'
import { useTicketsStore } from '../../store/useTicketsStore'
import { useSessionStore } from '../../store/useSessionStore'
import { useWearStore } from '../../store/useWearStore'
import { deriveNodes } from '../../services/wearForecast'
import { can, canChangeTicket } from '../../config/roleAccess'
import { toISODate } from '../../services/dayScheduler'

const TYPE_CFG = {
  EK:         { label: 'ЭК',     color: '#059669', bg: 'rgba(5,150,105,.1)' },
  TO:         { label: 'ТО',     color: '#1D4ED8', bg: 'rgba(29,78,216,.1)' },
  emergency:  { label: 'Авария', color: '#DC2626', bg: 'rgba(220,38,38,.1)' },
  inspection: { label: 'Фиксация износа', color: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
}

const STATUS_CFG = {
  open:        { label: 'Открыт',   color: '#6B7280', bg: 'rgba(107,114,128,.1)', next: 'in_progress' },
  in_progress: { label: 'В работе', color: '#1D4ED8', bg: 'rgba(29,78,216,.1)',   next: 'done' },
  done:        { label: 'Закрыт',   color: '#059669', bg: 'rgba(5,150,105,.1)',   next: 'open' },
}

function fmtCountdown(deadline, now) {
  const ms = new Date(deadline) - now
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const str = h > 0 ? `${h} ч ${m} мин` : `${m} мин`
  return ms >= 0 ? `осталось ${str}` : `просрочен на ${str}`
}

function SlaTimer({ ticket }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (ticket.status === 'done') return null
  const overdue = new Date(ticket.slaDeadline) < now
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: overdue ? '#DC2626' : '#D97706',
      display: 'flex', alignItems: 'center', gap: 5 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      SLA: {fmtCountdown(ticket.slaDeadline, now)}
      {ticket.slaNote && <span style={{ fontWeight: 400, color: '#9CA3AF' }}>({ticket.slaNote})</span>}
    </div>
  )
}

// Форма фиксации износа в карточке тикета (inspection / ЭК с трекаемыми узлами).
// Все поля опциональны — сохраняются только заполненные.
function WearRecordForm({ ticket, nodes, onSave, onClose }) {
  const [values, setValues] = useState({})

  function submit() {
    const entries = nodes
      .filter(n => values[n.nodeId] !== undefined && values[n.nodeId] !== '')
      .map(n => ({
        nodeId: n.nodeId,
        buildingId: n.buildingId,
        date: ticket.date,
        wearPct: parseFloat(values[n.nodeId]),
        ticketId: ticket.id,
        source: ticket.type === 'inspection' ? 'initial' : 'round',
      }))
      .filter(e => !isNaN(e.wearPct))
    onSave(entries)
    onClose()
  }

  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
        Износ узлов, % (пустые поля — пропуск)
      </div>
      {nodes.map(n => (
        <div key={n.nodeId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.name}{n.qty > 1 ? ` (парк ${n.qty})` : ''}
          </span>
          <input type="number" min="0" max="100" placeholder="—"
            value={values[n.nodeId] ?? ''}
            onChange={e => setValues(v => ({ ...v, [n.nodeId]: e.target.value }))}
            style={{ width: 64, fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontFamily: 'inherit', outline: 'none' }} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button onClick={submit}
          style={{ fontSize: 11, fontWeight: 600, color: '#FFF', background: '#1D4ED8', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Сохранить замеры{ticket.type === 'inspection' ? ' и закрыть тикет' : ''}
        </button>
        <button onClick={onClose}
          style={{ fontSize: 11, color: '#6B7280', background: 'none', border: '1px solid #E2E8F0', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Отмена
        </button>
      </div>
    </div>
  )
}

function TicketCard({ ticket, staffList, staleSystem, onStatus, onReassign, canReassignTickets, canEditThis, wearNodes, onWearSave }) {
  const [wearOpen, setWearOpen] = useState(false)
  const type = TYPE_CFG[ticket.type] ?? TYPE_CFG.TO
  const st   = STATUS_CFG[ticket.status] ?? STATUS_CFG.open

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 10, border: '1px solid #E8ECF5',
      background: '#FFFFFF', overflow: 'hidden', opacity: ticket.status === 'done' ? .65 : 1 }}>
      <div style={{ width: 3, flexShrink: 0, background: type.color }} />
      <div style={{ flex: 1, minWidth: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {ticket.order != null && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>
              {ticket.order}.
            </span>
          )}
          <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: type.bg, color: type.color, flexShrink: 0 }}>
            {type.label}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1117', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ticket.title}
          </span>
          {ticket.needsReview && (
            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', flexShrink: 0 }}>
              Требует проверки
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#6B7280', flexWrap: 'wrap' }}>
          <span>{ticket.systemName}</span>
          {ticket.periodicity && <span style={{ color: '#B4BCC8' }}>· {ticket.periodicity}</span>}
          {staleSystem && (
            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#FEE2E2', color: '#B91C1C' }}>
              система изменена при переприменении ТЗ
            </span>
          )}
        </div>

        {ticket.type === 'emergency' && <SlaTimer ticket={ticket} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {canEditThis && (
            <button onClick={() => onStatus(ticket.id, st.next)}
              title={`Перевести в «${STATUS_CFG[st.next].label}»`}
              style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: st.bg, color: st.color, border: `1px solid ${st.color}33`,
                cursor: 'pointer', fontFamily: 'inherit' }}>
              {st.label} →
            </button>
          )}
          {!canEditThis && (
            <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
              {st.label}
            </span>
          )}
          {canReassignTickets ? (
            <select
              value={ticket.assigneeId ?? ''}
              onChange={e => onReassign(ticket.id, e.target.value || null)}
              style={{ fontSize: 11, color: '#374151', border: '1px solid #E2E8F0', borderRadius: 6,
                padding: '3px 6px', background: '#FFFFFF', fontFamily: 'inherit', maxWidth: 190 }}>
              <option value="">— не назначен —</option>
              {staffList.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ) : null}
          {ticket.manuallyAssigned && ticket.type !== 'inspection' && (
            <span title="Назначен вручную — автораскладка не тронет" style={{ fontSize: 10, color: '#7C3AED' }}>✦ вручную</span>
          )}
          {wearNodes.length > 0 && canEditThis && ticket.status !== 'done' && !wearOpen && (
            <button onClick={() => setWearOpen(true)}
              style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#F5F3FF',
                border: '1px solid #DDD6FE', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Зафиксировать износ
            </button>
          )}
        </div>

        {wearOpen && (
          <WearRecordForm ticket={ticket} nodes={wearNodes}
            onClose={() => setWearOpen(false)}
            onSave={entries => onWearSave(ticket, entries)} />
        )}
      </div>
    </div>
  )
}

function EmergencyForm({ systems, onCreate, onClose }) {
  const [title, setTitle] = useState('')
  const [systemId, setSystemId] = useState('')

  function submit() {
    if (!title.trim()) return
    const sys = systems.find(s => s.id === systemId)
    onCreate({ title, systemId: sys?.id ?? null, systemName: sys?.name ?? null, category: sys?.category ?? 'other' })
    onClose()
  }

  return (
    <div style={{ background: '#FFF7F7', border: '1px solid #FECACA', borderRadius: 12, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>Аварийная заявка</div>
      <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
        placeholder="Что случилось (например: Прорыв стояка ХВС, 3 этаж)"
        style={{ fontSize: 13, padding: '9px 12px', borderRadius: 8, border: '1px solid #FECACA', fontFamily: 'inherit', outline: 'none' }} />
      <select value={systemId} onChange={e => setSystemId(e.target.value)}
        style={{ fontSize: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontFamily: 'inherit', background: '#FFF' }}>
        <option value="">Система (необязательно)</option>
        {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit}
          style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#FFF', background: '#DC2626', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          Создать — SLA-таймер запустится
        </button>
        <button onClick={onClose}
          style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, color: '#6B7280', background: 'none', border: '1px solid #E2E8F0', cursor: 'pointer', fontFamily: 'inherit' }}>
          Отмена
        </button>
      </div>
    </div>
  )
}

function NotAppliedStub() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: '#9CA3AF' }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.4">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#6B7280' }}>Нет данных платформы</div>
      <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
        Примените данные из Анализа ТЗ — дневной наряд сгенерируется из графиков ЭК/ТО
      </div>
    </div>
  )
}

export default function Tickets() {
  const { applied, systemsData, activeBuildingId, staffingPlan, slaData } = usePlatformStore()
  const staffStore   = useStaffStore()
  const ticketsStore = useTicketsStore()
  const wearStore    = useWearStore()
  const session      = useSessionStore()

  const [dateISO, setDateISO]   = useState(() => toISODate(new Date()))
  const [typeFilter, setType]   = useState('all')
  const [statusFilter, setStatus] = useState('all')
  const [sysFilter, setSys]     = useState('all')
  const [showEmergency, setShowEmergency] = useState(false)
  const [genRunning, setGenRunning] = useState(false)

  // Загрузка сторов + автосид реестра из штата ТЗ
  useEffect(() => { ticketsStore.loadFromDB(); wearStore.loadFromDB() }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    staffStore.loadFromDB().then(() => {
      if (applied && staffingPlan.length > 0) staffStore.seedIfEmpty(staffingPlan)
    })
  }, [applied, staffingPlan])                                             // eslint-disable-line react-hooks/exhaustive-deps

  const buildingSystems = useMemo(() =>
    systemsData.find(s => s.buildingId === activeBuildingId)?.systems ?? [],
    [systemsData, activeBuildingId])

  const knownSystemIds = useMemo(() => new Set(buildingSystems.map(s => s.id)), [buildingSystems])

  const staffList = useMemo(() =>
    staffStore.staff.filter(p => p.buildingId === activeBuildingId),
    [staffStore.staff, activeBuildingId])

  const actor = { role: session.role, personId: session.personId }
  const isExecutor = session.role === 'executor'
  const executorPerson = isExecutor ? staffStore.staff.find(p => p.id === session.personId) : null

  const dayTickets = useMemo(() => {
    let list = ticketsStore.tickets.filter(t => t.date === dateISO && t.buildingId === activeBuildingId)
    // Техник видит только СВОИ тикеты
    if (isExecutor) list = list.filter(t => t.assigneeId === session.personId)
    return list
  }, [ticketsStore.tickets, dateISO, activeBuildingId, isExecutor, session.personId])

  // Трекаемые узлы по системам объекта — для формы «Зафиксировать износ»
  const wearNodesBySystem = useMemo(() => {
    const map = new Map()
    for (const n of deriveNodes(systemsData)) {
      if (n.buildingId !== activeBuildingId) continue
      if (!map.has(n.systemId)) map.set(n.systemId, [])
      map.get(n.systemId).push(n)
    }
    return map
  }, [systemsData, activeBuildingId])

  // Суточник вне своей смены — сообщение вместо пустого экрана
  const offShiftInfo = useMemo(() => {
    if (!executorPerson || executorPerson.kind !== 'watchman' || !executorPerson.shift) return null
    const [y, m, d] = dateISO.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    if (shiftForDate(date) === executorPerson.shift) return null
    for (let i = 1; i <= 8; i++) {
      const nd = new Date(y, m - 1, d + i)
      if (shiftForDate(nd) === executorPerson.shift) {
        return nd.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
      }
    }
    return '—'
  }, [executorPerson, dateISO])

  const filtered = useMemo(() => dayTickets.filter(t =>
    (typeFilter === 'all' || t.type === typeFilter) &&
    (statusFilter === 'all' || t.status === statusFilter) &&
    (sysFilter === 'all' || t.systemId === sysFilter)
  ), [dayTickets, typeFilter, statusFilter, sysFilter])

  // Группировка по исполнителям в порядке order
  const groups = useMemo(() => {
    const byPerson = new Map()
    const unassigned = []
    for (const t of filtered) {
      if (!t.assigneeId) { unassigned.push(t); continue }
      if (!byPerson.has(t.assigneeId)) byPerson.set(t.assigneeId, [])
      byPerson.get(t.assigneeId).push(t)
    }
    for (const list of byPerson.values()) list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    return { byPerson, unassigned }
  }, [filtered])

  if (!applied) return <NotAppliedStub />

  async function handleGenerate() {
    if (genRunning) return
    setGenRunning(true)
    try {
      const [y, m, d] = dateISO.split('-').map(Number)
      await ticketsStore.generateForDate(systemsData, useStaffStore.getState().staff, new Date(y, m - 1, d))
    } finally {
      setGenRunning(false)
    }
  }

  const personName = id => staffStore.staff.find(p => p.id === id)?.name ?? 'Удалённый сотрудник'
  const personRole = id => staffStore.staff.find(p => p.id === id)?.role ?? ''

  async function handleWearSave(ticket, entries) {
    if (entries.length > 0) {
      await wearStore.addBatch(entries.map(e => ({ ...e, byPersonId: session.personId })))
    }
    // Первичная фиксация: сохранение закрывает тикет
    if (ticket.type === 'inspection') {
      await ticketsStore.setStatus(ticket.id, 'done', actor)
    }
  }

  const canGenerate = can(actor, 'reassignTickets')  // формирование наряда — административное действие

  const selStyle = { fontSize: 12, padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF', fontFamily: 'inherit', color: '#374151' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24, gap: 16, overflow: 'hidden', background: '#F3F5FA' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Тикеты — наряд на день</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280' }}>
            Плановые работы из графиков ЭК/ТО + аварийные заявки · раскладка по исполнителям
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={dateISO} onChange={e => setDateISO(e.target.value)} style={selStyle} />
          {canGenerate && (
            <button onClick={handleGenerate} disabled={genRunning}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                color: '#FFFFFF', border: 'none', cursor: genRunning ? 'wait' : 'pointer', fontFamily: 'inherit',
                background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)', opacity: genRunning ? .7 : 1 }}>
              {genRunning ? 'Генерация…' : 'Сформировать наряд'}
            </button>
          )}
          {can(actor, 'createEmergency') && (
            <button onClick={() => setShowEmergency(true)}
              style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#DC2626',
                background: '#FEF2F2', border: '1px solid #FECACA', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Аварийная заявка
            </button>
          )}
        </div>
      </div>

      {/* Emergency form */}
      {showEmergency && (
        <EmergencyForm
          systems={buildingSystems}
          onClose={() => setShowEmergency(false)}
          onCreate={payload => ticketsStore.createEmergency(
            { buildingId: activeBuildingId, createdBy: `${session.clientId}:${session.role}`, ...payload },
            slaData, useStaffStore.getState().staff)}
        />
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={typeFilter} onChange={e => setType(e.target.value)} style={selStyle}>
          <option value="all">Тип: все</option>
          <option value="EK">ЭК</option>
          <option value="TO">ТО</option>
          <option value="emergency">Аварийные</option>
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} style={selStyle}>
          <option value="all">Статус: все</option>
          <option value="open">Открыт</option>
          <option value="in_progress">В работе</option>
          <option value="done">Закрыт</option>
        </select>
        <select value={sysFilter} onChange={e => setSys(e.target.value)} style={selStyle}>
          <option value="all">Система: все</option>
          {buildingSystems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' }}>
          {dayTickets.length} тикетов · {dayTickets.filter(t => t.status === 'done').length} закрыто
        </span>
      </div>

      {/* Groups by assignee */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        {offShiftInfo ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: '#64748B' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Сегодня не ваша смена</div>
            <div style={{ fontSize: 12 }}>Следующая смена {executorPerson.shift}: <strong>{offShiftInfo}</strong></div>
          </div>
        ) : (
        <>
        {dayTickets.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, fontSize: 13, color: '#9CA3AF' }}>
            {isExecutor
              ? `На ${dateISO} ваших задач нет`
              : `Наряд на ${dateISO} не сформирован — нажмите «Сформировать наряд»`}
          </div>
        )}

        {[...groups.byPerson.entries()].map(([personId, list]) => (
          <div key={personId} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1117' }}>{personName(personId)}</span>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{personRole(personId)}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#EEF0F8', padding: '1px 8px', borderRadius: 8 }}>
                {list.length}
              </span>
            </div>
            {list.map(t => (
              <TicketCard key={t.id} ticket={t} staffList={staffList}
                staleSystem={t.systemId != null && !knownSystemIds.has(t.systemId)}
                canReassignTickets={can(actor, 'reassignTickets')}
                canEditThis={canChangeTicket(actor, t)}
                wearNodes={(t.type === 'inspection' || t.type === 'EK') ? (wearNodesBySystem.get(t.systemId) ?? []) : []}
                onWearSave={handleWearSave}
                onStatus={(id, status) => ticketsStore.setStatus(id, status, actor)}
                onReassign={(id, pid) => ticketsStore.reassign(id, pid, actor)} />
            ))}
          </div>
        ))}

        {groups.unassigned.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>
              Нераспределённые ({groups.unassigned.length}) — нет подходящего исполнителя в реестре
            </div>
            {groups.unassigned.map(t => (
              <TicketCard key={t.id} ticket={t} staffList={staffList}
                staleSystem={t.systemId != null && !knownSystemIds.has(t.systemId)}
                canReassignTickets={can(actor, 'reassignTickets')}
                canEditThis={canChangeTicket(actor, t)}
                wearNodes={(t.type === 'inspection' || t.type === 'EK') ? (wearNodesBySystem.get(t.systemId) ?? []) : []}
                onWearSave={handleWearSave}
                onStatus={(id, status) => ticketsStore.setStatus(id, status, actor)}
                onReassign={(id, pid) => ticketsStore.reassign(id, pid, actor)} />
            ))}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}
