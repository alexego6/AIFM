export const SYSTEMS = {
  ОВ: { label: 'ОВ', fullLabel: 'Отопление и вентиляция', color: '#f97316' },
  ВК: { label: 'ВК', fullLabel: 'Водоснабжение и канализация', color: '#3b82f6' },
  ЭО: { label: 'ЭО', fullLabel: 'Электроосвещение', color: '#eab308' },
  СС: { label: 'СС', fullLabel: 'Слаботочные системы', color: '#a855f7' },
}

export const STATUSES = {
  normal:    { label: 'Норма',             color: '#22c55e' },
  attention: { label: 'Требует внимания',  color: '#eab308' },
  critical:  { label: 'Авария / Просрочка', color: '#ef4444' },
}

// ─── ring layout constants (viewBox 0 0 960 960) ─────────────────────────────
const LEFT_Y = [0, 180, 330, 480, 630, 780]
const LEFT_H = [180, 150, 150, 150, 150, 180]
const TOP_X  = [175, 375, 585]
const TOP_W  = [200, 210, 200]

function leftRooms(ids, names, types = []) {
  return ids.map((id, i) => ({ id, name: names[i], x: 0,   y: LEFT_Y[i], w: 175,    h: LEFT_H[i], type: types[i] || 'office' }))
}
function rightRooms(ids, names, types = []) {
  return ids.map((id, i) => ({ id, name: names[i], x: 785, y: LEFT_Y[i], w: 175,    h: LEFT_H[i], type: types[i] || 'office' }))
}
function topRooms(ids, names, types = []) {
  return ids.map((id, i) => ({ id, name: names[i], x: TOP_X[i], y: 0,   w: TOP_W[i], h: 180,      type: types[i] || 'office' }))
}
function bottomRooms(ids, names, types = []) {
  return ids.map((id, i) => ({ id, name: names[i], x: TOP_X[i], y: 780, w: TOP_W[i], h: 180,      type: types[i] || 'office' }))
}
function coreRooms(floor, recName, wcmName, wcfName, coffName) {
  return [
    { id: `core-${floor}`,     name: '',          x: 240, y: 240, w: 480, h: 480, type: 'core'    },
    { id: `${floor}-rec`,      name: recName,     x: 240, y: 240, w: 190, h: 80,  type: 'service' },
    { id: `${floor}-wcm`,      name: wcmName,     x: 530, y: 240, w: 190, h: 120, type: 'wc'      },
    { id: `${floor}-liftl`,    name: 'Лифты',     x: 240, y: 320, w: 190, h: 320, type: 'stair'   },
    { id: `${floor}-stairs`,   name: 'Лестница',  x: 430, y: 240, w: 100, h: 480, type: 'stair'   },
    { id: `${floor}-liftr`,    name: 'Лифты',     x: 530, y: 360, w: 190, h: 280, type: 'stair'   },
    { id: `${floor}-wcf`,      name: wcfName,     x: 240, y: 640, w: 190, h: 80,  type: 'wc'      },
    { id: `${floor}-coff`,     name: coffName,    x: 530, y: 640, w: 190, h: 80,  type: 'service' },
  ]
}

