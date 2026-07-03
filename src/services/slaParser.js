// SLA data extraction from DOCX HTML.
// The actual reaction-time matrix (Appendix 1 to SLA) is stored as a PNG image —
// cannot be parsed without OCR. This module extracts what IS text-parseable:
// text constraints from the SLA body and quality-checklist criteria (Appendix 3).

const SLA_SUBJECT_CATS = [
  [/противопожарн|огнетушит|пожарн.*рукав|эвакуац/i, 'fire'],
  [/охранн|скуд|видеонабл/i, 'security'],
  [/холодоснабж|вентиляц|кондиц/i, 'hvac'],
  [/теплоснабж|тепловой\s+пункт|отоплен/i, 'heating'],
  [/водоснабж|канализац|водоотвед/i, 'plumbing'],
  [/электроснабж|электроосвещ/i, 'electrical'],
  [/кровл|фасад|несущ|лестниц|крыльц|окна|двер/i, 'structural'],
  [/скс|лвс|автоматик/i, 'automation'],
]

function classifySlaSubject(text) {
  const t = text.toLowerCase()
  for (const [pat, cat] of SLA_SUBJECT_CATS) {
    if (pat.test(t)) return cat
  }
  return 'other'
}

const CONSTRAINT_DEFS = [
  {
    re: /доступное\s+время\s+сервиса\s+(\d+)\s*часа?\s+в\s+сутки[^.]{0,60}/i,
    name: 'Доступность сервиса',
    unit: 'ч/сут',
  },
  {
    re: /(?:уведомлени[еяй][^.]{0,40})?в\s+течени[еи]\s+(\d+)\s*минут[^.]{0,80}/i,
    name: 'Уведомление о ЧП',
    unit: 'мин',
  },
]

function extractConstraints(text) {
  const constraints = []
  for (const { re, name, unit } of CONSTRAINT_DEFS) {
    const m = re.exec(text)
    if (!m) continue
    const value = parseInt(m[1])
    if (isNaN(value)) continue
    constraints.push({
      name,
      value,
      unit,
      citation: m[0].replace(/\s+/g, ' ').trim(),
      source: 'tz',
      needsReview: false,
    })
  }
  return constraints
}

function parseCells(trHtml) {
  return (trHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || [])
    .map(c => c.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
}

function parseChecklistRows(html) {
  const allTables = html.match(/<table[\s\S]*?<\/table>/g) || []
  const seen = new Set()
  const matrix = []

  for (const tbl of allTables) {
    const flat = tbl.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    if (!flat.includes('Чек-лист') && !flat.includes('Объекты оценки')) continue

    const rows = (tbl.match(/<tr[\s\S]*?<\/tr>/g) || []).map(parseCells)

    for (const row of rows) {
      if (!/^\d{1,2}$/.test(row[0])) continue
      const num = parseInt(row[0])
      if (num < 1 || num > 30) continue

      const subject = (row[1] || '').trim()
      if (!subject || subject.length < 3) continue

      const key = subject.toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(key)) continue
      seen.add(key)

      const scoreCell = (row[3] || '').trim()
      const pointsMatch = scoreCell.match(/до\s+(\d+)\s*балл/)
      const points = pointsMatch ? parseInt(pointsMatch[1]) : null

      matrix.push({
        category: classifySlaSubject(subject),
        subject,
        priority: null,
        reactionTime: null,
        resolutionTime: null,
        points,
        source: 'tz',
        needsReview: true,
      })
    }
  }

  return matrix
}

/**
 * Extracts SLA data from mammoth-generated HTML.
 * Returns slaData: { detected, constraints, matrix }
 *
 * matrix items come from the quality checklist (Appendix 3 to SLA).
 * reactionTime/resolutionTime/priority are null — those are in an image in App 1.
 */
export function parseSlaTables(html) {
  if (!html) return { detected: false, constraints: [], matrix: [] }

  const slaIdx = html.search(/Service\s+Level\s+Agreement|Соглашение\s+об\s+уровне\s+качества/i)
  if (slaIdx === -1) return { detected: false, constraints: [], matrix: [] }

  const slaHtml = html.slice(slaIdx)
  const slaText = slaHtml.replace(/<img[^>]+>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  const constraints = extractConstraints(slaText)
  const matrix = parseChecklistRows(slaHtml)

  return { detected: true, constraints, matrix }
}
