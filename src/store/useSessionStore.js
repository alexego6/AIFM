// Сессия: роль + персона (для техника) + стабильный clientId (трекинг
// аварийных заявок заказчика). Персист в localStorage. НЕ безопасность —
// клиентские представления.

import { create } from 'zustand'
import { DEFAULT_ROLE, ROLE_ACCESS } from '../config/roleAccess'

const LS_KEY = 'aifm_session'

function loadSession() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if (s.role && ROLE_ACCESS[s.role]) return s
    }
  } catch { /* повреждённый localStorage — дефолт */ }
  return null
}

function newClientId() {
  return `c_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

const initial = loadSession() ?? { role: DEFAULT_ROLE, personId: null, clientId: newClientId() }
if (!initial.clientId) initial.clientId = newClientId()

function save(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      role: state.role, personId: state.personId, clientId: state.clientId,
    }))
  } catch { /* quota — не критично */ }
}

export const useSessionStore = create((set, get) => ({
  role:     initial.role,
  personId: initial.personId,   // для executor — персона из aifm_staff
  clientId: initial.clientId,   // стабильный id браузер-сессии (createdBy аварийки)

  // Смена роли не трогает данные — только представление
  setRole: (role, personId = null) => {
    if (!ROLE_ACCESS[role]) return
    set({ role, personId: role === 'executor' ? personId : null })
    save(get())
  },

  actor: () => ({ role: get().role, personId: get().personId }),
}))
