import { create } from 'zustand'

function mergeRooms(existing, incoming) {
  const map = new Map(existing.map(r => [r.number, r]))
  for (const r of incoming) map.set(r.number, { ...(map.get(r.number) || {}), ...r })
  return [...map.values()].sort((a, b) =>
    a.number.localeCompare(b.number, undefined, { numeric: true })
  )
}

export const useAppStore = create((set) => ({
  // Navigation
  activeSection: 'building',
  setActiveSection: (section) => set({ activeSection: section }),

  // Floor plan
  activeFloor: 1,
  setActiveFloor: (floor) => set({ activeFloor: floor }),

  selectedRoomId: null,
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),

  // Equipment panel
  systemFilter: null,
  setSystemFilter: (system) => set({ systemFilter: system }),

  // BTI floor plan
  btiPlanImage: null,   // dataURL кропнутого чертежа — подложка
  btiRooms: [],         // [{ number, name, area, type }]
  btiMarkers: {},       // { [roomNumber]: { x, y } }  — 0..1 от размеров подложки
  btiRoomMasks: {},     // { [roomNumber]: { dataUrl, x, y, w, h } } — flood-fill маски помещений
  setBtiPlanImage: (img) => set({ btiPlanImage: img }),
  setBtiRooms: (rooms) => set({ btiRooms: rooms }),
  mergeBtiRooms: (incoming) => set(s => ({ btiRooms: mergeRooms(s.btiRooms, incoming) })),
  setBtiMarker: (number, pos) => set(s => ({ btiMarkers: { ...s.btiMarkers, [number]: pos } })),
  removeBtiMarker: (number) => set(s => { const m = { ...s.btiMarkers }; delete m[number]; return { btiMarkers: m } }),
  setBtiRoomMask: (number, mask) => set(s => ({ btiRoomMasks: { ...s.btiRoomMasks, [number]: mask } })),
  removeBtiRoomMask: (number) => set(s => { const m = { ...s.btiRoomMasks }; delete m[number]; return { btiRoomMasks: m } }),
  clearBti: () => set({ btiPlanImage: null, btiRooms: [], btiMarkers: {}, btiRoomMasks: {} }),

  // BIM
  bimLoaded: false,
  bimFileName: null,
  bimSelectedElement: null,
  bimPendingFile: null,          // файл, дропнутый из App-уровня
  setBimLoaded: (loaded, fileName) => set({ bimLoaded: loaded, bimFileName: fileName }),
  setBimSelectedElement: (el) => set({ bimSelectedElement: el }),
  setBimPendingFile: (file) => set({ bimPendingFile: file }),
}))
