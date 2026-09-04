export type ErrorSource = 'QT' | '电巢' | 'asem' | '系统'

const SOURCE_PREFIX_PATTERN = /^(QT|电巢|asem|系统):/
const ERROR_MESSAGE_SHOWN_KEY = '__errorMessageShown'

export function withErrorSource(source: ErrorSource, message: unknown, fallback = '操作失败'): string {
  const text = String(message || fallback)
  return SOURCE_PREFIX_PATTERN.test(text) ? text : `${source}:${text}`
}

/** 标记该错误已经由请求层展示，避免业务页面再次弹出同一错误。 */
export function markErrorMessageShown(error: unknown): void {
  if ((typeof error !== 'object' || error === null) && typeof error !== 'function') return
  try {
    Object.defineProperty(error, ERROR_MESSAGE_SHOWN_KEY, {
      value: true,
      configurable: true,
    })
  } catch {
    // 极少数不可扩展错误对象无法标记，保留原有兜底提示行为。
  }
}

export function wasErrorMessageShown(error: unknown): boolean {
  if ((typeof error !== 'object' || error === null) && typeof error !== 'function') return false
  return Boolean((error as Record<string, unknown>)[ERROR_MESSAGE_SHOWN_KEY])
}
