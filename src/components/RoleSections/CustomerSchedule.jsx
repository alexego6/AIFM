// График работ для заказчика — view-only. ЭК/ТО текущего месяца по системам
// из применённой платформы. Детализация «по помещениям» — заглушка (разрешено).

import { useMemo, useState } from 'react'
import { usePlatformStore } from '../../store/usePlatformStore'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

export default function CustomerSchedule() {
  const { applied, systemsData, activeBuildingId, buildings } = usePlatformStore()
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [showRooms, setShowRooms] = useState(false)

  const building = buildings.find(b => b.id === activeBuildingId)
  const systems = useMemo(() =>
    systemsData.find(s => s.buildingId === activeBuildingId)?.systems ?? [],
    [systemsData, activeBuildingId])

  const rows = useMemo(() => {
    const out = []
    for (const s of systems) {
      const tasks = (s.maintenanceTasks ?? []).filter(t =>
        (t.months ?? []).includes(month) ||
        /ежедневно|ежесменно|еженедельно|1р\/2дня|нед/i.test(t.periodicity ?? ''))
      if (tasks.length === 0) continue
      out.push({ system: s.name, count: tasks.length,
        ek: tasks.filter(t => t.mode === 'EK').length,
        to: tasks.filter(t => t.mode === 'TO').length })
    }
    return out
  }, [systems, month])

  if (!applied) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9CA3AF', fontSize: 13 }}>
        График появится после наполнения платформы
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#F3F5FA' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>График работ</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280' }}>
              {building?.name ?? ''} · плановое обслуживание (просмотр)
            </p>
          </div>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            style={{ fontSize: 12, padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF', fontFamily: 'inherit' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8ECF5', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '10px 16px', background: '#F9FAFB', borderBottom: '1px solid #E8ECF5',
            fontSize: 11, fontWeight: 600, color: '#6B7280' }}>
            <div style={{ flex: 1 }}>Система</div>
            <div style={{ width: 90, textAlign: 'center' }}>Осмотры (ЭК)</div>
            <div style={{ width: 90, textAlign: 'center' }}>Обслуживание (ТО)</div>
          </div>
          {rows.length === 0 && (
            <div style={{ padding: 20, fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
              В {MONTHS[month - 1].toLowerCase()} плановых работ нет
            </div>
          )}
          {rows.map(r => (
            <div key={r.system} style={{ display: 'flex', padding: '11px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
              <div style={{ flex: 1, color: '#0D1117' }}>{r.system}</div>
              <div style={{ width: 90, textAlign: 'center', color: '#059669', fontWeight: 600 }}>{r.ek || '—'}</div>
              <div style={{ width: 90, textAlign: 'center', color: '#1D4ED8', fontWeight: 600 }}>{r.to || '—'}</div>
            </div>
          ))}
        </div>

        <button onClick={() => setShowRooms(s => !s)}
          style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color: '#1D4ED8', background: '#EFF6FF',
            border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Детализация по помещениям
        </button>

        {showRooms && (
          <div style={{ background: '#FFFFFF', border: '1px dashed #C7D2FE', borderRadius: 14, padding: 30,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <svg width="120" height="72" viewBox="0 0 120 72" fill="none">
              <rect x="4" y="4" width="112" height="64" rx="4" stroke="#C7D2FE" strokeWidth="2"/>
              <path d="M4 28h50M54 4v64M54 40h62M84 40v28" stroke="#C7D2FE" strokeWidth="2"/>
              <circle cx="28" cy="16" r="4" fill="#A5B4FC"/>
              <circle cx="80" cy="22" r="4" fill="#A5B4FC"/>
              <circle cx="100" cy="54" r="4" fill="#A5B4FC"/>
            </svg>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6366F1' }}>Детализация по помещениям — в разработке</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
              Здесь появится план этажа с привязкой работ к конкретным помещениям
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
