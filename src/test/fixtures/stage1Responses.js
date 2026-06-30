// Fixture Claude responses for Stage 1 pipeline tests.
// These mock the raw JSON strings that callClaude() returns.

/** Batch 1 extraction — finds 3 candidates */
export const EXTRACT_BATCH1 = JSON.stringify([
  {
    id: 'b1',
    name: 'Офисный центр «Квартал Менделеева» корпус 1',
    address: 'г. Москва, ул. Нобеля, д. 7',
    floors: 4,
    area_m2: 8958.5,
    year_built: 2015,
    purpose: 'административно-офисное здание',
    sub_buildings: [],
  },
  {
    id: 'b2',
    name: 'Офисный центр «Квартал Менделеева» корпус 2',
    address: 'г. Москва, ул. Нобеля, д. 7, корп. 2',
    floors: 5,
    area_m2: 10200,
    year_built: 2016,
    purpose: 'административно-офисное здание',
    sub_buildings: [],
  },
  {
    id: 'b3',
    name: 'Усадьба',
    address: 'МО, Одинцовский р-н',
    floors: null,
    area_m2: null,
    year_built: null,
    purpose: 'загородный комплекс',
    sub_buildings: ['Коттедж №1', 'Баня'],
  },
])

/** Batch 2 extraction — duplicate + new object */
export const EXTRACT_BATCH2 = JSON.stringify([
  {
    id: 'b1',
    name: 'Квартал Менделеева, корпус 1',
    address: null,
    floors: 4,
    area_m2: null,
    year_built: null,
    purpose: null,
    sub_buildings: [],
  },
  {
    id: 'b2',
    name: 'Здание «Гиперкуб»',
    address: 'г. Москва, ул. Нобеля, д. 10',
    floors: 6,
    area_m2: 15000,
    year_built: 2019,
    purpose: 'инновационный центр',
    sub_buildings: [],
  },
])

/** Empty batch — no buildings found */
export const EXTRACT_EMPTY = JSON.stringify([])

/** Consolidation pass result — deduplicated, hierarchy resolved */
export const CONSOLIDATE_RESULT = JSON.stringify([
  {
    id: 'b1',
    name: 'Офисный центр «Квартал Менделеева» корпус 1',
    address: 'г. Москва, ул. Нобеля, д. 7',
    floors: 4,
    area_m2: 8958.5,
    year_built: 2015,
    purpose: 'административно-офисное здание',
    sub_buildings: [],
  },
  {
    id: 'b2',
    name: 'Офисный центр «Квартал Менделеева» корпус 2',
    address: 'г. Москва, ул. Нобеля, д. 7, корп. 2',
    floors: 5,
    area_m2: 10200,
    year_built: 2016,
    purpose: 'административно-офисное здание',
    sub_buildings: [],
  },
  {
    id: 'b3',
    name: 'Здание «Гиперкуб»',
    address: 'г. Москва, ул. Нобеля, д. 10',
    floors: 6,
    area_m2: 15000,
    year_built: 2019,
    purpose: 'инновационный центр',
    sub_buildings: [],
  },
  {
    id: 'b4',
    name: 'Усадьба «Ромашово»',
    address: 'МО, Одинцовский р-н',
    floors: null,
    area_m2: 12500,
    year_built: 2003,
    purpose: 'загородный комплекс',
    sub_buildings: ['Коттедж №1', 'Административно-хозяйственный корпус', 'Банный корпус'],
  },
])

/** Malformed JSON from Claude (simulate parse failure) */
export const MALFORMED_JSON = 'вот список объектов: [{name: Офис'

/** Single building — no dedup needed */
export const SINGLE_BUILDING = JSON.stringify([
  {
    id: 'b1',
    name: 'Бизнес-центр «Альфа»',
    address: 'г. СПб, пр. Невский, д. 1',
    floors: 10,
    area_m2: 25000,
    year_built: 2010,
    purpose: 'бизнес-центр класса А',
    sub_buildings: [],
  },
])
