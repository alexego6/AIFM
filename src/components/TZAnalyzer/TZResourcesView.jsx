import { useState, useMemo } from 'react'
import { calcGroupResources } from '../../services/resourcesHeuristic.js'

// ── Метки и цвета для ключей классов ─────────────────────────────────────────
const CLASS_META = {
  ahu:              { label: 'ПВУ/АХУ',       color: '#1E40AF', bg: '#EFF6FF' },
  fancoil:          { label: 'Фанкойл',        color: '#0E7490', bg: '#ECFEFF' },
  cooling_beam:     { label: 'Охл. балки',     color: '#0369A1', bg: '#F0F9FF' },
  chiller:          { label: 'Чиллер',         color: '#0F766E', bg: '#F0FDFA' },
  vrf:              { label: 'VRF/сплит',      color: '#7C3AED', bg: '#F5F3FF' },
  fan:              { label: 'Вентилятор',     color: '#1D4ED8', bg: '#DBEAFE' },
  air_curtain:      { label: 'Завеса',         color: '#2563EB', bg: '#EFF6FF' },
  pump:             { label: 'Насос',          color: '#166534', bg: '#F0FDF4' },
  boiler:           { label: 'Котёл',          color: '#92400E', bg: '#FEF3C7' },
  heat_exchanger:   { label: 'Теплообм.',      color: '#9A3412', bg: '#FFF7ED' },
  expansion_vessel: { label: 'Расш. бак',      color: '#92400E', bg: '#FEF3C7' },
  ups:              { label: 'ИБП',            color: '#713F12', bg: '#FEFCE8' },
  panel:            { label: 'Щит ЭЩ',         color: '#A16207', bg: '#FEFCE8' },
  lighting:         { label: 'Освещение',      color: '#A16207', bg: '#FEF9C3' },
  fire_ext:         { label: 'Огнетуш.',       color: '#B91C1C', bg: '#FEF2F2' },
  smoke_detector:   { label: 'Датчик ДУ',      color: '#B91C1C', bg: '#FEF2F2' },
  sanitary:         { label: 'Сантехника',     color: '#0F766E', bg: '#F0FDFA' },
  fire_hose:        { label: 'Пожар. кран',    color: '#991B1B', bg: '#FEF2F2' },
  elevator:         { label: 'Лифт',           color: '#9A3412', bg: '#FFF7ED' },
  solar:            { label: 'Солн. панели',   color: '#15803D', bg: '#F0FDF4' },
}

function ClassBadge({ cls }) {
  const m = CLASS_META[cls] ?? { label: cls, color: '#475569', bg: '#F8FAFC' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px',
      borderRadius: 5, background: m.bg, color: m.color,
      whiteSpace: 'nowrap', letterSpacing: '.3px',
    }}>{m.label}</span>
  )
}

function PendingBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: '2px 7px',
      borderRadius: 5, background: '#F1F5F9', color: '#94A3B8',
      whiteSpace: 'nowrap',
    }}>по факту 12 мес.</span>
  )
}

function buildingShortName(name) {
  if (!name) return '—'
  if (/гиперкуб/i.test(name)) return 'Гиперкуб'
  if (/усадьба/i.test(name)) return 'Усадьба'
  if (/нежилое|цдм/i.test(name)) return 'ЦДМ'
  if (/корпус?\s*2|корп\.?\s*2/i.test(name)) return 'КМ-2'
  if (/квартал|менделеева|корпус?\s*1|корп\.?\s*1/i.test(name)) return 'КМ-1'
  return name.slice(0, 18)
}

