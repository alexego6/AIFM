// Mock ТО (Техническое обслуживание) maintenance schedule
// Status computed dynamically in component from nextDate vs today

const FREQ_LABELS = {
  monthly:     'Ежемесячно',
  quarterly:   'Ежеквартально',
  semiannual:  'Раз в полгода',
  annual:      'Ежегодно',
}

export { FREQ_LABELS }

export const TO_SCHEDULE = [
  // ОВ
  { equipmentId: 'eq01', equipmentName: 'Вентустановка ВУ-1',       system: 'ОВ', frequency: 'quarterly',  lastDate: '2026-04-10', nextDate: '2026-07-10', responsible: 'Петров А.И.' },
  { equipmentId: 'eq02', equipmentName: 'Вентустановка ВУ-2',       system: 'ОВ', frequency: 'quarterly',  lastDate: '2026-03-15', nextDate: '2026-06-15', responsible: 'Петров А.И.' },
  { equipmentId: 'eq03', equipmentName: 'Фанкойл ФК-01',             system: 'ОВ', frequency: 'monthly',    lastDate: '2026-06-05', nextDate: '2026-07-05', responsible: 'Иванова М.С.' },
  { equipmentId: 'eq04', equipmentName: 'Фанкойл ФК-02',             system: 'ОВ', frequency: 'monthly',    lastDate: '2026-06-05', nextDate: '2026-07-05', responsible: 'Иванова М.С.' },
  { equipmentId: 'eq05', equipmentName: 'Фанкойл ФК-03',             system: 'ОВ', frequency: 'monthly',    lastDate: '2026-05-10', nextDate: '2026-06-10', responsible: 'Иванова М.С.' },
  { equipmentId: 'eq06', equipmentName: 'Клапан воздушный КВ-1',    system: 'ОВ', frequency: 'semiannual', lastDate: '2026-01-20', nextDate: '2026-07-20', responsible: 'Сидоров К.В.' },
  { equipmentId: 'eq07', equipmentName: 'Тепловой узел ТУ-1',       system: 'ОВ', frequency: 'quarterly',  lastDate: '2026-06-02', nextDate: '2026-09-02', responsible: 'Петров А.И.' },

  // ВК
  { equipmentId: 'eq08', equipmentName: 'Насос ХВС-1',              system: 'ВК', frequency: 'semiannual', lastDate: '2026-01-15', nextDate: '2026-07-15', responsible: 'Сидоров К.В.' },
  { equipmentId: 'eq09', equipmentName: 'Насос ХВС-2 (резерв)',     system: 'ВК', frequency: 'semiannual', lastDate: '2026-01-15', nextDate: '2026-07-15', responsible: 'Сидоров К.В.' },
  { equipmentId: 'eq10', equipmentName: 'Насос ГВС-1',              system: 'ВК', frequency: 'quarterly',  lastDate: '2026-03-20', nextDate: '2026-06-20', responsible: 'Сидоров К.В.' },
  { equipmentId: 'eq11', equipmentName: 'Бойлер БКН-500',           system: 'ВК', frequency: 'annual',     lastDate: '2025-09-10', nextDate: '2026-09-10', responsible: 'Кузнецов Д.Р.' },
  { equipmentId: 'eq12', equipmentName: 'Насосная станция НС-1',    system: 'ВК', frequency: 'quarterly',  lastDate: '2026-05-19', nextDate: '2026-08-19', responsible: 'Кузнецов Д.Р.' },
  { equipmentId: 'eq13', equipmentName: 'Счётчик воды СВ-1',        system: 'ВК', frequency: 'annual',     lastDate: '2025-11-01', nextDate: '2026-11-01', responsible: 'Кузнецов Д.Р.' },

  // ЭО
  { equipmentId: 'eq14', equipmentName: 'Щит ЩО-1 (1 эт.)',        system: 'ЭО', frequency: 'annual',     lastDate: '2026-02-10', nextDate: '2027-02-10', responsible: 'Петров А.И.' },
  { equipmentId: 'eq15', equipmentName: 'Щит ЩО-2 (2 эт.)',        system: 'ЭО', frequency: 'annual',     lastDate: '2025-12-15', nextDate: '2026-12-15', responsible: 'Петров А.И.' },
  { equipmentId: 'eq16', equipmentName: 'Щит ЩО-3 (3 эт.)',        system: 'ЭО', frequency: 'annual',     lastDate: '2026-02-10', nextDate: '2027-02-10', responsible: 'Петров А.И.' },
  { equipmentId: 'eq17', equipmentName: 'ВРУ-0,4кВ',               system: 'ЭО', frequency: 'annual',     lastDate: '2026-01-20', nextDate: '2027-01-20', responsible: 'Петров А.И.' },
  { equipmentId: 'eq18', equipmentName: 'ИБП серверной',            system: 'ЭО', frequency: 'quarterly',  lastDate: '2026-03-01', nextDate: '2026-06-01', responsible: 'Кузнецов Д.Р.' },
  { equipmentId: 'eq19', equipmentName: 'Дизель-генератор ДГ-1',   system: 'ЭО', frequency: 'quarterly',  lastDate: '2026-05-14', nextDate: '2026-08-14', responsible: 'Кузнецов Д.Р.' },

  // СС
  { equipmentId: 'eq20', equipmentName: 'Камера КВН-01',            system: 'СС', frequency: 'annual',     lastDate: '2026-01-10', nextDate: '2027-01-10', responsible: 'Иванова М.С.' },
  { equipmentId: 'eq21', equipmentName: 'Камера КВН-02',            system: 'СС', frequency: 'annual',     lastDate: '2026-01-10', nextDate: '2027-01-10', responsible: 'Иванова М.С.' },
  { equipmentId: 'eq22', equipmentName: 'Камера КВН-03',            system: 'СС', frequency: 'annual',     lastDate: '2026-02-20', nextDate: '2027-02-20', responsible: 'Иванова М.С.' },
  { equipmentId: 'eq23', equipmentName: 'Камера КВН-04',            system: 'СС', frequency: 'annual',     lastDate: '2026-01-10', nextDate: '2027-01-10', responsible: 'Иванова М.С.' },
  { equipmentId: 'eq24', equipmentName: 'Камера КВН-05',            system: 'СС', frequency: 'annual',     lastDate: '2026-01-10', nextDate: '2027-01-10', responsible: 'Иванова М.С.' },
  { equipmentId: 'eq25', equipmentName: 'Видеорегистратор NVR-1',   system: 'СС', frequency: 'semiannual', lastDate: '2026-02-01', nextDate: '2026-08-01', responsible: 'Иванова М.С.' },
  { equipmentId: 'eq26', equipmentName: 'Контроллер СКУД-1',        system: 'СС', frequency: 'semiannual', lastDate: '2026-01-25', nextDate: '2026-07-25', responsible: 'Сидоров К.В.' },
  { equipmentId: 'eq27', equipmentName: 'ОПС панель ПКП-1',         system: 'СС', frequency: 'annual',     lastDate: '2025-10-15', nextDate: '2026-10-15', responsible: 'Сидоров К.В.' },
  { equipmentId: 'eq28', equipmentName: 'Коммутатор SW-Core',       system: 'СС', frequency: 'quarterly',  lastDate: '2026-02-15', nextDate: '2026-05-15', responsible: 'Кузнецов Д.Р.' },
]
