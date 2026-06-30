import { useState, useMemo } from 'react'
import { EQUIPMENT, SYSTEMS } from '../../data/building'
import { WEAR_DATA } from '../../data/wear'
import { fetchWearPrediction } from '../../services/claudeApi'

const MERGED = EQUIPMENT.map(eq => {
  const wd = WEAR_DATA.find(w => w.equipmentId === eq.id)
  return { ...eq, wear: wd?.wear ?? 20, probability: wd?.probability ?? 1, consequence: wd?.consequence ?? 1 }
})

const wearColor = w => w >= 70 ? '#DC2626' : w >= 40 ? '#D97706' : '#059669'

function riskLabel(p, c) {
  const s = p * c
  if (s >= 15) return { label:'Критический', color:'#DC2626', bg:'rgba(220,38,38,.1)' }
  if (s >= 9)  return { label:'Высокий',     color:'#D97706', bg:'rgba(215,119,6,.1)' }
  if (s >= 4)  return { label:'Средний',     color:'#D97706', bg:'rgba(215,119,6,.08)' }
  return              { label:'Низкий',      color:'#059669', bg:'rgba(5,150,105,.1)' }
}

function remainingResource(wear) {
  const rem = 100 - wear
  if (rem <= 5)  return '< 1 мес.'
  if (rem <= 15) return `${Math.round(rem / 3)} мес.`
  if (rem <= 40) return `${Math.round(rem / 5)} мес.`
  return `${Math.round(rem / 8)} мес.`
}

function CircularGauge({ value }) {
  const r = 68, cx = 80, cy = 80
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - value / 100)
  const color = wearColor(value)
  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E8ECF5" strokeWidth="10"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 80 80)"/>
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="28" fontWeight="700" fill={color} fontFamily="'Golos Text',system-ui">{value}%</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="11" fill="#9CA3AF" fontFamily="'Golos Text',system-ui">износ</text>
    </svg>
  )
}

