import { useState } from 'react'
import { EQUIPMENT, SYSTEMS, STATUSES, FLOORS } from '../../data/building'
import { useAppStore } from '../../store/useAppStore'

function StatusBadge({ status }) {
  const s = STATUSES[status]
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: s.color }}
      title={s.label}
    />
  )
}

function SystemBadge({ system }) {
  const s = SYSTEMS[system]
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
      style={{ color: s.color, backgroundColor: `${s.color}15`, border: `1px solid ${s.color}25` }}
    >
      {system}
    </span>
  )
}

export default function EquipmentPanel() {
  const { selectedRoomId, systemFilter, setSystemFilter, activeFloor } = useAppStore()
  const [expandedId, setExpandedId] = useState(null)

  const getRoomName = (roomId) => {
    for (const floor of FLOORS) {
      const room = floor.rooms.find((r) => r.id === roomId)
      if (room) return room.name
    }
    return roomId
  }

  let filtered = EQUIPMENT.filter((e) => e.floor === activeFloor)
  if (selectedRoomId) filtered = filtered.filter((e) => e.roomId === selectedRoomId)
  if (systemFilter) filtered = filtered.filter((e) => e.system === systemFilter)

  const selectedRoom = selectedRoomId ? getRoomName(selectedRoomId) : null

  const total    = filtered.length
  const critical = filtered.filter((e) => e.status === 'critical').length
  const attention = filtered.filter((e) => e.status === 'attention').length

  return (
    <aside className="flex flex-col w-[300px] min-w-[300px] h-screen bg-white border-l border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="text-sm font-semibold text-slate-700 mb-3">
          {selectedRoom ? `Помещение: ${selectedRoom}` : 'Оборудование'}
        </div>

        {/* System filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSystemFilter(null)}
            className={`px-2.5 py-1 rounded text-xs transition-all
              ${!systemFilter
                ? 'bg-blue-50 text-blue-700 border border-blue-200 font-medium'
                : 'text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
          >
            Все
          </button>
          {Object.entries(SYSTEMS).map(([key, s]) => (
            <button
              key={key}
              onClick={() => setSystemFilter(systemFilter === key ? null : key)}
              className="px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all border"
              style={systemFilter === key
                ? { color: s.color, backgroundColor: `${s.color}15`, borderColor: `${s.color}40` }
                : { color: '#94a3b8', borderColor: '#e2e8f0' }
              }
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 px-4 py-3 border-b border-slate-200">
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-slate-700">{total}</div>
          <div className="text-[10px] text-slate-400">всего</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-lg font-bold" style={{ color: STATUSES.critical.color }}>{critical}</div>
          <div className="text-[10px] text-slate-400">авария</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-lg font-bold" style={{ color: STATUSES.attention.color }}>{attention}</div>
          <div className="text-[10px] text-slate-400">внимание</div>
        </div>
      </div>

      {/* Equipment list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            Нет оборудования
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-3">
            {filtered.map((eq) => {
              const isExpanded = expandedId === eq.id
              return (
                <div
                  key={eq.id}
                  className="rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : eq.id)}
                >
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <StatusBadge status={eq.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">{eq.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{getRoomName(eq.roomId)}</div>
                    </div>
                    <SystemBadge system={eq.system} />
                    <span className={`text-slate-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-1.5">
                      <Row label="Модель" value={eq.model} />
                      <Row label="Год" value={eq.year} />
                      <Row label="ID" value={eq.id} mono />
                      <Row label="Статус" value={STATUSES[eq.status].label} statusColor={STATUSES[eq.status].color} />
                      <Row label="Система" value={SYSTEMS[eq.system].fullLabel} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

function Row({ label, value, mono, statusColor }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-[10px] text-slate-400 flex-shrink-0">{label}</span>
      <span
        className={`text-[10px] text-right ${mono ? 'font-mono text-slate-400' : 'text-slate-600'}`}
        style={statusColor ? { color: statusColor } : {}}
      >
        {value}
      </span>
    </div>
  )
}
