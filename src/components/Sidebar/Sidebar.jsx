import { useAppStore } from '../../store/useAppStore'
import { TICKETS } from '../../data/tickets'

const TODAY = new Date('2026-06-22')
const openCount = TICKETS.filter(t => t.status !== 'done' && new Date(t.due) <= TODAY).length

// Разделы, недоступные когда загружена BIM-модель
const BIM_FROZEN = new Set(['building'])

const S = {
  aside: { width:230, flex:'none', background:'#FFFFFF', borderRight:'1px solid #E8ECF5', display:'flex', flexDirection:'column', boxShadow:'1px 0 4px rgba(29,78,216,0.05)' },
  logo:  { height:60, display:'flex', alignItems:'center', gap:12, padding:'0 18px', borderBottom:'1px solid #E8ECF5' },
  nav:   { display:'flex', flexDirection:'column', gap:2, padding:'12px 10px', flex:1 },
  foot:  { padding:14, borderTop:'1px solid #E8ECF5', display:'flex', alignItems:'center', gap:9, fontSize:12, color:'#9CA3AF' },
}

function navBtn(isActive) {
  return {
    display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9,
    fontSize:13, fontWeight: isActive ? 600 : 400, cursor:'pointer', border:'none',
    background: isActive ? 'linear-gradient(135deg,rgba(29,78,216,.08),rgba(124,58,237,.06))' : 'transparent',
    color: isActive ? '#1D4ED8' : '#374151',
    fontFamily:"'Golos Text',system-ui,sans-serif",
    width:'100%', textAlign:'left',
  }
}

function Icon({ d, d2 }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={d} />{d2 && <path d={d2} />}
    </svg>
  )
}

const NAV_ITEMS = [
  { id:'building',    label:'План здания',    icon:<Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" d2="M9 22V12h6v10"/> },
  { id:'bim',         label:'BIM-просмотр',   iconEl:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  )},
  { id:'schedule-ek', label:'График ЭК',      icon:<Icon d="M3 4h18v2H3zM3 9h18v2H3zM3 14h12v2H3z"/>, iconEl: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
    </svg>
  )},
  { id:'schedule-to', label:'График ТО',      iconEl:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )},
  { id:'wear',        label:'Прогноз износа', iconEl:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )},
  { id:'tickets',     label:'Тикеты',         badge: openCount || null, iconEl:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )},
  { id:'tz-analysis', label:'Анализ ТЗ',       iconEl:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M8 13h8M8 17h5M8 9h3"/>
    </svg>
  )},
  { id:'dashboard',   label:'Дашборд',        iconEl:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )},
]

export default function Sidebar() {
  const { activeSection, setActiveSection, bimLoaded } = useAppStore()

  return (
    <aside style={S.aside}>
      {/* Logo */}
      <div style={S.logo}>
        <div style={{ width:32, height:32, flex:'none', borderRadius:9, background:'linear-gradient(135deg,#1D4ED8,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:15, color:'#FFFFFF', boxShadow:'0 2px 8px rgba(29,78,216,0.35)' }}>A</div>
        <div style={{ lineHeight:1.1 }}>
          <div style={{ fontWeight:700, fontSize:15, letterSpacing:'.3px', color:'#0D1117' }}>AIFM</div>
          <div style={{ fontSize:10, color:'#9CA3AF', letterSpacing:'1.5px', textTransform:'uppercase' }}>Facility AI</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={S.nav}>
        {NAV_ITEMS.map(item => {
          const isActive = activeSection === item.id
          const isFrozen = bimLoaded && BIM_FROZEN.has(item.id)
          return (
            <button
              key={item.id}
              onClick={() => !isFrozen && setActiveSection(item.id)}
              style={{
                ...navBtn(isActive),
                opacity: isFrozen ? 0.35 : 1,
                cursor: isFrozen ? 'not-allowed' : 'pointer',
                pointerEvents: isFrozen ? 'none' : 'auto',
              }}
              title={isFrozen ? 'Недоступно при загруженной BIM-модели' : undefined}
            >
              <span style={{ width:20, height:20, flex:'none', display:'flex', alignItems:'center', justifyContent:'center', color: isActive ? '#1D4ED8' : '#6B7280' }}>
                {item.iconEl || item.icon}
              </span>
              <span style={{ whiteSpace:'nowrap' }}>{item.label}</span>
              {isFrozen && (
                <span style={{ marginLeft:'auto', fontSize:10, color:'#9CA3AF' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
              )}
              {!isFrozen && item.badge != null && (
                <span style={{ marginLeft:'auto', background:'#DC2626', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:10 }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={S.foot}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:'#059669', flex:'none' }} />
        <span>Система онлайн · v2.4</span>
      </div>
    </aside>
  )
}
