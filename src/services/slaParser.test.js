import { describe, it, expect } from 'vitest'
import { parseSlaTables } from './slaParser'

// Minimal fixture HTML that mimics the real DOCX structure
const CHECKLIST_TABLE = `<table>
  <tr><td colspan="2"><p>ООО «ОДАС СКОЛКОВО»</p></td></tr>
  <tr><td colspan="2"><p>Чек-лист (проверка качества) работы инжиниринговой службы</p></td></tr>
  <tr><td colspan="2"><p>Здание ОЦ "Технопарк"</p></td></tr>
  <tr>
    <td colspan="2"><p><strong>№</strong></p></td>
    <td><p><strong>Объекты оценки</strong></p></td>
    <td colspan="6"><p><strong>Требования</strong></p></td>
    <td colspan="3"><p><strong>Размер оценки</strong></p></td>
    <td><p><strong>Дата/оценка</strong></p></td>
  </tr>
  <tr>
    <td colspan="2"><p>1</p></td>
    <td><p>Электроснабжение и электроосвещение</p></td>
    <td colspan="6"><p>Исправно, в рабочем состоянии, обслуживается.</p></td>
    <td colspan="3"><p>от 1 до 4 баллов</p></td>
    <td><p> </p></td>
  </tr>
  <tr>
    <td colspan="2"><p>2</p></td>
    <td><p>Теплоснабжение</p></td>
    <td colspan="6"><p>Исправно, в рабочем состоянии.</p></td>
    <td colspan="3"><p>от 1 до 4 баллов</p></td>
    <td><p> </p></td>
  </tr>
  <tr>
    <td colspan="2"><p>3</p></td>
    <td><p>Вентиляция</p></td>
    <td colspan="6"><p>Исправно, в рабочем состоянии, обслуживается.</p></td>
    <td colspan="3"><p>от 1 до 4 баллов</p></td>
    <td><p> </p></td>
  </tr>
  <tr>
    <td colspan="2"><p>4</p></td>
    <td><p>Противопожарные системы</p></td>
    <td colspan="6"><p>Исправны, сбоев нет.</p></td>
    <td colspan="3"><p>от 1 до 4 баллов</p></td>
    <td><p> </p></td>
  </tr>
  <tr>
    <td colspan="2"><p>5</p></td>
    <td><p>Кровля</p></td>
    <td colspan="6"><p>Повреждения отсутствуют.</p></td>
    <td colspan="3"><p>от 1 до 3 баллов</p></td>
    <td><p> </p></td>
  </tr>
</table>`

const SLA_BODY = `
<p>Service Level Agreement</p>
<p>Соглашение об уровне качества оказания услуг.</p>
<p>Доступное время сервиса 24 часа в сутки ежедневно, круглый год.</p>
<p>Уведомление заказчика подрядчиком о любом ЧП в течение 5 минут.</p>
`

const FULL_SLA_HTML = SLA_BODY + CHECKLIST_TABLE

