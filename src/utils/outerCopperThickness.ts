const FINISHED_TO_BASE_LOW = [8, 12, 18]
const FINISHED_TO_BASE_HIGH = [8, 12, 18, 35, 52.5, 70, 87.5, 105, 140, 175, 210]
const BASE_TO_FINISHED_LOW = [18, 35, 52.5]
const BASE_TO_FINISHED_HIGH = [70, 87.5, 105, 140, 175, 210]

/** 判断提参字段是否确实返回了可用值，兼容纯值、{ value } 和候选数组。 */
export function hasProvidedCopperThickness(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasProvidedCopperThickness)
  if (value && typeof value === 'object') {
    const entry = value as Record<string, unknown>
    return 'value' in entry && hasProvidedCopperThickness(entry.value)
  }
  if (typeof value === 'string') return value.trim() !== ''
  return value !== undefined && value !== null
}

function nearest(value: number, candidates: readonly number[]) {
  return candidates.reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest,
  )
}

/**
 * 根据外层完成铜厚度推算外层基铜厚度。
 * 36um 边界归入低档；候选值等距时取较小值。
 */
export function calculateOuterBaseCopperThickness(finishedThickness: number) {
  const lowRange = finishedThickness <= 36
  const calculated = finishedThickness - (lowRange ? 18 : 35)
  return nearest(calculated, lowRange ? FINISHED_TO_BASE_LOW : FINISHED_TO_BASE_HIGH)
}

/**
 * 根据外层基铜厚度推算外层完成铜厚度。
 * 36um 边界归入低档；候选值等距时取较小值。
 */
export function calculateOuterFinishedCopperThickness(baseThickness: number) {
  const lowRange = baseThickness <= 36
  const calculated = baseThickness + (lowRange ? 18 : 35)
  return nearest(calculated, lowRange ? BASE_TO_FINISHED_LOW : BASE_TO_FINISHED_HIGH)
}
