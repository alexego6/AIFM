import { useState, useMemo } from 'react'
import { EK_CHECKS } from '../../data/scheduleEK'
import { SYSTEMS } from '../../data/building'

function getControlType(name) {
  const n = name.toLowerCase()
  if (n.includes('тепловой'))    return 'Тепловизионный'
  if (n.includes('насосная') || n.includes('насос')) return 'Контроль вибрации'
  if (n.includes('фанкойл') || n.includes('бойлер') || n.includes('счёт')) return 'Замер параметров'
  if (n.includes('ибп') || n.includes('щит') || n.includes('вру'))  return 'Измерение ТТХ'
  if (n.includes('дизель'))      return 'Тестовый запуск'
  if (n.includes('камера') || n.includes('коммутатор') || n.includes('скуд') || n.includes('опс')) return 'Проверка работосп.'
  return 'Визуальный осмотр'
}

function getLaborHours(name) {
  const n = name.toLowerCase()
  if (n.includes('дизель') || n.includes('тепловой')) return 2
  if (n.includes('насосная'))  return 1.5
  if (n.includes('насос'))     return 1
  if (n.includes('вентуст'))   return 1.5
  if (n.includes('ибп') || n.includes('щит') || n.includes('вру')) return 1
  return 0.5
}

const PRIO = {
  critical: { label:'Высокий', color:'#DC2626', bg:'rgba(220,38,38,.1)' },
  warning:  { label:'Средний',  color:'#D97706', bg:'rgba(215,119,6,.1)' },
  ok:       { label:'Низкий',   color:'#059669', bg:'rgba(5,150,105,.1)' },
}

const FREQ_LABELS = (row) => {
  if (row.inspector.includes('Смирнов'))  return 'Еженедельно'
  if (row.inspector.includes('Петров'))   return 'Ежемесячно'
  return 'Ежеквартально'
}

const HEAT_MONTHS = ['Я','Ф','М','А','М','И','И','А','С','О','Н','Д']

const cardStyle = { background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }

const aiBtn = { display:'flex', alignItems:'center', gap:9, background:'linear-gradient(135deg,#1D4ED8,#7C3AED)', color:'#FFFFFF', fontWeight:600, fontSize:13, border:'none', borderRadius:10, padding:'11px 18px', cursor:'pointer', boxShadow:'0 4px 16px rgba(29,78,216,0.35)', fontFamily:'inherit' }

const sparkle = <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>

export default function ScheduleEK() {
  const [sysFilter, setSysFilter] = useState(null)
  const [period, setPeriod]       = useState('Год')

  const enriched = useMemo(() =>
    EK_CHECKS.map(r => ({
      ...r,
      controlType: getControlType(r.equipmentName),
      laborHours:  getLaborHours(r.equipmentName),
      freq:        FREQ_LABELS(r),
      prio:        PRIO[r.status],
    }))
  , [])

  const rows = useMemo(() =>
    [...(sysFilter ? enriched.filter(r => r.system === sysFilter) : enriched)].reverse()
  , [sysFilter, enriched])

  const heatData = useMemo(() =>
    HEAT_MONTHS.map((label, i) => {
      const key = `2026-${String(i+1).padStart(2,'0')}`
      const count = enriched.filter(r => r.date.startsWith(key)).length
      const maxC = 12
      const pct = count / maxC
      const bg = pct > .6 ? '#1D4ED8' : pct > .3 ? '#93C5FD' : pct > 0 ? '#DBEAFE' : '#F3F5FA'
      return { label, count, bg }
    })
  , [enriched])

  const filterBtnStyle = (active) => ({
    padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight: active ? 600 : 400, border:`1px solid ${active ? '#1D4ED8' : '#E8ECF5'}`, cursor:'pointer', fontFamily:'inherit',
    background: active ? '#EEF2FF' : '#FFFFFF', color: active ? '#1D4ED8' : '#6B7280', transition:'all .15s',
  })

  const periodBtnStyle = (active) => ({
    padding:'5px 12px', borderRadius:7, fontSize:12, fontWeight: active ? 600 : 400, border:'none', cursor:'pointer', fontFamily:'inherit',
    background: active ? '#FFFFFF' : 'transparent', color: active ? '#1D4ED8' : '#6B7280',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
  })

  return (
    <div style={{ flex:1, overflow:'auto', padding:24, display:'flex', flexDirection:'column', gap:20, background:'#F3F5FA' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:14, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>График эксплуатационного контроля</h1>
          <p style={{ margin:'6px 0 0', fontSize:13, color:'#6B7280' }}>Регламентные осмотры и измерения инженерных систем</p>
        </div>
        <button style={{ ...aiBtn, marginLeft:'auto' }}>{sparkle}<span>Сгенерировать ИИ-график</span></button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button style={filterBtnStyle(!sysFilter)} onClick={() => setSysFilter(null)}>Все системы</button>
        {Object.keys(SYSTEMS).map(s => (
          <button key={s} style={filterBtnStyle(sysFilter === s)} onClick={() => setSysFilter(sysFilter===s?null:s)}>{s}</button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:4, background:'#F3F5FA', border:'1px solid #E8ECF5', borderRadius:10, padding:3 }}>
          {['Месяц','Квартал','Год'].map(p => (
            <button key={p} style={periodBtnStyle(period===p)} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <div style={{ display:'grid', gridTemplateColumns:'2.4fr 1.3fr 1.1fr 1fr 1.4fr 1fr', padding:'12px 18px', fontSize:10, letterSpacing:'.5px', textTransform:'uppercase', color:'#9CA3AF', borderBottom:'1px solid #E8ECF5', background:'#F8F9FD', fontWeight:600 }}>
          {['Оборудование','Тип контроля','Периодичность','Трудозатраты','Ответственный','Приоритет'].map(h => <span key={h}>{h}</span>)}
        </div>
        {rows.map(row => {
          return (
            <div key={row.id} style={{ display:'grid', gridTemplateColumns:'2.4fr 1.3fr 1.1fr 1fr 1.4fr 1fr', padding:'13px 18px', fontSize:13, alignItems:'center', borderBottom:'1px solid #F0F2FA' }}>
              <span style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: row.status==='critical'?'#DC2626':row.status==='warning'?'#D97706':'#059669', flex:'none' }}/>
                <span style={{ fontWeight:500 }}>{row.equipmentName}</span>
              </span>
              <span style={{ color:'#4B5563' }}>{row.controlType}</span>
              <span style={{ color:'#4B5563' }}>{row.freq}</span>
              <span style={{ color:'#4B5563', fontFamily:"'JetBrains Mono',monospace" }}>{row.laborHours} ч</span>
              <span style={{ color:'#4B5563' }}>{row.inspector}</span>
              <span>
                <span style={{ padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:600, background:row.prio.bg, color:row.prio.color }}>{row.prio.label}</span>
              </span>
            </div>
          )
        })}
      </div>

      {/* Heat map */}
      <div>
        <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:600, color:'#374151' }}>Интенсивность мероприятий по месяцам</h3>
        <div style={{ ...cardStyle, padding:18 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:8 }}>
            {heatData.map(m => (
              <div key={m.label} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                <div style={{ width:40, height:40, borderRadius:8, background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:600, color: m.count > 5 ? '#FFFFFF' : m.count > 2 ? '#1D4ED8' : '#9CA3AF' }}>
                  {m.count || ''}
                </div>
                <span style={{ fontSize:10, color:'#9CA3AF', fontFamily:"'JetBrains Mono',monospace" }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
