import { usePlatformStore } from '../../store/usePlatformStore'

const CAT_LABELS = {
  electrical:  'Электроснабжение',
  heating:     'Теплоснабжение',
  hvac:        'Вентиляция / Холодоснабжение',
  plumbing:    'Водоснабжение / Канализация',
  fire:        'Пожарная безопасность',
  security:    'Охранные системы',
  structural:  'Строительные конструкции',
  automation:  'Автоматика / СКС',
  other:       'Прочее',
}

const CAT_COLOR = {
  electrical: '#2563EB',
  heating:    '#EA580C',
  hvac:       '#0891B2',
  plumbing:   '#0284C7',
  fire:       '#DC2626',
  security:   '#7C3AED',
  structural: '#78716C',
  automation: '#059669',
  other:      '#6B7280',
}

function CategoryBadge({ cat }) {
  const color = CAT_COLOR[cat] ?? '#6B7280'
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 7px',
      borderRadius: 4, background: color + '18', color, border: `1px solid ${color}44`,
    }}>
      {CAT_LABELS[cat] ?? cat}
    </span>
  )
}

function ReviewBadge() {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 7px',
      borderRadius: 4, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A',
      marginLeft: 6,
    }}>
      Требует проверки
    </span>
  )
}

function SlaDevStub() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '60vh', gap: 12, color: '#9CA3AF' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806
          3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438
          3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806
          3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138
          3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946
          3.42 3.42 0 013.138-3.138z"/>
      </svg>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#6B7280' }}>SLA не применён</div>
      <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
        Применените данные из Анализа ТЗ — SLA-матрица станет доступна автоматически
      </div>
    </div>
  )
}

function ConstraintCard({ c }) {
  return (
    <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
      padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ background: '#EFF6FF', borderRadius: 6, padding: '6px 10px',
        textAlign: 'center', minWidth: 52 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1D4ED8', lineHeight: 1 }}>{c.value}</div>
        <div style={{ fontSize: 10, color: '#3B82F6', fontWeight: 500 }}>{c.unit}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{c.name}</div>
        {c.citation && (
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, fontStyle: 'italic', lineHeight: 1.4 }}>
            «{c.citation}»
          </div>
        )}
        {c.needsReview && <ReviewBadge />}
      </div>
    </div>
  )
}

function MatrixRow({ item }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
      borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ minWidth: 180 }}>
        <CategoryBadge cat={item.category} />
      </div>
      <div style={{ flex: 1, fontSize: 12, color: '#374151' }}>{item.subject}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {item.points != null && (
          <span style={{ fontSize: 11, color: '#059669', fontWeight: 600,
            background: '#ECFDF5', padding: '2px 7px', borderRadius: 4 }}>
            до {item.points} балл.
          </span>
        )}
        {item.reactionTime == null && (
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>реагирование: —</span>
        )}
        {item.needsReview && <ReviewBadge />}
      </div>
    </div>
  )
}

export default function SLA() {
  const { slaData, applied } = usePlatformStore()

  if (!applied || !slaData?.detected) return <SlaDevStub />

  const { constraints = [], matrix = [] } = slaData

  const byCategory = matrix.reduce((acc, item) => {
    ;(acc[item.category] = acc[item.category] ?? []).push(item)
    return acc
  }, {})

  return (
    <div style={{ padding: '20px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>SLA — Соглашение об уровне обслуживания</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
          Данные из Приложения №4 к Техническому заданию
        </div>
        <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Матрица времён реагирования (Приложение №1 к SLA) хранится в документе как изображение — времена реагирования недоступны без ручного ввода
        </div>
      </div>

      {constraints.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
            Ключевые нормативы SLA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {constraints.map((c, i) => <ConstraintCard key={i} c={c} />)}
          </div>
        </div>
      )}

      {matrix.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
            Критерии качества обслуживания ({matrix.length} позиций)
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden',
            background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
              fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
              <div style={{ minWidth: 180 }}>Категория</div>
              <div style={{ flex: 1 }}>Объект оценки</div>
              <div style={{ flexShrink: 0 }}>Оценка</div>
            </div>
            {Object.entries(byCategory).map(([cat, items]) =>
              items.map((item, i) => <MatrixRow key={`${cat}-${i}`} item={item} />)
            )}
          </div>
        </div>
      )}

      {matrix.length === 0 && constraints.length === 0 && (
        <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
          SLA-данные обнаружены, но не содержат извлекаемых позиций
        </div>
      )}
    </div>
  )
}
