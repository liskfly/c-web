export type ThicknessToleranceUnit = 'mm' | '%'

export interface ParsedThicknessTolerance {
  amount: number
  unit: ThicknessToleranceUnit
}

export interface P10ThicknessToleranceEvaluation {
  exceeds: boolean
  limitText: '+/-0.10mm' | '+/-10%'
}

const THICKNESS_TOLERANCE_PATTERN = /^\+\/-(\d+(?:\.\d+)?)(mm|%)$/
const COMPARISON_EPSILON = 1e-9

/** 板厚公差标准格式：+/-数字mm 或 +/-数字%。 */
export function parseThicknessTolerance(value: unknown): ParsedThicknessTolerance | null {
  if (typeof value !== 'string') return null
  const match = value.match(THICKNESS_TOLERANCE_PATTERN)
  if (!match) return null

  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return null

  return {
    amount,
    unit: match[2] as ThicknessToleranceUnit,
  }
}

export function isThicknessToleranceFormatValid(value: unknown): boolean {
  return parseThicknessTolerance(value) !== null
}

/**
 * P10 板厚公差能力：
 * - 成品板厚 < 1.0mm：+/-0.10mm
 * - 成品板厚 >= 1.0mm：+/-10%
 *
 * 用户可输入 mm 或 %，比较前会按照成品板厚换算成能力标准使用的单位。
 */
export function evaluateP10ThicknessTolerance(
  boardThickness: unknown,
  tolerance: unknown,
): P10ThicknessToleranceEvaluation | null {
  if (boardThickness === null || boardThickness === undefined || boardThickness === '') return null

  const thickness = Number(boardThickness)
  const parsed = parseThicknessTolerance(tolerance)
  if (!Number.isFinite(thickness) || thickness <= 0 || !parsed) return null

  if (thickness < 1.0) {
    const toleranceInMm = parsed.unit === 'mm'
      ? parsed.amount
      : thickness * parsed.amount / 100
    return {
      exceeds: toleranceInMm - 0.1 > COMPARISON_EPSILON,
      limitText: '+/-0.10mm',
    }
  }

  const toleranceInPercent = parsed.unit === '%'
    ? parsed.amount
    : parsed.amount / thickness * 100
  return {
    exceeds: toleranceInPercent - 10 > COMPARISON_EPSILON,
    limitText: '+/-10%',
  }
}
