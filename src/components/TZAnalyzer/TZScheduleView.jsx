import { useState, useEffect } from 'react'

const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

const CAT = {
  heating:    { label: 'Тепло',        color: '#92400E', bg: '#FEF3C7' },
  hvac:       { label: 'Вентиляция',   color: '#1E40AF', bg: '#EFF6FF' },
  plumbing:   { label: 'Водоснабж.',   color: '#166534', bg: '#F0FDF4' },
  electrical: { label: 'Электро',      color: '#713F12', bg: '#FEFCE8' },
  fire:       { label: 'Пожарная',     color: '#B91C1C', bg: '#FEF2F2' },
  security:   { label: 'Охрана',       color: '#374151', bg: '#F9FAFB' },
  lowcurrent: { label: 'СКС / ЛВС',   color: '#5B21B6', bg: '#F5F3FF' },
  media:      { label: 'Медиа',        color: '#312E81', bg: '#EEF2FF' },
  bms:        { label: 'BMS',          color: '#075985', bg: '#F0F9FF' },
  elevator:   { label: 'Лифты',        color: '#9A3412', bg: '#FFF7ED' },
  structural: { label: 'Конструкции',  color: '#1F2937', bg: '#F9FAFB' },
  other:      { label: 'Прочее',       color: '#475569', bg: '#F8FAFC' },
}

const MODE_COLOR = { TO: '#1D4ED8', EK: '#059669' }
const MODE_BG    = { TO: '#EEF2FF', EK: '#F0FDF4' }

function buildingShortName(name) {
  if (!name) return '—'
  if (/гиперкуб/i.test(name)) return 'Гиперкуб'
  if (/усадьба/i.test(name)) return 'Усадьба'
  if (/нежилое|цдм/i.test(name)) return 'ЦДМ'
  if (/корпус?\s*2|корп\.?\s*2/i.test(name)) return 'КМ-2'
  if (/квартал|менделеева|корпус?\s*1|корп\.?\s*1/i.test(name)) return 'КМ-1'
  return name.slice(0, 18)
}

