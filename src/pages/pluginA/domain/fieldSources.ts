export type FieldSourceCode = 'ai' | 'cam' | 'server default' | 'system default' | 'user' | 'conflict' | ''

export interface RawFieldCandidate extends Record<string, any> {
  value?: unknown
  ratio?: unknown
  source?: string
}

export interface FieldSourceOption {
  id: string
  kind: 'default' | 'remote' | 'user' | 'current'
  label: string
  source: FieldSourceCode
  value: unknown
  raw?: RawFieldCandidate
}

export function cloneFieldValue<T>(value: T): T {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value)) as T
}

export function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false
  return !Array.isArray(value) || value.length > 0
}

export function isCandidateEntry(value: unknown): value is RawFieldCandidate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entry = value as Record<string, unknown>
  return 'value' in entry || 'source' in entry || 'ratio' in entry
}

export function isCandidateArray(value: unknown): boolean {
  return Array.isArray(value) && value.some(isCandidateEntry)
}

function candidateValue(field: string, entry: RawFieldCandidate): unknown {
  if (field === 'immersionGoldArea') return entry.ratio ?? entry.value ?? entry[field]
  return entry.value ?? entry[field]
}

function normalizeSource(source: unknown, useSystemDefault: boolean): FieldSourceCode {
  const value = String(source ?? '').trim().toLowerCase()
  if (value === 'ai' || value === 'cam' || value === 'user') return value
  if (value === 'system default') return 'system default'
  if (value === 'server default') return useSystemDefault ? 'system default' : 'server default'
  return ''
}

function candidateLabel(source: FieldSourceCode, position: number): string {
  if (source === 'ai') return `AI提参${position}`
  if (source === 'cam') return `CAM提参${position}`
  if (source === 'system default') return '系统默认'
  if (source === 'server default') return '默认行业标准'
  if (source === 'user') return '用户确认'
  return `数据来源${position}`
}

/** 同时兼容新的候选数组与旧的单对象/直接值格式。 */
export function normalizeRemoteOptions(
  field: string,
  input: unknown,
  useSystemDefault: boolean,
): FieldSourceOption[] {
  let entries: Array<{ raw: RawFieldCandidate; position: number }>
  if (Array.isArray(input)) {
    if (input.length === 0) return []
    entries = input.some(isCandidateEntry)
      ? input.flatMap((raw, index) => isCandidateEntry(raw)
        ? [{ raw, position: index + 1 }]
        : [])
      : [{ raw: { value: input }, position: 1 }]
  } else if (isCandidateEntry(input)) {
    entries = [{ raw: input, position: 1 }]
  } else if (input === undefined || input === null) {
    return []
  } else {
    entries = [{ raw: { value: input }, position: 1 }]
  }

  return entries.flatMap(({ raw, position }) => {
    const value = candidateValue(field, raw)
    if (!hasMeaningfulValue(value)) return []
    const source = normalizeSource(raw.source, useSystemDefault)
    return [{
      id: `remote:${field}:${position - 1}`,
      kind: 'remote' as const,
      label: candidateLabel(source, position),
      source,
      value: cloneFieldValue(value),
      raw,
    }]
  })
}
