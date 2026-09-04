export type ErrorSource = 'QT' | '电巢' | 'asem' | '系统'

const SOURCE_PREFIX_PATTERN = /^(QT|电巢|asem|系统):/

export function withErrorSource(source: ErrorSource, message: unknown, fallback = '操作失败'): string {
  const text = String(message || fallback)
  return SOURCE_PREFIX_PATTERN.test(text) ? text : `${source}:${text}`
}
