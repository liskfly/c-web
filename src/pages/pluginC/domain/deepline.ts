export interface DeeplineTokenContext {
  enabled: boolean
  parameters: Record<string, any>
  taskId: string
  token: string
  uid: string
}

function toRecord(value: unknown): Record<string, any> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>
  }
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : null
  } catch {
    return null
  }
}

function findNestedRecord(
  value: unknown,
  predicate: (record: Record<string, any>) => boolean,
  childKeys: string[],
): Record<string, any> | null {
  const queue: unknown[] = [value]
  const visited = new Set<Record<string, any>>()
  while (queue.length) {
    const record = toRecord(queue.shift())
    if (!record || visited.has(record)) continue
    visited.add(record)
    if (predicate(record)) return record
    for (const key of childKeys) {
      if (key in record) queue.push(record[key])
    }
  }
  return null
}

/**
 * 解析 Qt token 回包中的 DeepLine 上下文。
 * PCB 参数兼容直接返回以及 data/parameters/params/pcbQuoteParams 等包装形式。
 */
export function resolveDeeplineToken(
  detail: Record<string, any>,
  formKeys: string[],
): DeeplineTokenContext {
  const rawInfo = detail.deepline_user_info
  const enabled = Object.prototype.hasOwnProperty.call(detail, 'deepline_user_info')
    && rawInfo !== null
    && rawInfo !== undefined
    && rawInfo !== ''
  const deepInfo = enabled ? toRecord(rawInfo) : null

  const parameters = enabled
    ? findNestedRecord(
      rawInfo,
      record => formKeys.some(key => key in record),
      ['pcbQuoteParams', 'pcb_quote_params', 'parameters', 'params', 'data'],
    ) || {}
    : {}

  const taskRecord = findNestedRecord(
    deepInfo,
    record => Boolean(record.taskId ?? record.task_id),
    ['data', 'user_info'],
  )
  const identity = toRecord(detail.elecnest_user_info)
    || findNestedRecord(
      deepInfo,
      record => Boolean(record.elecnest_user_token ?? record.token),
      ['elecnest_user_info', 'user_info', 'data'],
    )

  return {
    enabled,
    parameters,
    taskId: String(detail.taskId ?? taskRecord?.taskId ?? taskRecord?.task_id ?? ''),
    token: String(identity?.elecnest_user_token ?? identity?.token ?? ''),
    uid: String(identity?.elecnest_user_uid ?? identity?.uid ?? ''),
  }
}
