import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import BuildingView from './components/BuildingView/BuildingView'
import BIMViewer from './components/BIMViewer/BIMViewer'
import ScheduleEK from './components/ScheduleEK/ScheduleEK'
import ScheduleTO from './components/ScheduleTO/ScheduleTO'
import WearPrediction from './components/WearPrediction/WearPrediction'
import Tickets from './components/Tickets/Tickets'
import Dashboard from './components/Dashboard/Dashboard'
import { useAppStore } from './store/useAppStore'
import './index.css'

const SECTION_LABELS = {
  'building':     'План здания',
  'bim':          'BIM-просмотр',
  'schedule-ek':  'График ЭК',
  'schedule-to':  'График ТО',
  'wear':         'Прогноз износа',
  'tickets':      'Тикеты',
  'dashboard':    'Дашборд',
}

const BTI_MIME = /^(application\/pdf|image\/)/

export default function App() {
  const { activeSection, setActiveSection, setBimPendingFile, setBtiPendingFile } = useAppStore()
  const [globalDrag, setGlobalDrag] = useState(false)

  const onGlobalDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) setGlobalDrag(true)
  }, [])

  const onGlobalDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setGlobalDrag(false)
  }, [])

  const onGlobalDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setGlobalDrag(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (file.name.toLowerCase().endsWith('.ifc')) {
      setBimPendingFile(file)
      setActiveSection('bim')
    } else if (activeSection === 'building' && BTI_MIME.test(file.type)) {
      setBtiPendingFile(file)
    }
  }, [setBimPendingFile, setBtiPendingFile, setActiveSection, activeSection])

  const renderContent = () => {
    switch (activeSection) {
      case 'building':     return <BuildingView />
      case 'schedule-ek':  return <ScheduleEK />
      case 'schedule-to':  return <ScheduleTO />
      case 'wear':         return <WearPrediction />
      case 'tickets':      return <Tickets />
      case 'dashboard':    return <Dashboard />
      default:             return null
    }
  }

  return (
    <div
      style={{ display:'flex', height:'100vh', width:'100%', background:'#F3F5FA', fontFamily:"'Golos Text',system-ui,sans-serif", color:'#0D1117', overflow:'hidden', position:'relative' }}
      onDragOver={onGlobalDragOver}
      onDragLeave={onGlobalDragLeave}
      onDrop={onGlobalDrop}
    >
      {/* Глобальный дроп-оверлей — контекст зависит от раздела */}
      {globalDrag && (
        <div style={{
          position:'absolute', inset:0, zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(238,242,255,0.88)',
          backdropFilter:'blur(6px)',
          pointerEvents:'none',
        }}>
          <div style={{
            position:'absolute', inset:16,
            border:'2.5px dashed #6366F1',
            borderRadius:22,
            animation:'bimDashAnim 0.7s ease-in-out infinite',
          }}/>
          {activeSection === 'building' ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, zIndex:1 }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.4">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>
              <div style={{ fontSize:24, fontWeight:700, color:'#4338CA' }}>Отпустите план БТИ</div>
              <div style={{ fontSize:14, color:'#6366F1', opacity:0.85 }}>PDF или фото поэтажного плана</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, zIndex:1 }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.4">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <div style={{ fontSize:24, fontWeight:700, color:'#4338CA' }}>Отпустите IFC-файл</div>
              <div style={{ fontSize:14, color:'#6366F1', opacity:0.85 }}>Модель откроется в BIM-просмотрщике</div>
            </div>
          )}
        </div>
      )}

      <Sidebar />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {/* Topbar */}
        <header style={{ height:60, flex:'none', background:'#FFFFFF', borderBottom:'1px solid #E8ECF5', display:'flex', alignItems:'center', padding:'0 22px', gap:18, boxShadow:'0 1px 4px rgba(29,78,216,0.05)' }}>
          <div style={{ display:'flex', flexDirection:'column', lineHeight:1.15, minWidth:0 }}>
            <div style={{ fontSize:11, color:'#9CA3AF', letterSpacing:'.4px' }}>БЦ «Меридиан» · Корпус B</div>
            <div style={{ fontSize:16, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {SECTION_LABELS[activeSection]}
            </div>
          </div>

          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
            {/* Search */}
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'#F3F5FA', border:'1px solid #E8ECF5', borderRadius:9, padding:'7px 12px', width:220, color:'#9CA3AF', fontSize:13 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
              <span>Поиск оборудования…</span>
            </div>

            {/* Bell */}
            <button style={{ position:'relative', width:38, height:38, borderRadius:9, border:'1px solid #E8ECF5', background:'#F3F5FA', color:'#6B7280', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
              <span style={{ position:'absolute', top:7, right:8, width:7, height:7, borderRadius:'50%', background:'#DC2626', border:'1.5px solid #FFFFFF' }} />
            </button>

            {/* User */}
            <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft:4, borderLeft:'1px solid #E8ECF5', marginLeft:2 }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#7C3AED,#1D4ED8)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:13, color:'#FFFFFF' }}>ИП</div>
              <div style={{ lineHeight:1.15 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>И. Петров</div>
                <div style={{ fontSize:11, color:'#9CA3AF' }}>Гл. инженер</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', position:'relative' }}>
          {/* BIMViewer всегда смонтирован — скрываем через visibility чтобы canvas сохранял размеры */}
          <div style={{
            position: 'absolute', inset: 0,
            visibility: activeSection === 'bim' ? 'visible' : 'hidden',
            pointerEvents: activeSection === 'bim' ? 'auto' : 'none',
            display: 'flex', flexDirection: 'column', zIndex: activeSection === 'bim' ? 1 : 0,
          }}>
            <BIMViewer />
          </div>
          {activeSection !== 'bim' && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', zIndex:1 }}>
              {renderContent()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
