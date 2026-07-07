// Мини-обёртка IndexedDB для сторов (общая для aifm_staff / aifm_tickets).
// Копия паттерна из usePlatformStore — тот не трогаем (рабочий контур).

export function makeIdb(dbName, storeName = 'data') {
  let _db = null

  async function open() {
    if (_db) return _db
    return new Promise((res, rej) => {
      const req = indexedDB.open(dbName, 1)
      req.onupgradeneeded = e => e.target.result.createObjectStore(storeName)
      req.onsuccess  = e => { _db = e.target.result; res(_db) }
      req.onerror    = e => rej(e.target.error)
    })
  }

  return {
    async get(key) {
      const db = await open()
      return new Promise((res, rej) => {
        const r = db.transaction(storeName).objectStore(storeName).get(key)
        r.onsuccess = e => res(e.target.result ?? null)
        r.onerror   = e => rej(e.target.error)
      })
    },
    async set(key, val) {
      const db = await open()
      return new Promise((res, rej) => {
        const r = db.transaction(storeName, 'readwrite').objectStore(storeName).put(val, key)
        r.onsuccess = () => res()
        r.onerror   = e => rej(e.target.error)
      })
    },
    async clear() {
      const db = await open()
      return new Promise((res, rej) => {
        const r = db.transaction(storeName, 'readwrite').objectStore(storeName).clear()
        r.onsuccess = () => res()
        r.onerror   = e => rej(e.target.error)
      })
    },
  }
}