describe('parseSlaTables', () => {
  it('returns detected:false when no SLA section', () => {
    const result = parseSlaTables('<p>Обычный текст без SLA</p>')
    expect(result.detected).toBe(false)
    expect(result.constraints).toEqual([])
    expect(result.matrix).toEqual([])
  })

  it('returns detected:false for null/empty html', () => {
    expect(parseSlaTables(null).detected).toBe(false)
    expect(parseSlaTables('').detected).toBe(false)
  })

  it('returns detected:true when "Service Level Agreement" present', () => {
    const result = parseSlaTables(FULL_SLA_HTML)
    expect(result.detected).toBe(true)
  })

  it('returns detected:true when Russian variant present', () => {
    const html = '<p>Соглашение об уровне качества</p><p>Текст.</p>'
    const result = parseSlaTables(html)
    expect(result.detected).toBe(true)
    expect(result.constraints).toEqual([])
    expect(result.matrix).toEqual([])
  })

  describe('constraints extraction', () => {
    it('extracts 24-hour availability constraint', () => {
      const result = parseSlaTables(FULL_SLA_HTML)
      const c = result.constraints.find(x => x.name === 'Доступность сервиса')
      expect(c).toBeDefined()
      expect(c.value).toBe(24)
      expect(c.unit).toBe('ч/сут')
      expect(c.source).toBe('tz')
      expect(c.needsReview).toBe(false)
      expect(c.citation).toMatch(/24/)
    })

    it('extracts 5-minute incident notification constraint', () => {
      const result = parseSlaTables(FULL_SLA_HTML)
      const c = result.constraints.find(x => x.name === 'Уведомление о ЧП')
      expect(c).toBeDefined()
      expect(c.value).toBe(5)
      expect(c.unit).toBe('мин')
      expect(c.source).toBe('tz')
      expect(c.needsReview).toBe(false)
    })

    it('extracts no constraints when body has none', () => {
      const html = '<p>Service Level Agreement</p><p>Просто текст.</p>'
      const result = parseSlaTables(html)
      expect(result.detected).toBe(true)
      expect(result.constraints).toEqual([])
    })
  })

  describe('matrix extraction from checklist', () => {
    it('extracts matrix rows from checklist table', () => {
      const result = parseSlaTables(FULL_SLA_HTML)
      expect(result.matrix.length).toBeGreaterThanOrEqual(5)
    })

    it('correctly classifies electrical category', () => {
      const result = parseSlaTables(FULL_SLA_HTML)
      const elec = result.matrix.find(m => /электроснабж/i.test(m.subject))
      expect(elec).toBeDefined()
      expect(elec.category).toBe('electrical')
      expect(elec.points).toBe(4)
      expect(elec.source).toBe('tz')
      expect(elec.needsReview).toBe(true)
    })

    it('correctly classifies heating category', () => {
      const result = parseSlaTables(FULL_SLA_HTML)
      const heat = result.matrix.find(m => /теплоснабж/i.test(m.subject))
      expect(heat).toBeDefined()
      expect(heat.category).toBe('heating')
    })

    it('correctly classifies hvac category', () => {
      const result = parseSlaTables(FULL_SLA_HTML)
      const hvac = result.matrix.find(m => /вентиляц/i.test(m.subject))
      expect(hvac).toBeDefined()
      expect(hvac.category).toBe('hvac')
    })

    it('correctly classifies fire category', () => {
      const result = parseSlaTables(FULL_SLA_HTML)
      const fire = result.matrix.find(m => /противопожарн/i.test(m.subject))
      expect(fire).toBeDefined()
      expect(fire.category).toBe('fire')
    })

    it('correctly classifies structural category', () => {
      const result = parseSlaTables(FULL_SLA_HTML)
      const struct = result.matrix.find(m => /кровл/i.test(m.subject))
      expect(struct).toBeDefined()
      expect(struct.category).toBe('structural')
      expect(struct.points).toBe(3)
    })

    it('all matrix items have null reactionTime and resolutionTime', () => {
      const result = parseSlaTables(FULL_SLA_HTML)
      for (const item of result.matrix) {
        expect(item.reactionTime).toBeNull()
        expect(item.resolutionTime).toBeNull()
        expect(item.priority).toBeNull()
      }
    })

    it('deduplicates rows from multiple checklist tables', () => {
      // Two identical checklist tables (simulating 2 buildings with same criteria)
      const html = `<p>Service Level Agreement</p>${CHECKLIST_TABLE}${CHECKLIST_TABLE}`
      const result = parseSlaTables(html)
      // Should have same rows as single table (deduplication by subject)
      const single = parseSlaTables(FULL_SLA_HTML)
      expect(result.matrix.length).toBe(single.matrix.length)
    })

    it('ignores tables without Чек-лист heading', () => {
      const html = `<p>Service Level Agreement</p>
        <table><tr><td>1</td><td>Посторонний предмет</td><td>Требование</td><td>от 1 до 5 баллов</td></tr></table>`
      const result = parseSlaTables(html)
      expect(result.matrix).toEqual([])
    })
  })
})
