import { useState, useMemo, useEffect } from 'react'
import { EQUIPMENT, SYSTEMS, FLOORS } from '../../data/building'
import { useAppStore } from '../../store/useAppStore'
import { usePlatformStore } from '../../store/usePlatformStore'
import BTIRecognizer from '../BTIRecognizer/BTIRecognizer'


// ── isometric projection ──────────────────────────────────────────────────────
const W = 180, D = 110, H = 52, GAP = 22
const OX = 250, OY = 290

function proj(x, y, z) {
  return { x: OX + (x - y) * 0.866, y: OY + (x + y) * 0.5 - z }
}
function pt(x, y, z) {
  const p = proj(x, y, z)
  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
}

function floorGeom(idx) {
  const zB = idx * (H + GAP), zT = zB + H
  return {
    topFace:   [pt(0,0,zT), pt(W,0,zT), pt(W,D,zT), pt(0,D,zT)].join(' '),
    frontFace: [pt(0,0,zB), pt(W,0,zB), pt(W,0,zT), pt(0,0,zT)].join(' '),
    rightFace: [pt(W,0,zB), pt(W,D,zB), pt(W,D,zT), pt(W,0,zT)].join(' '),
    zT,
  }
}

function gridLines(idx) {
  const zT = idx * (H + GAP) + H
  const lines = []
  for (let i = 1; i <= 4; i++) {
    const x = (i / 5) * W
    const a = proj(x, 0, zT), b = proj(x, D, zT)
    lines.push(<line key={`x${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(29,78,216,0.12)" strokeWidth="0.8"/>)
  }
  for (let j = 1; j <= 3; j++) {
    const y = (j / 4) * D
    const a = proj(0, y, zT), b = proj(W, y, zT)
    lines.push(<line key={`y${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(29,78,216,0.12)" strokeWidth="0.8"/>)
  }
  return lines
}

const DOT_POS = [
  [.12,.18],[.28,.35],[.42,.14],[.55,.62],[.7,.28],
  [.82,.55],[.35,.72],[.63,.82],[.18,.55],[.75,.45],
  [.48,.48],[.22,.78],[.90,.22],[.58,.30],
]
const STATUS_COLOR = { normal:'#059669', attention:'#D97706', critical:'#DC2626' }

function EquipDots({ floorId, zT }) {
  return EQUIPMENT.filter(e => e.floor === floorId).map((eq, i) => {
    const pos = DOT_POS[i % DOT_POS.length]
    const p   = proj(pos[0] * W, pos[1] * D, zT)
    const c   = STATUS_COLOR[eq.status] || '#059669'
    return (
      <g key={eq.id}>
        <circle cx={p.x} cy={p.y} r="5" fill={c} opacity="0.2"/>
        <circle cx={p.x} cy={p.y} r="2.8" fill={c}/>
      </g>
    )
  })
}

// ── floor plan (absolute-positioned rooms) ────────────────────────────────────
const ROOM_COLORS = {
  office:    { bg:'#F8F9FE', border:'#E0E5F7', text:'#374151' },
  meeting:   { bg:'#EEF2FF', border:'#C7D2FE', text:'#3730A3' },
  server:    { bg:'#F0FDF4', border:'#A7F3D0', text:'#065F46' },
  technical: { bg:'#FFF7ED', border:'#FED7AA', text:'#92400E' },
  wc:        { bg:'#F9FAFB', border:'#E5E7EB', text:'#6B7280' },
  stair:     { bg:'#F9FAFB', border:'#E5E7EB', text:'#9CA3AF' },
  security:  { bg:'#FFF1F2', border:'#FECDD3', text:'#9F1239' },
  lobby:     { bg:'#FAFAF9', border:'#E7E5E4', text:'#44403C' },
  service:   { bg:'#F5F3FF', border:'#DDD6FE', text:'#5B21B6' },
  archive:   { bg:'#F0F9FF', border:'#BAE6FD', text:'#0369A1' },
  storage:   { bg:'#F9FAFB', border:'#E5E7EB', text:'#6B7280' },
  core:      null,
}

function approxArea(w, h) { return Math.round(w * h / 8000) }

function FloorPlan({ floorId, onBack }) {
  const [selRoom, setSelRoom] = useState(null)
  const floorData = FLOORS.find(f => f.id === floorId)
  if (!floorData) return null

  const rooms = floorData.rooms.filter(r => r.type !== 'core' && r.name && approxArea(r.w, r.h) >= 2)

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', animation:'aifmRiseIn .25s ease' }}>
      <div style={{ flex:1, padding:'20px 24px', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Controls */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18, flexWrap:'wrap', flexShrink:0 }}>
          <button onClick={() => onBack(null)}
            style={{ display:'flex', alignItems:'center', gap:7, background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:9, padding:'8px 14px', color:'#374151', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg>
            К зданию
          </button>
          <div style={{ display:'flex', gap:4, background:'#F3F5FA', border:'1px solid #E8ECF5', borderRadius:10, padding:3 }}>
            {[1,2,3].map(id => (
              <button key={id} onClick={() => { onBack(id); setSelRoom(null) }}
                style={{ padding:'6px 16px', borderRadius:8, fontSize:13, fontWeight: id === floorId ? 600 : 400, border:'none', cursor:'pointer', fontFamily:'inherit',
                  background: id === floorId ? '#FFFFFF' : 'transparent',
                  color: id === floorId ? '#1D4ED8' : '#6B7280',
                  boxShadow: id === floorId ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                Этаж {id}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:16, marginLeft:'auto', fontSize:12, color:'#6B7280' }}>
            {[['#059669','Норма'],['#D97706','Внимание'],['#DC2626','Авария']].map(([c,l]) => (
              <span key={l} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:c, flex:'none' }}/>
                {l}
              </span>
            ))}
          </div>
        </div>

        {/* Plan canvas */}
        <div style={{ position:'relative', flex:1, background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:16,
          backgroundImage:'linear-gradient(#1D4ED80B 1px,transparent 1px),linear-gradient(90deg,#1D4ED80B 1px,transparent 1px)',
          backgroundSize:'32px 32px', overflow:'hidden', boxShadow:'0 2px 8px rgba(29,78,216,0.06)' }}>
          <div style={{ position:'absolute', top:14, left:18, fontSize:11, color:'#9CA3AF', letterSpacing:'1px', fontFamily:"'JetBrains Mono',monospace" }}>
            ЭТАЖ {floorId} · M 1:200
          </div>
          {rooms.map(room => {
            const pct = { left:`${room.x/960*100}%`, top:`${room.y/960*100}%`, width:`${room.w/960*100}%`, height:`${room.h/960*100}%` }
            const colors = ROOM_COLORS[room.type] || ROOM_COLORS.office
            const area   = approxArea(room.w, room.h)
            const isSelected = selRoom?.id === room.id
            const eqInRoom = EQUIPMENT.filter(e => e.roomId === room.id && e.floor === floorId)

            return (
              <div key={room.id} onClick={() => setSelRoom(isSelected ? null : room)}
                style={{ position:'absolute', ...pct, background: isSelected ? '#EEF2FF' : colors.bg,
                  border:`1.5px solid ${isSelected ? '#6366F1' : colors.border}`, borderRadius:6, cursor:'pointer',
                  padding:'8px 10px', overflow:'hidden', transition:'all .15s',
                  boxShadow: isSelected ? '0 0 0 2px rgba(99,102,241,0.3)' : 'none' }}>
                <div style={{ fontSize:12, fontWeight:600, color: isSelected ? '#3730A3' : colors.text, lineHeight:1.2 }}>{room.name}</div>
                <div style={{ fontSize:10, color:'#9CA3AF', marginTop:2, fontFamily:"'JetBrains Mono',monospace" }}>{area} м²</div>
                {eqInRoom.length > 0 && (
                  <div style={{ display:'flex', gap:3, marginTop:4, flexWrap:'wrap' }}>
                    {eqInRoom.map(eq => (
                      <span key={eq.id} style={{ width:7, height:7, borderRadius:'50%', background: STATUS_COLOR[eq.status], flex:'none', display:'inline-block' }}/>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Right panel */}
      {selRoom && (() => {
        const eqInRoom = EQUIPMENT.filter(e => e.roomId === selRoom.id && e.floor === floorId)
        const area = approxArea(selRoom.w, selRoom.h)
        return (
          <aside style={{ width:300, flex:'none', background:'#FFFFFF', borderLeft:'1px solid #E8ECF5', overflow:'auto', display:'flex', flexDirection:'column', boxShadow:'-2px 0 8px rgba(29,78,216,0.05)' }}>
            <div style={{ padding:20 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4 }}>
                <div>
                  <div style={{ fontSize:10, color:'#9CA3AF', letterSpacing:'.6px', fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase' }}>ЭТАЖ {floorId}</div>
                  <h2 style={{ margin:'4px 0 0', fontSize:18, fontWeight:700, color:'#0D1117' }}>{selRoom.name}</h2>
                </div>
                <button onClick={() => setSelRoom(null)} style={{ width:30, height:30, borderRadius:8, border:'1px solid #E8ECF5', background:'#F3F5FA', color:'#6B7280', cursor:'pointer', flex:'none', fontSize:14 }}>✕</button>
              </div>
              <div style={{ fontSize:12, color:'#6B7280', margin:'8px 0 18px' }}>{area} м² · {eqInRoom.length} ед. оборудования</div>

              {eqInRoom.length > 0 && (
                <>
                  <div style={{ fontSize:10, letterSpacing:'.8px', textTransform:'uppercase', color:'#9CA3AF', marginBottom:10, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>Оборудование</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                    {eqInRoom.map(eq => {
                      const sys = SYSTEMS[eq.system]
                      return (
                        <div key={eq.id} style={{ display:'flex', alignItems:'center', gap:11, background:'#F8F9FD', border:'1px solid #EEF0F8', borderRadius:11, padding:11 }}>
                          <span style={{ width:34, height:34, flex:'none', borderRadius:9, background:(sys?.color||'#666')+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:sys?.color }}>
                            {eq.system}
                          </span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#0D1117' }}>{eq.name}</div>
                            <div style={{ fontSize:11, color:'#6B7280' }}>{sys?.fullLabel}</div>
                          </div>
                          <span style={{ width:8, height:8, borderRadius:'50%', flex:'none', background:STATUS_COLOR[eq.status] }}/>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <button style={{ width:'100%', background:'linear-gradient(135deg,#1D4ED8,#7C3AED)', color:'#FFFFFF', fontWeight:600, fontSize:13, border:'none', borderRadius:10, padding:12, cursor:'pointer', boxShadow:'0 4px 14px rgba(29,78,216,0.3)', fontFamily:'inherit' }}>
                Открыть тикет
              </button>
            </div>
          </aside>
        )
      })()}
    </div>
  )
}

// ── isometric building ────────────────────────────────────────────────────────
function IsometricBuilding({ onFloorClick, hoveredFloor }) {
  return (
    <svg width="500" height="420" viewBox="0 0 500 420" style={{ userSelect:'none' }}>
      {[1,2,3].map((floorId, idx) => {
        const { topFace, frontFace, rightFace, zT } = floorGeom(idx)
        const isHov = hoveredFloor === floorId
        const alpha = isHov ? 0.28 : 0.18
        const sAlpha = isHov ? 0.16 : 0.1
        const stroke = isHov ? 'rgba(29,78,216,0.5)' : 'rgba(29,78,216,0.25)'
        return (
          <g key={floorId} style={{ cursor:'pointer' }} onClick={() => onFloorClick(floorId)}>
            <polygon points={frontFace} fill={`rgba(29,78,216,${sAlpha})`} stroke={stroke} strokeWidth="0.8"/>
            <polygon points={rightFace} fill={`rgba(29,78,216,${sAlpha * 0.7})`} stroke={stroke} strokeWidth="0.8"/>
            <polygon points={topFace}   fill={`rgba(29,78,216,${alpha})`}  stroke={stroke} strokeWidth="1"/>
            {gridLines(idx)}
            <EquipDots floorId={floorId} zT={zT} />
            {(() => {
              const zB = idx * (H + GAP)
              const lp = proj(W / 2, 0, zB + H / 2)
              return <text x={lp.x + 8} y={lp.y} fontSize="10" fill="rgba(29,78,216,0.5)" fontWeight="700" fontFamily="'JetBrains Mono',monospace">{`0${floorId}`}</text>
            })()}
          </g>
        )
      })}
    </svg>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function BuildingView() {
  const [selectedFloor, setSelectedFloor] = useState(null)
  const [hoveredFloor, setHoveredFloor]   = useState(null)
  const { btiPlanImage, btiPendingFile } = useAppStore()
  const { applied } = usePlatformStore()
  // When applied: start on the stub; user opens BTI via explicit button.
  // When !applied: start on BTI viewer (normal demo mode).
  const [showBTI, setShowBTI]             = useState(!applied)

  // Если пришёл файл через глобальный дроп — открыть BTI
  useEffect(() => {
    if (btiPendingFile) setShowBTI(true)
  }, [btiPendingFile])

  const floorStats = useMemo(() =>
    [3,2,1].map(floorId => {
      const items = EQUIPMENT.filter(e => e.floor === floorId)
      const issues   = items.filter(e => e.status !== 'normal').length
      const critical = items.filter(e => e.status === 'critical').length
      return { floorId, count: items.length, issues, critical }
    })
  , [])

  if (showBTI) {
    return (
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', background:'#F3F5FA', position:'relative' }}>
        <BTIRecognizer onClose={() => setShowBTI(false)} />
      </div>
    )
  }

  // При applied цифровой двойник (изометрия + план) на моках не показываем
  if (applied) {
    return (
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', background:'#F3F5FA', padding:24, gap:16 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>План здания</h1>
          <p style={{ margin:'6px 0 0', fontSize:13, color:'#6B7280' }}>Цифровой двойник и поэтажные планы</p>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12 }}>
          {/* BTI доступен всегда — это загруженный пользователем файл */}
          <button onClick={() => setShowBTI(true)} style={{
            alignSelf:'flex-start', display:'flex', alignItems:'center', gap:10,
            background: btiPlanImage ? 'linear-gradient(135deg,#F0FDF4,#ECFDF5)' : 'linear-gradient(135deg,#EEF2FF,#F5F3FF)',
            border:`1.5px dashed ${btiPlanImage ? '#6EE7B7' : '#A5B4FC'}`, borderRadius:14, padding:'12px 16px',
            cursor:'pointer', fontFamily:'inherit', textAlign:'left',
          }}>
            <span style={{ width:38, height:38, flex:'none', borderRadius:10, background: btiPlanImage ? 'linear-gradient(135deg,#059669,#10B981)' : 'linear-gradient(135deg,#4F46E5,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>
            </span>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color: btiPlanImage ? '#065F46' : '#3730A3' }}>
                {btiPlanImage ? 'Открыть план БТИ' : 'Загрузить план БТИ'}
              </div>
              <div style={{ fontSize:11, color: btiPlanImage ? '#059669' : '#6366F1', marginTop:2 }}>
                {btiPlanImage ? 'Нажмите для просмотра' : 'PDF или фото → список помещений'}
              </div>
            </div>
          </button>

          {/* Заглушка для изометрии */}
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ textAlign:'center', maxWidth:400, display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.4">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>
              </svg>
              <div style={{ fontSize:15, fontWeight:600, color:'#94A3B8' }}>Цифровой двойник в разработке</div>
              <div style={{ fontSize:13, color:'#CBD5E1', lineHeight:1.6 }}>
                Интерактивная модель здания будет привязана к BIM-модели объекта — раздел в разработке
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (selectedFloor) {
    return (
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', background:'#F3F5FA' }}>
        <FloorPlan floorId={selectedFloor} onBack={(id) => setSelectedFloor(id)} />
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', padding:24, gap:20, background:'#F3F5FA' }}>
      {/* Left: 3D scene */}
      <div style={{ flex:1, position:'relative', border:'1px solid #E8ECF5', borderRadius:18,
        background:'radial-gradient(130% 100% at 50% 20%,#EBF0FF 0%,#DCE6FA 100%)',
        overflow:'hidden', boxShadow:'0 2px 12px rgba(29,78,216,0.08)', display:'flex', flexDirection:'column' }}>

        {/* Badge top-right */}
        <div style={{ position:'absolute', right:18, top:16, fontSize:10, color:'#6B7280', letterSpacing:'1.2px', fontFamily:"'JetBrains Mono',monospace", zIndex:5, background:'rgba(255,255,255,0.8)', padding:'4px 8px', borderRadius:6, border:'1px solid #E8ECF5' }}>
          BIM · 3 ЭТАЖА · {EQUIPMENT.length} ЕД. ОБОРУДОВАНИЯ
        </div>

        {/* Title */}
        <div style={{ padding:'20px 20px 0 20px' }}>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'#0D1117' }}>Цифровой двойник · Корпус B</h1>
          <p style={{ margin:'6px 0 0', fontSize:13, color:'#6B7280' }}>Нажмите на этаж, чтобы открыть его план и оборудование</p>
        </div>

        {/* 3D view */}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}
          onMouseLeave={() => setHoveredFloor(null)}>
          {[1,2,3].map((fid, idx) => {
            const { zT } = floorGeom(idx)
            const zB = idx * (H + GAP)
            const corners = [proj(0,0,zT),proj(W,0,zT),proj(W,D,zT),proj(0,D,zT),proj(0,0,zB),proj(W,0,zB),proj(W,D,zB)]
            const minX = Math.min(...corners.map(c=>c.x)), maxX = Math.max(...corners.map(c=>c.x))
            const minY = Math.min(...corners.map(c=>c.y)), maxY = Math.max(...corners.map(c=>c.y))
            return (
              <div key={fid} style={{ position:'absolute', left:minX+((500-500)/2), top:minY+((420-420)/2), width:maxX-minX, height:maxY-minY, cursor:'pointer' }}
                onMouseEnter={() => setHoveredFloor(fid)}
                onClick={() => setSelectedFloor(fid)}
              />
            )
          })}
          <IsometricBuilding onFloorClick={setSelectedFloor} hoveredFloor={hoveredFloor} />
        </div>
      </div>

      {/* Right: floor list */}
      <div style={{ width:258, flex:'none', display:'flex', flexDirection:'column', gap:10, justifyContent:'center' }}>
        {/* BTI button */}
        <button onClick={() => setShowBTI(true)} style={{
          display:'flex', alignItems:'center', gap:10,
          background: btiPlanImage ? 'linear-gradient(135deg,#F0FDF4,#ECFDF5)' : 'linear-gradient(135deg,#EEF2FF,#F5F3FF)',
          border:`1.5px dashed ${btiPlanImage ? '#6EE7B7' : '#A5B4FC'}`, borderRadius:14, padding:'12px 16px',
          cursor:'pointer', fontFamily:'inherit', textAlign:'left', marginBottom:2,
          transition:'all .15s',
        }}>
          <span style={{ width:38, height:38, flex:'none', borderRadius:10, background: btiPlanImage ? 'linear-gradient(135deg,#059669,#10B981)' : 'linear-gradient(135deg,#4F46E5,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
            </svg>
          </span>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color: btiPlanImage ? '#065F46' : '#3730A3' }}>
              {btiPlanImage ? 'Открыть план БТИ' : 'Загрузить план БТИ'}
            </div>
            <div style={{ fontSize:11, color: btiPlanImage ? '#059669' : '#6366F1', marginTop:2 }}>
              {btiPlanImage ? 'Нажмите для просмотра' : 'PDF или фото → список помещений'}
            </div>
          </div>
        </button>

        <div style={{ fontSize:10, letterSpacing:'1px', textTransform:'uppercase', color:'#9CA3AF', marginBottom:2, fontFamily:"'JetBrains Mono',monospace" }}>
          Этажи · сверху вниз
        </div>
        {floorStats.map(({ floorId, count, issues, critical }) => (
          <div key={floorId}
            onClick={() => setSelectedFloor(floorId)}
            onMouseEnter={() => setHoveredFloor(floorId)}
            onMouseLeave={() => setHoveredFloor(null)}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'#FFFFFF', border:`1px solid ${hoveredFloor === floorId ? '#A5B4FC' : '#E8ECF5'}`, borderRadius:14, cursor:'pointer', boxShadow: hoveredFloor === floorId ? '0 4px 16px rgba(29,78,216,0.12)' : '0 1px 4px rgba(0,0,0,0.04)', transition:'all .15s' }}>
            <div style={{ width:44, height:44, flex:'none', borderRadius:10, background:'#F3F5FA', border:'1px solid #E8ECF5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color: critical > 0 ? '#DC2626' : issues > 0 ? '#D97706' : '#1D4ED8' }}>
              0{floorId}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#0D1117' }}>Этаж {floorId}</div>
              <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>{count} ед. оборудования</div>
            </div>
            {issues > 0 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flex:'none' }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: critical > 0 ? '#DC2626' : '#D97706', flex:'none' }}/>
                <span style={{ fontSize:11, color: critical > 0 ? '#DC2626' : '#D97706', fontWeight:600 }}>{issues} замеч.</span>
              </div>
            )}
          </div>
        ))}
        <div style={{ display:'flex', gap:12, marginTop:4, fontSize:11, color:'#6B7280', paddingLeft:2 }}>
          {[['#059669','Норма'],['#D97706','Внимание'],['#DC2626','Авария']].map(([c,l]) => (
            <span key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:c, flex:'none' }}/>{l}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
