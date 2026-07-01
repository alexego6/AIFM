import { useState } from 'react'

const CAT = {
  heating:    { label: 'Теплоснабжение',                color: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
  hvac:       { label: 'Вентиляция и кондиционирование', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
  plumbing:   { label: 'Водоснабжение и канализация',    color: '#166534', bg: '#F0FDF4', border: '#BBF7D0' },
  electrical: { label: 'Электроснабжение',               color: '#713F12', bg: '#FEFCE8', border: '#FEF08A' },
  fire:       { label: 'Пожарная безопасность',          color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  security:   { label: 'Охранная сигнализация',          color: '#374151', bg: '#F9FAFB', border: '#D1D5DB' },
  lowcurrent: { label: 'Слаботочные системы',            color: '#5B21B6', bg: '#F5F3FF', border: '#DDD6FE' },
  media:      { label: 'Медийные системы',               color: '#312E81', bg: '#EEF2FF', border: '#C7D2FE' },
  bms:        { label: 'Диспетчеризация / BMS',          color: '#075985', bg: '#F0F9FF', border: '#BAE6FD' },
  elevator:   { label: 'Лифты и подъёмники',             color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA' },
  structural: { label: 'Строительные конструкции',       color: '#1F2937', bg: '#F9FAFB', border: '#E5E7EB' },
  other:      { label: 'Прочее',                         color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
}

const CONF = {
  high:   { label: 'Высокая',  color: '#059669', bg: '#ECFDF5' },
  medium: { label: 'Средняя',  color: '#D97706', bg: '#FFFBEB' },
  low:    { label: 'Низкая',   color: '#DC2626', bg: '#FEF2F2' },
}

function EquipmentTable({ equipment }) {
  if (!equipment.length) return (
    <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', padding: '8px 0' }}>
      Оборудование не указано
    </div>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F8FAFC' }}>
            {['Наименование', 'Марка / Модель', 'Кол-во', 'Мощность / Произв.', 'Расположение', 'Данные'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap', borderBottom: '1px solid #E2E8F0' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {equipment.map(eq => {
            const conf = CONF[eq.confidence] ?? CONF.medium
            return (
              <tr key={eq.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '8px 10px', color: '#0F172A', fontWeight: 500 }}>
                  {eq.name}
                  {eq.tag && <span style={{ marginLeft: 6, fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{eq.tag}</span>}
                </td>
                <td style={{ padding: '8px 10px', color: '#374151' }}>
                  {[eq.brand, eq.model].filter(Boolean).join(' ') || <span style={{ color: '#CBD5E1' }}>—</span>}
                </td>
                <td style={{ padding: '8px 10px', color: '#374151', textAlign: 'center', fontWeight: 600 }}>
                  {eq.qty}
                </td>
                <td style={{ padding: '8px 10px', color: '#374151' }}>
                  {eq.capacity ?? <span style={{ color: '#CBD5E1' }}>—</span>}
                </td>
                <td style={{ padding: '8px 10px', color: '#374151' }}>
                  {eq.location ?? <span style={{ color: '#CBD5E1' }}>—</span>}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: conf.bg, color: conf.color }}>
                    {conf.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SystemCard({ sys, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const meta = CAT[sys.category] ?? CAT.other
  const eqCount = sys.equipment.length
  const totalQty = sys.equipment.reduce((s, e) => s + (e.qty || 0), 0)

  return (
    <div style={{ border: `1px solid ${sys.needsReview ? '#FCA5A5' : meta.border}`, borderRadius: 10, overflow: 'hidden', background: '#FFFFFF' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: meta.bg, color: meta.color, whiteSpace: 'nowrap', flex: 'none' }}>
          {meta.label}
        </span>

        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0F172A', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sys.name}
        </span>

        {sys.scope === 'sub_building' && sys.subBuildingId && (
          <span style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', borderRadius: 8, padding: '2px 8px', whiteSpace: 'nowrap', flex: 'none' }}>
            {sys.subBuildingId}
          </span>
        )}

        {sys.needsReview && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', borderRadius: 8, padding: '2px 8px', flex: 'none' }}>
            Проверить
          </span>
        )}

        <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap', flex: 'none' }}>
          {eqCount > 0 ? `${eqCount} поз. / ${totalQty} ед.` : 'нет оборудования'}
        </span>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ flex: 'none', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${meta.border}` }}>
          {sys.notes && (
            <div style={{ fontSize: 12, color: '#475569', padding: '8px 0 10px', lineHeight: 1.5 }}>
              {sys.notes}
            </div>
          )}
          {sys.basisNorms.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {sys.basisNorms.map((n, i) => (
                <span key={i} style={{ fontSize: 10, color: '#475569', background: '#F1F5F9', borderRadius: 8, padding: '2px 8px' }}>{n}</span>
              ))}
            </div>
          )}
          <EquipmentTable equipment={sys.equipment} />
        </div>
      )}
    </div>
  )
}

export default function TZSystemsView({ systemsData, buildings }) {
  const [activeBuilding, setActiveBuilding] = useState(0)

  if (!systemsData?.length) return null

  const buildingEntry = systemsData[activeBuilding]
  const building = buildings.find(b => b.id === buildingEntry?.buildingId)
  const systems = buildingEntry?.systems ?? []
  const reviewCount = systems.filter(s => s.needsReview).length
  const totalEq = systems.reduce((s, sys) => s + sys.equipment.reduce((a, e) => a + e.qty, 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Building tabs */}
      {systemsData.length > 1 && (
        <div className="tz-tabs" style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <style>{`.tz-tabs::-webkit-scrollbar{display:none}`}</style>
          {systemsData.map((entry, i) => {
            const b = buildings.find(b => b.id === entry.buildingId)
            const label = b?.name ?? entry.buildingId
            const rv = entry.systems.filter(s => s.needsReview).length
            return (
              <button
                key={entry.buildingId}
                onClick={() => setActiveBuilding(i)}
                style={{
                  padding: '8px 14px', flexShrink: 0,
                  fontSize: 13, fontWeight: activeBuilding === i ? 600 : 400,
                  color: activeBuilding === i ? '#1D4ED8' : '#64748B',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: `2px solid ${activeBuilding === i ? '#1D4ED8' : 'transparent'}`,
                  marginBottom: -1,
                  fontFamily: "'Golos Text',system-ui,sans-serif",
                  whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {label.length > 22 ? label.slice(0, 20) + '…' : label}
                {rv > 0 && (
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#FEF2F2', color: '#DC2626', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {rv}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Building summary row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '0 2px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', flex: 1 }}>
          {building?.name ?? buildingEntry?.buildingId}
        </div>
        <div style={{ fontSize: 11, color: '#64748B' }}>{systems.length} систем · {totalEq} ед. оборудования</div>
        {reviewCount > 0 && (
          <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: '#FEF2F2', borderRadius: 8, padding: '2px 10px' }}>
            {reviewCount} поз. требуют проверки
          </div>
        )}
      </div>

      {/* System cards */}
      {systems.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
          Инженерные системы для этого объекта не найдены
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {systems.map(sys => (
            <SystemCard key={sys.id} sys={sys} defaultOpen={sys.needsReview || systems.length <= 3} />
          ))}
        </div>
      )}
    </div>
  )
}
