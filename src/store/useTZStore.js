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
export const useTZStore = create((set) => ({
  // Загруженный документ
  fileName: null,
  fileSize: null,
  parseWarnings: [],   // ['3 страницы без текстового слоя', ...]

  // Чанки исходного текста
  chunks: [],          // string[]

  // Прогресс пайплайна
  stage: 0,            // 0-6, текущий выполненный этап
  stageStatus: 'idle', // 'idle' | 'running' | 'done' | 'error' | 'checkpoint' | 'no_schedule'
  stageError: null,

  // Результаты этапов
  buildings: [],       // Building[] — Этап 1
  systems: [],         // { buildingId, systems: System[] }[] — Этап 2+3

  // Этап 3: статус графика ЭК/ТО
  // Хранится в IDB чтобы loadFromDB мог восстановить stage=3 после reload
  scheduleStatus: 'unknown',  // 'unknown' | 'found' | 'not_found' | 'merged'
  scheduleTableCount: 0,

  // Распарсенные таблицы графика — хранятся в IDB (не нужен HTML при перезагрузке)
  scheduleTables: null,  // result of parseScheduleTables, persisted

  // HTML документа — только в памяти (не нужен после парсинга таблиц)
  htmlContent: null,

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

  setSystems: async (systems) => {
    set({ systems })
    await idb.set('systems', systems)
  },

  setHtmlContent: async (html) => {
    set({ htmlContent: html })
    if (html) await idb.set('html', html)
  },

  setScheduleStatus: async (status, tableCount = 0) => {
    set({ scheduleStatus: status, scheduleTableCount: tableCount })
    await idb.set('schedule_status', { status, tableCount })
  },

  setScheduleTables: async (tables) => {
    set({ scheduleTables: tables })
    await idb.set('schedule_tables', tables)
  },

  reset: async () => {
    set({
      fileName: null, fileSize: null, parseWarnings: [],
      chunks: [], stage: 0, stageStatus: 'idle', stageError: null,
      buildings: [], systems: [],
      scheduleStatus: 'unknown', scheduleTableCount: 0,
      scheduleTables: null, htmlContent: null,
    })
    await idb.clear()
  },

  // Пендинг-файл из глобального дропа
  tzPendingFile: null,
  setTzPendingFile: (file) => set({ tzPendingFile: file }),
  clearTzPendingFile: () => set({ tzPendingFile: null }),

  // Восстановить прогресс при монтировании
  loadFromDB: async () => {
    const [chunks, buildings, systems, meta, schedData, schedTables, html] = await Promise.all([
      idb.get('chunks'),
      idb.get('buildings'),
      idb.get('systems'),
      idb.get('meta'),
      idb.get('schedule_status'),
      idb.get('schedule_tables'),
      idb.get('html'),
    ])
    const patch = {}
    if (meta)              { patch.fileName = meta.fileName; patch.fileSize = meta.fileSize }
    if (html)              { patch.htmlContent = html }
    if (chunks?.length)    { patch.chunks    = chunks;    patch.stage = 0; patch.stageStatus = 'done' }
    if (buildings?.length) { patch.buildings = buildings; patch.stage = 1; patch.stageStatus = 'done' }

    // Restore schedule detection result (available from Stage 0 onward)
    if (schedData) {
      patch.scheduleStatus = schedData.status
      patch.scheduleTableCount = schedData.tableCount ?? 0
    }
    if (schedTables?.length) {
      patch.scheduleTables = schedTables
    }

    if (systems?.length) {
      patch.systems = systems
      if (schedData?.status === 'merged') {
        patch.stage = 3
        patch.stageStatus = 'done'
      } else {
        patch.stage = 2
        patch.stageStatus = 'checkpoint'
      }
    }
    if (Object.keys(patch).length) set(patch)
  },
}))
