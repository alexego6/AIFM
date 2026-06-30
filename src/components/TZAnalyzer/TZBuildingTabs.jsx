import { useState } from 'react'

const FIELD_LABELS = {
  address:    'Адрес',
  floors:     'Этажей',
  area_m2:    'Площадь, кв.м',
  year_built: 'Год постройки',
  purpose:    'Назначение',
}

function BuildingCard({ building }) {
  const fields = Object.entries(FIELD_LABELS).filter(([k]) => building[k] != null)

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#FFFFFF', flex: 'none',
        }}>
          {building.id.replace('b', '')}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>{building.name}</div>
          {building.purpose && (
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{building.purpose}</div>
          )}
        </div>
      </div>

      {fields.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          {fields.map(([k, label]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1E293B', marginTop: 1 }}>
                {k === 'area_m2' ? building[k].toLocaleString('ru') : building[k]}
              </div>
            </div>
          ))}
        </div>
      )}

      {fields.length === 0 && (
        <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
          Подробные данные в ТЗ не указаны
        </div>
      )}
    </div>
  )
}

export default function TZBuildingTabs({ buildings }) {
  const [active, setActive] = useState(0)

  if (!buildings.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Вкладки */}
      {buildings.length > 1 && (
        <div className="tz-tabs" style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid #E2E8F0', marginBottom: 16,
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          <style>{`.tz-tabs::-webkit-scrollbar{display:none}`}</style>
          {buildings.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setActive(i)}
              style={{
                padding: '8px 14px', flexShrink: 0,
                fontSize: 13, fontWeight: active === i ? 600 : 400,
                color: active === i ? '#1D4ED8' : '#64748B',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${active === i ? '#1D4ED8' : 'transparent'}`,
                marginBottom: -1,
                fontFamily: "'Golos Text',system-ui,sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              {b.name.length > 22 ? b.name.slice(0, 20) + '…' : b.name}
            </button>
          ))}
        </div>
      )}

      <BuildingCard building={buildings[active]} />
    </div>
  )
}
