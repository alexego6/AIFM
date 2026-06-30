import { useState, useMemo } from 'react'
import { TICKETS } from '../../data/tickets'
import { SYSTEMS } from '../../data/building'

const TODAY = new Date('2026-06-22')

function isOverdue(t) {
  return t.status !== 'done' && new Date(t.due) < TODAY
}

const STATUS_CFG = {
  open:        { label:'Новый',     color:'#6B7280', bg:'rgba(107,114,128,.1)' },
  in_progress: { label:'В работе',  color:'#1D4ED8', bg:'rgba(29,78,216,.1)' },
  done:        { label:'Выполнен',  color:'#059669', bg:'rgba(5,150,105,.1)' },
  overdue:     { label:'Просрочен', color:'#DC2626', bg:'rgba(220,38,38,.1)' },
}

const PRIORITY_COLOR = {
  critical: '#DC2626',
  high:     '#D97706',
  medium:   '#D97706',
  low:      '#059669',
}

const TAB_FILTERS = [
  { key:'all',         label:'Все' },
  { key:'open',        label:'Новые' },
  { key:'in_progress', label:'В работе' },
  { key:'done',        label:'Выполнены' },
  { key:'overdue',     label:'Просрочены' },
]

function fmtDate(d) {
  return new Date(d).toLocaleDateString('ru-RU', { day:'numeric', month:'long' })
}

function avatarInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const CalIcon = ({ overdue }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={overdue ? '#DC2626' : '#9CA3AF'} strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
)

function TicketCard({ ticket, idx }) {
  const overdue   = isOverdue(ticket)
  const statusKey = overdue ? 'overdue' : ticket.status
  const s   = STATUS_CFG[statusKey]
  const sys = SYSTEMS[ticket.system]
  const stripe = PRIORITY_COLOR[ticket.priority] || '#9CA3AF'

  return (
    <div style={{ display:'flex', alignItems:'stretch', borderRadius:12, border:'1px solid #E8ECF5', background:'#FFFFFF', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', transition:'border-color .15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor='#C7D2FE'}
      onMouseLeave={e => e.currentTarget.style.borderColor='#E8ECF5'}
    >
      <div style={{ width:4, flexShrink:0, background:stripe }}/>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', flex:1, minWidth:0 }}>

        {/* ID + status */}
        <div style={{ flexShrink:0, width:130 }}>
          <div style={{ fontSize:10, color:'#9CA3AF', fontFamily:"'JetBrains Mono',monospace", marginBottom:5 }}>
            #AIFM-{String(idx + 1).padStart(4, '0')}
          </div>
          <span style={{ padding:'3px 10px', borderRadius:6, fontSize:11, fontWeight:600, background:s.bg, color:s.color }}>{s.label}</span>
        </div>

        {/* Title + equipment */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#0D1117', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ticket.title}</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, background:sys?.color||'#9CA3AF' }}/>
            <span style={{ fontSize:12, color:'#6B7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ticket.equipmentName}</span>
          </div>
        </div>

        {/* Assignee */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(29,78,216,.1)', border:'1px solid rgba(29,78,216,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:9, fontWeight:700, color:'#1D4ED8' }}>{avatarInitials(ticket.assignee)}</span>
          </div>
          <span style={{ fontSize:12, color:'#6B7280', whiteSpace:'nowrap' }}>{ticket.assignee}</span>
        </div>

        {/* Date */}
        <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5, marginLeft:8 }}>
          <CalIcon overdue={overdue}/>
          <span style={{ fontSize:12, color: overdue ? '#DC2626' : '#9CA3AF', fontFamily:"'JetBrains Mono',monospace" }}>{fmtDate(ticket.due)}</span>
        </div>
      </div>
    </div>
  )
}

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

export default function Tickets() {
  const [activeTab, setActiveTab] = useState('all')

  const counts = useMemo(() => ({
    all:         TICKETS.length,
    open:        TICKETS.filter(t => t.status === 'open' && !isOverdue(t)).length,
    in_progress: TICKETS.filter(t => t.status === 'in_progress').length,
    done:        TICKETS.filter(t => t.status === 'done').length,
    overdue:     TICKETS.filter(isOverdue).length,
  }), [])

  const filtered = useMemo(() => {
    if (activeTab === 'all')     return TICKETS
    if (activeTab === 'overdue') return TICKETS.filter(isOverdue)
    if (activeTab === 'open')    return TICKETS.filter(t => t.status === 'open' && !isOverdue(t))
    return TICKETS.filter(t => t.status === activeTab)
  }, [activeTab])

  const tabBtn = (isActive) => ({
    display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, fontSize:12, fontWeight: isActive ? 600 : 400, cursor:'pointer', border:'none', fontFamily:'inherit',
    background: isActive ? 'linear-gradient(135deg,#1D4ED8,#7C3AED)' : '#FFFFFF',
    color: isActive ? '#FFFFFF' : '#6B7280',
    boxShadow: isActive ? '0 2px 10px rgba(29,78,216,.3)' : '0 0 0 1px #E8ECF5',
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:24, gap:18, overflow:'hidden', background:'#F3F5FA' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Тикеты</h1>
          <p style={{ margin:'6px 0 0', fontSize:13, color:'#6B7280' }}>Заявки на обслуживание, ремонт и устранение замечаний</p>
        </div>
        <button style={{ display:'flex', alignItems:'center', gap:7, padding:'11px 18px', borderRadius:10, fontSize:13, fontWeight:600, color:'#FFFFFF', border:'none', cursor:'pointer', fontFamily:'inherit', background:'linear-gradient(135deg,#1D4ED8,#7C3AED)', boxShadow:'0 4px 16px rgba(29,78,216,0.35)' }}>
          <PlusIcon/>Новый тикет
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
        {TAB_FILTERS.map(tab => {
          const isActive = activeTab === tab.key
          const count    = counts[tab.key]
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={tabBtn(isActive)}>
              {tab.label}
              <span style={{ padding:'1px 7px', borderRadius:8, fontSize:10, fontWeight:700, background: isActive ? 'rgba(255,255,255,.25)' : '#EEF0F8', color: isActive ? '#FFFFFF' : '#9CA3AF' }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* List */}
      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', gap:8, paddingBottom:8 }}>
        {filtered.length === 0 ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:120, fontSize:13, color:'#9CA3AF' }}>
            Нет тикетов по выбранным фильтрам
          </div>
        ) : (
          filtered.map((t) => <TicketCard key={t.id} ticket={t} idx={TICKETS.indexOf(t)} />)
        )}
      </div>
    </div>
  )
}
