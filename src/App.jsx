import { useState, useCallback, useEffect } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import BuildingView from './components/BuildingView/BuildingView'
import BIMViewer from './components/BIMViewer/BIMViewer'
import ScheduleEK from './components/ScheduleEK/ScheduleEK'
import ScheduleTO from './components/ScheduleTO/ScheduleTO'
import WearPrediction from './components/WearPrediction/WearPrediction'
import SLA from './components/SLA/SLA'
import Tickets from './components/Tickets/Tickets'
import Dashboard from './components/Dashboard/Dashboard'
import TZAnalyzer from './components/TZAnalyzer/TZAnalyzer'
import RoleSwitcher from './components/RoleSwitcher'
import MyDay from './components/RoleSections/MyDay'
import CustomerSchedule from './components/RoleSections/CustomerSchedule'
import MyRequests from './components/RoleSections/MyRequests'
import { useAppStore } from './store/useAppStore'
import { useTZStore } from './store/useTZStore'
import { usePlatformStore } from './store/usePlatformStore'
import { useSessionStore } from './store/useSessionStore'
import { useStaffStore } from './store/useStaffStore'
import { accessFor } from './config/roleAccess'
import './index.css'

const SECTION_LABELS = {
  'building':      'План здания',
  'bim':           'BIM-просмотр',
  'schedule-ek':   'График ЭК',
  'schedule-to':   'График ТО',
  'sla':           'SLA',
  'wear':          'Прогноз износа',
  'tickets':       'Тикеты',
  'dashboard':     'Дашборд',
  'tz-analysis':   'Анализ ТЗ',
  'my-day':        'Мой день',
  'schedule-view': 'График работ',
  'my-requests':   'Мои заявки',
}

const TZ_MIME = /^(application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/(pdf|vnd\.ms-excel)|text\/plain)/

const BTI_MIME = /^(application\/pdf|image\/)/

export default function App() {
  const { activeSection, setActiveSection, setBimPendingFile, setBtiPendingFile } = useAppStore()
  const { setTzPendingFile } = useTZStore()
  const { applied, buildings: pBuildings, activeBuildingId, setActiveBuildingId, loadFromDB: loadPlatform } = usePlatformStore()
  const { role, personId } = useSessionStore()
  const { staff } = useStaffStore()

  // Load platform store from IDB on mount
  useEffect(() => { loadPlatform() }, [loadPlatform])

  const access = accessFor(role)

  // Guard разделов: недоступный роли раздел → дефолтный раздел роли
  useEffect(() => {
    if (!access.sections.includes(activeSection)) {
      setActiveSection(access.defaultSection)
    }
  }, [role, activeSection, access, setActiveSection])

  // Техник привязан к объекту своей персоны — ObjectSwitcher зафиксирован
  const executorPerson = role === 'executor' ? staff.find(p => p.id === personId) : null
  useEffect(() => {
    if (executorPerson && executorPerson.buildingId !== activeBuildingId) {
      setActiveBuildingId(executorPerson.buildingId)
    }
  }, [executorPerson, activeBuildingId, setActiveBuildingId])

  const canSwitchObjects = access.actions.switchObjects
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
    } else if (TZ_MIME.test(file.type) || /\.(docx|xlsx|xls|txt)$/i.test(file.name)) {
      setTzPendingFile(file)
      setActiveSection('tz-analysis')
    }
  }, [setBimPendingFile, setBtiPendingFile, setTzPendingFile, setActiveSection, activeSection])

  const renderContent = () => {
    switch (activeSection) {
      case 'building':     return <BuildingView />
      case 'schedule-ek':  return <ScheduleEK />
      case 'schedule-to':  return <ScheduleTO />
      case 'sla':          return <SLA />
      case 'wear':         return <WearPrediction />
      case 'tickets':      return <Tickets />
      case 'dashboard':    return <Dashboard />
      case 'tz-analysis':  return <TZAnalyzer />
      case 'my-day':        return <MyDay />
      case 'schedule-view': return <CustomerSchedule />
      case 'my-requests':   return <MyRequests />
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
          ) : activeSection === 'tz-analysis' ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, zIndex:1 }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.4">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <path d="M8 13h8M8 17h5"/>
              </svg>
              <div style={{ fontSize:24, fontWeight:700, color:'#4338CA' }}>Отпустите файл ТЗ</div>
              <div style={{ fontSize:14, color:'#6366F1', opacity:0.85 }}>DOCX, PDF или TXT с техническим заданием</div>
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
            {applied && pBuildings.length > 0 ? (
              canSwitchObjects ? (
                <select
                  value={activeBuildingId ?? pBuildings[0]?.id ?? ''}
                  onChange={e => setActiveBuildingId(e.target.value)}
                  style={{
                    fontSize:11, color:'#1D4ED8', letterSpacing:'.3px', fontWeight:600,
                    background:'none', border:'none', cursor:'pointer', padding:0,
                    fontFamily:"'Golos Text',system-ui,sans-serif", appearance:'none',
                    WebkitAppearance:'none', outline:'none', maxWidth:260,
                  }}
                >
                  {pBuildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize:11, color:'#6B7280', letterSpacing:'.3px', fontWeight:600, maxWidth:260,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {pBuildings.find(b => b.id === activeBuildingId)?.name ?? pBuildings[0]?.name ?? ''}
                </div>
              )
            ) : (
              <div style={{ fontSize:11, color:'#9CA3AF', letterSpacing:'.4px' }}>БЦ «Меридиан» · Корпус B</div>
            )}
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

            {/* Роль / персона */}
            <RoleSwitcher />
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