export const FLOORS = [
  // ── ЭТАЖ 1 ──────────────────────────────────────────────────────────────────
  {
    id: 1, label: '1 этаж',
    rooms: [
      ...coreRooms(1, 'Ресепшн', 'Муж. туалет', 'Жен. туалет', 'Гардероб'),
      ...leftRooms(
        ['116', '115', '114', '113', '102', '111'],
        ['Вестибюль', 'Офис 115', 'Офис 114', 'Офис 113', 'Охрана / КПП', 'Офис 111'],
        ['lobby', 'office', 'office', 'office', 'security', 'office'],
      ),
      ...topRooms(
        ['117', '1-meet', '118'],
        ['Офис 117', 'Переговорная 1', 'Серверная'],
        ['office', 'meeting', 'server'],
      ),
      ...rightRooms(
        ['119', '120', '121', '122', '123', '124'],
        ['Тех. помещение ВК', 'Офис 120', 'Офис 121', 'Офис 122', 'Офис 123', 'Офис 124'],
        ['technical', 'office', 'office', 'office', 'office', 'office'],
      ),
      ...bottomRooms(
        ['125', '126', '127'],
        ['Офис 125', 'Офис 126', 'Офис 127'],
      ),
    ],
  },
  // ── ЭТАЖ 2 ──────────────────────────────────────────────────────────────────
  {
    id: 2, label: '2 этаж',
    rooms: [
      ...coreRooms(2, 'Зона ожидания', 'Муж. туалет', 'Жен. туалет', 'Кофе-поинт'),
      ...leftRooms(
        ['216', '215', '214', '213', '201', '211'],
        ['ИТП', 'Архив', 'Офис 214', 'Офис 213', 'Офис 201', 'Офис 211'],
        ['technical', 'archive', 'office', 'office', 'office', 'office'],
      ),
      ...topRooms(
        ['217', '2-meet', '218'],
        ['Офис 217', 'Переговорная 2', 'Офис 218'],
        ['office', 'meeting', 'office'],
      ),
      ...rightRooms(
        ['219', '220', '221', '222', '223', '224'],
        ['Офис 219', 'Офис 220', 'Офис 221', 'Офис 222', 'Офис 223', 'Офис 224'],
      ),
      ...bottomRooms(
        ['225', '226', '227'],
        ['Офис 225', 'Офис 226', 'Офис 227'],
      ),
    ],
  },
  // ── ЭТАЖ 3 ──────────────────────────────────────────────────────────────────
  {
    id: 3, label: '3 этаж',
    rooms: [
      ...coreRooms(3, 'ИТ-служба', 'Муж. туалет', 'Жен. туалет', 'Принтер / Копир'),
      ...leftRooms(
        ['316', '315', '314', '313', '301', '311'],
        ['Венткамера', 'Кладовая', 'Офис 314', 'Офис 313', 'Офис 301', 'Офис 311'],
        ['technical', 'storage', 'office', 'office', 'office', 'office'],
      ),
      ...topRooms(
        ['317', '3-meet', '318'],
        ['Офис 317', 'Зал совещаний', 'Офис 318'],
        ['office', 'meeting', 'office'],
      ),
      ...rightRooms(
        ['319', '320', '321', '322', '323', '324'],
        ['Офис 319', 'Офис 320', 'Офис 321', 'Офис 322', 'Офис 323', 'Офис 324'],
      ),
      ...bottomRooms(
        ['325', '326', '327'],
        ['Офис 325', 'Офис 326', 'Офис 327'],
      ),
    ],
  },
  // ── ЭТАЖ 4 ──────────────────────────────────────────────────────────────────
  {
    id: 4, label: '4 этаж',
    rooms: [
      ...coreRooms(4, 'Зона отдыха', 'Муж. туалет', 'Жен. туалет', 'Кофе-поинт'),
      ...leftRooms(
        ['416', '415', '414', '413', '401', '411'],
        ['Офис 416', 'Офис 415', 'Офис 414', 'Офис 413', 'Офис 401', 'Офис 411'],
      ),
      ...topRooms(
        ['417', '4-meet', '418'],
        ['Офис 417', 'Переговорная 4', 'Офис 418'],
        ['office', 'meeting', 'office'],
      ),
      ...rightRooms(
        ['419', '420', '421', '422', '423', '424'],
        ['Офис 419', 'Офис 420', 'Офис 421', 'Офис 422', 'Офис 423', 'Офис 424'],
      ),
      ...bottomRooms(
        ['425', '426', '427'],
        ['Кухня / Кафе', 'Офис 426', 'Офис 427'],
        ['service', 'office', 'office'],
      ),
    ],
  },
  // ── ЭТАЖ 5 ──────────────────────────────────────────────────────────────────
  {
    id: 5, label: '5 этаж',
    rooms: [
      ...coreRooms(5, 'Секретариат', 'Муж. туалет', 'Жен. туалет', 'Кофе-поинт'),
      ...leftRooms(
        ['516', '515', '514', '513', '501', '511'],
        ['Офис 516', 'Офис 515', 'Офис 514', 'Офис 513', 'Офис 501', 'Офис 511'],
      ),
      ...topRooms(
        ['517', '5-meet', '518'],
        ['Офис 517', 'Переговорная 5', 'Каб. директора'],
        ['office', 'meeting', 'office'],
      ),
      ...rightRooms(
        ['519', '520', '521', '522', '523', '524'],
        ['Офис 519', 'Офис 520', 'Офис 521', 'Офис 522', 'Офис 523', 'Офис 524'],
      ),
      ...bottomRooms(
        ['525', '526', '527'],
        ['Офис 525', 'Офис 526', 'Офис 527'],
      ),
    ],
  },
  // ── ЭТАЖ 6 ──────────────────────────────────────────────────────────────────
  {
    id: 6, label: '6 этаж',
    rooms: [
      ...coreRooms(6, 'Sky-лаундж', 'Муж. туалет', 'Жен. туалет', 'Барная зона'),
      ...leftRooms(
        ['616', '615', '614', '613', '601', '611'],
        ['Офис 616', 'Офис 615', 'Офис 614', 'Офис 613', 'Офис 601', 'Офис 611'],
      ),
      ...topRooms(
        ['617', '6-meet', '618'],
        ['Офис 617', 'Зал совещаний', 'Офис 618'],
        ['office', 'meeting', 'office'],
      ),
      ...rightRooms(
        ['619', '620', '621', '622', '623', '624'],
        ['Офис 619', 'Офис 620', 'Офис 621', 'Офис 622', 'Офис 623', 'Офис 624'],
      ),
      ...bottomRooms(
        ['625', '626', '627'],
        ['Офис 625', 'Офис 626', 'Офис 627'],
      ),
    ],
  },
]

