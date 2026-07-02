import { useState } from 'react'

const FIELD_LABELS = {
  address:           'Адрес',
  floors:            'Этажей',
  territoryAreaSqm:  'Площадь участка, кв.м',
  year_built:        'Год постройки',
  purpose:           'Назначение',
}

const fmtArea = (n) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })

function BuildingCard({ building }) {
  const [showComponents, setShowComponents] = useState(false)
  const fields = Object.entries(FIELD_LABELS).filter(([k]) => building[k] != null)
  const hasComponents = building.areaSqmComponents?.length > 0

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#FFFFFF', flex: 'none',
        }}>
          {building.id.replace('b', '')}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>{building.name}</div>
            {building.needsReview && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: '#D97706',
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap',
              }}>★ требует проверки</span>
            )}
          </div>
          {building.purpose && (
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{building.purpose}</div>
          )}
        </div>
      </div>

      {/* areaSqm — отдельно, с раскрываемыми слагаемыми */}
      {building.areaSqm != null ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Площадь пола, кв.м
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1E293B' }}>
              {fmtArea(building.areaSqm)}
            </span>
            {hasComponents && (
              <button
                onClick={() => setShowComponents(v => !v)}
                style={{
                  fontSize: 11, color: '#1D4ED8', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                }}
              >
                {showComponents ? '▲ свернуть' : `▼ слагаемые (${building.areaSqmComponents.length} строений)`}
              </button>
            )}
          </div>
          {hasComponents && showComponents && (
            <div style={{
              marginTop: 8, borderRadius: 8, border: '1px solid #E2E8F0',
              background: '#F8FAFC', padding: '8px 12px',
              display: 'flex', flexDirection: 'column', gap: 3,
              maxHeight: 220, overflowY: 'auto',
            }}>
              {building.areaSqmComponents.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#374151' }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, minWidth: 56, textAlign: 'right', color: '#1D4ED8', flexShrink: 0 }}>
                    {fmtArea(c.area)}
                  </span>
                  <span style={{ color: '#64748B' }}>{c.name.replace(/\s*\(.*?\)\s*$/, '').trim()}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 4, paddingTop: 4, display: 'flex', gap: 8, fontSize: 12, fontWeight: 600 }}>
                <span style={{ minWidth: 56, textAlign: 'right', color: '#059669', flexShrink: 0 }}>
                  {fmtArea(building.areaSqm)}
                </span>
                <span style={{ color: '#059669' }}>Итого</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
          padding: '7px 12px', fontSize: 12, color: '#92400E', marginBottom: 12,
        }}>
          Площадь пола не найдена в ТЗ — уточните вручную перед расчётом штата
        </div>
      )}

      {/* Остальные поля */}
      {fields.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          {fields.map(([k, label]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1E293B', marginTop: 1 }}>
                {k === 'territoryAreaSqm' ? fmtArea(building[k]) : building[k]}
              </div>
            </div>
          ))}
        </div>
      )}

      {fields.length === 0 && !building.sub_buildings?.length && building.areaSqm == null && (
        <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
          Подробные данные в ТЗ не указаны
        </div>
      )}

      {building.sub_buildings?.length > 0 && (
        <div style={{ marginTop: fields.length ? 14 : 0 }}>
          <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
            Составные объекты ({building.sub_buildings.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {building.sub_buildings.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#CBD5E1', flex: 'none' }} />
                {s}
              </div>
            ))}
          </div>
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
