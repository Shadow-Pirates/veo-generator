function sanitizeFilename(input: string) {
  const s = String(input || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F#]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return s.replace(/[.\s]+$/g, '')
}

function formatTimestampForFilename(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${y}${m}${d}_${hh}${mm}${ss}`
}

function getExtFromPath(p: string | undefined) {
  const s = String(p || '')
  const m = s.match(/\.[A-Za-z0-9]+$/)
  return m ? m[0] : ''
}

export function makeSuggestedFileName(params: {
  prompt: string
  filePath?: string
  date?: Date
  index?: number
  total?: number
  defaultBase?: string
}) {
  const date = params.date || new Date()
  const ts = formatTimestampForFilename(date)
  const raw = String(params.prompt || '').trim().replace(/\s+/g, ' ')
  const prefix = sanitizeFilename(raw.slice(0, 12)) || params.defaultBase || 'file'
  const ext = getExtFromPath(params.filePath)

  const total = Number(params.total || 0)
  const idx = typeof params.index === 'number' ? params.index : undefined
  const seq = total > 1 && idx !== undefined ? `_${String(idx + 1).padStart(2, '0')}` : ''

  return `${prefix}_${ts}${seq}${ext}`
}
