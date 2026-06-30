import { useState, useMemo } from 'react'
import { TO_SCHEDULE, FREQ_LABELS } from '../../data/scheduleTO'
import { SYSTEMS } from '../../data/building'

const TODAY = new Date('2026-06-22')

function getToType(item) {
  const n = item.equipmentName.toLowerCase()
  if (n.includes('лифт') || n.includes('лебёд')) return { label:'Капремонт', color:'#DC2626', bg:'rgba(220,38,38,.1)' }
  const map = {
    monthly:    { label:'ТО-1', color:'#059669', bg:'rgba(5,150,105,.1)' },
    quarterly:  { label:'ТО-2', color:'#1D4ED8', bg:'rgba(29,78,216,.1)' },
    semiannual: { label:'ТО-2', color:'#1D4ED8', bg:'rgba(29,78,216,.1)' },
    annual:     { label:'ППР',  color:'#D97706', bg:'rgba(215,119,6,.1)'  },
  }
  return map[item.frequency] || map.annual
}

function getLaborHours(name) {
  const n = name.toLowerCase()
  if (n.includes('вентуст'))  return 6
  if (n.includes('дизель'))   return 6
  if (n.includes('ибп'))      return 4
  if (n.includes('насосная')) return 8
  if (n.includes('насос'))    return 2
  if (n.includes('бойлер'))   return 4
  if (n.includes('фанкойл'))  return 1.5
  if (n.includes('вру'))      return 6
  if (n.includes('щит'))      return 3
  return 2
}

function getPriority(item) {
  const diff = Math.ceil((new Date(item.nextDate) - TODAY) / 86400000)
  if (diff < 0 || diff <= 14) return { label:'Высокий', color:'#DC2626', bg:'rgba(220,38,38,.1)' }
  const n = item.equipmentName.toLowerCase()
  if (n.includes('дизель') || n.includes('ибп') || n.includes('вентуст') || n.includes('тепловой') || n.includes('насосная'))
    return { label:'Высокий', color:'#DC2626', bg:'rgba(220,38,38,.1)' }
  return { label:'Средний', color:'#D97706', bg:'rgba(215,119,6,.1)' }
}

const cardStyle = { background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }
const aiBtn    = { display:'flex', alignItems:'center', gap:9, background:'linear-gradient(135deg,#1D4ED8,#7C3AED)', color:'#FFFFFF', fontWeight:600, fontSize:13, border:'none', borderRadius:10, padding:'11px 18px', cursor:'pointer', boxShadow:'0 4px 16px rgba(29,78,216,0.35)', fontFamily:'inherit' }
const sparkle  = <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>

const GANTT_MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

export default function ScheduleTO() {
  const [sysFilter, setSysFilter] = useState(null)

  const rows = useMemo(() =>
    TO_SCHEDULE
      .filter(r => !sysFilter || r.system === sysFilter)
      .map(r => ({ ...r, toType: getToType(r), laborHours: getLaborHours(r.equipmentName), priority: getPriority(r) }))
      .sort((a,b) => new Date(a.nextDate) - new Date(b.nextDate))
  , [sysFilter])

  const ganttRows = useMemo(() =>
    TO_SCHEDULE.slice(0,6).map(r => {
      const month = new Date(r.nextDate).getMonth()
      const start = month / 12 * 100
      const width = 8
      const toType = getToType(r)
      return { name: r.equipmentName, month, start, width, color: toType.color, label: toType.label }
    })
  , [])

  const filterBtn = (active) => ({
    padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight: active ? 600 : 400,
    border:`1px solid ${active ? '#1D4ED8' : '#E8ECF5'}`, cursor:'pointer', fontFamily:'inherit',
    background: active ? '#EEF2FF' : '#FFFFFF', color: active ? '#1D4ED8' : '#6B7280',
  })

  return (
    <div style={{ flex:1, overflow:'auto', padding:24, display:'flex', flexDirection:'column', gap:20, background:'#F3F5FA' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:14, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>График технического обслуживания</h1>
          <p style={{ margin:'6px 0 0', fontSize:13, color:'#6B7280' }}>ТО-1, ТО-2, ППР и капитальный ремонт парка оборудования</p>
        </div>
        <button style={{ ...aiBtn, marginLeft:'auto' }}>{sparkle}<span>Сгенерировать ИИ-график</span></button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button style={filterBtn(!sysFilter)} onClick={() => setSysFilter(null)}>Все системы</button>
        {Object.keys(SYSTEMS).map(s => (
          <button key={s} style={filterBtn(sysFilter===s)} onClick={() => setSysFilter(sysFilter===s?null:s)}>{s}</button>
        ))}
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <div style={{ display:'grid', gridTemplateColumns:'2.2fr 1fr 1.1fr 1fr 1.4fr 1fr', padding:'12px 18px', fontSize:10, letterSpacing:'.5px', textTransform:'uppercase', color:'#9CA3AF', borderBottom:'1px solid #E8ECF5', background:'#F8F9FD', fontWeight:600 }}>
          {['Оборудование','Вид ТО','Периодичность','Трудозатраты','Ответственный','Приоритет'].map(h => <span key={h}>{h}</span>)}
        </div>
        {rows.map(row => (
          <div key={row.equipmentId} style={{ display:'grid', gridTemplateColumns:'2.2fr 1fr 1.1fr 1fr 1.4fr 1fr', padding:'13px 18px', fontSize:13, alignItems:'center', borderBottom:'1px solid #F0F2FA' }}>
            <span style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background: row.priority.color, flex:'none' }}/>
              <span style={{ fontWeight:500 }}>{row.equipmentName}</span>
            </span>
            <span>
              <span style={{ padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:700, background:row.toType.bg, color:row.toType.color }}>{row.toType.label}</span>
            </span>
            <span style={{ color:'#4B5563' }}>{FREQ_LABELS[row.frequency]}</span>
            <span style={{ color:'#4B5563', fontFamily:"'JetBrains Mono',monospace" }}>{row.laborHours} ч</span>
            <span style={{ color:'#4B5563' }}>{row.responsible}</span>
            <span>
              <span style={{ padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:600, background:row.priority.bg, color:row.priority.color }}>{row.priority.label}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Gantt */}
      <div>
        <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:600, color:'#374151' }}>План работ — 2026</h3>
        <div style={{ ...cardStyle, padding:18, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'170px 1fr', fontSize:10, color:'#9CA3AF', marginBottom:10, fontFamily:"'JetBrains Mono',monospace" }}>
            <span/>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)' }}>
              {GANTT_MONTHS.map(m => <span key={m} style={{ textAlign:'center' }}>{m}</span>)}
            </div>
          </div>
          {ganttRows.map((g, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'170px 1fr', alignItems:'center', height:34, borderTop:'1px solid #F0F2FA' }}>
              <span style={{ fontSize:12, color:'#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', paddingRight:12, fontWeight:500 }}>{g.name}</span>
              <div style={{ position:'relative', height:'100%' }}>
                <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'repeat(12,1fr)' }}>
                  {Array(12).fill(0).map((_,j) => <span key={j} style={{ borderLeft:'1px solid #EEF0F8' }}/>)}
                </div>
                <div style={{ position:'absolute', top:'25%', height:'50%', left:`${g.start}%`, width:`${g.width}%`, background:g.color, borderRadius:4, display:'flex', alignItems:'center', paddingLeft:6, fontSize:10, color:'#fff', fontWeight:600, minWidth:30 }}>
                  {g.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
