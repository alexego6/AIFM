// Ролевая модель — КЛИЕНТСКИЕ ПРЕДСТАВЛЕНИЯ, не безопасность.
// Единая карта доступа: какие разделы видны и какие действия разрешены.
// Guard'ы применяются в компонентах И в сторах (setStatus/reassign).

export const ROLES = {
  executor: { label: 'Техник',           short: 'Исполнитель' },
  chief:    { label: 'Главный инженер',  short: 'Гл. инженер' },
  customer: { label: 'Заказчик',         short: 'Заказчик' },
  director: { label: 'Руководитель УК',  short: 'Руководитель' },
}

export const DEFAULT_ROLE = 'chief'

// Разделы меню (ключи activeSection из App/Sidebar)
export const ROLE_ACCESS = {
  executor: {
    sections: ['my-day', 'tickets'],
    defaultSection: 'my-day',
    actions: {
      changeOwnTicketStatus: true,
      changeAnyTicketStatus: false,
      reassignTickets:       false,
      manageStaff:           false,
      viewStaffFot:          false,
      runInitialInspection:  false,
      recordWear:            true,   // только в своих ЭК-тикетах (guard по assigneeId)
      createEmergency:       true,
      viewWearSection:       false,
      viewSlaFull:           false,
      viewTzAnalyzer:        false,
      switchObjects:         false,  // объект зафиксирован по персоне
    },
  },
  chief: {
    sections: ['building', 'bim', 'schedule-ek', 'schedule-to', 'sla', 'wear', 'tickets', 'tz-analysis', 'dashboard'],
    defaultSection: 'dashboard',
    actions: {
      changeOwnTicketStatus: true,
      changeAnyTicketStatus: true,
      reassignTickets:       true,
      manageStaff:           true,
      viewStaffFot:          true,
      runInitialInspection:  true,
      recordWear:            true,
      createEmergency:       true,
      viewWearSection:       true,
      viewSlaFull:           true,
      viewTzAnalyzer:        true,
      switchObjects:         true,
    },
  },
  customer: {
    sections: ['schedule-view', 'my-requests'],
    defaultSection: 'schedule-view',
    actions: {
      changeOwnTicketStatus: false,
      changeAnyTicketStatus: false,
      reassignTickets:       false,
      manageStaff:           false,
      viewStaffFot:          false,
      runInitialInspection:  false,
      recordWear:            false,
      createEmergency:       true,   // подача заявки + трекинг своих
      viewWearSection:       false,
      viewSlaFull:           false,
      viewTzAnalyzer:        false,
      switchObjects:         true,
    },
  },
  director: {
    sections: ['building', 'bim', 'schedule-ek', 'schedule-to', 'sla', 'wear', 'tickets', 'tz-analysis', 'dashboard'],
    defaultSection: 'dashboard',
    actions: {
      changeOwnTicketStatus: true,
      changeAnyTicketStatus: true,
      reassignTickets:       true,
      manageStaff:           true,
      viewStaffFot:          true,   // + блок бюджетов в Дашборде
      runInitialInspection:  true,
      recordWear:            true,
      createEmergency:       true,
      viewWearSection:       true,
      viewSlaFull:           true,
      viewTzAnalyzer:        true,
      switchObjects:         true,   // + сводный режим
    },
  },
}

export function accessFor(role) {
  return ROLE_ACCESS[role] ?? ROLE_ACCESS[DEFAULT_ROLE]
}

export function can(actor, action) {
  return !!accessFor(actor?.role).actions[action]
}

// Guard статуса тикета: техник — только свои. Используется В СТОРЕ.
export function canChangeTicket(actor, ticket) {
  const acc = accessFor(actor?.role)
  if (acc.actions.changeAnyTicketStatus) return true
  if (acc.actions.changeOwnTicketStatus) return ticket.assigneeId === actor?.personId
  return false
}

export function canReassign(actor) {
  return !!accessFor(actor?.role).actions.reassignTickets
}
