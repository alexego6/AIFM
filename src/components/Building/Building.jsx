import { useState, useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { FLOORS, EQUIPMENT, SYSTEMS, STATUSES } from '../../data/building'

// ─── room style by type ───────────────────────────────────────────────────────
const TYPE_STYLE = {
  office:    { base: '#f8fafc', stroke: '#cbd5e1', label: '#475569' },
  meeting:   { base: '#f5f3ff', stroke: '#c4b5fd', label: '#6d28d9' },
  lobby:     { base: '#eff6ff', stroke: '#93c5fd', label: '#1d4ed8' },
  technical: { base: '#fef9c3', stroke: '#fcd34d', label: '#92400e' },
  server:    { base: '#ecfdf5', stroke: '#6ee7b7', label: '#065f46' },
  wc:        { base: '#f0fdf4', stroke: '#86efac', label: '#166534' },
  archive:   { base: '#fdf4ff', stroke: '#e879f9', label: '#701a75' },
  storage:   { base: '#f8fafc', stroke: '#cbd5e1', label: '#64748b' },
  security:  { base: '#fff7ed', stroke: '#fdba74', label: '#9a3412' },
  service:   { base: '#fff7ed', stroke: '#fdba74', label: '#9a3412' },
  stair:     { base: '#f1f5f9', stroke: '#94a3b8', label: '#64748b' },
  core:      { base: '#dce3ee', stroke: '#b0bdd0', label: '#6b7a99' },
}

const STATUS_STYLE = {
  critical:  { fill: '#fff1f2', stroke: '#f87171', stripe: '#ef4444', dot: '#ef4444' },
  attention: { fill: '#fff7ed', stroke: '#fb923c', stripe: '#f97316', dot: '#f97316' },
  ok:        { fill: null, stroke: null, stripe: null, dot: '#22c55e' },
  empty:     { fill: null, stroke: null, stripe: null, dot: null },
}

function getRoomStatus(roomId) {
  const eq = EQUIPMENT.filter(e => e.roomId === roomId)
  if (eq.some(e => e.status === 'critical'))  return 'critical'
  if (eq.some(e => e.status === 'attention')) return 'attention'
  if (eq.length > 0) return 'ok'
  return 'empty'
}

function getFloorStatus(floorId) {
  const eq = EQUIPMENT.filter(e => e.floor === floorId)
  if (eq.some(e => e.status === 'critical'))  return 'critical'
  if (eq.some(e => e.status === 'attention')) return 'attention'
  return 'normal'
}

// ─── 3D building — ring plan, Skolkovo hypercube ──────────────────────────────
// Scale: floor plan 960×960 px → 3D 10.0×10.0 units
const S   = 10 / 960
const p2x = px => px * S - 5
const p2z = py => py * S - 5

// Outer wing extents (3D coords)
const LX1 = p2x(0);   const LX2 = p2x(175)   // left wing  x: -5 → -3.177
const RX1 = p2x(785); const RX2 = p2x(960)    // right wing x:  3.177 → 5
const TZ1 = p2z(0);   const TZ2 = p2z(180)    // top wing   z: -5 → -3.125
const BZ1 = p2z(780); const BZ2 = p2z(960)    // bot wing   z:  3.125 → 5
// Central service core extents
const CX1 = p2x(240); const CX2 = p2x(720)    // core x: -2.5 → 2.5
const CZ1 = p2z(240); const CZ2 = p2z(720)    // core z: -2.5 → 2.5

// Room-boundary fin positions on each facade face
// Left/right wings: fins at plan-y boundaries [180,330,480,630,780]
const WING_LR_FINS = [180, 330, 480, 630, 780].map(p2z)
// Top/bottom wings: fins at plan-x boundaries [375,585]
const WING_TB_FINS = [375, 585].map(p2x)

const BH = 3.0   // floor height
const BG = 0.18  // slab thickness

function Building3D({ onFloorClick }) {
  const containerRef = useRef(null)
  const canvasRef    = useRef(null)
  const [hoveredId,  setHoveredId]  = useState(null)
  const [hoverPos,   setHoverPos]   = useState({ x: 0, y: 0 })

  useEffect(() => {
    const container = containerRef.current
    const canvas    = canvasRef.current
    if (!container || !canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.offsetWidth, container.offsetHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xd8e4f0)
    scene.fog = new THREE.Fog(0xd8e4f0, 70, 140)

    const ambient = new THREE.AmbientLight(0xffffff, 0.85)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfff8ee, 1.2)
    sun.position.set(18, 35, 14)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30
    sun.shadow.camera.top  = 35;  sun.shadow.camera.bottom = -30
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0xa8c8f0, 0.45)
    fill.position.set(-12, 10, -12)
    scene.add(fill)
    scene.add(new THREE.HemisphereLight(0xc8dff0, 0x98a8b8, 0.35))

    const totalH = FLOORS.length * (BH + BG)
    const camera = new THREE.PerspectiveCamera(40, container.offsetWidth / container.offsetHeight, 0.1, 300)
    camera.position.set(24, 22, 24)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.target.set(0, totalH * 0.42, 0)
    controls.maxPolarAngle = Math.PI / 2 - 0.03
    controls.minDistance = 16
    controls.maxDistance = 70
    controls.update()

    // Ground plaza
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshLambertMaterial({ color: 0xc8d4de }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.01
    ground.receiveShadow = true
    scene.add(ground)
    const grid = new THREE.GridHelper(100, 100, 0xaab8c4, 0xb8c8d4)
    grid.position.y = 0.005
    scene.add(grid)

    // Shared materials
    const SLAB_MAT  = new THREE.MeshLambertMaterial({ color: 0x7a8898 })
    const FRAME_MAT = new THREE.MeshLambertMaterial({ color: 0xc8d8e8 })
    const CORE_MAT  = new THREE.MeshLambertMaterial({ color: 0x8898a8 })
    const ROOF_MAT  = new THREE.MeshLambertMaterial({ color: 0x4e5e6e })
    const makeGlass = (hex) => new THREE.MeshPhongMaterial({
      color: hex, transparent: true, opacity: 0.68,
      shininess: 220, specular: new THREE.Color(0xffffff),
    })

    // Per-floor wing definitions [cx, cz, w, d]
    // Left/Right wings span full depth (10.0), Top/Bottom between them
    const wingDefs = [
      [(LX1 + LX2) / 2, 0,               LX2 - LX1, 10.0     ],   // left
      [(RX1 + RX2) / 2, 0,               RX2 - RX1, 10.0     ],   // right
      [0, (TZ1 + TZ2) / 2, RX1 - LX2, TZ2 - TZ1 ],   // top
      [0, (BZ1 + BZ2) / 2, RX1 - LX2, BZ2 - BZ1 ],   // bottom
    ]

    const floorMeshes = []

    FLOORS.forEach((floor, idx) => {
      const y0     = idx * (BH + BG)
      const status = getFloorStatus(floor.id)
      const glassHex = status === 'critical'  ? 0xffa0a0
                     : status === 'attention' ? 0xffd080
                     : idx === 0              ? 0x68b8e0
                     :                          0x88c8ea

      // ── glass wings (raycasting targets) ────────────────────────────────
      wingDefs.forEach(([cx, cz, w, d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, BH, d), makeGlass(glassHex))
        m.position.set(cx, y0 + BH / 2, cz)
        m.castShadow = true
        m.userData = { floorId: floor.id, baseHex: glassHex }
        scene.add(m)
        floorMeshes.push(m)
      })

      // ── outer-face fins at room boundaries ───────────────────────────────
      const finGeo = new THREE.BoxGeometry(0.12, BH + 0.04, 0.12)
      // Left wing outer face (x = LX1): fins along z at LEFT_Y boundaries
      WING_LR_FINS.forEach(zb => {
        const f = new THREE.Mesh(finGeo, FRAME_MAT)
        f.position.set(LX1 - 0.04, y0 + BH / 2, zb)
        scene.add(f)
      })
      // Right wing outer face (x = RX2)
      WING_LR_FINS.forEach(zb => {
        const f = new THREE.Mesh(finGeo, FRAME_MAT)
        f.position.set(RX2 + 0.04, y0 + BH / 2, zb)
        scene.add(f)
      })
      // Top wing outer face (z = TZ1): fins along x at TOP_X boundaries
      WING_TB_FINS.forEach(xb => {
        const f = new THREE.Mesh(finGeo, FRAME_MAT)
        f.position.set(xb, y0 + BH / 2, TZ1 - 0.04)
        scene.add(f)
      })
      // Bottom wing outer face (z = BZ2)
      WING_TB_FINS.forEach(xb => {
        const f = new THREE.Mesh(finGeo, FRAME_MAT)
        f.position.set(xb, y0 + BH / 2, BZ2 + 0.04)
        scene.add(f)
      })

      // ── 4 outer corner columns ────────────────────────────────────────────
      const colGeo = new THREE.BoxGeometry(0.24, BH + BG, 0.24)
      ;[[LX1, TZ1], [LX1, BZ2], [RX2, TZ1], [RX2, BZ2]].forEach(([cx, cz]) => {
        const c = new THREE.Mesh(colGeo, FRAME_MAT)
        c.position.set(cx, y0 + (BH + BG) / 2, cz)
        c.castShadow = true
        scene.add(c)
      })
      // 4 inner-corner columns (where wing meets inner corridor)
      ;[[LX2, CZ1], [LX2, CZ2], [RX1, CZ1], [RX1, CZ2]].forEach(([cx, cz]) => {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.16, BH + BG, 0.16), CORE_MAT)
        c.position.set(cx, y0 + (BH + BG) / 2, cz)
        scene.add(c)
      })

      // ── floor slabs (wings + inner corridors) ────────────────────────────
      // Wing slabs
      wingDefs.forEach(([cx, cz, w, d]) => {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, BG, d + 0.15), SLAB_MAT)
        slab.position.set(cx, y0, cz)
        slab.castShadow = true
        slab.receiveShadow = true
        scene.add(slab)
      })
      // Corridor slabs (between wings and core, visible from above)
      ;[
        [(LX2 + CX1) / 2, 0,               CX1 - LX2, CZ2 - CZ1],   // left corridor
        [(CX2 + RX1) / 2, 0,               RX1 - CX2, CZ2 - CZ1],   // right corridor
        [0, (TZ2 + CZ1) / 2, CX2 - CX1, CZ1 - TZ2         ],   // top corridor
        [0, (CZ2 + BZ1) / 2, CX2 - CX1, BZ1 - CZ2         ],   // bottom corridor
      ].forEach(([cx, cz, w, d]) => {
        if (w > 0.01 && d > 0.01) {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(w, BG, d), SLAB_MAT)
          slab.position.set(cx, y0, cz)
          scene.add(slab)
        }
      })

      // ── status LED strip on front slab edge ──────────────────────────────
      const ledColor = status === 'critical' ? 0xef4444 : status === 'attention' ? 0xf97316 : 0x22c55e
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(RX1 - LX2, 0.07, 0.07),
        new THREE.MeshBasicMaterial({ color: ledColor }),
      )
      led.position.set(0, y0 + BG / 2, BZ2 + 0.09)
      scene.add(led)
    })

    // ── central service core (lifts + stairs, full height) ───────────────────
    const coreH = totalH + BG
    const coreMesh = new THREE.Mesh(
      new THREE.BoxGeometry(CX2 - CX1, coreH, CZ2 - CZ1),
      CORE_MAT,
    )
    coreMesh.position.set(0, coreH / 2, 0)
    coreMesh.castShadow = true
    scene.add(coreMesh)

    // Lift shaft marks on core faces (thin darker lines)
    const shaftMat = new THREE.MeshLambertMaterial({ color: 0x6a7888 })
    ;[TZ2 + 0.01, BZ1 - 0.01].forEach(zFace => {
      // 2 shaft rectangles per face
      for (const xo of [-1.2, 1.2]) {
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.9, coreH * 0.95, 0.04), shaftMat)
        shaft.position.set(xo, coreH / 2, zFace)
        scene.add(shaft)
      }
    })

    // ── atrium glass ceiling (over inner corridors, roof level) ──────────────
    const atriumGlass = new THREE.MeshPhongMaterial({
      color: 0x90c0e0, transparent: true, opacity: 0.25, shininess: 180, specular: 0xffffff,
    })
    const atriumY = totalH + BG + 0.04
    ;[
      [(LX2 + CX1) / 2, (CZ2 - CZ1),       CX1 - LX2, CZ2 - CZ1],
      [(CX2 + RX1) / 2, 0,                  RX1 - CX2, CZ2 - CZ1],
      [0,               (TZ2 + CZ1) / 2,    CX2 - CX1, CZ1 - TZ2],
      [0,               (CZ2 + BZ1) / 2,    CX2 - CX1, BZ1 - CZ2],
    ].forEach(([cx, cz, w, d]) => {
      if (w > 0.01 && d > 0.01) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), atriumGlass)
        m.position.set(cx, atriumY, cz)
        scene.add(m)
      }
    })

    // ── roof ring (follows wing shape) ────────────────────────────────────────
    const roofY = totalH
    wingDefs.forEach(([cx, cz, w, d]) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.28, d + 0.15), ROOF_MAT)
      r.position.set(cx, roofY + 0.14, cz)
      r.castShadow = true
      scene.add(r)
    })

    // Parapet on outer perimeter
    const parapetH = 0.55
    const py = roofY + 0.28 + parapetH / 2
    ;[
      [10.0 + 0.15, parapetH, 0.18,  0,      py,  BZ2 + 0.22],   // front
      [10.0 + 0.15, parapetH, 0.18,  0,      py,  TZ1 - 0.22],   // back
      [0.18, parapetH, 10.0 + 0.15,  LX1 - 0.22, py, 0     ],   // left
      [0.18, parapetH, 10.0 + 0.15,  RX2 + 0.22, py, 0     ],   // right
    ].forEach(([w, h, d, x, y, z]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), FRAME_MAT)
      m.position.set(x, y, z)
      m.castShadow = true
      scene.add(m)
    })

    // Rooftop mechanical units (on left wing roof)
    const mechMat = new THREE.MeshLambertMaterial({ color: 0x3e4e5e })
    ;[[-3.8, 0.7, 0.6, 0.9], [-3.8, 0.5, 0.5, 0.7], [-3.8, 0.4, 0.7, 0.5]].forEach(([x, w, d, h], i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mechMat)
      m.position.set(x, roofY + 0.28 + h / 2, -1.0 + i * 1.5)
      m.castShadow = true
      scene.add(m)
    })

    // ── entrance canopy (bottom-wing front face, ground floor) ───────────────
    const canopyMat = new THREE.MeshPhongMaterial({
      color: 0xb0d4f0, transparent: true, opacity: 0.5, shininess: 200, specular: 0xffffff,
    })
    const canopyW = RX1 - LX2   // spans the full bottom-wing width
    const canopy  = new THREE.Mesh(new THREE.BoxGeometry(canopyW, 0.12, 1.6), canopyMat)
    canopy.position.set(0, BH * 0.58, BZ2 + 0.8)
    canopy.castShadow = true
    scene.add(canopy)
    for (const sx of [-(canopyW / 2 - 0.3), canopyW / 2 - 0.3]) {
      const sup = new THREE.Mesh(new THREE.BoxGeometry(0.1, BH * 0.58, 0.1), FRAME_MAT)
      sup.position.set(sx, BH * 0.29, BZ2 + 1.55)
      scene.add(sup)
    }

    // ── raycasting ────────────────────────────────────────────────────────────
    const rc  = new THREE.Raycaster()
    const m2d = new THREE.Vector2()
    let curHovered = null

    const setFloorColor = (id, hex) => {
      floorMeshes
        .filter(m => m.userData.floorId === id)
        .forEach(m => m.material.color.setHex(hex))
    }

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      m2d.set((px / rect.width) * 2 - 1, -(py / rect.height) * 2 + 1)
      rc.setFromCamera(m2d, camera)
      const hit = rc.intersectObjects(floorMeshes)[0]
      const fid = hit?.object?.userData?.floorId ?? null
      if (fid !== curHovered) {
        if (curHovered) setFloorColor(curHovered, floorMeshes.find(m => m.userData.floorId === curHovered)?.userData.baseHex)
        if (fid) setFloorColor(fid, 0x50a8d8)
        curHovered = fid
        setHoveredId(fid)
        canvas.style.cursor = fid ? 'pointer' : 'default'
      }
      setHoverPos({ x: px, y: py })
    }

    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect()
      m2d.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      rc.setFromCamera(m2d, camera)
      const hit = rc.intersectObjects(floorMeshes)[0]
      if (hit?.object?.userData?.floorId) onFloorClick(hit.object.userData.floorId)
    }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('click', onClick)

    let raf
    const animate = () => { raf = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera) }
    animate()

    const onResize = () => {
      if (!container.offsetWidth) return
      camera.aspect = container.offsetWidth / container.offsetHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.offsetWidth, container.offsetHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
      controls.dispose()
      scene.traverse(o => {
        o.geometry?.dispose()
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose())
      })
      renderer.dispose()
    }
  }, [onFloorClick])

  const hovFloor = hoveredId ? FLOORS.find(f => f.id === hoveredId) : null

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Floor buttons overlay */}
      <div className="absolute left-5 top-5 flex flex-col gap-1.5">
        {[...FLOORS].reverse().map(floor => {
          const st = getFloorStatus(floor.id)
          return (
            <button key={floor.id} onClick={() => onFloorClick(floor.id)}
              className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-slate-200 shadow-sm hover:border-blue-300 hover:bg-blue-50 transition-colors text-left">
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: st === 'critical' ? '#ef4444' : st === 'attention' ? '#f97316' : '#22c55e' }} />
              <span className="text-xs font-medium text-slate-700">{floor.label}</span>
              <span className="text-[10px] text-blue-400 ml-1">→ план</span>
            </button>
          )
        })}
      </div>

      {/* Hover tooltip */}
      {hovFloor && (
        <div className="absolute pointer-events-none z-10 bg-white shadow-lg rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200"
          style={{ left: hoverPos.x + 16, top: hoverPos.y - 40 }}>
          {hovFloor.label} <span className="text-blue-500 font-normal ml-1">кликните для плана</span>
        </div>
      )}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-slate-400 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200 pointer-events-none">
        Кликните на этаж или кнопку слева · колёсико — зум · ПКМ — поворот
      </div>
    </div>
  )
}