export default function TZScheduleView({ systemsData, buildings, defaultMode = 'TO', lockMode = false, hideBuildingSwitcher = false }) {
  const [selectedBuildingId, setSelectedBuildingId] = useState(buildings[0]?.id ?? null)
  const [selectedMode, setSelectedMode] = useState(defaultMode)

  // Sync selected building when buildings prop changes (e.g. header switcher changed activeBuildingId)
  useEffect(() => {
    if (buildings.length > 0 && !buildings.find(b => b.id === selectedBuildingId)) {
      setSelectedBuildingId(buildings[0].id)
    }
  }, [buildings])

  const buildingSystems = (systemsData.find(b => b.buildingId === selectedBuildingId)?.systems ?? [])
    .filter(s => s.maintenanceTasks?.length > 0)

  function tasksForMonth(system, monthNum) {
    return (system.maintenanceTasks ?? []).filter(
      t => t.mode === selectedMode && t.months.includes(monthNum)
    )
  }

  function totalTasks(system) {
    return new Set(
      (system.maintenanceTasks ?? [])
        .filter(t => t.mode === selectedMode)
        .map(t => t.opNum || t.operation.slice(0, 40))
    ).size
  }

  const modeColor = MODE_COLOR[selectedMode]
  const modeBg    = MODE_BG[selectedMode]

  if (!buildings.length || !systemsData.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Building switcher — скрываем если один объект или платформенный режим */}
      {!hideBuildingSwitcher && buildings.length > 1 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {buildings.map(b => {
          const active = b.id === selectedBuildingId
          const bSystems = (systemsData.find(x => x.buildingId === b.id)?.systems ?? [])
            .filter(s => s.maintenanceTasks?.length > 0)
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBuildingId(b.id)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? '#1D4ED8' : '#F1F5F9',
                color: active ? '#FFFFFF' : '#475569',
                fontSize: 13, fontWeight: active ? 600 : 400,
                fontFamily: "'Golos Text',system-ui,sans-serif",
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {buildingShortName(b.name)}
              {bSystems.length > 0 && (
                <span style={{
                  background: active ? 'rgba(255,255,255,0.25)' : '#CBD5E1',
                  color: active ? '#fff' : '#64748B',
                  borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 600,
                }}>
                  {bSystems.length}
                </span>
              )}
            </button>
          )
        })}
      </div>}

      {/* Mode switcher — скрываем если режим зафиксирован */}
      {!lockMode && <div style={{ display: 'flex', gap: 6 }}>
        {[['TO', 'Техническое обслуживание (ТО)'], ['EK', 'Эксплуатационный контроль (ЭК)']].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setSelectedMode(mode)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: selectedMode === mode ? MODE_BG[mode] : '#F8FAFC',
              color: selectedMode === mode ? MODE_COLOR[mode] : '#94A3B8',
              fontSize: 13, fontWeight: selectedMode === mode ? 600 : 400,
              fontFamily: "'Golos Text',system-ui,sans-serif",
              boxShadow: selectedMode === mode ? `inset 0 0 0 1.5px ${MODE_COLOR[mode]}` : 'inset 0 0 0 1px #E2E8F0',
            }}
          >
            {label}
          </button>
        ))}
      </div>}

      {/* Matrix */}
      {buildingSystems.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          Задачи {selectedMode} не найдены для этого здания
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #E2E8F0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{
                  padding: '8px 14px', textAlign: 'left', color: '#64748B',
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px',
                  borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap',
                  position: 'sticky', left: 0, background: '#F8FAFC', zIndex: 2, minWidth: 200,
                }}>
                  Система
                </th>
                {MONTHS.map((m, i) => (
                  <th key={i} style={{
                    padding: '8px 6px', textAlign: 'center', color: '#64748B',
                    fontSize: 11, fontWeight: 600, borderBottom: '2px solid #E2E8F0',
                    minWidth: 38,
                  }}>
                    {m}
                  </th>
                ))}
                <th style={{
                  padding: '8px 10px', textAlign: 'center', color: '#64748B',
                  fontSize: 11, fontWeight: 600, borderBottom: '2px solid #E2E8F0',
                  whiteSpace: 'nowrap', minWidth: 56,
                }}>
                  Итого
                </th>
              </tr>
            </thead>
            <tbody>
              {buildingSystems.map((system, si) => {
                const cat = CAT[system.category] ?? CAT.other
                const total = totalTasks(system)
                const hasAny = total > 0
                return (
                  <tr
                    key={system.id}
                    style={{
                      background: si % 2 === 0 ? '#FFFFFF' : '#FAFBFC',
                      opacity: hasAny ? 1 : 0.45,
                    }}
                  >
                    {/* System name cell */}
                    <td style={{
                      padding: '9px 14px',
                      borderBottom: '1px solid #F1F5F9',
                      position: 'sticky', left: 0,
                      background: si % 2 === 0 ? '#FFFFFF' : '#FAFBFC',
                      zIndex: 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{
                          background: cat.bg, color: cat.color,
                          borderRadius: 4, padding: '2px 6px',
                          fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {cat.label}
                        </span>
                        <span style={{
                          color: '#0F172A', fontWeight: 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 220,
                        }} title={system.name}>
                          {system.name}
                        </span>
                        {system.needsReview && (
                          <span style={{ color: '#F59E0B', fontSize: 14, flexShrink: 0 }}>★</span>
                        )}
                      </div>
                    </td>

                    {/* Month cells */}
                    {MONTHS.map((_, mi) => {
                      const tasks = tasksForMonth(system, mi + 1)
                      const n = tasks.length
                      return (
                        <td
                          key={mi}
                          title={n > 0 ? tasks.map(t => `${t.periodicity}: ${t.operation.slice(0, 60)}`).join('\n') : ''}
                          style={{
                            padding: '6px 4px', textAlign: 'center',
                            borderBottom: '1px solid #F1F5F9',
                            background: n > 0 ? modeBg : 'transparent',
                            cursor: n > 0 ? 'default' : 'default',
                          }}
                        >
                          {n > 0 && (
                            <span style={{
                              display: 'inline-block',
                              minWidth: 20, height: 20, lineHeight: '20px',
                              borderRadius: '50%',
                              background: modeColor,
                              color: '#FFFFFF',
                              fontSize: 10, fontWeight: 700,
                              textAlign: 'center',
                            }}>
                              {n > 9 ? '9+' : n}
                            </span>
                          )}
                        </td>
                      )
                    })}

                    {/* Total */}
                    <td style={{
                      padding: '6px 10px', textAlign: 'center',
                      borderBottom: '1px solid #F1F5F9',
                      fontWeight: 600, color: hasAny ? modeColor : '#CBD5E1',
                      fontSize: 13,
                    }}>
                      {total || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94A3B8', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            display: 'inline-block', width: 16, height: 16, borderRadius: '50%',
            background: modeColor, lineHeight: '16px', textAlign: 'center',
            color: '#fff', fontSize: 9, fontWeight: 700,
          }}>3</span>
          — количество операций в месяц
        </div>
        <div>★ — система добавлена из графика (не было в прозе ТЗ)</div>
      </div>
    </div>
  )
}
