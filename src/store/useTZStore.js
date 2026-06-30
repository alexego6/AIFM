import { create } from 'zustand'

// ── IndexedDB для персистентности прогресса ───────────────────────────────────
const idb = (() => {
  let _db = null
  const NAME = 'aifm_tz', STORE = 'data', VER = 1

  async function open() {
    if (_db) return _db
    return new Promise((res, rej) => {
      const req = indexedDB.open(NAME, VER)
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE)
      req.onsuccess = e => { _db = e.target.result; res(_db) }
      req.onerror = e => rej(e.target.error)
    })
  }
  return {
    async get(key) {
      const db = await open()
      return new Promise((res, rej) => {
        const r = db.transaction(STORE).objectStore(STORE).get(key)
        r.onsuccess = e => res(e.target.result ?? null)
        r.onerror = e => rej(e.target.error)
      })
    },
    async set(key, val) {
      const db = await open()
      return new Promise((res, rej) => {
        const r = db.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key)
        r.onsuccess = () => res()
        r.onerror = e => rej(e.target.error)
      })
    },
    async clear() {
      const db = await open()
      return new Promise((res, rej) => {
        const r = db.transaction(STORE, 'readwrite').objectStore(STORE).clear()
        r.onsuccess = () => res()
        r.onerror = e => rej(e.target.error)
      })
    },
  }
})()

// ── Zustand стор ─────────────────────────────────────────────────────────────
export const useTZStore = create((set, get) => ({
  // Загруженный документ
  fileName: null,
  fileSize: null,
  parseWarnings: [],   // ['3 страницы без текстового слоя', ...]

  // Чанки исходного текста
  chunks: [],          // string[]

  // Прогресс пайплайна
  stage: 0,            // 0-6, текущий выполненный этап
  stageStatus: 'idle', // 'idle' | 'running' | 'done' | 'error' | 'checkpoint'
  stageError: null,

  // Результаты этапов
  buildings: [],       // Building[] — Этап 1
  // buildings[i].systems  — Этап 2
  // buildings[i].tasks    — Этап 3
  // buildings[i].resource — Этап 5

  // ── действия ─────────────────────────────────────────────────────────────
  setFile: async (name, size) => {
    set({ fileName: name, fileSize: size })
    await idb.set('meta', { fileName: name, fileSize: size })
  },

  setChunks: async (chunks) => {
    set({ chunks })
    await idb.set('chunks', chunks)
  },

  setParseWarnings: (w) => set({ parseWarnings: w }),

  setStage: (stage, status = 'done', error = null) =>
    set({ stage, stageStatus: status, stageError: error }),

  setBuildings: async (buildings) => {
    set({ buildings })
    await idb.set('buildings', buildings)
  },

  updateBuilding: (id, patch) => set(s => ({
    buildings: s.buildings.map(b => b.id === id ? { ...b, ...patch } : b),
  })),

  reset: async () => {
    set({
      fileName: null, fileSize: null, parseWarnings: [],
      chunks: [], stage: 0, stageStatus: 'idle', stageError: null,
      buildings: [],
    })
    await idb.clear()
  },

  // Пендинг-файл из глобального дропа
  tzPendingFile: null,
  setTzPendingFile: (file) => set({ tzPendingFile: file }),
  clearTzPendingFile: () => set({ tzPendingFile: null }),

  // Восстановить прогресс при монтировании
  loadFromDB: async () => {
    const [chunks, buildings, meta] = await Promise.all([
      idb.get('chunks'),
      idb.get('buildings'),
      idb.get('meta'),
    ])
    const patch = {}
    if (meta)              { patch.fileName = meta.fileName; patch.fileSize = meta.fileSize }
    if (chunks?.length)    { patch.chunks    = chunks;    patch.stage = 0; patch.stageStatus = 'done' }
    if (buildings?.length) { patch.buildings = buildings; patch.stage = 1; patch.stageStatus = 'checkpoint' }
    if (Object.keys(patch).length) set(patch)
  },
}))
