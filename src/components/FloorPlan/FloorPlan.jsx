import { useEffect, useRef, useState } from 'react'
import Konva from 'konva'
import { FLOORS, EQUIPMENT, STATUSES } from '../../data/building'
import { useAppStore } from '../../store/useAppStore'

const ROOM_FILL          = '#f1f5f9'
const ROOM_FILL_HOVER    = '#e2e8f0'
const ROOM_FILL_SELECTED = '#eff6ff'
const ROOM_STROKE        = '#cbd5e1'
const ROOM_STROKE_SELECTED = '#2563eb'

function getStatusColor(roomId, equipment) {
  const roomEq = equipment.filter((e) => e.roomId === roomId)
  if (roomEq.some((e) => e.status === 'critical'))  return STATUSES.critical.color
  if (roomEq.some((e) => e.status === 'attention')) return STATUSES.attention.color
  if (roomEq.length > 0) return STATUSES.normal.color
  return null
}

export default function FloorPlan() {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const { activeFloor, setActiveFloor, selectedRoomId, setSelectedRoomId } = useAppStore()
  const [, setTooltip] = useState(null)

  const floor = FLOORS.find((f) => f.id === activeFloor)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width  = container.offsetWidth
    const height = container.offsetHeight

    const scaleX = (width  - 40) / 800
    const scaleY = (height - 80) / 500

    const stage = new Konva.Stage({ container, width, height })
    stageRef.current = stage

    const layer = new Konva.Layer()
    stage.add(layer)

    floor.rooms.forEach((room) => {
      const rx = room.x * scaleX + 20
      const ry = room.y * scaleY + 20
      const rw = room.w * scaleX
      const rh = room.h * scaleY

      const isSelected  = selectedRoomId === room.id
      const statusColor = getStatusColor(room.id, EQUIPMENT)

      const rect = new Konva.Rect({
        x: rx, y: ry, width: rw, height: rh,
        fill:        isSelected ? ROOM_FILL_SELECTED : ROOM_FILL,
        stroke:      isSelected ? ROOM_STROKE_SELECTED : ROOM_STROKE,
        strokeWidth: isSelected ? 1.5 : 1,
        cornerRadius: 4,
        shadowColor:   isSelected ? '#2563eb' : 'transparent',
        shadowBlur:    isSelected ? 6 : 0,
        shadowOpacity: 0.15,
      })

      let dot = null
      if (statusColor) {
        dot = new Konva.Circle({
          x: rx + rw - 8, y: ry + 8,
          radius: 4,
          fill: statusColor,
        })
      }

      const label = new Konva.Text({
        x: rx + 6, y: ry + 6,
        width: rw - 12,
        text: room.name,
        fontSize: Math.max(9, Math.min(11, rw / 10)),
        fill: isSelected ? '#2563eb' : '#64748b',
        wrap: 'word',
        ellipsis: true,
      })

      const eqCount = EQUIPMENT.filter((e) => e.roomId === room.id).length
      let countLabel = null
      if (eqCount > 0) {
        countLabel = new Konva.Text({
          x: rx + 6, y: ry + rh - 18,
          text: `${eqCount} ед.`,
          fontSize: 9,
          fill: '#94a3b8',
        })
      }

      const group = new Konva.Group()
      group.add(rect)
      if (dot) group.add(dot)
      group.add(label)
      if (countLabel) group.add(countLabel)
      layer.add(group)

      group.on('mouseenter', () => {
        if (!isSelected) rect.fill(ROOM_FILL_HOVER)
        rect.strokeWidth(1.5)
        label.fill('#334155')
        layer.batchDraw()
        setTooltip({ name: room.name, x: rx + rw / 2, y: ry - 10 })
        stage.container().style.cursor = 'pointer'
      })
      group.on('mouseleave', () => {
        if (!isSelected) {
          rect.fill(ROOM_FILL)
          rect.strokeWidth(1)
          label.fill('#64748b')
        }
        layer.batchDraw()
        setTooltip(null)
        stage.container().style.cursor = 'default'
      })
      group.on('click', () => {
        setSelectedRoomId(selectedRoomId === room.id ? null : room.id)
      })
    })

    layer.draw()

    const handleResize = () => {
      if (!containerRef.current || !stageRef.current) return
      stage.width(containerRef.current.offsetWidth)
      stage.height(containerRef.current.offsetHeight)
      layer.draw()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      stage.destroy()
    }
  }, [activeFloor, selectedRoomId])

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Floor selector */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
        <span className="text-slate-400 text-xs mr-2">Этаж:</span>
        {FLOORS.map((f) => (
          <button
            key={f.id}
            onClick={() => { setActiveFloor(f.id); setSelectedRoomId(null) }}
            className={`px-3 py-1 rounded text-xs transition-all duration-150
              ${activeFloor === f.id
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-medium'
                : 'text-slate-500 hover:text-slate-700 border border-transparent hover:border-slate-200'
              }`}
          >
            {f.label}
          </button>
        ))}
        {selectedRoomId && (
          <button
            onClick={() => setSelectedRoomId(null)}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Сбросить выбор ✕
          </button>
        )}
      </div>

      {/* Konva canvas */}
      <div ref={containerRef} className="flex-1 relative bg-[#f8fafc]" />

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200 bg-white">
        <span className="text-slate-400 text-xs">Статус:</span>
        {Object.entries(STATUSES).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-slate-500 text-xs">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
