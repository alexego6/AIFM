import { useMemo } from 'react'
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { EQUIPMENT, SYSTEMS } from '../../data/building'
import { WEAR_DATA } from '../../data/wear'
import { TICKETS } from '../../data/tickets'
import { usePlatformStore } from '../../store/usePlatformStore'
import {
  tasksPerMonth, tasksThisMonth, totalEquipmentUnits, systemsDistribution,
} from '../../services/platformAdapter'
import StaffPanel from './StaffPanel'
import { useSessionStore } from '../../store/useSessionStore'
import { can } from '../../config/roleAccess'

const TODAY = new Date()
const CURRENT_MONTH = TODAY.getMonth() // 0-based

const MONTH_LABELS = ['Я','Ф','М','А','М','И','И','А','С','О','Н','Д']
const MOCK_BAR = [14,18,22,25,28,24,30,27,31,26,21,19]

const card      = { background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:14, padding:'18px 20px', position:'relative', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }
const chartCard = { background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }

// Stub card shown instead of mock blocks when applied
function StubCard({ title, note }) {
  return (
    <div style={{ ...chartCard, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, minHeight:160, opacity:.7 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
      <div style={{ fontSize:13, fontWeight:600, color:'#94A3B8' }}>{title}</div>
      {note && <div style={{ fontSize:11, color:'#CBD5E1', textAlign:'center' }}>{note}</div>}
    </div>
  )
}

function LightTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:8, padding:'8px 12px', fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
      {label && <div style={{ color:'#374151', marginBottom:4, fontWeight:500 }}>{label}</div>}
      {payload.map(p => (
        <div key={p.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:8, height:8, borderRadius:2, background:p.fill||p.color, flex:'none' }}/>
          <span style={{ color:'#6B7280' }}>{p.name}:</span>
          <span style={{ color:'#0D1117', fontWeight:600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

const DASH_KPIS_ICONS = {
  tickets: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  done:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>,
  overdue: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  work:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  systems: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  equip:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  tasks:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  zip:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 8h14M5 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/><path d="M19 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/><path d="M12 3v18M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/></svg>,
}

// ── Platform-data dashboard ──────────────────────────────────────────────────
function PlatformDashboard({ buildingData, staffingEntry, resourcesEntry, appliedAt, buildingName, buildingId, canManageStaff, isDirector }) {
  const sysDist = useMemo(() => systemsDistribution(buildingData), [buildingData])
  const monthCounts = useMemo(() => tasksPerMonth(buildingData), [buildingData])
  const eqTotal  = useMemo(() => totalEquipmentUnits(buildingData), [buildingData])
  const tasksMon = useMemo(() => tasksThisMonth(buildingData, CURRENT_MONTH), [buildingData])
  const sysCount = buildingData?.systems?.length ?? 0

  // FOT from staffing
  const fot = staffingEntry
    ? (() => {
        const eng  = (staffingEntry.numEngineers  ?? 0) * 120_000
        const tech = (staffingEntry.numTechnicians ?? 0) * 75_000
        const watch= (staffingEntry.watchStavki    ?? 0) * 65_000
        return (eng + tech + watch) * 1.3
      })()
    : null

  // ZIP from resources
  const zipCount = resourcesEntry?.spareParts?.length ?? 0

  // Pie data from systems
  const PIE_COLORS = ['#1D4ED8','#059669','#D97706','#7C3AED','#0E7490','#B91C1C']
  const pieData = sysDist.map((s, i) => ({
    label: s.code ?? s.name,
    name: s.name,
    value: s.eqCount || 1,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const kpiCfg = [
    { label: 'Систем', value: sysCount, color: '#1D4ED8', key: 'systems' },
    { label: 'Единиц оборудования', value: eqTotal, color: '#059669', key: 'equip' },
    { label: `Операций в ${MONTH_LABELS[CURRENT_MONTH]}`, value: tasksMon, color: '#7C3AED', key: 'tasks' },
    { label: 'Позиций ЗИП', value: zipCount, color: '#D97706', key: 'zip' },
  ]

  const fmt = n => n >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + ' М₽'
    : n >= 1_000
    ? (n / 1_000).toFixed(0) + ' тыс. ₽'
    : n + ' ₽'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Applied banner */}
      <div style={{ background:'#F0FDF4', border:'1px solid #A7F3D0', borderRadius:10, padding:'10px 16px', display:'flex', alignItems:'center', gap:10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
        <span style={{ fontSize:13, fontWeight:600, color:'#059669' }}>Платформа наполнена из ТЗ</span>
        <span style={{ fontSize:12, color:'#6EE7B7', marginLeft:'auto' }}>{buildingName}</span>
        {appliedAt && <span style={{ fontSize:11, color:'#A7F3D0' }}>{new Date(appliedAt).toLocaleDateString('ru-RU')}</span>}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {kpiCfg.map(k => (
          <div key={k.key} style={card}>
            <div style={{ position:'absolute', right:-10, top:-10, width:70, height:70, borderRadius:'50%', background:k.color, filter:'blur(24px)', opacity:.14 }}/>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:12 }}>
              <span style={{ width:32, height:32, borderRadius:8, background:k.color+'15', display:'flex', alignItems:'center', justifyContent:'center', color:k.color }}>
                {DASH_KPIS_ICONS[k.key]}
              </span>
              <span style={{ fontSize:12, color:'#6B7280', fontWeight:500 }}>{k.label}</span>
            </div>
            <div style={{ fontSize:32, fontWeight:700, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Row 2 */}
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:14 }}>
        {/* Bar: tasks per month */}
        <div style={chartCard}>
          <h3 style={{ margin:'0 0 20px', fontSize:14, fontWeight:600, color:'#0D1117' }}>Операций ТО/ЭК по месяцам</h3>
          <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:190 }}>
            {monthCounts.map((v, i) => {
              const maxV = Math.max(...monthCounts, 1)
              const h = Math.round(v / maxV * 100)
              const isNow = i === CURRENT_MONTH
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                  <span style={{ fontSize:10, color:'#6B7280', fontFamily:"'JetBrains Mono',monospace" }}>{v || ''}</span>
                  <div style={{ width:'100%', height:`${Math.max(h,2)}%`, background: isNow ? 'linear-gradient(180deg,#059669,#34D399)' : 'linear-gradient(180deg,#1D4ED8,#7C3AED)', borderRadius:'4px 4px 0 0', minHeight:4 }}/>
                  <span style={{ fontSize:10, color: isNow ? '#059669' : '#9CA3AF', fontWeight: isNow ? 700 : 400 }}>{MONTH_LABELS[i]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pie: systems distribution */}
        <div style={chartCard}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600, color:'#0D1117' }}>Распределение по системам</h3>
          {pieData.length === 0 ? (
            <div style={{ fontSize:13, color:'#94A3B8', padding:16 }}>Нет данных</div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:120, height:120, flex:'none' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={54} dataKey="value" strokeWidth={2} stroke="#FFFFFF">
                      {pieData.map((e,i) => <Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip content={<LightTooltip />}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1 }}>
                {pieData.map(e => (
                  <div key={e.label} style={{ display:'flex', alignItems:'center', gap:9, fontSize:12 }}>
                    <span style={{ width:10, height:10, borderRadius:3, background:e.color, flex:'none' }}/>
                    <span style={{ flex:1, color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.label}</span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", color:'#6B7280', fontWeight:600 }}>{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* FOT card */}
        {fot != null ? (
          <div style={chartCard}>
            <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:600, color:'#0D1117' }}>Штат и ФОТ</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { label:'Инженеров', value: staffingEntry.numEngineers  ?? 0 },
                { label:'Техников',  value: staffingEntry.numTechnicians ?? 0 },
                { label:'Ставок дежурных', value: staffingEntry.watchStavki ?? 0 },
              ].map(r => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0', borderBottom:'1px solid #F1F5F9' }}>
                  <span style={{ color:'#374151' }}>{r.label}</span>
                  <span style={{ fontWeight:600 }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:700, marginTop:4 }}>
                <span style={{ color:'#0F172A' }}>ФОТ / мес (×1.3)</span>
                <span style={{ color:'#1D4ED8' }}>{fmt(Math.round(fot / 12))}</span>
              </div>
            </div>
          </div>
        ) : (
          <StubCard title="Нет плана штата" note="Выполните Этап 5 и переприменитe" />
        )}

        {/* ZIP status */}
        <div style={chartCard}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:600, color:'#0D1117' }}>Статус ЗИП</h3>
          {resourcesEntry ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0', borderBottom:'1px solid #F1F5F9' }}>
                <span style={{ color:'#374151' }}>Позиций ЗИП</span>
                <span style={{ fontWeight:600 }}>{resourcesEntry.spareParts?.length ?? 0}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0', borderBottom:'1px solid #F1F5F9' }}>
                <span style={{ color:'#374151' }}>Расходники</span>
                <span style={{ fontWeight:600 }}>{resourcesEntry.consumables?.length ?? 0}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0' }}>
                <span style={{ color:'#374151' }}>Статус норм</span>
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:5, background:'#FEF3C7', color:'#92400E' }}>по факту 12 мес.</span>
              </div>
              <div style={{ fontSize:11, color:'#94A3B8', marginTop:4, lineHeight:1.5 }}>
                Phase 1: номенклатура определена. Годовая норма — после 12 мес. эксплуатации (Phase 2).
              </div>
            </div>
          ) : (
            <div style={{ fontSize:13, color:'#94A3B8', padding:8 }}>Нет данных ЗИП — выполните Этап 5</div>
          )}
        </div>
      </div>

      {/* Row 4: реестр исполнителей (только chief/director) */}
      {canManageStaff && <StaffPanel buildingId={buildingId} />}

      {/* Руководитель УК: сводный режим — портфель всех объектов */}
      {isDirector && <PortfolioSummary />}

      {/* Руководитель УК: загрузка контракта — заглушка (в разработке) */}
      {isDirector && (
        <div style={{ background:'#FFFFFF', border:'1px dashed #C7D2FE', borderRadius:14, padding:'16px 20px',
          display:'flex', alignItems:'center', gap:12 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.6">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#4338CA' }}>Загрузить контракт на ТО</div>
            <div style={{ fontSize:11, color:'#9CA3AF' }}>Сверка объёмов контракта с плановыми графиками — в разработке</div>
          </div>
          <button disabled style={{ fontSize:12, fontWeight:600, color:'#94A3B8', background:'#F1F5F9',
            border:'none', borderRadius:8, padding:'8px 16px', cursor:'not-allowed', fontFamily:'inherit' }}>
            В разработке
          </button>
        </div>
      )}
    </div>
  )
}

// ── Сводный режим директора: портфель всех объектов ─────────────────────────
function PortfolioSummary() {
  const { buildings, systemsData, staffingPlan } = usePlatformStore()
  const rows = useMemo(() => buildings.map(b => {
    const sd = systemsData.find(s => s.buildingId === b.id)
    const plan = staffingPlan.find(p => p.buildingId === b.id)
    const sysCount = sd?.systems?.length ?? 0
    const monthTasks = sd ? tasksThisMonth(sd, new Date().getMonth()) : 0
    const fot = plan
      ? Math.round(((plan.numEngineers ?? 0) * 120_000 + (plan.numTechnicians ?? 0) * 75_000 + (plan.watchStavki ?? 0) * 65_000) * 1.3)
      : null
    return { id: b.id, name: b.name, areaSqm: b.areaSqm, sysCount, monthTasks, fot }
  }), [buildings, systemsData, staffingPlan])

  const totalFot = rows.reduce((s, r) => s + (r.fot ?? 0), 0)
  const fmtR = n => n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + ' М₽' : Math.round(n / 1000) + ' тыс. ₽'

  return (
    <div style={{ background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:14, padding:20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:'#0D1117' }}>Портфель объектов (сводно)</h3>
        <span style={{ fontSize:13, fontWeight:700, color:'#7C3AED' }}>ФОТ портфеля: {fmtR(totalFot)}/мес</span>
      </div>
      <div style={{ display:'flex', padding:'6px 0', borderBottom:'1px solid #E8ECF5', fontSize:11, fontWeight:600, color:'#6B7280' }}>
        <div style={{ flex:2 }}>Объект</div>
        <div style={{ flex:1, textAlign:'right' }}>Площадь, м²</div>
        <div style={{ flex:1, textAlign:'right' }}>Систем</div>
        <div style={{ flex:1, textAlign:'right' }}>Операций/мес</div>
        <div style={{ flex:1, textAlign:'right' }}>ФОТ/мес</div>
      </div>
      {rows.map(r => (
        <div key={r.id} style={{ display:'flex', padding:'8px 0', borderBottom:'1px solid #F3F4F6', fontSize:12, color:'#374151' }}>
          <div style={{ flex:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:8 }}>{r.name}</div>
          <div style={{ flex:1, textAlign:'right' }}>{r.areaSqm ? r.areaSqm.toLocaleString('ru-RU') : '—'}</div>
          <div style={{ flex:1, textAlign:'right' }}>{r.sysCount}</div>
          <div style={{ flex:1, textAlign:'right' }}>{r.monthTasks}</div>
          <div style={{ flex:1, textAlign:'right', fontWeight:600 }}>{r.fot != null ? fmtR(r.fot) : '—'}</div>
        </div>
      ))}
    </div>
  )
}

// ── Mock dashboard (no applied data) ────────────────────────────────────────
function MockDashboard() {
  const kpis = useMemo(() => ({
    total:   TICKETS.length,
    done:    TICKETS.filter(t => t.status === 'done').length,
    overdue: TICKETS.filter(t => t.status !== 'done' && new Date(t.due) < TODAY).length,
    work:    TICKETS.filter(t => t.status === 'in_progress').length,
  }), [])

  const barData = useMemo(() => MOCK_BAR.map((v, i) => ({ label: MONTH_LABELS[i], value: v })), [])

  const sysPie = useMemo(() => {
    const counts = {}
    EQUIPMENT.forEach(e => { counts[e.system] = (counts[e.system]||0)+1 })
    return Object.entries(SYSTEMS).map(([k, sys]) => ({
      label: `${k} — ${sys.fullLabel.split(' ')[0]}`,
      short: k,
      value: Math.round((counts[k]||0) / EQUIPMENT.length * 100),
      color: sys.color,
    }))
  }, [])

  const topRisk = useMemo(() => {
    return WEAR_DATA
      .sort((a,b) => b.wear - a.wear)
      .slice(0,5)
      .map(w => {
        const eq = EQUIPMENT.find(e => e.id === w.equipmentId)
        const color = w.wear >= 70 ? '#DC2626' : w.wear >= 40 ? '#D97706' : '#059669'
        return { name: eq?.name || w.equipmentId, value: w.wear, color, barStyle: { height:'100%', background:color, borderRadius:4, width:`${w.wear}%` } }
      })
  }, [])

  const kpiCfg = [
    { label:'Всего тикетов', value:kpis.total,   color:'#1D4ED8', key:'tickets' },
    { label:'Выполнено',     value:kpis.done,    color:'#059669', key:'done' },
    { label:'Просрочено',    value:kpis.overdue, color:'#DC2626', key:'overdue' },
    { label:'В работе',      value:kpis.work,    color:'#7C3AED', key:'work' },
  ]

  return (
    <>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {kpiCfg.map(k => (
          <div key={k.key} style={card}>
            <div style={{ position:'absolute', right:-10, top:-10, width:70, height:70, borderRadius:'50%', background:k.color, filter:'blur(24px)', opacity:.14 }}/>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:12 }}>
              <span style={{ width:32, height:32, borderRadius:8, background:k.color+'15', display:'flex', alignItems:'center', justifyContent:'center', color:k.color }}>
                {DASH_KPIS_ICONS[k.key]}
              </span>
              <span style={{ fontSize:12, color:'#6B7280', fontWeight:500 }}>{k.label}</span>
            </div>
            <div style={{ fontSize:32, fontWeight:700, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Row 2 */}
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:14 }}>
        <div style={chartCard}>
          <h3 style={{ margin:'0 0 20px', fontSize:14, fontWeight:600, color:'#0D1117' }}>Выполнение ТО по месяцам</h3>
          <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:190 }}>
            {barData.map((b, idx) => {
              const h = Math.round(b.value / 35 * 100)
              return (
                <div key={idx} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                  <span style={{ fontSize:10, color:'#6B7280', fontFamily:"'JetBrains Mono',monospace" }}>{b.value}</span>
                  <div style={{ width:'100%', height:`${h}%`, background:'linear-gradient(180deg,#1D4ED8,#7C3AED)', borderRadius:'4px 4px 0 0', minHeight:4 }}/>
                  <span style={{ fontSize:10, color:'#9CA3AF' }}>{b.label}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div style={chartCard}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600, color:'#0D1117' }}>Распределение по системам</h3>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:120, height:120, flex:'none' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sysPie} cx="50%" cy="50%" innerRadius={36} outerRadius={54} dataKey="value" strokeWidth={2} stroke="#FFFFFF">
                    {sysPie.map((e,i) => <Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip content={<LightTooltip />}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, flex:1 }}>
              {sysPie.map(e => (
                <div key={e.short} style={{ display:'flex', alignItems:'center', gap:9, fontSize:12 }}>
                  <span style={{ width:10, height:10, borderRadius:3, background:e.color, flex:'none' }}/>
                  <span style={{ flex:1, color:'#374151' }}>{e.label}</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", color:'#6B7280', fontWeight:600 }}>{e.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div style={chartCard}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:600, color:'#0D1117' }}>Топ-5 по риску аварии</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
            {topRisk.map(r => (
              <div key={r.name}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                  <span style={{ color:'#374151', fontWeight:500 }}>{r.name}</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", color:r.color, fontWeight:600 }}>{r.value}%</span>
                </div>
                <div style={{ height:6, background:'#F0F2FA', borderRadius:4, overflow:'hidden' }}>
                  <div style={r.barStyle}/>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={chartCard}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:600, color:'#0D1117' }}>Тикеты по системам</h3>
          {Object.entries(SYSTEMS).map(([key, sys]) => {
            const count = TICKETS.filter(t => t.system === key).length
            const pct   = Math.round(count / TICKETS.length * 100)
            return (
              <div key={key} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                  <span style={{ color:'#374151', fontWeight:500 }}>{sys.fullLabel}</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", color:sys.color, fontWeight:600 }}>{count}</span>
                </div>
                <div style={{ height:6, background:'#F0F2FA', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:sys.color, borderRadius:4, width:`${pct}%` }}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { applied, systemsData, buildings, activeBuildingId, staffingPlan, resourcesPlan, appliedAt } = usePlatformStore()
  const { role } = useSessionStore()

  const buildingData  = useMemo(() =>
    systemsData.find(s => s.buildingId === activeBuildingId) ?? systemsData[0] ?? null,
    [systemsData, activeBuildingId]
  )
  const staffingEntry  = useMemo(() =>
    staffingPlan.find(p => p.buildingId === activeBuildingId) ?? staffingPlan[0] ?? null,
    [staffingPlan, activeBuildingId]
  )
  const resourcesEntry = useMemo(() =>
    resourcesPlan.find(p => p.buildingId === activeBuildingId) ?? resourcesPlan[0] ?? null,
    [resourcesPlan, activeBuildingId]
  )
  const buildingName = useMemo(() =>
    buildings.find(b => b.id === activeBuildingId)?.name ?? buildings[0]?.name ?? '',
    [buildings, activeBuildingId]
  )

  return (
    <div style={{ flex:1, overflow:'auto', padding:24, display:'flex', flexDirection:'column', gap:14, background:'#F3F5FA' }}>
      {applied && buildingData
        ? <PlatformDashboard
            buildingData={buildingData}
            staffingEntry={staffingEntry}
            resourcesEntry={resourcesEntry}
            appliedAt={appliedAt}
            buildingName={buildingName}
            buildingId={activeBuildingId ?? buildings[0]?.id ?? null}
            canManageStaff={can({ role }, 'manageStaff')}
            isDirector={role === 'director'}
          />
        : <MockDashboard />
      }
    </div>
  )
}