// ── Таблица ЗИП / Расходников ─────────────────────────────────────────────────
function ResourceTable({ items, isGroup = false }) {
  if (!items.length) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
        Нет данных — оборудование этого типа в ТЗ не зафиксировано
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #E2E8F0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#F8FAFC' }}>
            {['Система', 'Оборудование', 'Позиция номенклатуры', 'Установлено, ед.', 'Год. норма'].map(h => (
              <th key={h} style={{
                padding: '8px 12px', textAlign: 'left',
                fontSize: 10, fontWeight: 700, color: '#64748B',
                textTransform: 'uppercase', letterSpacing: '.4px',
                borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                <ClassBadge cls={item.forClass} />
              </td>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle', maxWidth: 200 }}>
                <div style={{ fontWeight: 500, color: '#1E293B', lineHeight: 1.3 }}>
                  {item.forEquipment?.name || '—'}
                </div>
                {item.forEquipment?.brand && (
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.forEquipment.brand}</div>
                )}
              </td>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle', maxWidth: 260 }}>
                <div style={{ color: '#0F172A' }}>{item.name}</div>
                {item.note && (
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{item.note}</div>
                )}
              </td>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle', textAlign: 'center' }}>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>
                  {item.installedQty ?? '—'}
                </span>
              </td>
              <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                {item.annualQty != null
                  ? <span style={{ fontWeight: 600 }}>{item.annualQty}</span>
                  : <PendingBadge />
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Инструмент ────────────────────────────────────────────────────────────────
function ToolsSection({ tools, viewMode }) {
  const arr = Array.isArray(tools) ? tools : []
  const baseObj   = arr.filter(t => t.basis === 'base'  && t.scope === 'object')
  const classBoth = arr.filter(t => t.basis === 'class')
  const groupAll  = arr.filter(t => t.scope === 'group')

  const Section = ({ title, items, color = '#1E293B', bg = '#F8FAFC', borderColor = '#E2E8F0', badge }) => (
    items.length === 0 ? null : (
      <div style={{ background: '#FFFFFF', border: `1px solid ${borderColor}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{
          padding: '9px 14px', background: bg,
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 7px',
              borderRadius: 4, background: borderColor, color,
            }}>{badge}</span>
          )}
        </div>
        <div style={{ padding: '2px 0' }}>
          {items.map((t, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px',
              borderBottom: i < items.length - 1 ? '1px solid #F1F5F9' : 'none',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: color === '#1E293B' ? '#CBD5E1' : color,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: '#0F172A', flex: 1 }}>{t.name}</span>
              {t.forClass && <ClassBadge cls={t.forClass} />}
              {t.scope === 'group' && t.basis !== 'base' && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 6px',
                  borderRadius: 4, background: '#FFF7ED', color: '#9A3412',
                }}>на группу</span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Section
        title="Базовый набор — на каждый объект"
        items={baseObj}
        bg="#F8FAFC"
        borderColor="#E2E8F0"
        color="#1E293B"
      />
      {classBoth.length > 0 && (
        <Section
          title="По оборудованию объекта"
          items={classBoth}
          bg="#EFF6FF"
          borderColor="#BFDBFE"
          color="#1D4ED8"
        />
      )}
      <Section
        title={viewMode === 'group'
          ? 'Групповой инструмент — 1 ед. на всю группу объектов'
          : 'Общегрупповой — дорогой/редкий, 1 ед. на группу'}
        items={groupAll}
        bg="#FFF7ED"
        borderColor="#FED7AA"
        color="#C2410C"
        badge={viewMode === 'object' ? 'не на объект' : undefined}
      />
    </div>
  )
}

// ── Блок незамапленных классов ────────────────────────────────────────────────
function UnmappedBlock({ classes }) {
  if (!classes?.length) return null
  return (
    <div style={{
      marginTop: 4,
      padding: '12px 16px',
      background: '#FFFBEB',
      border: '1px solid #FCD34D',
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
        Классы оборудования без привязки ресурсов — нужен ручной разбор
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {classes.map(c => (
          <code key={c} style={{
            fontSize: 11, padding: '2px 8px',
            background: '#FEF3C7', color: '#78350F',
            borderRadius: 4, fontFamily: 'monospace',
          }}>{c}</code>
        ))}
      </div>
    </div>
  )
}

// ── Хелпер подсчёта по табу ───────────────────────────────────────────────────
function countForTab(tab, plan) {
  if (!plan) return 0
  if (tab === 'zip')         return plan.spareParts?.length  ?? 0
  if (tab === 'consumables') return plan.consumables?.length ?? 0
  if (tab === 'tools')       return plan.tools?.length       ?? 0
  return 0
}

const TABS = [
  { key: 'zip',         label: 'ЗИП' },
  { key: 'consumables', label: 'Расходники' },
  { key: 'tools',       label: 'Инструмент' },
]

// ── Главный компонент ─────────────────────────────────────────────────────────
export default function TZResourcesView({ resourcesPlans }) {
  const [viewMode,       setViewMode]       = useState('object') // 'object' | 'group'
  const [activeBuilding, setActiveBuilding] = useState(0)
  const [activeTab,      setActiveTab]      = useState('zip')

  const groupPlan = useMemo(
    () => (resourcesPlans?.length ? calcGroupResources(resourcesPlans) : null),
    [resourcesPlans],
  )

  if (!resourcesPlans?.length) return null

  const objPlan   = resourcesPlans[activeBuilding]
  const activePlan = viewMode === 'group' ? groupPlan : objPlan

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Переключатель среза ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', background: '#F1F5F9', borderRadius: 10,
        padding: 3, gap: 3, width: 'fit-content',
      }}>
        {[
          { key: 'object', label: 'По объекту' },
          { key: 'group',  label: 'Сводно по группе' },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setViewMode(v.key)}
            style={{
              padding: '6px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: viewMode === v.key ? '#FFFFFF' : 'transparent',
              color: viewMode === v.key ? '#0F172A' : '#64748B',
              fontSize: 13, fontWeight: viewMode === v.key ? 600 : 400,
              boxShadow: viewMode === v.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              fontFamily: "'Golos Text',system-ui,sans-serif",
              transition: 'all .15s',
            }}
          >{v.label}</button>
        ))}
      </div>

      {/* ── Выбор здания (только в режиме "По объекту") ─────────────────── */}
      {viewMode === 'object' && resourcesPlans.length > 1 && (
        <div className="res-bld-tabs" style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid #E2E8F0',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          <style>{`.res-bld-tabs::-webkit-scrollbar{display:none}`}</style>
          {resourcesPlans.map((p, i) => (
            <button
              key={p.buildingId}
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
              }}
            >
              {buildingShortName(p.buildingName)}
            </button>
          ))}
        </div>
      )}

      {/* ── Вкладки ЗИП / Расходники / Инструмент ──────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const cnt = countForTab(t.key, activePlan)
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? '#EFF6FF' : '#F8FAFC',
                color: active ? '#1D4ED8' : '#94A3B8',
                fontSize: 13, fontWeight: active ? 600 : 400,
                fontFamily: "'Golos Text',system-ui,sans-serif",
                boxShadow: active ? 'inset 0 0 0 1.5px #1D4ED8' : 'inset 0 0 0 1px #E2E8F0',
              }}
            >
              {t.label}
              {cnt > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: 11, fontWeight: 700,
                  background: active ? '#1D4ED8' : '#CBD5E1',
                  color: '#fff', borderRadius: 10, padding: '1px 6px',
                }}>{cnt}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Контент вкладки ────────────────────────────────────────────── */}
      {activeTab === 'zip' && (
        <>
          <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
            Phase 1: номенклатура определена по классам оборудования Stage 2.
            Годовая норма — <strong>по факту 12 мес. эксплуатации</strong> (Phase 2).
          </div>
          <ResourceTable items={activePlan?.spareParts ?? []} isGroup={viewMode === 'group'} />
          <UnmappedBlock classes={activePlan?.unmappedClasses} />
        </>
      )}
      {activeTab === 'consumables' && (
        <>
          <ResourceTable items={activePlan?.consumables ?? []} isGroup={viewMode === 'group'} />
          <UnmappedBlock classes={activePlan?.unmappedClasses} />
        </>
      )}
      {activeTab === 'tools' && (
        <ToolsSection tools={activePlan?.tools ?? []} viewMode={viewMode} />
      )}

    </div>
  )
}