// ─── floor plan — ClimManager ring style ─────────────────────────────────────

function CoreBackground({ room }) {
  return (
    <rect x={room.x} y={room.y} width={room.w} height={room.h}
      fill="#d0dae8" stroke="#a0b0c4" strokeWidth={1.5}
      style={{ pointerEvents: 'none' }} />
  )
}

function StairRoom({ room }) {
  const cx = room.x + room.w / 2
  const cy = room.y + room.h / 2
  const isLift = room.name.toLowerCase().includes('лифт')
  const isTall = room.h > 140
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={room.x} y={room.y} width={room.w} height={room.h}
        fill="url(#hatch-stair)" stroke="#8898aa" strokeWidth={1} />
      <line x1={room.x + 4} y1={room.y + 4} x2={room.x + room.w - 4} y2={room.y + room.h - 4}
        stroke="#8898aa" strokeWidth={0.7} />
      <line x1={room.x + room.w - 4} y1={room.y + 4} x2={room.x + 4} y2={room.y + room.h - 4}
        stroke="#8898aa" strokeWidth={0.7} />
      {isTall && (
        <>
          <text x={cx} y={cy - (isLift ? 12 : 0)} textAnchor="middle" dominantBaseline="middle"
            fontSize={isLift ? 20 : 16} style={{ userSelect: 'none' }}>
            {isLift ? '🛗' : '🚶'}
          </text>
          <text x={cx} y={cy + (isLift ? 18 : 20)} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="#607080" fontWeight="500" style={{ userSelect: 'none' }}>
            {room.name}
          </text>
        </>
      )}
    </g>
  )
}

