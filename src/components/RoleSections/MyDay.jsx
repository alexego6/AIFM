// Мой день — личный мини-дашборд техника (executor).
// Мои задачи на сегодня, просрочки SLA, мои аварийки.
// Суточник вне своей смены видит дату следующей смены, не пустой экран.

import { useEffect, useMemo } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useStaffStore, shiftForDate } from '../../store/useStaffStore'
import { useTicketsStore } from '../../store/useTicketsStore'
import { useAppStore } from '../../store/useAppStore'
import { toISODate } from '../../services/dayScheduler'

function nextShiftDate(person, from = new Date()) {
  if (!person?.shift) return null
  for (let i = 1; i <= 8; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    if (shiftForDate(d) === person.shift) return d
  }
  return null
}

function fmtDate(d) {
  return d?.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) ?? '—'
}

const card = { background: '#FFFFFF', border: '1px solid #E8ECF5', borderRadius: 14, padding: '18px 20px' }

export default function MyDay() {
  const { personId } = useSessionStore()
  const { staff, loadFromDB: loadStaff } = useStaffStore()
  const { tickets, loadFromDB: loadTickets } = useTicketsStore()
  const { setActiveSection } = useAppStore()

  useEffect(() => { loadStaff(); loadTickets() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const person = staff.find(p => p.id === personId)
  const today = new Date()
  const todayISO = toISODate(today)

  const my = useMemo(() => tickets.filter(t => t.assigneeId === personId), [tickets, personId])
  const todays = my.filter(t => t.date === todayISO && t.status !== 'done')
  const overdue = useMemo(() => my.filter(t =>
    t.status !== 'done' && t.slaDeadline && new Date(t.slaDeadline) < today), [my])   // eslint-disable-line react-hooks/exhaustive-deps
  const myEmergency = my.filter(t => t.type === 'emergency' && t.status !== 'done')

  // Суточник вне смены
  const offShift = person?.kind === 'watchman' && person.shift && shiftForDate(today) !== person.shift

  if (!person) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9CA3AF', fontSize: 13 }}>
        Персона не выбрана — выберите себя в переключателе роли (шапка)
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#F3F5FA' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Мой день</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280' }}>
            {person.name} · {person.role}{person.shift ? ` · смена ${person.shift}` : ''}
          </p>
        </div>

        {offShift ? (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Сегодня не ваша смена</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              Следующая смена {person.shift}: <strong>{fmtDate(nextShiftDate(person))}</strong>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { label: 'Задач на сегодня', value: todays.length, color: '#1D4ED8' },
                { label: 'Просрочено по SLA', value: overdue.length, color: overdue.length > 0 ? '#DC2626' : '#059669' },
                { label: 'Мои аварийные', value: myEmergency.length, color: myEmergency.length > 0 ? '#D97706' : '#059669' },
              ].map(k => (
                <div key={k.label} style={card}>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>{k.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Задачи на сегодня</h3>
                <button onClick={() => setActiveSection('tickets')}
                  style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Открыть тикеты →
                </button>
              </div>
              {todays.length === 0 ? (
                <div style={{ fontSize: 13, color: '#9CA3AF', padding: '12px 0' }}>На сегодня задач нет</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...todays].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', width: 18 }}>{t.order ?? '·'}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                        background: t.type === 'EK' ? 'rgba(5,150,105,.1)' : t.type === 'emergency' ? 'rgba(220,38,38,.1)' : 'rgba(29,78,216,.1)',
                        color: t.type === 'EK' ? '#059669' : t.type === 'emergency' ? '#DC2626' : '#1D4ED8' }}>
                        {t.type === 'EK' ? 'ЭК' : t.type === 'emergency' ? 'Авария' : t.type === 'inspection' ? 'Осмотр' : 'ТО'}
                      </span>
                      <span style={{ flex: 1, color: '#0D1117', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{t.systemName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {overdue.length > 0 && (
              <div style={{ ...card, borderColor: '#FECACA', background: '#FFF7F7' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#B91C1C' }}>Просрочки по SLA</h3>
                {overdue.map(t => (
                  <div key={t.id} style={{ fontSize: 12, color: '#7F1D1D', padding: '4px 0' }}>
                    {t.title} — дедлайн {new Date(t.slaDeadline).toLocaleDateString('ru-RU')}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
