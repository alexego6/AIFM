import { create } from 'zustand'
import { upsertBuildings, upsertSystemsData } from '../services/platformAdapter'

// ── IndexedDB (namespace: aifm_platform) ─────────────────────────────────────
const idb = (() => {
  let _db = null
  const NAME = 'aifm_platform', STORE = 'data', VER = 1

  async function open() {
    if (_db) return _db
    return new Promise((res, rej) => {
      const req = indexedDB.open(NAME, VER)
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE)
      req.onsuccess  = e => { _db = e.target.result; res(_db) }
      req.onerror    = e => rej(e.target.error)
    })
  }

  return {
    async get(key) {
      const db = await open()
      return new Promise((res, rej) => {
        const r = db.transaction(STORE).objectStore(STORE).get(key)
        r.onsuccess = e => res(e.target.result ?? null)
        r.onerror   = e => rej(e.target.error)
      })
    },
    async set(key, val) {
      const db = await open()
      return new Promise((res, rej) => {
        const r = db.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key)
        r.onsuccess = () => res()
        r.onerror   = e => rej(e.target.error)
      })
    },
    async clear() {
      const db = await open()
      return new Promise((res, rej) => {
        const r = db.transaction(STORE, 'readwrite').objectStore(STORE).clear()
        r.onsuccess = () => res()
        r.onerror   = e => rej(e.target.error)
      })
    },
  }
})()

// ── Store ─────────────────────────────────────────────────────────────────────
export const usePlatformStore = create((set, get) => ({
  buildings:         [],
  systemsData:       [],   // {buildingId, systems[]}[]
  staffingPlan:      [],
  resourcesPlan:     [],
  activeBuildingId:  null,
  applied:           false,
  appliedAt:         null,

  setActiveBuildingId: async (id) => {
    set({ activeBuildingId: id })
    await idb.set('active_building_id', id)
  },

  // Called from TZAnalyzer Stage 6 after validation.
  // buildings/systemsData are already mapped through platformAdapter before calling.
  applyFromTZ: async ({ buildings, systemsData, staffingPlan, resourcesPlan }) => {
    const cur = get()
    const merged = {
      buildings:    upsertBuildings(cur.buildings, buildings),
      systemsData:  upsertSystemsData(cur.systemsData, systemsData),
      staffingPlan:  staffingPlan  ?? [],
      resourcesPlan: resourcesPlan ?? [],
      applied:   true,
      appliedAt: new Date().toISOString(),
      activeBuildingId: cur.activeBuildingId ?? buildings[0]?.id ?? null,
    }
    set(merged)
    await Promise.all([
      idb.set('buildings',          merged.buildings),
      idb.set('systems_data',       merged.systemsData),
      idb.set('staffing_plan',      merged.staffingPlan),
      idb.set('resources_plan',     merged.resourcesPlan),
      idb.set('applied',            true),
      idb.set('applied_at',         merged.appliedAt),
      idb.set('active_building_id', merged.activeBuildingId),
    ])
  },

  loadFromDB: async () => {
    const [buildings, systemsData, staffingPlan, resourcesPlan,
           applied, appliedAt, activeBuildingId] = await Promise.all([
      idb.get('buildings'),
      idb.get('systems_data'),
      idb.get('staffing_plan'),
      idb.get('resources_plan'),
      idb.get('applied'),
      idb.get('applied_at'),
      idb.get('active_building_id'),
    ])
    const patch = {}
    if (buildings?.length)    patch.buildings         = buildings
    if (systemsData?.length)  patch.systemsData       = systemsData
    if (staffingPlan?.length) patch.staffingPlan      = staffingPlan
    if (resourcesPlan?.length)patch.resourcesPlan     = resourcesPlan
    if (applied)              patch.applied           = true
    if (appliedAt)            patch.appliedAt         = appliedAt
    if (activeBuildingId)     patch.activeBuildingId  = activeBuildingId
    if (Object.keys(patch).length) set(patch)
  },

  reset: async () => {
    set({
      buildings: [], systemsData: [], staffingPlan: [], resourcesPlan: [],
      activeBuildingId: null, applied: false, appliedAt: null,
    })
    await idb.clear()
  },
}))
