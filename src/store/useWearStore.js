// Замеры износа. IDB namespace: aifm_wear.
// История замеров НЕ зависит от жизни узла: переприменение ТЗ может осиротить
// nodeId — замеры не удаляются, узел показывается с пометкой.

import { create } from 'zustand'
import { makeIdb } from '../services/idbStore'
import { contentHash } from '../services/dayScheduler'

const idb = makeIdb('aifm_wear')

async function persist(measurements) {
  await idb.set('measurements', measurements)
}

export const useWearStore = create((set, get) => ({
  measurements: [],   // {id, nodeId, buildingId, date, wearPct, byPersonId, ticketId?, note?, source}
  loaded: false,

  loadFromDB: async () => {
    if (get().loaded) return
    const measurements = await idb.get('measurements')
    set({ measurements: measurements ?? [], loaded: true })
  },

  /**
   * Добавить замер. source: 'initial' | 'round' | 'manual'.
   * Дата произвольная (включая прошлое — перенос бумажных журналов).
   * wearPct клампится в 0–100.
   */
  addMeasurement: async ({ nodeId, buildingId, date, wearPct, byPersonId = null, ticketId = null, note = null, source = 'manual' }) => {
    if (nodeId == null || typeof wearPct !== 'number' || !date) return null
    const clamped = Math.max(0, Math.min(100, wearPct))
    const m = {
      id: contentHash(`wear|${nodeId}|${date}|${clamped}|${ticketId ?? ''}|${Date.now().toString(36)}`),
      nodeId, buildingId, date,
      wearPct: clamped,
      byPersonId, ticketId, note, source,
      createdAt: new Date().toISOString(),
    }
    const next = [...get().measurements, m]
    set({ measurements: next })
    await persist(next)
    return m
  },

  // Пакетное сохранение из формы тикета (inspection/round): пустые поля пропускаются
  addBatch: async (entries) => {
    const valid = (entries ?? []).filter(e => e.nodeId != null && typeof e.wearPct === 'number' && e.date)
    if (valid.length === 0) return 0
    const stamp = Date.now().toString(36)
    const batch = valid.map((e, i) => ({
      id: contentHash(`wear|${e.nodeId}|${e.date}|${e.wearPct}|${e.ticketId ?? ''}|${stamp}${i}`),
      nodeId: e.nodeId,
      buildingId: e.buildingId ?? null,
      date: e.date,
      wearPct: Math.max(0, Math.min(100, e.wearPct)),
      byPersonId: e.byPersonId ?? null,
      ticketId: e.ticketId ?? null,
      note: e.note ?? null,
      source: e.source ?? 'round',
      createdAt: new Date().toISOString(),
    }))
    const next = [...get().measurements, ...batch]
    set({ measurements: next })
    await persist(next)
    return batch.length
  },

  measurementsForNode: (nodeId) =>
    get().measurements.filter(m => m.nodeId === nodeId),

  reset: async () => {
    set({ measurements: [], loaded: true })
    await idb.clear()
  },
}))
