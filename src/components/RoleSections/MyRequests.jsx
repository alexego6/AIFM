// Мои заявки — раздел заказчика: подача аварийной заявки + трекинг статуса
// СВОИХ заявок (фильтр по createdBy == clientId сессии).

import { useEffect, useMemo, useState } from 'react'
import { usePlatformStore } from '../../store/usePlatformStore'
import { useSessionStore } from '../../store/useSessionStore'
import { useTicketsStore } from '../../store/useTicketsStore'

const STATUS_CFG = {
  open:        { label: 'Принята',    color: '#D97706', bg: '#FFFBEB' },
  in_progress: { label: 'В работе',   color: '#1D4ED8', bg: '#EFF6FF' },
  done:        { label: 'Выполнена',  color: '#059669', bg: '#ECFDF5' },
}

export default function MyRequests() {
  const { applied, activeBuildingId, buildings, systemsData, slaData } = usePlatformStore()
  const { clientId } = useSessionStore()
  const ticketsStore = useTicketsStore()
  const [title, setTitle] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => { ticketsStore.loadFromDB() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const building = buildings.find(b => b.id === activeBuildingId)
  const systems = useMemo(() =>
    systemsData.find(s => s.buildingId === activeBuildingId)?.systems ?? [],
    [systemsData, activeBuildingId])
  const [systemId, setSystemId] = useState('')

  // Только заявки, созданные из ЭТОЙ сессии
  const mine = useMemo(() =>
    ticketsStore.tickets
      .filter(t => t.type === 'emergency' && t.createdBy === clientId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [ticketsStore.tickets, clientId])

  async function submit() {
    if (!title.trim() || !applied) return
    const sys = systems.find(s => s.id === systemId)
    await ticketsStore.createEmergency({
      buildingId: activeBuildingId,
      title,
      systemId: sys?.id ?? null,
      systemName: sys?.name ?? null,
      category: sys?.category ?? 'other',
      createdBy: clientId,
    }, slaData)
    setTitle(''); setSystemId(''); setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#F3F5FA' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Мои заявки</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280' }}>
            {building?.name ?? ''} · аварийные заявки и их статус
          </p>
        </div>

        {/* Подача заявки */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8ECF5', borderRadius: 14, padding: 18,
          display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Сообщить о проблеме</div>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Опишите проблему (например: Не работает кондиционер в переговорной 312)"
            style={{ fontSize: 13, padding: '10px 13px', borderRadius: 9, border: '1px solid #E2E8F0', fontFamily: 'inherit', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={systemId} onChange={e => setSystemId(e.target.value)}
              style={{ fontSize: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF', fontFamily: 'inherit', flex: 1, minWidth: 180 }}>
              <option value="">Система (если знаете)</option>
              {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={submit} disabled={!title.trim() || !applied}
              style={{ padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#FFF',
                background: title.trim() && applied ? '#DC2626' : '#E2E8F0', border: 'none',
                cursor: title.trim() && applied ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              Отправить
            </button>
          </div>
          {sent && (
            <div style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
              Заявка принята — служба эксплуатации уведомлена (SLA: реакция ≤ 1 часа)
            </div>
          )}
        </div>

        {/* Трекинг своих заявок */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>История ({mine.length})</div>
          {mine.length === 0 && (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '16px 0', textAlign: 'center' }}>
              Заявок из этой сессии пока нет
            </div>
          )}
          {mine.map(t => {
            const st = STATUS_CFG[t.status] ?? STATUS_CFG.open
            return (
              <div key={t.id} style={{ background: '#FFFFFF', border: '1px solid #E8ECF5', borderRadius: 12,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1117' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                    {new Date(t.createdAt).toLocaleString('ru-RU')}
                    {t.systemName && t.systemName !== '—' && <> · {t.systemName}</>}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 7, background: st.bg, color: st.color, flexShrink: 0 }}>
                  {st.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
