import { useMemo } from 'react'
import {
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { EQUIPMENT, SYSTEMS } from '../../data/building'
import { WEAR_DATA } from '../../data/wear'
import { TICKETS } from '../../data/tickets'

const TODAY = new Date('2026-06-22')

const MONTH_LABELS = ['Я','Ф','М','А','М','И','И','А','С','О','Н','Д']
const MOCK_BAR = [14,18,22,25,28,24,30,27,31,26,21,19]

const card = { background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:14, padding:'18px 20px', position:'relative', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }
const chartCard = { background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }

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
}

export default function Dashboard() {
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
    { label:'Всего тикетов', value:kpis.total, color:'#1D4ED8', glow:'#1D4ED8', key:'tickets' },
    { label:'Выполнено',     value:kpis.done,  color:'#059669', glow:'#059669', key:'done' },
    { label:'Просрочено',    value:kpis.overdue,color:'#DC2626', glow:'#DC2626', key:'overdue' },
    { label:'В работе',      value:kpis.work,  color:'#7C3AED', glow:'#7C3AED', key:'work' },
  ]

  return (
    <div style={{ flex:1, overflow:'auto', padding:24, display:'flex', flexDirection:'column', gap:14, background:'#F3F5FA' }}>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {kpiCfg.map(k => (
          <div key={k.key} style={card}>
            <div style={{ position:'absolute', right:-10, top:-10, width:70, height:70, borderRadius:'50%', background:k.glow, filter:'blur(24px)', opacity:.14 }}/>
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
        {/* Bar chart */}
        <div style={chartCard}>
          <h3 style={{ margin:'0 0 20px', fontSize:14, fontWeight:600, color:'#0D1117' }}>Выполнение ТО по месяцам</h3>
          <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:190 }}>
            {barData.map(b => {
              const h = Math.round(b.value / 35 * 100)
              return (
                <div key={b.label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                  <span style={{ fontSize:10, color:'#6B7280', fontFamily:"'JetBrains Mono',monospace" }}>{b.value}</span>
                  <div style={{ width:'100%', height:`${h}%`, background:'linear-gradient(180deg,#1D4ED8,#7C3AED)', borderRadius:'4px 4px 0 0', minHeight:4 }}/>
                  <span style={{ fontSize:10, color:'#9CA3AF' }}>{b.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pie */}
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
        {/* Top-5 risk */}
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

        {/* Status tickets by system */}
        <div style={chartCard}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:600, color:'#0D1117' }}>Тикеты по системам</h3>
          <div style={{ flex:1 }}>
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
      </div>
    </div>
  )
}
