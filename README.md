# AIFM — AI Facility Management

Прототип платформы для управления объектами недвижимости с AI-ассистентом, BIM-просмотрщиком и компьютерным зрением для работы с планами BTI.

## Возможности

| Модуль | Описание |
|--------|----------|
| **Dashboard** | Сводный дашборд по объекту |
| **BIM Viewer** | Просмотр IFC-моделей здания (Three.js + web-ifc) |
| **BTI Recognizer** | Загрузка планов/экспликаций BTI → AI-распознавание помещений (Claude Vision) |
| **Floor Plan** | Интерактивный поэтажный план (Konva) |
| **Wear Prediction** | AI-прогноз износа оборудования и рисков аварий (Claude) |
| **Tickets** | Заявки на обслуживание |
| **Schedule TO/EK** | Графики технического обслуживания и экстренных работ |
| **Systems List** | Список инженерных систем |
| **Equipment Panel** | Паспорта оборудования |

## Стек

- **React 19** + **Vite 8**
- **Tailwind CSS 4**
- **Three.js** + **web-ifc** — просмотр BIM/IFC моделей
- **react-konva** — интерактивные SVG/canvas планы
- **pdfjs-dist** — загрузка PDF-планов BTI
- **Recharts** — графики
- **Zustand** — стейт-менеджмент
- **Claude API** (Anthropic) — Vision-распознавание, прогноз износа

## Быстрый старт (локально)

### Требования

- Node.js 18+
- npm 9+
- API-ключ Anthropic (для AI-функций)

### Установка

```bash
git clone https://github.com/alexego6/AIFM.git
cd AIFM

npm install

cp .env.example .env
# Откройте .env и вставьте ваш Anthropic API key
```

### Запуск в режиме разработки

```bash
npm run dev
```

Откройте [http://localhost:5173](http://localhost:5173)

### Сборка для продакшена

```bash
npm run build
# Собранный сайт — в папке dist/
```

### Превью сборки

```bash
npm run preview
```

## Переменные окружения

Создайте файл `.env` (скопируйте из `.env.example`):

| Переменная | Описание | Обязательна |
|-----------|----------|-------------|
| `VITE_ANTHROPIC_API_KEY` | Ключ Anthropic API | Для AI-функций |

> Получить ключ: [console.anthropic.com](https://console.anthropic.com/)

AI-функции без ключа недоступны, остальные модули работают на демо-данных.

## Деплой на сервер (nginx)

```bash
npm run build
cp -r dist/* /var/www/aifm/
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/aifm;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Деплой через Vercel / Netlify

Подключите репозиторий — Vite-проект задеплоится автоматически.  
Добавьте переменную `VITE_ANTHROPIC_API_KEY` в настройки окружения.

> **Важно:** `VITE_*` переменные попадают в JS-бандл браузера.  
> Для продакшена рекомендуется серверный прокси для вызовов Claude API.

## Структура проекта

```
src/
├── components/
│   ├── BIMViewer/        # IFC/BIM просмотрщик (Three.js)
│   ├── BTIRecognizer/    # Загрузка и AI-распознавание планов BTI
│   ├── Building/         # 3D-модель здания
│   ├── BuildingView/     # Вид здания
│   ├── Dashboard/        # Главный дашборд
│   ├── EquipmentPanel/   # Паспорт оборудования
│   ├── FloorPlan/        # Поэтажный план (Konva)
│   ├── ScheduleEK/       # График экстренных работ
│   ├── ScheduleTO/       # График техобслуживания
│   ├── Sidebar/          # Навигация
│   ├── SystemsList/      # Инженерные системы
│   ├── Tickets/          # Заявки
│   └── WearPrediction/   # AI-прогноз износа
├── data/                 # Демо-данные (здание, расписания, заявки)
├── lib/                  # Утилиты (ifcInstance.js)
├── services/
│   └── claudeApi.js      # Клиент Claude API (Vision + текст)
├── store/                # Zustand store
└── main.jsx
public/
├── web-ifc.wasm          # WebAssembly модуль для парсинга IFC
└── pdf.worker.min.mjs    # PDF.js worker для загрузки PDF-планов
```
