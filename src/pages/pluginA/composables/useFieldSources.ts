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
  autoConfirmedCamFields?: ReadonlySet<string>
  conflictMode: boolean
  coerceValue: (field: string, value: unknown) => any
}

export function useFieldSources(options: FieldSourceOptions) {
  const {
    form,
    initialValues,
    defaultValues,
    systemDefaultFields,
    autoConfirmedCamFields = new Set<string>(),
    conflictMode,
    coerceValue,
  } = options
  const fieldSource = reactive<Record<string, FieldSourceCode>>({})
  const fieldRawData = reactive<Record<string, any>>({})
  const remoteOptions = reactive<Record<string, FieldSourceOption[]>>({})
  // 记录用户通过来源下拉选中的值，用来区分“选择来源”和“手动输入”。
  const selectedSourceValues = reactive<Record<string, any>>({})
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
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
      return a.every((value, index) => isSameValue(value, b[index]))
    }

    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const aKeys = Object.keys(a).sort()
      const bKeys = Object.keys(b).sort()
      return aKeys.length === bKeys.length &&
        aKeys.every((key, index) => key === bKeys[index] && isSameValue(a[key], b[key]))
    }

    const normalizeText = (value: unknown) => String(value ?? '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
    const aText = normalizeText(a)
    const bText = normalizeText(b)
    const numericPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

    if (typeof a !== 'boolean' && typeof b !== 'boolean' &&
      numericPattern.test(aText) && numericPattern.test(bText)) {
      return Number(aText) === Number(bText)
    }
    return aText === bText
  }

  function rebuildUserModified() {
    if (applyingData) return
    const next = new Set<string>()
    for (const field of Object.keys(form)) {
      if (field === 'remark') continue
      if (Object.prototype.hasOwnProperty.call(selectedSourceValues, field)) {
        if (isSameValue(form[field], selectedSourceValues[field])) {
          next.add(field)
          continue
        }
        delete selectedSourceValues[field]
      }
      if (fieldSource[field] === 'user' || !isSameValue(form[field], userBaseline[field])) {
        next.add(field)
        fieldSource[field] = 'user'
        delete fieldRawData[field]
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
    const modified = userModifiedFields.value.has(field) || source === 'user'
    if (source === 'conflict') return 'bg-conflict'
    if (!hasFieldValue(field)) {
      const classes = []
      if (!hasDefault(field)) {
        // 板材品牌、板材型号为非必填项；无默认值且未收到返回值时使用浅灰色。
        classes.push(field === 'materialBrand' || field === 'materialVersion' ? 'bg-light-gray' : 'bg-light-red')
      }
      if (modified) classes.push('font-blue')
      return classes.join(' ')
    }
    if (source === 'ai') return modified ? 'bg-green font-blue' : 'bg-green'
    if (source === 'cam') {
      const selectedByUser = Object.prototype.hasOwnProperty.call(selectedSourceValues, field)
      return selectedByUser ? 'bg-cam-selected font-blue' : 'bg-orange'
    }
    if (modified) return 'font-blue'
    if (source === 'server default' || source === 'system default' || source === 'default algorithm rule') return ''
    return hasDefault(field) ? '' : 'bg-light-red'
  }

  function sourceLabel(field: string): string {
    const source = fieldSource[field]
    if (source === 'conflict') return '数据有冲突'
    if (!hasFieldValue(field)) return ''
    if (source === 'user') return '用户修改'
    if (source === 'ai') return 'AI提参'
    if (source === 'cam') return 'CAM提参'
    if (source === 'system default') return '系统默认'
    if (source === 'server default') return '默认行业标准'
    if (source === 'default algorithm rule') return '默认算法规则'
    if (systemDefaultFields.has(field)) return '系统默认'
    return hasDefault(field) ? '默认行业标准' : ''
  }

  function sourceClass(field: string): string {
    const source = fieldSource[field]
    if (source === 'conflict') return 'badge conflict'
    if (!hasFieldValue(field)) return 'badge empty'
    if (source === 'user') return 'badge user'
    if (source === 'ai') return 'badge ai'
    if (source === 'cam') return 'badge extracted'
    if (source === 'default algorithm rule') return 'badge algorithm'
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

    const currentSource = fieldSource[field]
    if (currentSource === 'default algorithm rule' && hasFieldValue(field)) {
      result.push({
        id: `algorithm:${field}`,
        kind: 'current',
        label: '默认算法规则',
        source: currentSource,
        value: cloneFieldValue(form[field]),
      })
    }
    if (sourceLabel(field) && result.length === 0 && currentSource !== 'conflict' && currentSource !== 'user') {
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

  function showSourceOptionValues(field: string): boolean {
    return conflictMode && (remoteOptions[field]?.length || 0) > 1
  }

  function clearValue(field: string): any {
    const initialValue = initialValues[field]
    if (Array.isArray(initialValue)) return []
    return typeof initialValue === 'string' ? '' : null
  }

  function snapshotBaseline(fields = Object.keys(form)) {
    for (const field of fields) userBaseline[field] = cloneFieldValue(form[field])
  }

  /** 将页面公式或联动生成的字段标记为默认算法规则，并作为新的用户修改基准。 */
  function markDefaultAlgorithmFields(fields: string[]) {
    for (const field of fields) {
      if (hasFieldValue(field)) fieldSource[field] = 'default algorithm rule'
      else delete fieldSource[field]
      delete fieldRawData[field]
      delete selectedSourceValues[field]
      userBaseline[field] = cloneFieldValue(form[field])
    }
    rebuildUserModified()
  }

  function resolveInitialCandidate(candidates: FieldSourceOption[]): {
    candidate?: FieldSourceOption
    conflict: boolean
  } {
    if (candidates.length === 0) return { conflict: false }
    if (candidates.length === 1) return { candidate: candidates[0], conflict: false }

    // 非冲突版本只接收单对象；意外收到候选数组时不擅自选择其中一条。
    if (!conflictMode) return { conflict: false }

    const aiCandidates = candidates.filter(candidate => candidate.source === 'ai')
    const camCandidates = candidates.filter(candidate => candidate.source === 'cam')

    if (aiCandidates.length && camCandidates.length) {
      const firstAi = aiCandidates[0]
      const valuesDiffer = [...aiCandidates, ...camCandidates]
        .some(candidate => !isSameValue(candidate.value, firstAi.value))
      return valuesDiffer
        ? { conflict: true }
        : { candidate: firstAi, conflict: false }
    }

    // 只有 AI 或只有 CAM 时，均按后端顺序采用第一条。
    if (aiCandidates.length) return { candidate: aiCandidates[0], conflict: false }
    if (camCandidates.length) return { candidate: camCandidates[0], conflict: false }

    // 未识别来源的多条候选仍按冲突处理，避免静默选错数据。
    return { conflict: true }
  }

  async function selectSource(field: string, optionId: string) {
    const selected = sourceOptions(field).find(option => option.id === optionId)
    if (!selected) return
    applyingData = true
    try {
      form[field] = cloneFieldValue(selected.value)
      fieldSource[field] = selected.source
      if (selected.raw) fieldRawData[field] = selected.raw
      else delete fieldRawData[field]
      await nextTick()
      selectedSourceValues[field] = cloneFieldValue(form[field])
      userModifiedFields.value = new Set([...userModifiedFields.value, field])
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
      for (const map of [fieldSource, fieldRawData, remoteOptions, selectedSourceValues]) {
        for (const key of Object.keys(map)) delete map[key]
      }
      userModifiedFields.value = new Set()

      for (const field of Object.keys(form)) {
        // 备注由页面规则维护。重复同步相同参数时，字段最终值没有变化，
        // Vue 不会再次触发对应 watcher；此处若清空备注会导致超 P10 提示丢失。
        if (field === 'remark') continue
        form[field] = cloneFieldValue(initialValues[field])
        if (hasDefault(field)) fieldSource[field] = defaultSource(field)
      }

      for (const field of Object.keys(data)) {
        if (!(field in form)) continue
        const candidates = normalizeRemoteOptions(field, data[field], systemDefaultFields.has(field))
          .map(candidate => ({ ...candidate, value: coerceValue(field, candidate.value) }))
          .filter(candidate => hasMeaningfulValue(candidate.value))
        remoteOptions[field] = candidates
        const resolution = resolveInitialCandidate(candidates)
        if (resolution.candidate) {
          const candidate = resolution.candidate
          form[field] = cloneFieldValue(candidate.value)
          fieldSource[field] = candidate.source
          fieldRawData[field] = candidate.raw
          // 指定制程能力字段只有 CAM 候选时，直接按用户已确认 CAM 的状态展示。
          if (autoConfirmedCamFields.has(field) && candidates.every(item => item.source === 'cam')) {
            selectedSourceValues[field] = cloneFieldValue(form[field])
          }
        } else if (resolution.conflict) {
          console.warn('[字段来源冲突]', {
            field,
            candidates: candidates.map(candidate => ({
              source: candidate.source,
              value: candidate.value,
              valueType: Array.isArray(candidate.value) ? 'array' : typeof candidate.value,
            })),
          })
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
    showSourceOptionValues,
    selectSource,
    markDefaultAlgorithmFields,
    applyFieldData,
  }
}