function DetailPanel({ item, onClose, aiText, aiLoading }) {
  const risk = riskLabel(item.probability, item.consequence)
  const sys  = SYSTEMS[item.system]
  const factors = [
    item.wear >= 80 && { text: `Наработка превышает ресурс на ${item.wear - 70}%`, level:'crit' },
    item.probability >= 4 && { text: '3 отказа за последние 6 мес.', level:'crit' },
    item.consequence >= 4 && { text: 'Вибрация выше нормы', level:'warn' },
    item.wear >= 50 && { text: 'Рекомендована внеплановая проверка', level:'warn' },
  ].filter(Boolean).slice(0, 3)

  return (
    <div style={{ width:280, flexShrink:0, background:'#FFFFFF', borderLeft:'1px solid #E8ECF5', display:'flex', flexDirection:'column', height:'100%', overflow:'auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid #E8ECF5' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#0D1117', lineHeight:1.3 }}>{item.name}</div>
        <button onClick={onClose} style={{ color:'#9CA3AF', background:'none', border:'none', fontSize:20, cursor:'pointer', padding:0, lineHeight:1 }}>×</button>
      </div>

      <div style={{ display:'flex', justifyContent:'center', paddingTop:16, paddingBottom:8 }}>
        <CircularGauge value={item.wear} />
      </div>

      <div style={{ padding:'0 18px 14px', textAlign:'center', fontSize:11, color:'#6B7280' }}>
        Прогнозный износ · остаток ресурса {remainingResource(item.wear)}
      </div>

      <div style={{ padding:'12px 18px', borderTop:'1px solid #E8ECF5' }}>
        <div style={{ fontSize:10, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10, fontWeight:600 }}>Риск-факторы</div>
        {factors.length === 0 ? (
          <div style={{ fontSize:11, color:'#9CA3AF' }}>Факторы риска не выявлены</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {factors.map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background: f.level==='crit'?'#DC2626':'#D97706', marginTop:3, flex:'none' }}/>
                <span style={{ fontSize:12, color:'#4B5563', lineHeight:1.4 }}>{f.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding:'10px 18px', borderTop:'1px solid #E8ECF5' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
          <span style={{ padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:600, background:risk.bg, color:risk.color }}>{risk.label} риск</span>
          <span style={{ padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:600, background:(sys?.color||'#666')+'18', color:sys?.color }}>{item.system}</span>
        </div>
      </div>

      {aiLoading && (
        <div style={{ margin:'12px 18px', padding:'12px 14px', borderRadius:12, border:'1px solid #E8ECF5', background:'#F8F9FD', fontSize:12, color:'#9CA3AF' }}>
          ИИ анализирует данные...
        </div>
      )}
      {aiText && (
        <div style={{ margin:'4px 18px 16px', padding:'12px 14px', borderRadius:12, border:'1px solid #A5B4FC', background:'rgba(238,242,255,.6)' }}>
          <div style={{ fontSize:10, color:'#1D4ED8', fontWeight:700, marginBottom:6, letterSpacing:'.5px' }}>ИИ-ПРОГНОЗ</div>
          <div style={{ fontSize:12, color:'#374151', lineHeight:1.55 }}>{aiText}</div>
        </div>
      )}
    </div>
  )
}

const cardStyle = { background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:14, padding:'16px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }

export default function WearPrediction() {
  const [selectedId, setSelectedId] = useState(null)
  const [aiText, setAiText]         = useState(null)
  const [aiLoading, setAiLoading]   = useState(false)

  const sorted = useMemo(() => [...MERGED].sort((a, b) => b.wear - a.wear), [])

  const stats = useMemo(() => ({
    avgWear:  Math.round(MERGED.reduce((s, e) => s + e.wear, 0) / MERGED.length),
    highRisk: MERGED.filter(e => e.probability * e.consequence >= 15).length,
    planned:  MERGED.filter(e => e.wear >= 70).length,
  }), [])

  const selected = selectedId ? MERGED.find(e => e.id === selectedId) : null

  async function handleSelect(item) {
    if (selectedId === item.id) { setSelectedId(null); setAiText(null); return }
    setSelectedId(item.id)
    setAiText(null)
    if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
      setAiLoading(true)
      try {
        const text = await fetchWearPrediction(item, WEAR_DATA.find(w => w.equipmentId === item.id))
        setAiText(text)
      } catch { /* ignore */ }
      finally { setAiLoading(false) }
    }
  }

  const kpiCfg = [
    { label:'Средний износ парка', value:`${stats.avgWear}%`, color:'#D97706' },
    { label:'Высокий риск',        value:`${stats.highRisk} ед.`, color:'#DC2626' },
    { label:'Плановая замена',     value:`${stats.planned} ед.`,  color:'#D97706' },
  ]

  return (
    <div style={{ display:'flex', height:'100%', background:'#F3F5FA', overflow:'hidden' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', padding:24, gap:18, overflow:'hidden' }}>

        {/* Header */}
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Прогноз износа оборудования</h1>
          <p style={{ margin:'6px 0 0', fontSize:13, color:'#6B7280' }}>ИИ-модель остаточного ресурса на основе наработки и истории отказов</p>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {kpiCfg.map(k => (
            <div key={k.label} style={cardStyle}>
              <div style={{ fontSize:11, color:'#6B7280', marginBottom:10, fontWeight:500 }}>{k.label}</div>
              <div style={{ fontSize:28, fontWeight:700, color:k.color, fontFamily:"'JetBrains Mono',monospace" }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex:1, overflow:'auto', background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:14, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1.5fr 1fr 1fr', padding:'12px 18px', fontSize:10, letterSpacing:'.5px', textTransform:'uppercase', color:'#9CA3AF', borderBottom:'1px solid #E8ECF5', background:'#F8F9FD', fontWeight:600, position:'sticky', top:0, zIndex:1 }}>
            {['Название','Система','Износ','Риск аварии','Остаток ресурса'].map(h => <span key={h}>{h}</span>)}
          </div>
          {sorted.map(item => {
            const sys  = SYSTEMS[item.system]
            const risk = riskLabel(item.probability, item.consequence)
            const isSel = item.id === selectedId
            return (
              <div key={item.id}
                onClick={() => handleSelect(item)}
                style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1.5fr 1fr 1fr', padding:'13px 18px', fontSize:13, alignItems:'center', borderBottom:'1px solid #F0F2FA', cursor:'pointer', background: isSel ? '#EEF2FF' : undefined, transition:'background .1s' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8F9FD' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = '' }}
              >
                <span style={{ display:'flex', alignItems:'center', gap:9 }}>
                  {isSel && <span style={{ width:3, height:20, borderRadius:2, background:'#1D4ED8', flex:'none' }}/>}
                  <span style={{ fontWeight:500, color:'#0D1117' }}>{item.name}</span>
                </span>
                <span>
                  <span style={{ padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:600, background:(sys?.color||'#666')+'18', color:sys?.color }}>{item.system}</span>
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ flex:1, height:6, borderRadius:4, background:'#F0F2FA', minWidth:60, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:4, background:wearColor(item.wear), width:`${item.wear}%` }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:wearColor(item.wear), fontFamily:"'JetBrains Mono',monospace", minWidth:32 }}>{item.wear}%</span>
                </span>
                <span>
                  <span style={{ padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:600, background:risk.bg, color:risk.color }}>{risk.label}</span>
                </span>
                <span style={{ color:'#6B7280', fontFamily:"'JetBrains Mono',monospace" }}>{remainingResource(item.wear)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <DetailPanel
          item={selected}
          onClose={() => { setSelectedId(null); setAiText(null) }}
          aiText={aiText}
          aiLoading={aiLoading}
        />
      )}
    </div>
  )
}