export const EQUIPMENT = [
  // ОВ — Отопление и вентиляция
  { id: 'eq01', name: 'Вентустановка ВУ-1',    system: 'ОВ', roomId: '316',    floor: 3, status: 'normal',    model: 'Systemair SAVE 700',   year: 2019 },
  { id: 'eq02', name: 'Вентустановка ВУ-2',    system: 'ОВ', roomId: '119',    floor: 1, status: 'attention', model: 'Systemair SAVE 500',   year: 2017 },
  { id: 'eq03', name: 'Фанкойл ФК-01',         system: 'ОВ', roomId: '117',    floor: 1, status: 'normal',    model: 'Daikin FWF04BTN',      year: 2021 },
  { id: 'eq04', name: 'Фанкойл ФК-02',         system: 'ОВ', roomId: '1-meet', floor: 1, status: 'normal',    model: 'Daikin FWF04BTN',      year: 2021 },
  { id: 'eq05', name: 'Фанкойл ФК-03',         system: 'ОВ', roomId: '3-meet', floor: 3, status: 'attention', model: 'Daikin FWF06BTN',      year: 2020 },
  { id: 'eq06', name: 'Клапан воздушный КВ-1', system: 'ОВ', roomId: '316',    floor: 3, status: 'normal',    model: 'Belimo LM24A',         year: 2019 },
  { id: 'eq07', name: 'Тепловой узел ТУ-1',    system: 'ОВ', roomId: '216',    floor: 2, status: 'critical',  model: 'Danfoss ECL Comfort',  year: 2015 },

  // ВК — Водоснабжение и канализация
  { id: 'eq08', name: 'Насос ХВС-1',           system: 'ВК', roomId: '119',    floor: 1, status: 'normal',    model: 'Grundfos CM5-6',       year: 2020 },
  { id: 'eq09', name: 'Насос ХВС-2 (резерв)',  system: 'ВК', roomId: '119',    floor: 1, status: 'normal',    model: 'Grundfos CM5-6',       year: 2020 },
  { id: 'eq10', name: 'Насос ГВС-1',           system: 'ВК', roomId: '119',    floor: 1, status: 'attention', model: 'Wilo Star-RS 25/4',    year: 2018 },
  { id: 'eq11', name: 'Бойлер БКН-500',        system: 'ВК', roomId: '119',    floor: 1, status: 'normal',    model: 'Thermex IF 500 V',     year: 2021 },
  { id: 'eq12', name: 'Насосная станция НС-1', system: 'ВК', roomId: '216',    floor: 2, status: 'critical',  model: 'Grundfos Hydro MPC',   year: 2014 },
  { id: 'eq13', name: 'Счётчик воды СВ-1',     system: 'ВК', roomId: '119',    floor: 1, status: 'normal',    model: 'Zenner MNK-N',         year: 2022 },

  // ЭО — Электроосвещение
  { id: 'eq14', name: 'Щит ЩО-1 (1 эт.)',      system: 'ЭО', roomId: '118',    floor: 1, status: 'normal',    model: 'ABB MMS 2.0',          year: 2020 },
  { id: 'eq15', name: 'Щит ЩО-2 (2 эт.)',      system: 'ЭО', roomId: '215',    floor: 2, status: 'attention', model: 'ABB MMS 2.0',          year: 2018 },
  { id: 'eq16', name: 'Щит ЩО-3 (3 эт.)',      system: 'ЭО', roomId: '315',    floor: 3, status: 'normal',    model: 'ABB MMS 2.0',          year: 2020 },
  { id: 'eq17', name: 'ВРУ-0,4кВ',             system: 'ЭО', roomId: '118',    floor: 1, status: 'normal',    model: 'Schneider Prisma',     year: 2019 },
  { id: 'eq18', name: 'ИБП серверной',          system: 'ЭО', roomId: '118',    floor: 1, status: 'attention', model: 'APC Smart-UPS 3000',   year: 2017 },
  { id: 'eq19', name: 'Дизель-генератор ДГ-1', system: 'ЭО', roomId: '118',    floor: 1, status: 'critical',  model: 'Cummins C150D5',       year: 2013 },

  // СС — Слаботочные системы
  { id: 'eq20', name: 'Камера КВН-01',          system: 'СС', roomId: '116',    floor: 1, status: 'normal',    model: 'Hikvision DS-2CD2147G2', year: 2022 },
  { id: 'eq21', name: 'Камера КВН-02',          system: 'СС', roomId: '117',    floor: 1, status: 'normal',    model: 'Hikvision DS-2CD2147G2', year: 2022 },
  { id: 'eq22', name: 'Камера КВН-03',          system: 'СС', roomId: '3-meet', floor: 3, status: 'attention', model: 'Hikvision DS-2CD2347G2', year: 2021 },
  { id: 'eq23', name: 'Камера КВН-04',          system: 'СС', roomId: '2-rec',  floor: 2, status: 'normal',    model: 'Hikvision DS-2CD2147G2', year: 2022 },
  { id: 'eq24', name: 'Камера КВН-05',          system: 'СС', roomId: '102',    floor: 1, status: 'normal',    model: 'Hikvision DS-2CD2147G2', year: 2022 },
  { id: 'eq25', name: 'Видеорегистратор NVR-1', system: 'СС', roomId: '118',    floor: 1, status: 'normal',    model: 'Hikvision DS-7616NXI',   year: 2022 },
  { id: 'eq26', name: 'Контроллер СКУД-1',      system: 'СС', roomId: '102',    floor: 1, status: 'attention', model: 'HID VertX EVO V1000',    year: 2019 },
  { id: 'eq27', name: 'ОПС панель ПКП-1',       system: 'СС', roomId: '102',    floor: 1, status: 'normal',    model: 'Bosch D9412GV4',         year: 2020 },
  { id: 'eq28', name: 'Коммутатор SW-Core',      system: 'СС', roomId: '118',    floor: 1, status: 'critical',  model: 'Cisco Catalyst 2960X',   year: 2013 },
]
