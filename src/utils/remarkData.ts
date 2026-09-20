/**
 * 兼容 remark 的纯值、{ value, source } 以及候选数组格式，统一为字符串数组。
 */
export function normalizeRemarks(input: unknown): string[] {
  if (input === null || input === undefined || input === '') return []

  if (Array.isArray(input)) {
    return input.flatMap(item => normalizeRemarks(item))
  }

  if (typeof input === 'object') {
    const entry = input as Record<string, unknown>
    if ('value' in entry) return normalizeRemarks(entry.value)
    if ('remark' in entry) return normalizeRemarks(entry.remark)
    return []
  }

  return [String(input)].filter(value => value.trim() !== '')
}
