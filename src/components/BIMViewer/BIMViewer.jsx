import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { IFCLoader } from 'web-ifc-three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useAppStore } from '../../store/useAppStore'
import { EQUIPMENT, STATUSES } from '../../data/building'
import { setIfcManager } from '../../lib/ifcInstance'

const STATUS_COLORS = {
  normal:    0x22c55e,
  attention: 0xeab308,
  critical:  0xef4444,
}

function findEquipmentMatch(name) {
  if (!name) return null
  const lower = name.toLowerCase()
  return EQUIPMENT.find((e) => lower.includes(e.id.toLowerCase()) || lower.includes(e.name.toLowerCase().split(' ')[0].toLowerCase()))
}

const FEATURES = [
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    title: '3D-просмотр',
    desc: 'Orbit, pan, zoom. Клик по элементу — свойства IFC',
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
    title: 'Планы этажей',
    desc: 'Разрез по горизонтали, вид сверху для каждого уровня',
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>,
    title: 'Атрибуты объектов',
    desc: 'Тип IFC, имя, описание и связь с оборудованием FM',
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    title: 'IFC2x3 и IFC4',
    desc: 'Архитектура, конструкции, MEP, электрика',
  },
]

function BIMEmptyState() {
  const { setBimPendingFile, setActiveSection } = useAppStore()
  const handleFile = (e) => {
    const file = e.target.files[0]
    if (file) { setBimPendingFile(file); setActiveSection('bim') }
  }
  return (
    <div style={{
      position:'absolute', inset:0, zIndex:10,
      background:'linear-gradient(160deg,#EEF2FF 0%,#F3F5FA 50%,#EDF9F4 100%)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:32,
    }}>
      <div style={{ display:'flex', gap:64, alignItems:'center', maxWidth:900, width:'100%' }}>

        {/* Left — иллюстрация */}
        <div style={{ flex:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
          <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
            {/* Base grid */}
            <rect x="20" y="140" width="160" height="2" rx="1" fill="#C7D2FE" opacity=".5"/>
            {/* Building iso */}
            <g transform="translate(40,30)">
              {/* Back floor */}
              <polygon points="60,20 120,50 120,110 60,80" fill="#E0E7FF" stroke="#A5B4FC" strokeWidth="1.2"/>
              <polygon points="0,50 60,20 60,80 0,110" fill="#C7D2FE" stroke="#A5B4FC" strokeWidth="1.2"/>
              <polygon points="0,50 60,20 120,50 60,80" fill="#EEF2FF" stroke="#A5B4FC" strokeWidth="1.2"/>
              {/* Windows front */}
              {[65,80].map(y => [10,25,40].map(x => (
                <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" rx="1" fill="#818CF8" opacity=".35"/>
              )))}
              {/* Windows right */}
              {[65,80].map(y => [72,87,102].map(x => (
                <rect key={`r${x}-${y}`} x={x} y={y} width="8" height="8" rx="1" fill="#818CF8" opacity=".2"/>
              )))}
              {/* Door */}
              <rect x="22" y="90" width="10" height="16" rx="1.5" fill="#6366F1" opacity=".5"/>
              {/* Roof accent */}
              <polygon points="0,50 60,20 120,50" fill="none" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="4 3" opacity=".6"/>
            </g>
            {/* Orbit ring */}
            <ellipse cx="100" cy="152" rx="52" ry="10" stroke="#A5B4FC" strokeWidth="1" strokeDasharray="3 3" fill="none" opacity=".6"/>
            {/* Orbit dot */}
            <circle cx="152" cy="152" r="4" fill="#6366F1" opacity=".7"/>
            {/* Corner markers */}
            {[[36,142],[164,142],[100,118]].map(([x,y],i) => (
              <circle key={i} cx={x} cy={y} r="3" fill="#818CF8" opacity=".5"/>
            ))}
          </svg>

          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#3730A3', marginBottom:6 }}>BIM-просмотрщик</div>
            <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.6 }}>
              Откройте IFC-модель здания<br/>для работы с цифровым двойником
            </div>
          </div>

          <label style={{
            display:'flex', alignItems:'center', gap:9,
            background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
            color:'#fff', fontWeight:600, fontSize:14,
            padding:'11px 24px', borderRadius:12, cursor:'pointer',
            boxShadow:'0 4px 16px rgba(79,70,229,0.35)',
            fontFamily:"'Golos Text',system-ui,sans-serif",
            transition:'opacity .15s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Выбрать IFC-файл
            <input type="file" accept=".ifc" style={{ display:'none' }} onChange={handleFile}/>
          </label>
          <div style={{ fontSize:11, color:'#9CA3AF' }}>или перетащите файл в эту область</div>
        </div>

        {/* Right — возможности */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ fontSize:11, letterSpacing:'1px', textTransform:'uppercase', color:'#9CA3AF', fontWeight:600, fontFamily:"'JetBrains Mono',monospace", marginBottom:4 }}>
            Возможности просмотрщика
          </div>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              display:'flex', alignItems:'flex-start', gap:14,
              background:'#FFFFFF', border:'1px solid #E8ECF5',
              borderRadius:14, padding:'14px 18px',
              boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <span style={{
                width:38, height:38, flex:'none', borderRadius:10,
                background:'linear-gradient(135deg,#EEF2FF,#E0E7FF)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#6366F1',
              }}>{f.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#0D1117', marginBottom:3 }}>{f.title}</div>
                <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4, paddingLeft:2 }}>
            Поддерживаются форматы IFC2x3 и IFC4 · Autodesk Revit, ArchiCAD, Allplan
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BIMViewer() {
  const canvasRef      = useRef(null)
  const sceneRef       = useRef(null)
  const rendererRef    = useRef(null)
  const cameraRef      = useRef(null)
  const orthoCamRef    = useRef(null)
  const controlsRef    = useRef(null)
  const ifcLoaderRef   = useRef(null)
  const modelRef       = useRef(null)
  const rafRef         = useRef(null)
  const highlightMeshRef = useRef(null)
  const modelBoundsRef  = useRef(null)
  const modelCenterRef  = useRef(new THREE.Vector3())

  const [loading, setLoading]           = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [loadPhase, setLoadPhase]       = useState('download') // 'download' | 'parse'
  const [error, setError]               = useState(null)
  const [isDragOver, setIsDragOver]     = useState(false)
  const [viewMode, setViewMode]         = useState('3d')   // '3d' | '2d'
  const [floorLevel, setFloorLevel]     = useState(0)      // index into storeys
  const [storeys, setStoreys]           = useState([])     // [{ name, elevation, topElevation }]

  const { bimLoaded, bimFileName, bimSelectedElement, bimPendingFile, activeSection, setBimLoaded, setBimSelectedElement, setBimPendingFile } = useAppStore()

  // Init Three.js scene
  // Блокируем браузерный дефолт — открытие файла как страницы
  useEffect(() => {
    const block = (e) => e.preventDefault()
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  // Ресайз рендерера когда раздел становится видимым (canvas был 0×0 пока скрыт)
  useEffect(() => {
    if (activeSection !== 'bim') return
    const id = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas || !rendererRef.current) return
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      if (!w || !h) return
      rendererRef.current.setSize(w, h)
      if (cameraRef.current) {
        cameraRef.current.aspect = w / h
        cameraRef.current.updateProjectionMatrix()
      }
      if (orthoCamRef.current) {
        const asp = w / h
        const s = 20
        orthoCamRef.current.left   = -s * asp
        orthoCamRef.current.right  =  s * asp
        orthoCamRef.current.top    =  s
        orthoCamRef.current.bottom = -s
        orthoCamRef.current.updateProjectionMatrix()
      }
    }, 30)
    return () => clearTimeout(id)
  }, [activeSection])


  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(canvas.offsetWidth, canvas.offsetHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.localClippingEnabled = true
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf8fafc)
    sceneRef.current = scene

    const grid = new THREE.GridHelper(50, 50, 0xcbd5e1, 0xe2e8f0)
    scene.add(grid)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(10, 20, 10)
    dirLight.castShadow = true
    scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.2)
    fillLight.position.set(-10, 5, -10)
    scene.add(fillLight)

    // Perspective camera
    const camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 0.1, 1000)
    camera.position.set(10, 10, 10)
    cameraRef.current = camera

    // Orthographic camera (for 2D plan)
    const aspect = canvas.offsetWidth / canvas.offsetHeight
    const orthoSize = 20
    const orthoCam = new THREE.OrthographicCamera(
      -orthoSize * aspect, orthoSize * aspect,
      orthoSize, -orthoSize,
      0.1, 1000,
    )
    orthoCam.position.set(0, 100, 0)
    orthoCam.lookAt(0, 0, 0)
    orthoCamRef.current = orthoCam

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(0, 2, 0)
    controlsRef.current = controls

    const ifcLoader = new IFCLoader()
    ifcLoader.ifcManager.setWasmPath('/')
    ifcLoaderRef.current = ifcLoader
    setIfcManager(ifcLoader.ifcManager)

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      controls.update()
      const activeCam = renderer.domElement.dataset.mode === '2d' ? orthoCamRef.current : cameraRef.current
      renderer.render(scene, activeCam)
    }
    animate()

    const onResize = () => {
      if (!canvas.offsetWidth) return
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()

      const asp = w / h
      const s   = orthoSize
      orthoCam.left   = -s * asp
      orthoCam.right  =  s * asp
      orthoCam.top    =  s
      orthoCam.bottom = -s
      orthoCam.updateProjectionMatrix()

      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
    }
  }, [])

  const applyFloorClip = useCallback((level) => {
    if (!modelRef.current || storeys.length === 0) return
    const storey = storeys[level]
    if (!storey) return

    const floorH = storey.topElevation - storey.elevation
    // Section cut at 40% of floor height (≈1.2m for a 3m floor, scales for mansard)
    const cutY   = storey.elevation + floorH * 0.4
    const bottom = storey.elevation - 0.05

    const clipBottom = new THREE.Plane(new THREE.Vector3(0,  1, 0), -bottom)
    const clipTop    = new THREE.Plane(new THREE.Vector3(0, -1, 0),  cutY)

    modelRef.current.traverse(obj => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(m => { m.clippingPlanes = [clipBottom, clipTop]; m.clipShadows = true })
      }
    })

    // Position ortho camera directly above the model center at this floor level
    const cx = modelCenterRef.current.x
    const cz = modelCenterRef.current.z
    const cy = storey.elevation + floorH * 0.5
    if (orthoCamRef.current) {
      orthoCamRef.current.position.set(cx, cy + 100, cz)
      orthoCamRef.current.lookAt(cx, cy, cz)
      orthoCamRef.current.up.set(0, 0, -1)
      orthoCamRef.current.updateProjectionMatrix()
    }
  }, [storeys])

  // Switch between 3D and 2D modes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.dataset.mode = viewMode

    const controls = controlsRef.current
    if (!controls) return

    if (viewMode === '2d') {
      controls.enabled = false
      applyFloorClip(floorLevel)
    } else {
      controls.enabled = true
      if (modelRef.current) {
        modelRef.current.traverse(obj => {
          if (obj.isMesh && obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
            mats.forEach(m => { m.clippingPlanes = [] })
          }
        })
      }
    }
  }, [viewMode, applyFloorClip, floorLevel])

  useEffect(() => {
    if (viewMode === '2d') applyFloorClip(floorLevel)
  }, [floorLevel, viewMode, applyFloorClip])

  // Click on model element (3D mode only)
  const handleCanvasClick = useCallback(async (e) => {
    if (viewMode === '2d') return
    if (!modelRef.current || !ifcLoaderRef.current) return
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const mouse  = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, cameraRef.current)
    const intersects = raycaster.intersectObjects([modelRef.current], true)
    if (!intersects.length) {
      if (highlightMeshRef.current) { sceneRef.current.remove(highlightMeshRef.current); highlightMeshRef.current = null }
      setBimSelectedElement(null)
      return
    }

    const { face, object } = intersects[0]
    const modelID = modelRef.current.modelID ?? 0
    try {
      const expressID = await ifcLoaderRef.current.ifcManager.getExpressId(object.geometry, face.a)
      const props     = await ifcLoaderRef.current.ifcManager.getItemProperties(modelID, expressID, false)
      const type      = await ifcLoaderRef.current.ifcManager.getIfcType(modelID, expressID)
      const name      = props?.Name?.value || props?.LongName?.value || type
      const matched   = findEquipmentMatch(name)

      setBimSelectedElement({
        expressID, type, name,
        props: {
          'Тип IFC':    type,
          'Имя':        props?.Name?.value || '—',
          'Описание':   props?.Description?.value || '—',
          'ID объекта': props?.ObjectType?.value || '—',
          'ExpressID':  expressID,
        },
        matched,
      })

      if (highlightMeshRef.current) sceneRef.current.remove(highlightMeshRef.current)
      const highlightColor = matched ? STATUS_COLORS[matched.status] : 0x00d4ff
      const subset = await ifcLoaderRef.current.ifcManager.createSubset({
        modelID,
        ids: [expressID],
        material: new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.6, color: new THREE.Color(highlightColor), depthTest: false }),
        scene: sceneRef.current,
        removePrevious: true,
        customID: 'highlight',
      })
      highlightMeshRef.current = subset
    } catch { /* ignore */ }
  }, [viewMode, setBimSelectedElement])

  // Load IFC file
  const loadIFC = useCallback(async (file) => {
    if (!ifcLoaderRef.current || !sceneRef.current) return
    setLoading(true)
    setLoadProgress(0)
    setLoadPhase('download')
    setError(null)
    setBimSelectedElement(null)
    setViewMode('3d')

    try {
      if (modelRef.current) {
        sceneRef.current.remove(modelRef.current)
        ifcLoaderRef.current.ifcManager.disposeMemory()
        modelRef.current = null
        modelBoundsRef.current = null
      }

      const url = URL.createObjectURL(file)
      const model = await ifcLoaderRef.current.loadAsync(url, (xhr) => {
        if (xhr.total) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100)
          setLoadProgress(pct)
          if (pct === 100) setLoadPhase('parse')
        }
      })
      URL.revokeObjectURL(url)

      model.modelID = 0
      sceneRef.current.add(model)
      modelRef.current = model

      const box    = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      const size   = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)

      modelCenterRef.current = center

      // Read IfcBuildingStorey names and relative order (type code 3124254112)
      const IFCBUILDINGSTOREY = 3124254112
      let parsedStoreys = []
      try {
        const ids = await ifcLoaderRef.current.ifcManager.getAllItemsOfType(0, IFCBUILDINGSTOREY, false)
        const raw = []
        for (const id of ids) {
          const props = await ifcLoaderRef.current.ifcManager.getItemProperties(0, id, false)
          const elev  = typeof props?.Elevation?.value === 'number' ? props.Elevation.value : 0
          const name  = props?.Name?.value || props?.LongName?.value || `Этаж ${raw.length + 1}`
          raw.push({ name, ifcElev: elev })
        }
        raw.sort((a, b) => a.ifcElev - b.ifcElev)

        // Map IFC elevations proportionally to Three.js bounding box Y range.
        // This handles both mm and m IFC files — only order and ratio matter.
        const ifcMin  = raw[0].ifcElev
        const ifcMax  = raw[raw.length - 1].ifcElev
        const ifcSpan = ifcMax - ifcMin || 1
        const threeH  = box.max.y - box.min.y

        parsedStoreys = raw.map((s, i) => {
          const t    = (s.ifcElev - ifcMin) / ifcSpan          // 0..1
          const tTop = i < raw.length - 1
            ? (raw[i + 1].ifcElev - ifcMin) / ifcSpan
            : 1
          return {
            name:         s.name,
            elevation:    box.min.y + t    * threeH,
            topElevation: box.min.y + tTop * threeH,
          }
        })
      } catch { /* fallback below */ }

      // Fallback: single floor = whole bounding box
      if (parsedStoreys.length === 0) {
        parsedStoreys = [{ name: 'Этаж 1', elevation: box.min.y, topElevation: box.max.y }]
      }

      setStoreys(parsedStoreys)
      setFloorLevel(0)

      cameraRef.current.position.set(center.x + maxDim, center.y + maxDim * 0.8, center.z + maxDim)
      controlsRef.current.target.copy(center)
      controlsRef.current.update()

      // Fit orthographic camera
      const asp = canvasRef.current.offsetWidth / canvasRef.current.offsetHeight
      const s   = maxDim * 0.7
      orthoCamRef.current.left   = -s * asp
      orthoCamRef.current.right  =  s * asp
      orthoCamRef.current.top    =  s
      orthoCamRef.current.bottom = -s
      orthoCamRef.current.position.set(center.x, box.max.y + 50, center.z)
      orthoCamRef.current.lookAt(center.x, center.y, center.z)
      orthoCamRef.current.updateProjectionMatrix()

      setBimLoaded(true, file.name)
    } catch (err) {
      const msg = err?.message || String(err)
      setError(`Ошибка загрузки: ${msg}`)
      console.error('[BIMViewer] loadIFC error:', err)
    } finally {
      setLoading(false)
    }
  }, [setBimLoaded, setBimSelectedElement])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.ifc')) loadIFC(file)
    else setError('Поддерживается только формат .ifc')
  }, [loadIFC])

  // Файл пришёл из глобального дропа в App
  useEffect(() => {
    if (bimPendingFile) {
      setBimPendingFile(null)
      loadIFC(bimPendingFile)
    }
  }, [bimPendingFile, loadIFC, setBimPendingFile])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const onDragLeave = useCallback((e) => {
    // только если курсор ушёл за пределы всего контейнера
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false)
    }
  }, [])

  const onFileInput = (e) => {
    const file = e.target.files[0]
    if (file) loadIFC(file)
  }

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag overlay — поверх всего окна */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(238,242,255,0.85)',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', inset: 12,
            border: '2.5px dashed #6366F1',
            borderRadius: 20,
            animation: 'bimDashAnim 0.6s linear infinite',
          }}/>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <div style={{ fontSize:22, fontWeight:700, color:'#4338CA' }}>Отпустите .ifc файл</div>
            <div style={{ fontSize:13, color:'#6366F1', opacity:0.8 }}>Модель откроется в 3D-просмотрщике</div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white z-10">
        <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs cursor-pointer hover:bg-blue-100 transition-colors font-medium">
          ↑ Загрузить IFC
          <input type="file" accept=".ifc" className="hidden" onChange={onFileInput} />
        </label>

        {bimFileName && (
          <span className="text-slate-400 text-xs font-mono truncate max-w-[200px]">{bimFileName}</span>
        )}

        {bimLoaded && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            {/* 3D / 2D toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              {['3d', '2d'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    viewMode === mode
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {mode === '3d' ? '3D' : '2D план'}
                </button>
              ))}
            </div>

            {/* Floor selector (2D only) */}
            {viewMode === '2d' && storeys.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">Этаж:</span>
                {storeys.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setFloorLevel(i)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all border ${
                      floorLevel === i
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-300">
          {viewMode === '3d' ? (
            <>
              <span>ЛКМ — выбор</span>
              <span>ПКМ — пан</span>
              <span>Колёсико — зум</span>
            </>
          ) : (
            <span>2D вид сверху · выберите этаж</span>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onClick={handleCanvasClick}
        />

        {!bimLoaded && !loading && <BIMEmptyState />}

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20">
            {loadPhase === 'parse' ? (
              <>
                <div style={{ display:'flex', gap:5, marginBottom:20 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:'#1D4ED8', animation:`bimDot 1.2s ease-in-out ${i*0.2}s infinite` }}/>
                  ))}
                </div>
                <div className="text-slate-700 text-sm font-medium mb-1">Парсинг IFC-модели…</div>
                <div className="text-slate-400 text-xs">WASM обрабатывает геометрию, подождите</div>
              </>
            ) : (
              <>
                <div className="text-slate-600 text-sm mb-4">Загрузка файла…</div>
                <div className="w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${loadProgress}%` }} />
                </div>
                <div className="text-slate-400 text-xs mt-2">{loadProgress}%</div>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs z-20">
            {error}
            <button className="ml-3 text-red-400 hover:text-red-600" onClick={() => setError(null)}>✕</button>
          </div>
        )}
      </div>

      {/* Selected element panel */}
      {bimSelectedElement && (
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-10 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-blue-700">{bimSelectedElement.name || bimSelectedElement.type}</span>
                <span className="text-[10px] text-slate-400 font-mono">{bimSelectedElement.type}</span>
              </div>
              <div className="grid grid-cols-3 gap-x-6 gap-y-1">
                {Object.entries(bimSelectedElement.props).map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <span className="text-[10px] text-slate-400">{k}:</span>
                    <span className="text-[10px] text-slate-600 truncate">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
            {bimSelectedElement.matched && (
              <div className="flex-shrink-0 border-l border-slate-200 pl-4">
                <div className="text-[10px] text-slate-400 mb-1">Связано с</div>
                <div className="text-xs text-slate-700 font-medium">{bimSelectedElement.matched.name}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUSES[bimSelectedElement.matched.status].color }} />
                  <span className="text-[10px]" style={{ color: STATUSES[bimSelectedElement.matched.status].color }}>
                    {STATUSES[bimSelectedElement.matched.status].label}
                  </span>
                </div>
              </div>
            )}
            <button className="text-slate-400 hover:text-slate-600 text-sm flex-shrink-0" onClick={() => setBimSelectedElement(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
