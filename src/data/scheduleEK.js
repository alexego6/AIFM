// Mock ЭК (Эксплуатационный контроль) inspection records
// Format matches future Claude API response shape

export const EK_CHECKS = [
  // Март 2026
  { id: 'ek001', date: '2026-03-03', equipmentId: 'eq07', equipmentName: 'Тепловой узел ТУ-1',       system: 'ОВ', inspector: 'Петров А.И.',    status: 'critical', notes: 'Утечка в узле обвязки, давление ниже нормы' },
  { id: 'ek002', date: '2026-03-05', equipmentId: 'eq12', equipmentName: 'Насосная станция НС-1',    system: 'ВК', inspector: 'Сидоров К.В.',   status: 'critical', notes: 'Вибрация насоса, превышение нормы в 2,3 раза' },
  { id: 'ek003', date: '2026-03-07', equipmentId: 'eq01', equipmentName: 'Вентустановка ВУ-1',       system: 'ОВ', inspector: 'Иванова М.С.',   status: 'ok',       notes: '' },
  { id: 'ek004', date: '2026-03-10', equipmentId: 'eq19', equipmentName: 'Дизель-генератор ДГ-1',   system: 'ЭО', inspector: 'Кузнецов Д.Р.', status: 'warning',  notes: 'Уровень масла на нижней границе' },
  { id: 'ek005', date: '2026-03-12', equipmentId: 'eq14', equipmentName: 'Щит ЩО-1 (1 эт.)',        system: 'ЭО', inspector: 'Петров А.И.',    status: 'ok',       notes: '' },
  { id: 'ek006', date: '2026-03-14', equipmentId: 'eq28', equipmentName: 'Коммутатор SW-Core',       system: 'СС', inspector: 'Сидоров К.В.',   status: 'critical', notes: 'Перегрев, температура процессора 89°C' },
  { id: 'ek007', date: '2026-03-17', equipmentId: 'eq08', equipmentName: 'Насос ХВС-1',              system: 'ВК', inspector: 'Иванова М.С.',   status: 'ok',       notes: '' },
  { id: 'ek008', date: '2026-03-19', equipmentId: 'eq02', equipmentName: 'Вентустановка ВУ-2',       system: 'ОВ', inspector: 'Кузнецов Д.Р.', status: 'warning',  notes: 'Загрязнение фильтров G4, требуется замена' },
  { id: 'ek009', date: '2026-03-21', equipmentId: 'eq18', equipmentName: 'ИБП серверной',             system: 'ЭО', inspector: 'Петров А.И.',    status: 'warning',  notes: 'Остаточная ёмкость АКБ — 71%' },
  { id: 'ek010', date: '2026-03-25', equipmentId: 'eq26', equipmentName: 'Контроллер СКУД-1',        system: 'СС', inspector: 'Сидоров К.В.',   status: 'ok',       notes: '' },

  // Апрель 2026
  { id: 'ek011', date: '2026-04-02', equipmentId: 'eq07', equipmentName: 'Тепловой узел ТУ-1',       system: 'ОВ', inspector: 'Иванова М.С.',   status: 'critical', notes: 'Трещина в корпусе клапана, необходима замена' },
  { id: 'ek012', date: '2026-04-04', equipmentId: 'eq11', equipmentName: 'Бойлер БКН-500',            system: 'ВК', inspector: 'Кузнецов Д.Р.', status: 'ok',       notes: '' },
  { id: 'ek013', date: '2026-04-07', equipmentId: 'eq15', equipmentName: 'Щит ЩО-2 (2 эт.)',         system: 'ЭО', inspector: 'Петров А.И.',    status: 'warning',  notes: 'Нагрев клеммных соединений в секции 3' },
  { id: 'ek014', date: '2026-04-09', equipmentId: 'eq03', equipmentName: 'Фанкойл ФК-01',             system: 'ОВ', inspector: 'Сидоров К.В.',   status: 'ok',       notes: '' },
  { id: 'ek015', date: '2026-04-11', equipmentId: 'eq22', equipmentName: 'Камера КВН-03',             system: 'СС', inspector: 'Иванова М.С.',   status: 'warning',  notes: 'Засветка объектива в дневное время' },
  { id: 'ek016', date: '2026-04-14', equipmentId: 'eq19', equipmentName: 'Дизель-генератор ДГ-1',   system: 'ЭО', inspector: 'Кузнецов Д.Р.', status: 'critical', notes: 'Не запускается при тестовом включении' },
  { id: 'ek017', date: '2026-04-16', equipmentId: 'eq12', equipmentName: 'Насосная станция НС-1',    system: 'ВК', inspector: 'Петров А.И.',    status: 'critical', notes: 'Отказ частотного преобразователя' },
  { id: 'ek018', date: '2026-04-18', equipmentId: 'eq01', equipmentName: 'Вентустановка ВУ-1',       system: 'ОВ', inspector: 'Сидоров К.В.',   status: 'ok',       notes: '' },
  { id: 'ek019', date: '2026-04-22', equipmentId: 'eq17', equipmentName: 'ВРУ-0,4кВ',                system: 'ЭО', inspector: 'Иванова М.С.',   status: 'ok',       notes: '' },
  { id: 'ek020', date: '2026-04-25', equipmentId: 'eq05', equipmentName: 'Фанкойл ФК-03',             system: 'ОВ', inspector: 'Кузнецов Д.Р.', status: 'warning',  notes: 'Шум подшипника вентилятора' },
  { id: 'ek021', date: '2026-04-28', equipmentId: 'eq10', equipmentName: 'Насос ГВС-1',               system: 'ВК', inspector: 'Петров А.И.',    status: 'warning',  notes: 'Снижение напора на 15%' },

  // Май 2026
  { id: 'ek022', date: '2026-05-05', equipmentId: 'eq28', equipmentName: 'Коммутатор SW-Core',       system: 'СС', inspector: 'Сидоров К.В.',   status: 'warning',  notes: 'Температура нормализована после прочистки, мониторинг' },
  { id: 'ek023', date: '2026-05-07', equipmentId: 'eq07', equipmentName: 'Тепловой узел ТУ-1',       system: 'ОВ', inspector: 'Иванова М.С.',   status: 'warning',  notes: 'После ремонта: давление в норме, наблюдение 2 нед.' },
  { id: 'ek024', date: '2026-05-09', equipmentId: 'eq14', equipmentName: 'Щит ЩО-1 (1 эт.)',        system: 'ЭО', inspector: 'Кузнецов Д.Р.', status: 'ok',       notes: '' },
  { id: 'ek025', date: '2026-05-12', equipmentId: 'eq08', equipmentName: 'Насос ХВС-1',              system: 'ВК', inspector: 'Петров А.И.',    status: 'ok',       notes: '' },
  { id: 'ek026', date: '2026-05-14', equipmentId: 'eq19', equipmentName: 'Дизель-генератор ДГ-1',   system: 'ЭО', inspector: 'Сидоров К.В.',   status: 'critical', notes: 'После ремонта: запуск восстановлен, необходим капремонт' },
  { id: 'ek027', date: '2026-05-16', equipmentId: 'eq02', equipmentName: 'Вентустановка ВУ-2',       system: 'ОВ', inspector: 'Иванова М.С.',   status: 'ok',       notes: 'Фильтры заменены' },
  { id: 'ek028', date: '2026-05-19', equipmentId: 'eq12', equipmentName: 'Насосная станция НС-1',    system: 'ВК', inspector: 'Кузнецов Д.Р.', status: 'warning',  notes: 'Частотник заменён, идёт приработка' },
  { id: 'ek029', date: '2026-05-21', equipmentId: 'eq27', equipmentName: 'ОПС панель ПКП-1',         system: 'СС', inspector: 'Петров А.И.',    status: 'ok',       notes: '' },
  { id: 'ek030', date: '2026-05-23', equipmentId: 'eq18', equipmentName: 'ИБП серверной',             system: 'ЭО', inspector: 'Сидоров К.В.',   status: 'warning',  notes: 'Ёмкость АКБ 68%, рекомендована замена батарей' },
  { id: 'ek031', date: '2026-05-27', equipmentId: 'eq06', equipmentName: 'Клапан воздушный КВ-1',    system: 'ОВ', inspector: 'Иванова М.С.',   status: 'ok',       notes: '' },
  { id: 'ek032', date: '2026-05-29', equipmentId: 'eq16', equipmentName: 'Щит ЩО-3 (3 эт.)',         system: 'ЭО', inspector: 'Кузнецов Д.Р.', status: 'ok',       notes: '' },

  // Июнь 2026
  { id: 'ek033', date: '2026-06-02', equipmentId: 'eq07', equipmentName: 'Тепловой узел ТУ-1',       system: 'ОВ', inspector: 'Петров А.И.',    status: 'ok',       notes: 'Параметры стабилизировались' },
  { id: 'ek034', date: '2026-06-04', equipmentId: 'eq22', equipmentName: 'Камера КВН-03',             system: 'СС', inspector: 'Сидоров К.В.',   status: 'ok',       notes: 'Козырёк установлен, засветка устранена' },
  { id: 'ek035', date: '2026-06-06', equipmentId: 'eq19', equipmentName: 'Дизель-генератор ДГ-1',   system: 'ЭО', inspector: 'Иванова М.С.',   status: 'warning',  notes: 'Уровень топлива 30%, необходима дозаправка' },
  { id: 'ek036', date: '2026-06-09', equipmentId: 'eq05', equipmentName: 'Фанкойл ФК-03',             system: 'ОВ', inspector: 'Кузнецов Д.Р.', status: 'ok',       notes: 'Подшипник заменён' },
  { id: 'ek037', date: '2026-06-11', equipmentId: 'eq12', equipmentName: 'Насосная станция НС-1',    system: 'ВК', inspector: 'Петров А.И.',    status: 'ok',       notes: 'Давление и расход в норме' },
  { id: 'ek038', date: '2026-06-13', equipmentId: 'eq28', equipmentName: 'Коммутатор SW-Core',       system: 'СС', inspector: 'Сидоров К.В.',   status: 'critical', notes: 'Потеря пакетов 12%, деградация порта 8' },
  { id: 'ek039', date: '2026-06-16', equipmentId: 'eq10', equipmentName: 'Насос ГВС-1',               system: 'ВК', inspector: 'Иванова М.С.',   status: 'warning',  notes: 'Напор восстановлен частично до 92%' },
  { id: 'ek040', date: '2026-06-18', equipmentId: 'eq18', equipmentName: 'ИБП серверной',             system: 'ЭО', inspector: 'Кузнецов Д.Р.', status: 'warning',  notes: 'Заявка на замену АКБ подана' },
]
