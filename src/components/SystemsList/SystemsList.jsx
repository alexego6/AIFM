import { useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useAppStore } from '../../store/useAppStore'
import { getIfcManager } from '../../lib/ifcInstance'

// IFC type codes (CRC32 of Express schema names)
const IFC_SYSTEM_TYPES = [
  { code: 2254336722, label: 'Система' },
  { code: 1177604601, label: 'Инж. система здания' },
  { code: 574549367,  label: 'Система распределения' },
]
const IFCRELASSIGNSTOGROUP = 1307041759

const PREDEFINED_RU = {
  ELECTRICAL:          'Электроснабжение',
  LIGHTING:            'Освещение',
  DOMESTIC_HOT_WATER:  'ГВС',
  DOMESTIC_COLD_WATER: 'ХВС',
  HEATING:             'Отопление',
  COOLING:             'Охлаждение',
  VENTILATION:         'Вентиляция',
  AIR_CONDITIONING:    'Кондиционирование',
  GAS:                 'Газоснабжение',
  FIRE_PROTECTION:     'Пожаротушение',
  SPRINKLER:           'Спринклеры',
  WASTEWATER:          'Канализация',
  DRAINAGE:            'Дренаж',
  COMMUNICATION:       'Связь',
  SECURITY:            'Безопасность',
  CONTROLSYSTEM:       'Система управления',
  EXHAUST:             'Вытяжная вентиляция',
  COMPRESSEDAIR:       'Сжатый воздух',
}

const TYPE_COLOR = {
  'Электроснабжение':    '#eab308',
  'Освещение':           '#f59e0b',
  'ГВС':                 '#ef4444',
  'ХВС':                 '#3b82f6',
  'Отопление':           '#f97316',
  'Охлаждение':          '#06b6d4',
  'Вентиляция':          '#8b5cf6',
  'Кондиционирование':   '#06b6d4',
  'Газоснабжение':       '#84cc16',
  'Пожаротушение':       '#ef4444',
  'Спринклеры':          '#3b82f6',
  'Канализация':         '#78716c',
  'Дренаж':              '#64748b',
  'Связь':               '#a855f7',
  'Безопасность':        '#f43f5e',
  'Система управления':  '#0ea5e9',
  'Вытяжная вентиляция': '#7c3aed',
  'Сжатый воздух':       '#0284c7',
}

// ── mini 3D preview ───────────────────────────────────────────────────────────
function SystemPreview({ elementIDs, systemName }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ifcManager = getIfcManager()
    if (!ifcManager || elementIDs.length === 0) return

    const w = canvas.offsetWidth || 460
    const h = 220

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(w, h)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf1f5f9)
    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(5, 10, 5)
    scene.add(dir)
    scene.add(new THREE.GridHelper(50, 50, 0xdde3ea, 0xe8edf2))

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 2000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07

    const customID = `prev_${systemName.replace(/\W/g, '_')}`
    let disposed = false

    ;(async () => {
      try {
        const mat = new THREE.MeshLambertMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.85 })
        const subset = await ifcManager.createSubset({ modelID: 0, ids: elementIDs, material: mat, scene, removePrevious: true, customID })
        if (disposed || !subset) return

        const box    = new THREE.Box3().setFromObject(subset)
        const center = box.getCenter(new THREE.Vector3())
        const size   = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z) || 1

        camera.position.set(center.x + maxDim * 1.5, center.y + maxDim, center.z + maxDim * 1.5)
        controls.target.copy(center)
        controls.update()
      } catch (e) {
        console.warn('preview subset:', e)
      }
    })()

    let raf
    const animate = () => { raf = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera) }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      controls.dispose()
      try { ifcManager.removeSubset(0, undefined, customID) } catch { /* no-op */ }
      scene.traverse(o => {
        o.geometry?.dispose()
        if (o.material) [].concat(o.material).forEach(m => m.dispose())
      })
      renderer.dispose()
    }
  }, [elementIDs, systemName])

  if (elementIDs.length === 0) {
    return (
      <div className="w-full rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 text-xs" style={{ height: 120 }}>
        Геометрия недоступна
      </div>
    )
  }

  return <canvas ref={canvasRef} className="w-full rounded-xl" style={{ height: 220 }} />
}

