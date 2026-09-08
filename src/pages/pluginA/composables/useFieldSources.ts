import { nextTick, reactive, ref, watch } from 'vue'
import {
  cloneFieldValue,
  hasMeaningfulValue,
  isCandidateArray,
  normalizeRemoteOptions,
  type FieldSourceCode,
  type FieldSourceOption,
} from '../domain/fieldSources'

interface FieldSourceOptions {
  form: Record<string, any>
  initialValues: Record<string, any>
  defaultValues: Record<string, any>
  systemDefaultFields: Set<string>
  coerceValue: (field: string, value: unknown) => any
}

export function useFieldSources(options: FieldSourceOptions) {
  const { form, initialValues, defaultValues, systemDefaultFields, coerceValue } = options
  const fieldSource = reactive<Record<string, FieldSourceCode>>({})
  const fieldRawData = reactive<Record<string, any>>({})
  const remoteOptions = reactive<Record<string, FieldSourceOption[]>>({})
  const userValues = reactive<Record<string, any>>({})
  const userModifiedFields = ref<Set<string>>(new Set())
  const userBaseline = reactive<Record<string, any>>(cloneFieldValue(defaultValues))
  let applyingData = false

  function hasDefault(field: string): boolean {
    return hasMeaningfulValue(defaultValues[field])
  }

  function hasFieldValue(field: string): boolean {
    return hasMeaningfulValue(form[field])
  }

  function isSameValue(a: any, b: any): boolean {
    if ((Array.isArray(a) && Array.isArray(b)) ||
      (a && b && typeof a === 'object' && typeof b === 'object')) {
      return JSON.stringify(a) === JSON.stringify(b)
    }
    if ((typeof a === 'number' || typeof b === 'number') &&
      typeof a !== 'boolean' && typeof b !== 'boolean' &&
      a !== null && b !== null && a !== undefined && b !== undefined && a !== '' && b !== '') {
      const na = Number(a)
      const nb = Number(b)
      if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb
    }
    return String(a) === String(b)
  }

  function rebuildUserModified() {
    if (applyingData) return
    const next = new Set<string>()
    for (const field of Object.keys(form)) {
      if (!isSameValue(form[field], userBaseline[field])) {
        next.add(field)
        userValues[field] = cloneFieldValue(form[field])
      }
    }
    userModifiedFields.value = next
  }

  watch(form, rebuildUserModified, { deep: true, flush: 'sync' })

  function defaultSource(field: string): FieldSourceCode {
    return systemDefaultFields.has(field) ? 'system default' : 'server default'
  }

  function fieldBgClass(field: string): string {
    const source = fieldSource[field]
    if (userModifiedFields.value.has(field) || source === 'user') return 'font-blue'
    if (source === 'conflict') return 'bg-conflict'
    if (source === 'ai') return 'bg-green'
    if (source === 'cam') return 'bg-orange'
    if (source === 'server default' || source === 'system default') return ''
    return hasDefault(field) ? '' : 'bg-light-red'
  }

  function sourceLabel(field: string): string {
    const source = fieldSource[field]
    if (source === 'conflict') return '数据有冲突'
    if (!hasFieldValue(field)) return ''
    if (userModifiedFields.value.has(field) || source === 'user') return '用户确认'
    if (source === 'ai') return 'AI提参'
    if (source === 'cam') return 'CAM提参'
    if (source === 'system default') return '系统默认'
    if (source === 'server default') return '默认行业标准'
    if (systemDefaultFields.has(field)) return '系统默认'
    return hasDefault(field) ? '默认行业标准' : ''
  }

  function sourceClass(field: string): string {
    const source = fieldSource[field]
    if (source === 'conflict') return 'badge conflict'
    if (!hasFieldValue(field)) return 'badge empty'
    if (userModifiedFields.value.has(field) || source === 'user') return 'badge user'
    if (source === 'ai') return 'badge ai'
    if (source === 'cam') return 'badge extracted'
    return 'badge empty'
  }

  function sourceOptions(field: string): FieldSourceOption[] {
    const result: FieldSourceOption[] = []
    if (hasDefault(field)) {
      const source = defaultSource(field)
      result.push({
        id: `default:${field}`,
        kind: 'default',
        label: source === 'system default' ? '系统默认' : '默认行业标准',
        source,
        value: cloneFieldValue(defaultValues[field]),
      })
    }
    result.push(...(remoteOptions[field] || []))
    if (Object.prototype.hasOwnProperty.call(userValues, field)) {
      result.push({
        id: `user:${field}`,
        kind: 'user',
        label: '用户确认',
        source: 'user',
        value: cloneFieldValue(userValues[field]),
      })
    }

    const currentSource = fieldSource[field]
    if (sourceLabel(field) && result.length === 0 && currentSource !== 'conflict') {
      result.push({
        id: `current:${field}`,
        kind: 'current',
        label: sourceLabel(field),
        source: currentSource,
        value: cloneFieldValue(form[field]),
        raw: fieldRawData[field],
      })
    }
    return result
  }

  function clearValue(field: string): any {
    const initialValue = initialValues[field]
    if (Array.isArray(initialValue)) return []
    return typeof initialValue === 'string' ? '' : null
  }

  function snapshotBaseline(fields = Object.keys(form)) {
    for (const field of fields) userBaseline[field] = cloneFieldValue(form[field])
  }

  async function selectSource(field: string, optionId: string) {
    const selected = sourceOptions(field).find(option => option.id === optionId)
    if (!selected) return
    const before = Object.fromEntries(Object.keys(form).map(key => [key, cloneFieldValue(form[key])]))
    applyingData = true
    try {
      form[field] = cloneFieldValue(selected.value)
      fieldSource[field] = selected.source
      if (selected.raw) fieldRawData[field] = selected.raw
      else delete fieldRawData[field]
      await nextTick()
      const changedFields = Object.keys(form).filter(key => !isSameValue(before[key], form[key]))
      snapshotBaseline(changedFields.length ? changedFields : [field])
    } finally {
      applyingData = false
      rebuildUserModified()
    }
  }

  async function applyFieldData(
    data: Record<string, any>,
    afterAssign?: (usesCandidateArrays: boolean) => void,
  ) {
    applyingData = true
    try {
      for (const map of [fieldSource, fieldRawData, remoteOptions, userValues]) {
        for (const key of Object.keys(map)) delete map[key]
      }
      userModifiedFields.value = new Set()

      for (const field of Object.keys(form)) {
        form[field] = cloneFieldValue(initialValues[field])
        if (hasDefault(field)) fieldSource[field] = defaultSource(field)
      }

      for (const field of Object.keys(data)) {
        if (!(field in form)) continue
        const candidates = normalizeRemoteOptions(field, data[field], systemDefaultFields.has(field))
          .map(candidate => ({ ...candidate, value: coerceValue(field, candidate.value) }))
        remoteOptions[field] = candidates
        if (candidates.length === 1) {
          const candidate = candidates[0]
          form[field] = cloneFieldValue(candidate.value)
          fieldSource[field] = candidate.source
          fieldRawData[field] = candidate.raw
        } else if (candidates.length > 1) {
          form[field] = clearValue(field)
          fieldSource[field] = 'conflict'
        }
      }

      const usesCandidateArrays = Object.entries(data).some(([field, value]) => {
        if (!(field in form) || !Array.isArray(value)) return false
        // 标量字段的空数组也属于 Qt 新候选协议；表单自身为数组的字段则保留旧格式兼容。
        return isCandidateArray(value) || (value.length === 0 && !Array.isArray(initialValues[field]))
      })
      afterAssign?.(usesCandidateArrays)
      await nextTick()
      snapshotBaseline()
    } finally {
      applyingData = false
      rebuildUserModified()
    }
  }

  return {
    fieldSource,
    fieldRawData,
    userModifiedFields,
    userBaseline,
    hasDefault,
    hasFieldValue,
    rebuildUserModified,
    fieldBgClass,
    sourceLabel,
    sourceClass,
    sourceOptions,
    selectSource,
    applyFieldData,
  }
}
