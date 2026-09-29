export const INDUSTRY_STANDARD_QUOTE_FIELDS = [
  'materialType',
  'boardThickness',
  'outerCopperThickness',
  'outerBaseCopperThickness',
  'innerCopperThickness',
  'surfaceFinish',
] as const

export const INDUSTRY_STANDARD_QUOTE_WARNING =
  '此项目资料未提供具体的加工工艺要求，系统将按行业标准要求默认值录入报价核算成本，仅供参考，请确认是否继续；'
