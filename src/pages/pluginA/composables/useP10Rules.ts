import { computed, watch } from 'vue'
import { evaluateP10ThicknessTolerance } from '../domain/thicknessTolerance'

export function useP10Rules(form: Record<string, any>) {
  const showPanelFields = computed(() => form.setMethod === '客户拼板')
  // 外形要求：客户拼板/单片加工艺边 时必填，其他情况非必填
  const requireClientPanelSeparation = computed(() => form.setMethod === '客户拼板' || form.setMethod === '单片加工艺边')
  // 单片无拼板时清空外形要求；客户拼板/单片加工艺边时默认 拼板+V-CUT交货
  watch(() => form.setMethod, (val) => {
    if (val === '单片无拼板') form.clientPanelSeparation = ''
    else if (val === '客户拼板' || val === '单片加工艺边') form.clientPanelSeparation = '拼板+V-CUT交货'
  })
  const showEnigGold = computed(() => form.surfaceFinish === '沉金')
  const showGoldFinger = computed(() => form.goldFingerType !== '无')
  const hasInnerLayer = computed(() => Number(form.layerCount) > 2)
  // 层数超过 20 提醒
  watch(() => form.layerCount, (val) => {
    const n = Number(val)
    const KEY = 'LAYER_COUNT_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (Number.isFinite(n) && n > 20) {
      form.remark.push(KEY + '|' + '板子层数超过20,走线下下单模式进行')
    }
  })

  // 盲埋孔提醒：选是则超出P10能力，走线下下单模式
  watch(() => form.blindVia, (val) => {
    const KEY = 'BLIND_VIA_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (val) {
      form.remark.push(KEY + '|' + '盲埋孔：超出P10工厂能力，走线下下单模式进行')
    }
  })

  // 内层基铜厚度超范围提醒（层数 > 2 且内层基铜 > 2oz）
  watch([() => form.layerCount, () => form.innerCopperThickness], () => {
    const n = Number(form.innerCopperThickness)
    const KEY = 'INNER_COPPER_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (Number(form.layerCount) > 2 && Number.isFinite(n) && n > 2) {
      form.remark.push(KEY + '|' + '内层基铜厚度：超出P10工厂2oz铜厚的项目，走线下下单模式进行')
    }
  })

  // 外层基铜厚度超范围提醒
  watch(() => form.outerBaseCopperThickness, (val) => {
    const n = Number(val)
    const KEY = 'OUTER_BASE_COPPER_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (Number.isFinite(n) && n > 70) {
      form.remark.push(KEY + '|' + '外层基铜厚度：超出P10工厂基铜70um（完成105um）铜厚的项目，走线下下单模式进行;')
    }
  })

  // 外层完成铜厚度超范围提醒
  watch(() => form.outerCopperThickness, (val) => {
    const n = Number(val)
    const KEY = 'OUTER_COPPER_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (Number.isFinite(n) && n > 105) {
      form.remark.push(KEY + '|' + '外层完成铜厚度：超出P10工厂105um铜厚的项目，走线下下单模式进行，支持系统录入下单和成本核算；')
    }
  })

  // 最小沉金金厚超范围提醒（表面处理=沉金 且 金厚 > 0.0762）
  watch([() => form.surfaceFinish, () => form.enigGoldThickness], () => {
    const n = Number(form.enigGoldThickness)
    const KEY = 'ENIG_GOLD_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (form.surfaceFinish === '沉金' && Number.isFinite(n) && n > 0.0762) {
      form.remark.push(KEY + '|' + '最小沉金金厚：超出P10工厂0.0762um沉金厚度的项目，走线下下单模式进行；')
    }
  })

  // 最小孔铜超范围提醒
  watch(() => form.holeCopperThickness, (val) => {
    const n = Number(val)
    const KEY = 'HOLE_COPPER_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (Number.isFinite(n) && n > 25.4) {
      form.remark.push(KEY + '|' + '最小孔铜：超出P10工厂25.4um孔铜的项目，走线下下单模式进行')
    }
  })

  // 外层最小线宽超范围提醒（< 3mil）
  watch(() => form.minTraceWidthOuter, (val) => {
    const n = Number(val)
    const KEY = 'MIN_TRACE_WIDTH_OUTER_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (val !== null && val !== undefined && val !== '' && Number.isFinite(n) && n > 0 && n < 3) {
      form.remark.push(KEY + '|' + '外层最小线宽：小于3mil，超出P10工厂能力，走线下下单模式进行')
    }
  })

  // 外层最小线距超范围提醒（< 3mil）
  watch(() => form.minTraceSpacingOuter, (val) => {
    const n = Number(val)
    const KEY = 'MIN_TRACE_SPACING_OUTER_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (val !== null && val !== undefined && val !== '' && Number.isFinite(n) && n > 0 && n < 3) {
      form.remark.push(KEY + '|' + '外层最小线距：小于3mil，超出P10工厂能力，走线下下单模式进行')
    }
  })

  // 内层最小线宽超范围提醒（层数>2 且 < 2.5mil）
  watch([() => form.layerCount, () => form.minTraceWidthInner], () => {
    const n = Number(form.minTraceWidthInner)
    const KEY = 'MIN_TRACE_WIDTH_INNER_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    const v = form.minTraceWidthInner
    if (Number(form.layerCount) > 2 && v !== null && v !== undefined && v !== '' && Number.isFinite(n) && n > 0 && n < 2.5) {
      form.remark.push(KEY + '|' + '内层最小线宽：小于2.5mil，超出P10工厂能力，走线下下单模式进行')
    }
  })

  // 内层最小线距超范围提醒（层数>2 且 < 2.5mil）
  watch([() => form.layerCount, () => form.minTraceSpacingInner], () => {
    const n = Number(form.minTraceSpacingInner)
    const KEY = 'MIN_TRACE_SPACING_INNER_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    const v = form.minTraceSpacingInner
    if (Number(form.layerCount) > 2 && v !== null && v !== undefined && v !== '' && Number.isFinite(n) && n > 0 && n < 2.5) {
      form.remark.push(KEY + '|' + '内层最小线距：小于2.5mil，超出P10工厂能力，走线下下单模式进行')
    }
  })

  // 最小孔径超范围提醒（< 0.15mm）
  watch(() => form.minHoleSize, (val) => {
    const n = Number(val)
    const KEY = 'MIN_HOLE_SIZE_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (val !== null && val !== undefined && val !== '' && Number.isFinite(n) && n > 0 && n < 0.15) {
      form.remark.push(KEY + '|' + '最小孔径：小于0.15mm，超出P10工厂能力，走线下下单模式进行')
    }
  })

  // 外形公差超范围提醒（< 0.1mm 超出P10能力）
  watch(() => form.dimensionTolerance, (val) => {
    const KEY = 'DIMENSION_TOLERANCE_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    const n = Number(val)
    if (val !== null && val !== undefined && val !== '' && Number.isFinite(n) && n > 0 && n < 0.1) {
      form.remark.push(KEY + '|' + '外形公差：小于0.1mm，超出P10工厂能力，走线下下单模式进行')
    }
  })

  // 阻焊颜色提醒（红色超P10能力）
  watch(() => form.solderMaskColor, (val) => {
    const KEY = 'SOLDER_MASK_COLOR_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (val === '红色') {
      form.remark.push(KEY + '|' + '阻焊颜色：红色超出P10工厂能力，走线下下单模式进行')
    }
  })

  // 字符颜色提醒（仅支持 白色字符/黑色字符/不印字符）
  watch(() => form.silkscreenColor, (val) => {
    const KEY = 'SILKSCREEN_COLOR_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (val && !['白色字符', '黑色字符', '不印字符'].includes(val)) {
      form.remark.push(KEY + '|' + '字符颜色：超出P10工厂能力（仅支持白色字符、黑色字符、不印字符），走线下下单模式进行')
    }
  })

  // 表面处理提醒（仅支持清单内处理方式）
  watch(() => form.surfaceFinish, (val) => {
    const KEY = 'SURFACE_FINISH_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (val && !['沉金', '无铅喷锡', 'OSP', '喷锡', '沉银', '沉锡', '无需表面处理'].includes(val)) {
      form.remark.push(KEY + '|' + '表面处理：超出P10工厂能力（仅支持沉金、无铅喷锡、OSP、喷锡、沉银、沉锡、无需表面处理），走线下下单模式进行')
    }
  })

  // 验收标准提醒（仅支持 IPC 2 / IPC 3）
  watch(() => form.acceptanceStandard, (val) => {
    const KEY = 'ACCEPTANCE_STANDARD_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (val && !['IPC 2', 'IPC 3'].includes(val)) {
      form.remark.push(KEY + '|' + '验收标准：超出P10工厂能力（仅支持IPC 2、IPC 3），走线下下单模式进行')
    }
  })

  // 周期格式提醒（仅支持 WWYY/YYWW/MMYY/YYMM/DDMMYY/YYMMDD）
  watch(() => form.periodFormat, (val) => {
    const KEY = 'PERIOD_FORMAT_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (val && !['WWYY', 'YYWW', 'MMYY', 'YYMM', 'DDMMYY', 'YYMMDD'].includes(val)) {
      form.remark.push(KEY + '|' + '周期格式：超出P10工厂能力（仅支持WWYY、YYWW、MMYY、YYMM、DDMMYY、YYMMDD），走线下下单模式进行')
    }
  })

  // 测试要求提醒（仅支持清单内测试项）
  watch(() => form.testRequirements, (val) => {
    const KEY = 'TEST_REQUIREMENTS_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    const allowed = ['电感测试', '损耗', '耐电压测试', '孔电阻测试', '线电阻测试', '不需要', '飞针测试', '夹具测试']
    const list = Array.isArray(val) ? val : []
    const invalid = list.filter((v: string) => !allowed.includes(v))
    if (invalid.length) {
      form.remark.push(KEY + '|' + `测试要求：超出P10工厂能力（${invalid.join('、')}），走线下下单模式进行`)
    }
  })

  // 出货报告提醒（仅支持清单内报告项）
  watch(() => form.shippingReports, (val) => {
    const KEY = 'SHIPPING_REPORTS_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    const allowed = ['最终产品检查报告', '回流焊测试报告', '可焊性测试报告', '离子污染度测试报告', '耐电压测试报告', '热应力检测报告', '不需要']
    const list = Array.isArray(val) ? val : []
    const invalid = list.filter((v: string) => !allowed.includes(v))
    if (invalid.length) {
      form.remark.push(KEY + '|' + `出货报告：超出P10工厂能力（${invalid.join('、')}），走线下下单模式进行`)
    }
  })

  // 特殊工艺提醒（仅支持清单内工艺项）
  watch(() => form.specialProcesses, (val) => {
    const KEY = 'SPECIAL_PROCESSES_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    const allowed = ['电镀填孔', '金属包边', '金属化半孔', '背钻孔', '锥形孔', '阶梯孔', '铣阶梯槽', '控深钻', '不需要']
    const list = Array.isArray(val) ? val : []
    const invalid = list.filter((v: string) => !allowed.includes(v))
    if (invalid.length) {
      form.remark.push(KEY + '|' + `特殊工艺：超出P10工厂能力（${invalid.join('、')}），走线下下单模式进行`)
    }
  })

  // 成品板厚联动板厚公差 & 超范围提醒（P10 范围：0.6~3.5mm）
  watch(() => form.boardThickness, (val) => {
    const n = Number(val)
    if (val !== null && val !== undefined && val !== '' && Number.isFinite(n)) {
      form.thicknessTolerance = n < 1.0 ? '+/-0.10mm' : '+/-10%'
    }
    const KEY = 'BOARD_THICKNESS_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (Number.isFinite(n) && n > 0 && (n < 0.6 || n > 3.5)) {
      form.remark.push(KEY + '|' + '成品板厚：超出P10工厂能力（0.6~3.5mm范围），走线下下单模式进行')
    }
  })

  // 板厚公差按成品板厚换算后判断是否超出 P10 能力；格式错误由提交校验负责拦截。
  watch([() => form.boardThickness, () => form.thicknessTolerance], () => {
    const KEY = 'THICKNESS_TOLERANCE_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    const evaluation = evaluateP10ThicknessTolerance(form.boardThickness, form.thicknessTolerance)
    if (evaluation?.exceeds) {
      form.remark.push(
        KEY + '|' + `板厚公差：${form.thicknessTolerance}超出P10工厂能力（当前成品板厚对应能力为${evaluation.limitText}），走线下下单模式进行`,
      )
    }
  }, { immediate: true })

  // 翘曲度超范围提醒（< 0.5% 超出P10能力）
  watch(() => form.maxWarpage, (val) => {
    const KEY = 'WARPAGE_LIMIT'
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    const match = String(val ?? '').match(/[0-9]*\.?[0-9]+/)
    const n = match ? Number(match[0]) : NaN
    if (Number.isFinite(n) && n > 0 && n < 0.5) {
      form.remark.push(KEY + '|' + '翘曲度：小于0.5%，超出P10工厂能力，走线下下单模式进行')
    }
  })
  // ==================== P10 超能力汇总（提交订单时用于人工审核参数） ====================
  // 汇总所有超P10项，每条 "字段中文名：值，超制程;"
  function collectP10Reasons(): string[] {
    const reasons: string[] = []
    const add = (label: string, value: string) => reasons.push(`${label}：${value}，超制程;`)
    const hasVal = (v: any) => v !== null && v !== undefined && v !== ''
    const num = (v: any) => Number(v)
    const numOver = (v: any, t: number) => hasVal(v) && Number.isFinite(num(v)) && num(v) > t
    const numBelow = (v: any, t: number) => hasVal(v) && Number.isFinite(num(v)) && num(v) > 0 && num(v) < t
    const layerCount = num(form.layerCount)
    const innerLayer = Number.isFinite(layerCount) && layerCount > 2
    // 板子层数
    if (hasVal(form.layerCount) && Number.isFinite(layerCount) && layerCount > 20) add('板子层数', `${form.layerCount}层`)
    // 盲埋孔
    if (form.blindVia) add('盲埋孔', '是')
    // 内层基铜厚度
    if (innerLayer && numOver(form.innerCopperThickness, 2)) add('内层基铜厚度', `${form.innerCopperThickness}oz`)
    // 外层基铜厚度
    if (numOver(form.outerBaseCopperThickness, 70)) add('外层基铜厚度', `${form.outerBaseCopperThickness}um`)
    // 外层完成铜厚度
    if (numOver(form.outerCopperThickness, 105)) add('外层完成铜厚度', `${form.outerCopperThickness}um`)
    // 最小沉金金厚
    if (form.surfaceFinish === '沉金' && numOver(form.enigGoldThickness, 0.0762)) add('最小沉金金厚', `${form.enigGoldThickness}um`)
    // 最小孔铜
    if (numOver(form.holeCopperThickness, 25.4)) add('最小孔铜', `${form.holeCopperThickness}um`)
    // 成品板厚
    if (hasVal(form.boardThickness) && Number.isFinite(num(form.boardThickness)) && num(form.boardThickness) > 0 && (num(form.boardThickness) < 0.6 || num(form.boardThickness) > 3.5)) add('成品板厚', `${form.boardThickness}mm`)
    // 板厚公差
    const thicknessToleranceEvaluation = evaluateP10ThicknessTolerance(form.boardThickness, form.thicknessTolerance)
    if (thicknessToleranceEvaluation?.exceeds) add('板厚公差', String(form.thicknessTolerance))
    // 外形公差
    if (numBelow(form.dimensionTolerance, 0.1)) add('外形公差', `${form.dimensionTolerance}mm`)
    // 翘曲度
    {
      const m = String(form.maxWarpage ?? '').match(/[0-9]*\.?[0-9]+/)
      const wn = m ? Number(m[0]) : NaN
      if (Number.isFinite(wn) && wn > 0 && wn < 0.5) add('翘曲度', `${wn}%`)
    }
    // 外层最小线宽/线距
    if (numBelow(form.minTraceWidthOuter, 3)) add('外层最小线宽', `${form.minTraceWidthOuter}mil`)
    if (numBelow(form.minTraceSpacingOuter, 3)) add('外层最小线距', `${form.minTraceSpacingOuter}mil`)
    // 内层最小线宽/线距
    if (innerLayer && numBelow(form.minTraceWidthInner, 2.5)) add('内层最小线宽', `${form.minTraceWidthInner}mil`)
    if (innerLayer && numBelow(form.minTraceSpacingInner, 2.5)) add('内层最小线距', `${form.minTraceSpacingInner}mil`)
    // 最小孔径
    if (numBelow(form.minHoleSize, 0.15)) add('最小孔径', `${form.minHoleSize}mm`)
    // 阻焊颜色
    if (form.solderMaskColor === '红色') add('阻焊颜色', '红色')
    // 字符颜色
    if (form.silkscreenColor && !['白色字符', '黑色字符', '不印字符'].includes(form.silkscreenColor)) add('字符颜色', form.silkscreenColor)
    // 表面处理
    if (form.surfaceFinish && !['沉金', '无铅喷锡', 'OSP', '喷锡', '沉银', '沉锡', '无需表面处理'].includes(form.surfaceFinish)) add('表面处理', form.surfaceFinish)
    // 验收标准
    if (form.acceptanceStandard && !['IPC 2', 'IPC 3'].includes(form.acceptanceStandard)) add('验收标准', form.acceptanceStandard)
    // 周期格式
    if (form.periodFormat && !['WWYY', 'YYWW', 'MMYY', 'YYMM', 'DDMMYY', 'YYMMDD'].includes(form.periodFormat)) add('周期格式', form.periodFormat)
    // 测试要求 / 出货报告 / 特殊工艺：清单外项
    const listInvalid = (val: any, allowed: string[]) => Array.isArray(val) ? (val as string[]).filter((v: string) => !allowed.includes(v)) : []
    const testInvalid = listInvalid(form.testRequirements, ['电感测试', '损耗', '耐电压测试', '孔电阻测试', '线电阻测试', '不需要', '飞针测试', '夹具测试'])
    if (testInvalid.length) add('测试要求', testInvalid.join('、'))
    const shipInvalid = listInvalid(form.shippingReports, ['最终产品检查报告', '回流焊测试报告', '可焊性测试报告', '离子污染度测试报告', '耐电压测试报告', '热应力检测报告', '不需要'])
    if (shipInvalid.length) add('出货报告', shipInvalid.join('、'))
    const spInvalid = listInvalid(form.specialProcesses, ['电镀填孔', '金属包边', '金属化半孔', '背钻孔', '锥形孔', '阶梯孔', '铣阶梯槽', '控深钻', '不需要'])
    if (spInvalid.length) add('特殊工艺', spInvalid.join('、'))
    // PCS / SET 尺寸超限
    const pw = num(form.pcsSizeWidth)
    const ph = num(form.pcsSizeHeight)
    const sw = num(form.setSizeWidth)
    const sh = num(form.setSizeHeight)
    const sizeInvalid = (w: number, h: number) => Number.isFinite(w) && Number.isFinite(h) && ((w > 571.5 && (h <= 0 || h > 419.1)) || (h > 571.5 && (w <= 0 || w > 419.1)))
    if (sizeInvalid(pw, ph)) add('PCS尺寸', `${form.pcsSizeWidth}x${form.pcsSizeHeight}mm`)
    if (sizeInvalid(sw, sh)) add('SET尺寸', `${form.setSizeWidth}x${form.setSizeHeight}mm`)
    return reasons
  }

  const computedDrillDensity = computed(() => {
    const v = form.clientPanelVertical
    const h = form.throughHoleQty
    const w = form.setSizeWidth
    const sh = form.setSizeHeight
    if (v && h && w && sh && w > 0 && sh > 0) {
      return ((v * h) / (w * sh / 1000000) / 10000).toFixed(3)
    }
    return ''
  })

  return {
    showPanelFields,
    requireClientPanelSeparation,
    showEnigGold,
    showGoldFinger,
    hasInnerLayer,
    collectP10Reasons,
    computedDrillDensity,
  }
}