function RoomCell({ room, isSelected, isHovered, onClick, onHover }) {
  const ts      = TYPE_STYLE[room.type] || TYPE_STYLE.office
  const ss      = STATUS_STYLE[getRoomStatus(room.id)]
  const eq      = EQUIPMENT.filter(e => e.roomId === room.id)
  const bad     = eq.filter(e => e.status !== 'normal').length
  const hasIssue = ss.stripe !== null

  const fill   = isSelected ? '#dbeafe' : (ss.fill || ts.base)
  const stroke = isSelected ? '#2563eb' : (ss.stroke || ts.stroke)
  const sw     = isSelected ? 2.5 : isHovered ? 2 : 1
  const fs     = Math.max(7, Math.min(12, Math.min(room.w, room.h) / 13))

  return (
    <g onClick={() => onClick(room)} onMouseEnter={() => onHover(room.id)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
      {hasIssue && (
        <rect x={room.x - 3} y={room.y - 3} width={room.w + 6} height={room.h + 6} rx={5} fill={ss.stripe + '22'} stroke="none" />
      )}
      <rect x={room.x} y={room.y} width={room.w} height={room.h}
        fill={fill} stroke={stroke} strokeWidth={sw} opacity={isHovered && !isSelected ? 0.88 : 1} />
      {hasIssue && (
        <rect x={room.x} y={room.y + 4} width={4} height={room.h - 8} fill={ss.stripe} rx={2} />
      )}
      {isSelected && (
        <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="#2563eb0a" stroke="none" />
      )}
      <text x={room.x + room.w / 2} y={room.y + room.h / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={fs} fill={isSelected ? '#1d4ed8' : ts.label}
        fontWeight={hasIssue || isSelected ? '700' : '500'}
        style={{ userSelect: 'none', pointerEvents: 'none' }}>
        {room.name}
      </text>
      {ss.dot && (
        <circle cx={room.x + room.w - 10} cy={room.y + 10} r={5} fill={ss.dot} stroke="white" strokeWidth={1.5} />
      )}
      {eq.length > 0 && (
        <g>
          <rect x={room.x + room.w - 24} y={room.y + room.h - 20} width={22} height={16} rx={4}
            fill={bad > 0 ? (ss.stripe || '#94a3b8') : '#cbd5e1'} />
          <text x={room.x + room.w - 13} y={room.y + room.h - 12}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={8.5} fill="white" fontWeight="700" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {eq.length}
          </text>
        </g>
      )}
    </g>
  )
}

// ─── room detail panel ────────────────────────────────────────────────────────
function RoomDetailPanel({ room, onClose }) {
  const status = getRoomStatus(room.id)
  const ss     = STATUS_STYLE[status]
  const roomEq = EQUIPMENT.filter(e => e.roomId === room.id)
  const statusLabel = { critical: 'Критичное состояние', attention: 'Требует внимания', ok: 'Норма', empty: 'Нет оборудования' }[status]

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-white border-l border-slate-200 shadow-xl overflow-y-auto z-20 flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
        <div>
          <div className="text-sm font-bold text-slate-800">{room.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{room.id}</div>
        </div>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-500 text-lg">✕</button>
      </div>

      <div className="px-5 py-3 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ss.dot || '#cbd5e1' }} />
          <span className="text-xs font-semibold" style={{ color: ss.dot || '#94a3b8' }}>{statusLabel}</span>
        </div>
      </div>

      <div className="px-5 py-3 flex-1">
        <div className="text-[10px] text-slate-400 mb-2 uppercase tracking-wide font-medium">
          Оборудование{roomEq.length > 0 ? ` (${roomEq.length})` : ''}
        </div>
        {roomEq.length === 0 ? (
          <div className="text-xs text-slate-300">Нет зарегистрированного оборудования</div>
        ) : (
          <div className="flex flex-col gap-2">
            {roomEq.map(eq => {
              const sys = SYSTEMS[eq.system]
              const st  = STATUSES[eq.status]
              return (
                <div key={eq.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                    <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{eq.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: sys?.color, backgroundColor: sys?.color + '18' }}>{eq.system}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 truncate">{eq.model}</span>
                    <span className="text-[10px] font-semibold shrink-0 ml-2" style={{ color: st.color }}>{st.label}</span>
                  </div>
                  <div className="text-[10px] text-slate-300">{eq.year} г.в. · {eq.id}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── floor plan view ──────────────────────────────────────────────────────────
function FloorPlanView({ floorId, onBack, onFloorChange }) {
  const [hoveredRoomId, setHoveredRoomId] = useState(null)
  const [selectedRoom,  setSelectedRoom]  = useState(null)
  const floor = FLOORS.find(f => f.id === floorId)

  const floorStats = FLOORS.map(f => {
    const crit = EQUIPMENT.filter(e => e.floor === f.id && e.status === 'critical').length
    return { id: f.id, label: f.label, critical: crit }
  })

  const handleRoomClick = useCallback((room) => {
    if (room.type === 'core' || room.type === 'stair') return
    setSelectedRoom(prev => prev?.id === room.id ? null : room)
  }, [])

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 bg-white border-b border-slate-100 flex-wrap">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors shrink-0">
          ← 3D-модель
        </button>
        <div className="w-px h-4 bg-slate-200 shrink-0" />
        <span className="text-xs text-slate-400 font-medium shrink-0">Этаж:</span>
        {floorStats.map(f => (
          <button key={f.id}
            onClick={() => { onFloorChange(f.id); setSelectedRoom(null) }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0 ${
              floorId === f.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}>
            {f.label}
            {f.critical > 0 && (
              <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                floorId === f.id ? 'bg-white/30 text-white' : 'bg-red-500 text-white'
              }`}>{f.critical}</span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
          {[['#ef4444', 'Критично'], ['#f97316', 'Внимание'], ['#22c55e', 'Норма']].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
              <span>{l}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-3 rounded-sm bg-[#f5f3ff] border border-[#c4b5fd]" />
            <span>Перег.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-3 rounded-sm"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg,#9baab8 0,#9baab8 1px,transparent 1px,transparent 5px)', backgroundColor: '#f1f5f9' }} />
            <span>Лифт/Лест.</span>
          </div>
        </div>
      </div>

      {/* Plan + detail */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 w-full max-w-[800px]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                <span>📐</span>{floor?.label} — БЦ «Горизонт»
              </div>
              <div className="text-[10px] text-slate-300">Нажмите на помещение для деталей</div>
            </div>

            <svg viewBox="0 0 960 960" className="w-full rounded-lg" style={{ height: 'auto', display: 'block' }}>
              <defs>
                <pattern id="hatch-stair" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#9baab8" strokeWidth="1.8" />
                </pattern>
              </defs>

              {/* Corridor background */}
              <rect x={0} y={0} width={960} height={960} fill="#cfd7e3" stroke="#7a8a9e" strokeWidth={3} />

              {/* Render order: core bg → stairs → rooms */}
              {floor?.rooms
                .filter(r => r.type === 'core')
                .map(r => <CoreBackground key={r.id} room={r} />)}
              {floor?.rooms
                .filter(r => r.type === 'stair')
                .map(r => <StairRoom key={r.id} room={r} />)}
              {floor?.rooms
                .filter(r => r.type !== 'core' && r.type !== 'stair')
                .map(r => (
                  <RoomCell
                    key={r.id}
                    room={r}
                    isSelected={selectedRoom?.id === r.id}
                    isHovered={hoveredRoomId === r.id}
                    onClick={handleRoomClick}
                    onHover={setHoveredRoomId}
                  />
                ))}

              {/* North arrow */}
              <g transform="translate(935, 935)">
                <circle cx={0} cy={0} r={16} fill="white" stroke="#b0bec5" strokeWidth={1.5} />
                <polygon points="0,-11 -5,4 0,0 5,4" fill="#37474f" />
                <text x={0} y={16} textAnchor="middle" fontSize={8} fill="#90a4ae" fontWeight="700">С</text>
              </g>
            </svg>
          </div>
        </div>

        {selectedRoom && (
          <RoomDetailPanel room={selectedRoom} onClose={() => setSelectedRoom(null)} />
        )}
      </div>
    </div>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────
export default function Building() {
  const [view,        setView]        = useState('3d')
  const [activeFloor, setActiveFloor] = useState(1)

  const handleFloorClick = useCallback((id) => { setActiveFloor(id); setView('plan') }, [])

  if (view === 'plan') {
    return <FloorPlanView floorId={activeFloor} onBack={() => setView('3d')} onFloorChange={setActiveFloor} />
  }
  return (
    <div className="h-full w-full">
      <Building3D onFloorClick={handleFloorClick} />
    </div>
  )
}