// ── detail modal ──────────────────────────────────────────────────────────────
function SystemModal({ system, onClose }) {
  const color = TYPE_COLOR[system.predefinedLabel] || TYPE_COLOR[system.ifcTypeLabel] || '#94a3b8'
  const label = system.predefinedLabel || system.ifcTypeLabel

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[540px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
            </div>
            <div className="text-base font-bold text-slate-800 leading-snug">{system.name}</div>
            {system.description && (
              <div className="text-xs text-slate-400 mt-1">{system.description}</div>
            )}
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 text-xl ml-4 shrink-0 leading-none">✕</button>
        </div>

        {/* 3D preview */}
        <div className="px-6 pt-5 pb-3">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 font-semibold">3D-вид системы</div>
          <SystemPreview elementIDs={system.elementIDs} systemName={system.name} />
          {system.elementIDs.length > 0 && (
            <div className="text-[10px] text-slate-300 mt-1.5 text-center">ЛКМ — поворот · колёсико — зум</div>
          )}
        </div>

        {/* Properties */}
        <div className="px-6 pb-6">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 font-semibold">Свойства</div>
          <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            {system.props.map(([k, v]) => (
              <div key={k} className="flex items-start gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 transition-colors">
                <span className="text-[11px] text-slate-400 w-44 shrink-0 pt-px">{k}</span>
                <span className="text-[11px] text-slate-700 font-medium break-all">{String(v)}</span>
              </div>
            ))}
            <div className="flex items-start gap-3 px-4 py-2.5 bg-white">
              <span className="text-[11px] text-slate-400 w-44 shrink-0 pt-px">Количество элементов</span>
              <span className="text-[11px] font-bold text-blue-600">{system.elementIDs.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── main export ───────────────────────────────────────────────────────────────
export default function SystemsList() {
  const { bimLoaded } = useAppStore()
  const [systems,  setSystems]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(null)

  const parseSystems = useCallback(async () => {
    const ifcManager = getIfcManager()
    if (!ifcManager) return

    setLoading(true)
    const found = []

    try {
      // 1. Collect all system objects
      for (const { code, label } of IFC_SYSTEM_TYPES) {
        let ids = []
        try { ids = await ifcManager.getAllItemsOfType(0, code, false) } catch { continue }

        for (const id of ids) {
          const props = await ifcManager.getItemProperties(0, id, false)
          const name  = props?.Name?.value || props?.LongName?.value || `Система ${id}`
          const desc  = props?.Description?.value || ''
          const ptype = props?.PredefinedType?.value || props?.SystemType?.value || ''
          const predefinedLabel = PREDEFINED_RU[ptype] || ''

          const propRows = []
          if (props?.Name?.value)        propRows.push(['Имя',              props.Name.value])
          if (props?.LongName?.value)    propRows.push(['Длинное имя',      props.LongName.value])
          if (props?.Description?.value) propRows.push(['Описание',         props.Description.value])
          if (ptype)                     propRows.push(['Тип (PredefinedType)', ptype])
          propRows.push(['IFC тип',   label])
          propRows.push(['ExpressID', String(id)])

          found.push({ id, name, description: desc, ifcTypeLabel: label, predefinedLabel, props: propRows, elementIDs: [] })
        }
      }

      // 2. Resolve element memberships via IfcRelAssignsToGroup
      let relIDs = []
      try { relIDs = await ifcManager.getAllItemsOfType(0, IFCRELASSIGNSTOGROUP, false) } catch { /* no-op */ }

      for (const relID of relIDs) {
        try {
          const rel     = await ifcManager.getItemProperties(0, relID, false)
          const groupID = rel?.RelatingGroup?.value
          const members = rel?.RelatedObjects
          if (!groupID || !Array.isArray(members)) continue
          const sys = found.find(s => s.id === groupID)
          if (sys) sys.elementIDs = members.map(m => m.value).filter(v => v != null)
        } catch { /* no-op */ }
      }
    } catch (e) {
      console.error('parseSystems:', e)
    }

    setSystems(found)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (bimLoaded) parseSystems()
    else { setSystems([]); setSelected(null) }
  }, [bimLoaded, parseSystems])

  // ── empty states ─────────────────────────────────────────────────────────
  if (!bimLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl opacity-10">🏗</div>
        <div className="text-slate-400 text-sm text-center leading-relaxed">
          Загрузите IFC-модель<br />в разделе <span className="text-slate-600 font-medium">«Здание»</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="w-7 h-7 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
        <div className="text-slate-400 text-sm">Анализ инженерных систем...</div>
      </div>
    )
  }

  if (systems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl opacity-10">🔍</div>
        <div className="text-slate-400 text-sm text-center leading-relaxed">
          В модели не найдено явно<br />заданных инженерных систем
        </div>
      </div>
    )
  }

  // ── list ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
        <div className="text-xs text-slate-400">
          Инженерных систем: <span className="font-semibold text-slate-600">{systems.length}</span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2">
        {systems.map(sys => {
          const color = TYPE_COLOR[sys.predefinedLabel] || TYPE_COLOR[sys.ifcTypeLabel] || '#94a3b8'
          const label = sys.predefinedLabel || sys.ifcTypeLabel
          return (
            <button
              key={sys.id}
              onClick={() => setSelected(sys)}
              className="w-full text-left rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all p-4 flex items-center gap-4 group"
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{sys.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color }}>{label}</div>
              </div>

              <div className="text-right shrink-0 mr-1">
                <div className="text-xl font-bold text-slate-700 leading-none">{sys.elementIDs.length}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">элем.</div>
              </div>

              <span className="text-slate-200 group-hover:text-blue-400 transition-colors text-base shrink-0">›</span>
            </button>
          )
        })}
      </div>

      {selected && <SystemModal system={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
