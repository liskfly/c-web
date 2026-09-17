export interface StackupFormRow {
  layerName: string
  material: string
  pcbMaterialType: string
  copperThickness: string | number | null
  dielectricThickness: number | null
  dk: number | null
}

export interface StackupPayloadRow {
  layerName: string
  material: string
  pcbMaterialType: string
  copperThickness: string
  dielectricThickness: string
  dk: string
}

function unwrapTableValue(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  const record = input as Record<string, unknown>
  return record.value ?? record.stackupTable ?? record.stackupList ?? input
}

/** 优先读取标准字段 stackupTable，同时兼容旧字段 stackupList。 */
export function extractStackupList(data: Record<string, any> | null | undefined): unknown[] | null {
  if (!data || typeof data !== 'object') return null
  let input = unwrapTableValue(data.stackupTable ?? data.stackupList)
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

function normalizeMaterial(value: unknown): string {
  const material = toText(value).trim()
  const upper = material.toUpperCase()
  if (upper === 'CU' || upper === 'PP' || upper === 'CORE') return upper
  return material
}

function normalizeCopperThickness(value: unknown): string | number | null {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : String(value)
}

/** 转换返回数据；配本、RC 等非页面字段会被有意忽略。 */
export function normalizeStackupRows(input: unknown[]): StackupFormRow[] {
  return input.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    return [{
      layerName: toText(row.layerName),
      material: normalizeMaterial(row.material),
      pcbMaterialType: toText(row.pcbMaterialType),
      copperThickness: normalizeCopperThickness(row.copperThickness),
      dielectricThickness: toNumberOrNull(row.dielectricThickness),
      dk: toNumberOrNull(row.dk),
    }]
  })
}

function payloadValue(value: unknown): string {
  return value === undefined || value === null || value === '' ? '' : String(value)
}

/** 只传页面原有字段，不包含返回数据中的配本、RC。 */
export function serializeStackupRows(rows: StackupFormRow[]): StackupPayloadRow[] {
  return rows.map(row => ({
    layerName: payloadValue(row.layerName),
    material: payloadValue(row.material),
    pcbMaterialType: payloadValue(row.pcbMaterialType),
    copperThickness: payloadValue(row.copperThickness),
    dielectricThickness: payloadValue(row.dielectricThickness),
    dk: payloadValue(row.dk),
  }))
}
