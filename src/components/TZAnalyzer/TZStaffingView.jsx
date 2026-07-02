import { useState } from 'react'
import { calcSummary } from '../../services/staffingHeuristic'

function buildingShortName(name) {
  if (!name) return '—'
  if (/гиперкуб/i.test(name)) return 'Гиперкуб'
  if (/усадьба/i.test(name)) return 'Усадьба'
  if (/нежилое|цдм/i.test(name)) return 'ЦДМ'
  if (/корпус?\s*2|корп\.?\s*2/i.test(name)) return 'КМ-2'
  if (/квартал|менделеева|корпус?\s*1|корп\.?\s*1/i.test(name)) return 'КМ-1'
  return name.slice(0, 18)
}

const fmtArea = (n) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })

const BASIS_COLORS = {
  heuristic: { color: '#1D4ED8', bg: '#EFF6FF', label: 'Эталон' },
  tz:        { color: '#7C3AED', bg: '#F5F3FF', label: 'ТЗ' },
  user:      { color: '#059669', bg: '#F0FDF4', label: 'Вручную' },
}

function RoleRow({ role }) {
  const [open, setOpen] = useState(false)
  const bc = BASIS_COLORS[role.basis] ?? BASIS_COLORS.heuristic
  const hasCombined = role.combinedWith?.length > 0

  return (
    <div style={{ borderBottom: '1px solid #F1F5F9' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 0', cursor: hasCombined ? 'pointer' : 'default',
      }} onClick={() => hasCombined && setOpen(v => !v)}>
        {/* Ставки */}
        <div style={{
          minWidth: 44, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#FFF', fontSize: 15, fontWeight: 700, flexShrink: 0,
        }}>
          {role.stavka}
        </div>
        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{role.role}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px',
              borderRadius: 5, background: bc.bg, color: bc.color,
            }}>{bc.label}</span>
            {hasCombined && (
              <span style={{ fontSize: 11, color: '#64748B' }}>
                + совмещения {open ? '▲' : '▼'}
              </span>
            )}
          </div>
          {role.note && (
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{role.note}</div>
          )}
        </div>
      </div>
      {hasCombined && open && (
        <div style={{
          margin: '0 0 10px 54px', background: '#F8FAFC',
          border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>
            Совмещаемые роли (новые ставки не нужны)
          </div>
          {role.combinedWith.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
              <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OffSiteBlock({ items }) {
  return (
    <div style={{
      background: '#FAFAFA', border: '1px solid #E2E8F0',
      borderRadius: 10, padding: '12px 16px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
        Служба за скобками — не в штат объекта
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: i < items.length - 1 ? 8 : 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{item.role}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{item.note}</div>
        </div>
      ))}
    </div>
  )
}

function SLABlock({ constraints }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: '#F8FAFC', border: 'none', cursor: 'pointer',
          fontFamily: "'Golos Text',system-ui,sans-serif",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Проверка ТЗ — требования закрыты {open ? '▲' : '▼'}
        </span>
        <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
          {constraints.length} / {constraints.length} ✓
        </span>
      </button>
      {open && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {constraints.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 10 }}>
              <span style={{ color: '#059669', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{c.requirement}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {c.coveredBy}
                  {c.source && <span style={{ marginLeft: 6, fontSize: 11, color: '#94A3B8' }}>({c.source})</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryBlock({ plans }) {
  const s = calcSummary(plans)
  if (!s) return null

  const rows = [
    { label: 'Инженер по эксплуатации', value: s.engineers, note: `${s.buildingCount} объект(ов) × 1` },
    { label: 'Техник-универсал', value: s.technicians, note: 'сумма по объектам' },
    { label: 'Дежурный (суточник)', value: s.watchStavki, note: 'ставок — режим сутки/трое' },
  ]

  return (
    <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
        Итого по всем объектам ({s.buildingCount})
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {rows.map(r => (
          <div key={r.label} style={{
            flex: '1 1 140px', background: '#FFFFFF', borderRadius: 10,
            border: '1px solid #BAE6FD', padding: '10px 14px',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0369A1' }}>{r.value}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#0F172A', marginTop: 2 }}>{r.label}</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{r.note}</div>
          </div>
        ))}
        <div style={{
          flex: '1 1 140px', background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
          borderRadius: 10, padding: '10px 14px',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>{s.totalStavki}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.85)', marginTop: 2 }}>Итого ставок на объектах</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 1 }}>без службы за скобками</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#0284C7', borderTop: '1px solid #BAE6FD', paddingTop: 10 }}>
        + Служба за скобками (диспетчерская + аварийная бригада) — общая на все объекты, учитывается отдельно
      </div>
    </div>
  )
}

export default function TZStaffingView({ staffingPlans }) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (!staffingPlans?.length) return null

  const plan = staffingPlans[activeIdx]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Building tabs */}
      {staffingPlans.length > 1 && (
        <div className="staff-tabs" style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid #E2E8F0',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          <style>{`.staff-tabs::-webkit-scrollbar{display:none}`}</style>
          {staffingPlans.map((p, i) => (
            <button
              key={p.buildingId}
              onClick={() => setActiveIdx(i)}
              style={{
                padding: '8px 14px', flexShrink: 0,
                fontSize: 13, fontWeight: activeIdx === i ? 600 : 400,
                color: activeIdx === i ? '#1D4ED8' : '#64748B',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${activeIdx === i ? '#1D4ED8' : 'transparent'}`,
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

      {/* Building header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>
              {plan.buildingName}
            </span>
            {plan.needsReview && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: '#D97706',
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 5, padding: '1px 6px',
              }}>★ уточните рассредоточенность</span>
            )}
          </div>
          {plan.areaSqm && (
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              Площадь пола: {fmtArea(plan.areaSqm)} кв.м · провенанс tz
            </div>
          )}
        </div>
        {plan.totalStavki != null && (
          <div style={{
            background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
            borderRadius: 10, padding: '8px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#FFF' }}>{plan.totalStavki}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.5px' }}>ставок на объекте</div>
          </div>
        )}
      </div>

      {/* Error state */}
      {plan.error && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400E',
        }}>
          {plan.error}
        </div>
      )}

      {/* Part A — штат на объекте */}
      {plan.roles.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
            А — Штат на объекте (провенанс: эталон)
          </div>
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '4px 14px' }}>
            {plan.roles.map(r => <RoleRow key={r.id} role={r} />)}
          </div>
        </div>
      )}

      {/* Part B — служба за скобками */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
          Б — Служба за скобками
        </div>
        <OffSiteBlock items={plan.offSite} />
      </div>

      {/* SLA floor check */}
      {plan.slaConstraints?.length > 0 && (
        <SLABlock constraints={plan.slaConstraints} />
      )}

      {/* ₽ stub */}
      <div style={{
        background: '#F8FAFC', border: '1px dashed #CBD5E1',
        borderRadius: 10, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18, color: '#CBD5E1' }}>₽</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8' }}>Слой ФОТ — в следующей итерации</div>
          <div style={{ fontSize: 12, color: '#CBD5E1' }}>
            Ставки специалистов (МСК дефолты) · редактируемые · провенанс user
          </div>
        </div>
      </div>

      {/* Summary across all buildings — shown only when multiple buildings */}
      {staffingPlans.length > 1 && <SummaryBlock plans={staffingPlans} />}
    </div>
  )
}
