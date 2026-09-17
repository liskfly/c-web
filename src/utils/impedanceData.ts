export interface ImpedanceFormRow {
  impType: string
  controlLayer: string
  refLayerTop: string
  refLayerBottom: string
  isCoated: boolean
  lineWidth: number | null
  lineSpacing: number | null
  lineToCopper: number | null
  impTarget: number | null
  impTol: number | null
  impOhmTol: number | null
  _refTopError?: string
  _refBottomError?: string
}

export interface ImpedancePayloadRow {
  impType: string
  controlLayer: string
  refLayerTop: string
  refLayerBottom: string
  isCoated: '是' | ''
  lineWidth: string
  lineSpacing: string
  lineToCopper: string
  要求: string
  '公差(%)': string
  '公差(ohm)': string
}

function unwrapTableValue(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  const record = input as Record<string, unknown>
  return record.value ?? record.impedanceTable ?? record.impList ?? input
}

/** 优先读取标准字段 impedanceTable，同时兼容旧字段 impList。 */
export function extractImpedanceList(data: Record<string, any> | null | undefined): unknown[] | null {
  if (!data || typeof data !== 'object') return null
  let input = unwrapTableValue(data.impedanceTable ?? data.impList)
  if (!Array.isArray(input)) return null

  // 兼容候选来源结构：[{ source: 'ai', value: [...] }]。
  const candidate = input.find(item => item && typeof item === 'object' && Array.isArray(item.value))
  if (candidate) input = candidate.value
  return Array.isArray(input) ? input : null
}

function toText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['true', '1', 'yes', '是'].includes(normalized)
}

/** 将 Qt/后端返回的 impedanceTable 或旧 impList 转成页面表格结构。 */
export function normalizeImpedanceRows(input: unknown[]): ImpedanceFormRow[] {
  return input.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    return [{
      impType: toText(row.impType),
      controlLayer: toText(row.controlLayer),
      refLayerTop: toText(row.refLayerTop),
      refLayerBottom: toText(row.refLayerBottom),
      isCoated: toBoolean(row.isCoated),
      lineWidth: toNumberOrNull(row.lineWidth),
      lineSpacing: toNumberOrNull(row.lineSpacing),
      lineToCopper: toNumberOrNull(row.lineToCopper),
      impTarget: toNumberOrNull(row.impTarget ?? row['要求']),
      impTol: toNumberOrNull(row.impTol ?? row['公差(%)']),
      impOhmTol: toNumberOrNull(row.impOhmTol ?? row['公差(ohm)']),
    }]
  })
}

function payloadNumber(value: unknown): string {
  const number = toNumberOrNull(value)
  return number === null ? '' : String(number)
}

/** 按后端/Qt 当前使用的 impedanceTable 行格式输出。 */
export function serializeImpedanceRows(rows: ImpedanceFormRow[]): ImpedancePayloadRow[] {
  // 页面会按层数生成空白占位行；只有填写了实际阻抗参数的行才属于 impedanceTable。
  return rows.filter(row => [
    row.lineWidth,
    row.lineSpacing,
    row.lineToCopper,
    row.impTarget,
    row.impOhmTol,
  ].some(value => toNumberOrNull(value) !== null)).map(row => ({
    impType: toText(row.impType),
    controlLayer: toText(row.controlLayer),
    refLayerTop: toText(row.refLayerTop),
    refLayerBottom: toText(row.refLayerBottom),
    isCoated: row.isCoated ? '是' : '',
    lineWidth: payloadNumber(row.lineWidth),
    lineSpacing: payloadNumber(row.lineSpacing),
    lineToCopper: payloadNumber(row.lineToCopper),
    要求: payloadNumber(row.impTarget),
    '公差(%)': payloadNumber(row.impTol),
    '公差(ohm)': payloadNumber(row.impOhmTol),
  }))
}
