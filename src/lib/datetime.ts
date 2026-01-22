export function parseDateAsUtc(dateStr: string): Date {
  const s = (dateStr || '').trim()
  if (!s) return new Date(NaN)

  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s)
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z')
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) {
    return new Date(s + 'Z')
  }

  return new Date(s)
}

export function formatDateShanghai(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const date = parseDateAsUtc(dateStr)
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    ...(options || {}),
  })
}
