<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted, watch } from 'vue'
import InvoiceSection from './components/InvoiceSection.vue'
import DeliverySection from './components/DeliverySection.vue'
import ParameterForm from './components/ParameterForm.vue'
import StackupSection from './components/StackupSection.vue'
import ImpedanceSection from './components/ImpedanceSection.vue'
import QuoteSummary from './components/QuoteSummary.vue'
import PaymentDialog from './components/PaymentDialog.vue'
import { orderCreate, unpaidAuditCallback } from '@/api/pcb'
import { pcbPayV2 } from '@/api/invoice'
import QRCode from 'qrcode'
import { materialRules, ppMap, versionDetailMap } from './config/materials'
import { defaultValues, fieldLabels, formOptions, initialForm } from './config/form'
import { useP10Rules } from './composables/useP10Rules'
import { useBoardStructure } from './composables/useBoardStructure'
import { usePaymentFlow } from './composables/usePaymentFlow'
import { useAutocompleteOptions } from './composables/useAutocompleteOptions'
import { usePanelSize } from './composables/usePanelSize'
import { isThicknessToleranceFormatValid } from './domain/thicknessTolerance'
import { ElMessage, ElMessageBox } from 'element-plus'
import { withErrorSource, type ErrorSource } from '@/utils/errorSource'

// ==================== 折叠 ====================
const sections = reactive<Record<string, boolean>>({ basic: true, process: true, custom: true, stackup: true, impedance: true, invoice: true, delivery: true })

// ==================== 表单 V7.0 ====================
const form = reactive<Record<string, any>>(JSON.parse(JSON.stringify(initialForm)))

// ==================== 字段状态颜色 ====================
const DEFAULT_VALUES: Record<string, any> = JSON.parse(JSON.stringify(defaultValues))

const userModifiedFields = ref<Set<string>>(new Set())
let applyingData = false

function hasDefault(f: string): boolean {
  const v = DEFAULT_VALUES[f]
  if (v === undefined || v === null || v === '') return false
  if (Array.isArray(v) && v.length === 0) return false
  return true
}

function fieldBgClass(f: string): string {
  // 背景色只由来源决定（有来源优先显示来源色，即使该字段有默认值）；用户改动不改变背景，只让字体变蓝
  let cls = ''
  const src = fieldSource[f]
  if (src === 'ai') cls = 'bg-green'
  else if (src === 'cam') cls = 'bg-orange'
  // 来源为服务端默认值：不改变背景色
  else if (src === 'server default') cls = ''
  else if (!hasDefault(f)) {
    // 板材品牌/板材型号：无来源时默认浅灰（可选项，非必填）
    cls = (f === 'materialBrand' || f === 'materialVersion') ? 'bg-light-gray' : 'bg-light-red'
  }
  if (userModifiedFields.value.has(f)) cls = cls ? `${cls} font-blue` : 'font-blue'
  return cls
}

// 用户手动修改标记：与“最近一次 Qt 同步后的值”对比（初始为默认值），
// Qt/AI 回传的不同值不算用户改动；flush: 'sync' 让 applyingData 保护在同步期间真正生效
let userBaseline: Record<string, any> = JSON.parse(JSON.stringify(DEFAULT_VALUES))
// 类型不敏感对比：组件回写导致的 字符串/数字 转换不算改动（如 el-input-number 把 "0.0" 归一化为 0）
function isSameValue(a: any, b: any): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b)
  // 一方是数字时按数值比较（容忍 "0.0" vs 0、"20" vs 20）；空值/布尔不参与数值比较
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
  const next = new Set<string>()
  for (const k of Object.keys(form)) {
    if (!isSameValue(form[k], userBaseline[k])) next.add(k)
  }
  userModifiedFields.value = next
}
watch(form, () => {
  if (applyingData) return
  rebuildUserModified()
}, { deep: true, flush: 'sync' })

// ==================== 选项 ====================
const opts = JSON.parse(JSON.stringify(formOptions)) as Record<string, any[]>

// 当前匹配到的 PP 型号（叠层生成时 PP 行“类型”的默认值）
const currentPpModel = ref('')

// 材料选项覆盖：板材种类按清单分类，芯板型号/品牌取清单中的全部值
opts.materialType = ['FR4', '高速板材', '高频板', 'PI']
opts.materialVersion = [...new Set(Object.values(materialRules).flatMap(r => r.versions))]
opts.materialBrand = ['生益', '联茂', '建滔', '华正', '超声', '松下', 'Isola', '台光', '台耀', '南亚', 'Rogers', 'Neclo', 'Arlon', '腾辉', '其它']
opts.materialTg = [{ value: false, label: '中TG' }, { value: true, label: '高TG' }]

// 材料字段旧值：弹窗提示不可更改时回滚
const prevMaterial: Record<string, any> = {
  materialType: form.materialType, materialVersion: form.materialVersion,
  materialBrand: form.materialBrand, materialTg: form.materialTg, halogenFree: form.halogenFree,
}
let materialConfirmOpen = false

function syncPrevMaterial() {
  prevMaterial.materialType = form.materialType
  prevMaterial.materialVersion = form.materialVersion
  prevMaterial.materialBrand = form.materialBrand
  prevMaterial.materialTg = form.materialTg
  prevMaterial.halogenFree = form.halogenFree
}

// 型号 → 所属板材种类（板材型号优先级最高，用于带出材料类型）
// 清单分类键 → 页面显示分类名（高速板材/高频板 等旧称呼）
const CATEGORY_ALIAS: Record<string, string> = { 'FR4': 'FR4', '高频': '高频板', '高速': '高速板材', 'PI': 'PI' }
const versionTypeMap: Record<string, string> = {}
for (const [typeName, rule] of Object.entries(materialRules)) {
  const displayName = CATEGORY_ALIAS[typeName] || typeName
  for (const v of rule.versions) versionTypeMap[v] = displayName
}

// 按芯板型号带出 材料类型/品牌/TG/无卤，并记录对应 PP 型号
function fillByVersion(version: string) {
  const d = versionDetailMap[version]
  if (!d) return
  form.materialType = versionTypeMap[version] || form.materialType
  form.materialBrand = d.brand
  form.materialTg = d.tg === '高TG'
  form.halogenFree = d.halogen
  currentPpModel.value = ppMap[version] || ''
}

// 数据到达后的材料匹配：仅当返回了型号时按型号带出；
// 无型号不做匹配（型号保持空），其余字段有传值用传值、没传值用默认值
function applyMaterialPriorityRules() {
  const version = form.materialVersion
  if (version && versionDetailMap[version]) {
    fillByVersion(version)
    // 型号匹配带出的项：来源标记为 AI提参（不算用户改动，不显示用户确认）
    ;['materialType','materialBrand','materialTg','halogenFree'].forEach(k => { fieldSource[k] = 'ai' })
    return
  }
  currentPpModel.value = ''
}

// 补出的值：来源标 AI提参 + 同步基准（不算用户改动）
function markAiAndBaseline(k: string) {
  fieldSource[k] = 'ai'
  userBaseline[k] = JSON.parse(JSON.stringify(form[k]))
}

// 外层完成铜厚度/外层基铜厚度互补规则：只传其一时按规则补另一个
// 只有基铜：完成铜 = 基铜 + (>=35 ? 35 : 18)
// 只有完成铜：>=70 → 基铜 = 完成铜-35；<56 → 完成铜-18；56~70 → 相等
// 两个都传按传值；都没传按默认值
function applyCopperRules(data: Record<string, any>) {
  const baseRaw = data.outerBaseCopperThickness?.value ?? data.outerBaseCopperThickness
  const doneRaw = data.outerCopperThickness?.value ?? data.outerCopperThickness
  const baseGiven = baseRaw !== undefined && baseRaw !== null && baseRaw !== ''
  const doneGiven = doneRaw !== undefined && doneRaw !== null && doneRaw !== ''
  if (baseGiven && !doneGiven) {
    const base = Number(form.outerBaseCopperThickness)
    if (Number.isFinite(base)) {
      form.outerCopperThickness = base + (base >= 35 ? 35 : 18)
      markAiAndBaseline('outerCopperThickness')
    }
  } else if (doneGiven && !baseGiven) {
    const done = Number(form.outerCopperThickness)
    if (Number.isFinite(done)) {
      form.outerBaseCopperThickness = done >= 70 ? done - 35 : done < 56 ? done - 18 : done
      markAiAndBaseline('outerBaseCopperThickness')
    }
  }
}

// 板材种类变化：已匹配板材型号时不可更改（混压板例外，可自由改）
function onMaterialTypeChange() {
  if (materialConfirmOpen) return
  const oldType = prevMaterial.materialType
  const version = form.materialVersion
  if (!version || form.materialType === '混压板') { prevMaterial.materialType = form.materialType; return }
  materialConfirmOpen = true
  ElMessageBox.alert('当前的值已匹配板材型号，不可更改', '提示', {
    confirmButtonText: '确定', type: 'warning',
  }).finally(() => {
    form.materialType = oldType
    prevMaterial.materialType = oldType
    materialConfirmOpen = false
  })
}

// 下拉选中建议项时 v-model 尚未更新，先写入值再走校验
function onMaterialVersionSelect(item: Record<string, any>) {
  form.materialVersion = item.value
  onMaterialVersionChange()
}

// 板材型号变化：选中后自动带出 材料类型/品牌/TG/无卤（混压板时保留混压板，只带品牌/TG/无卤）
function onMaterialVersionChange() {
  if (materialConfirmOpen) return
  if (form.materialVersion === prevMaterial.materialVersion) return
  const version = form.materialVersion
  if (!version) { currentPpModel.value = ''; syncPrevMaterial(); return }
  const d = versionDetailMap[version]
  if (!d) { currentPpModel.value = ''; syncPrevMaterial(); return }
  currentPpModel.value = ppMap[version] || ''
  if (form.materialType === '混压板') {
    form.materialBrand = d.brand
    form.materialTg = d.tg === '高TG'
    form.halogenFree = d.halogen
  } else {
    fillByVersion(version)
  }
  syncPrevMaterial()
}

// 下拉选中建议项时 v-model 尚未更新，先写入值再走校验
function onMaterialBrandSelect(item: Record<string, any>) {
  form.materialBrand = item.value
  onMaterialBrandChange()
}

// 板材品牌变化：已匹配板材型号时不可更改（混压板例外）
function onMaterialBrandChange() {
  if (materialConfirmOpen) return
  const oldBrand = prevMaterial.materialBrand
  if (form.materialBrand === oldBrand) return
  if (!form.materialVersion || form.materialType === '混压板') { prevMaterial.materialBrand = form.materialBrand; return }
  materialConfirmOpen = true
  ElMessageBox.alert('当前的值已匹配板材型号，不可更改', '提示', {
    confirmButtonText: '确定', type: 'warning',
  }).finally(() => {
    form.materialBrand = oldBrand
    materialConfirmOpen = false
  })
}

// TG值变化：已匹配板材型号时不可更改（混压板例外）
function onMaterialTgChange() {
  if (materialConfirmOpen) return
  const oldTg = prevMaterial.materialTg
  if (form.materialTg === oldTg) return
  if (!form.materialVersion || form.materialType === '混压板') { prevMaterial.materialTg = form.materialTg; return }
  materialConfirmOpen = true
  ElMessageBox.alert('当前的值已匹配板材型号，不可更改', '提示', {
    confirmButtonText: '确定', type: 'warning',
  }).finally(() => {
    form.materialTg = oldTg
    materialConfirmOpen = false
  })
}

// 无卤变化：已匹配板材型号时不可更改（混压板例外）
function onMaterialHalogenChange() {
  if (materialConfirmOpen) return
  const oldHalogen = prevMaterial.halogenFree
  if (form.halogenFree === oldHalogen) return
  if (!form.materialVersion || form.materialType === '混压板') { prevMaterial.halogenFree = form.halogenFree; return }
  materialConfirmOpen = true
  ElMessageBox.alert('当前的值已匹配板材型号，不可更改', '提示', {
    confirmButtonText: '确定', type: 'warning',
  }).finally(() => {
    form.halogenFree = oldHalogen
    materialConfirmOpen = false
  })
}

// ==================== 表单联动与 P10 能力校验 ====================
const {
  showPanelFields,
  requireClientPanelSeparation,
  showEnigGold,
  showGoldFinger,
  hasInnerLayer,
  collectP10Reasons,
  computedDrillDensity,
} = useP10Rules(form)

// ==================== 自动补全 ====================
const {
  queryMaterialBrand,
  queryMaterialVersion,
  queryStackupPpType,
  queryStackupCoreType,
  queryStackupCuType,
  queryLayerCount,
  queryThicknessTolerance,
  queryMaxWarpage,
  queryBoardThickness,
  queryOuterCopperThickness,
  queryOuterBaseCopperThickness,
  queryInnerCopperThickness,
  queryEnigGoldThickness,
  queryGoldFingerThickness,
  queryHoleCopperThickness,
} = useAutocompleteOptions(form, opts)

// ==================== 叠层与阻抗 ====================
const {
  stackupRows,
  stackupScheme,
  toggleStackupScheme,
  onLayerCountBlur,
  addStackupRow,
  insertStackupRow,
  onMaterialChange,
  impRows,
  impTypes,
  layerOptions,
  refLayerOptions,
  onControlLayerChange,
  validateRefLayer,
  addImpRow,
  insertImpRow,
  requestPCSSize,
  requestSetSize,
} = useBoardStructure(form, currentPpModel)

// ==================== 提交 ====================
const taskId = ref('')
const userToken = ref('')
const userUid = ref('')
const invoiceRef = ref<any>(null)
const deliveryRef = ref<any>(null)
const submitting = ref(false)
const ordering = ref(false)
const orderCompleted = ref(false)
const quoteData = ref<any>(null)
const formDataLoaded = ref(false)
const tokenReady = ref(false)

// Qt 桥接请求的等待状态：避免接口尚未返回时重复点击。
const BRIDGE_RESPONSE_TIMEOUT_MS = 30_000
let quoteResponseTimer: number | null = null
let orderResponseTimer: number | null = null
let orderWorkflowPending = false
let awaitingQuoteResponse = false
let awaitingOrderedResponse = false
let componentActive = true

function clearQuoteResponseTimer() {
  if (quoteResponseTimer !== null) window.clearTimeout(quoteResponseTimer)
  quoteResponseTimer = null
}

function clearOrderResponseTimer() {
  if (orderResponseTimer !== null) window.clearTimeout(orderResponseTimer)
  orderResponseTimer = null
}

function beginQuoteRequest() {
  clearQuoteResponseTimer()
  awaitingQuoteResponse = true
  submitting.value = true
  quoteResponseTimer = window.setTimeout(() => {
    quoteResponseTimer = null
    ElMessage.warning('报价仍在处理中，请勿重复提交；如长时间无响应请重新打开页面')
  }, BRIDGE_RESPONSE_TIMEOUT_MS)
}

function finishQuoteRequest() {
  clearQuoteResponseTimer()
  awaitingQuoteResponse = false
  submitting.value = false
}

function beginOrderRequest() {
  clearOrderResponseTimer()
  awaitingOrderedResponse = true
  ordering.value = true
  orderResponseTimer = window.setTimeout(() => {
    orderResponseTimer = null
    ElMessage.warning('订单仍在处理中，请勿重复提交；如长时间无响应请重新打开页面')
  }, BRIDGE_RESPONSE_TIMEOUT_MS)
}

function finishOrderRequest() {
  clearOrderResponseTimer()
  awaitingOrderedResponse = false
  ordering.value = false
}

function reportError(context: string, error: unknown, message: string, source: ErrorSource = '系统') {
  console.error(`[${context}]`, error)
  if (componentActive) ElMessage.error(withErrorSource(source, message))
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', '是'].includes(normalized)) return true
    if (['false', '0', 'no', '否', ''].includes(normalized)) return false
  }
  return Boolean(value)
}

function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === '') return '--'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '--'
}

const labelMap = fieldLabels

// ==================== 数据来源追踪 ====================
const fieldSource = reactive<Record<string, string>>({})
const fieldRawData = reactive<Record<string, any>>({})

const { handleSizeBlur } = usePanelSize({
  form,
  fieldSource,
  userBaseline,
  rebuildUserModified,
})
const rawEventData = ref<any>(null)
const systemDefaultFields = new Set(['pcbFile', 'quantity'])

function sourceLabel(f: string): string {
  // 用户修改过 → 用户确认；否则按来源显示
  if (userModifiedFields.value.has(f)) return '用户确认'
  const s = fieldSource[f]
  if (s==='ai') return 'AI提参'
  if (s==='cam') return 'CAM提参'
  if (s === 'system default') return '系统默认'
  // PCB资料、板子数量由系统提供默认值；其余字段沿用默认行业标准。
  if (s==='server default' || hasDefault(f)) {
    return systemDefaultFields.has(f) ? '系统默认' : '默认行业标准'
  }
  return ''
}
function sourceClass(f: string): string {
  if (userModifiedFields.value.has(f)) return 'badge user'
  const s = fieldSource[f]
  if (s==='ai') return 'badge ai'
  if (s==='cam') return 'badge extracted'
  return 'badge empty'
}
function showGraphicBtn(f: string): boolean { const r = fieldRawData[f]; if (!r||r.source!=='cam') return false; return Array.isArray(r.items)&&r.items.length>0 }
function showDocBtn(f: string): boolean { const r = fieldRawData[f]; if (!r||r.source!=='ai') return false; return Array.isArray(r.bbox)&&r.bbox.length>0 }
function handleViewClick(f: string) { const r = fieldRawData[f]; rawEventData.value = r; if(!r) return; const w=window as any; console.log('[我→QT] html-button-message:', JSON.stringify(r, null, 2)); if(w.QtBridge?.send) w.QtBridge.send('html-button-message',r); else{ElMessage.info('查看: '+f);} }

function applyFieldData(data: Record<string, any>) {
  const boolF=['blindVia','acceptXOut','materialTg','halogenFree','impedanceControl','confirmProductionFile']
  const numF=['boardThickness','outerCopperThickness','outerBaseCopperThickness','innerCopperThickness','holeCopperThickness','enigGoldThickness','goldFingerThickness']
  const arrF=['markingRequirements','testRequirements','shippingReports','specialProcesses']
  applyingData = true
  for(const k of Object.keys(data)) {
    if(!(k in form)) continue
    const e=data[k]; const v = k === 'immersionGoldArea' ? (e?.ratio ?? e?.[k] ?? e) : (e?.value ?? e?.[k] ?? e); const s=e?.source??''
    if(boolF.includes(k)) form[k]=toBoolean(v)
    else if(k==='dimensionTolerance') {
      // 兼容旧格式 "+/-0.10mm" → 数值
      if (typeof v === 'number') form[k] = v
      else { const m = String(v ?? '').match(/[0-9]*\.?[0-9]+/); form[k] = m ? Number(m[0]) : null }
    }
    else if(numF.includes(k)) { const numeric=Number(v); form[k]=Number.isFinite(numeric)?numeric:0 }
    else if(arrF.includes(k)) form[k]=Array.isArray(v)?v:(v?[v]:[])
    else form[k]=v
    if(s) fieldSource[k]=s; fieldRawData[k]=e
  }
  // 材料匹配规则：返回了型号才按型号带出；无型号不做匹配
  applyMaterialPriorityRules()
  // 外层完成铜/基铜互补规则
  applyCopperRules(data)
  applyingData = false
  // 以本次同步后的值作为新基准：Qt/AI 回传的值（含型号匹配带出的材料项）不算用户改动
  const baselineKeys = new Set(Object.keys(data))
  ;['materialType','materialBrand','materialVersion','materialTg','halogenFree'].forEach(k => baselineKeys.add(k))
  for (const k of baselineKeys) {
    if (k in form) userBaseline[k] = JSON.parse(JSON.stringify(form[k]))
  }
  rebuildUserModified()
}

// 外形公差提交格式：数字 → "+/-X.XXmm"
function formatDimensionTolerance(): string {
  const n = Number(form.dimensionTolerance)
  if (!Number.isFinite(n)) return ''
  return `+/-${n.toFixed(2)}mm`
}

function validateForm(): boolean {
  const alwaysRequired = ['pcbFile','layerCount','pcsSizeWidth','pcsSizeHeight','dimensionTolerance','quantity','deliveryUnit','panelTypesCount','setMethod','materialType','materialTg','halogenFree','maxWarpage','boardThickness','thicknessTolerance','outerCopperThickness','innerCopperThickness','minTraceWidthOuter','minTraceSpacingOuter','minHoleSize','holeCopperThickness','solderMaskColor','silkscreenColor','surfaceFinish','viaProcess','goldFingerType','acceptanceStandard','impedanceControl','markingRequirements','testRequirements','shippingReports','specialProcesses','confirmProductionFile']
  if (showPanelFields.value) alwaysRequired.push('clientPanelHorizontal','clientPanelVertical','setSizeWidth','setSizeHeight')
  if (requireClientPanelSeparation.value) alwaysRequired.push('clientPanelSeparation')
  if (hasInnerLayer.value) alwaysRequired.push('minTraceWidthInner','minTraceSpacingInner')
  if (form.surfaceFinish === '沉金') alwaysRequired.push('enigGoldThickness','immersionGoldArea')
  if (form.goldFingerType !== '无') alwaysRequired.push('goldFingerThickness','goldFingerChamferAngle')
  if ((form.markingRequirements as string[]).includes('周期标记')) alwaysRequired.push('periodFormat')
  const m = alwaysRequired.filter(k => { const v = form[k]; return v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0) })
  if (m.length) { ElMessage.warning('请填写: ' + m.map(k => labelMap[k] || k).join('、')); return false }
  if (!isThicknessToleranceFormatValid(form.thicknessTolerance)) {
    ElMessage.warning('板厚公差需要修改成标准格式，例如：+/-10mm 或 +/-10%')
    return false
  }
  return true
}

function submitForm() {
  if (submitting.value) return
  if (!validateForm()) return
  beginQuoteRequest()
  const params: Record<string, any> = {}
  const fk = Object.keys(form)
  fk.forEach(k => { if (k !== "remark") params[k] = k === 'dimensionTolerance' ? formatDimensionTolerance() : form[k] })
  params['drillDenstity'] = computedDrillDensity.value
  // if (stackupRows.value.length) params['stackupList'] = stackupRows.value
  // if (impRows.value.length) params['impList'] = impRows.value
  const payload = { taskId: taskId.value, pcbQuoteParams: params }
  const win = window as any
  // console.debug('[我→QT] 报价请求', { taskId: taskId.value, fieldCount: Object.keys(params).length })
  console.log('[我→QT] 报价请求', { taskId: taskId.value, fieldCount: Object.keys(params).length })
  try {
    if (!win.QtBridge?.send) throw new Error('QtBridge.send 不可用')
    win.QtBridge.send('html-button-message', payload)
  } catch (error) {
    finishQuoteRequest()
    reportError('报价桥接', error, '无法提交报价，请检查客户端连接')
  }
}

// 生成支付二维码，返回 { qrUrl, mergeOrderNo, timeExpire }
async function generatePayQr(orderNo: string) {
  let payRes: any
  try {
    payRes = await pcbPayV2(userToken.value, { order_no: orderNo })
  } catch (error: any) {
    throw new Error(withErrorSource('电巢', error?.message, '支付接口失败'))
  }
  if (String(payRes.code) !== '10000' || !payRes.data?.order_str) {
    throw new Error(withErrorSource('电巢', payRes.msg, '支付接口失败'))
  }
  let qrUrl: string
  try {
    qrUrl = await QRCode.toDataURL(payRes.data.order_str)
  } catch (error: any) {
    throw new Error(withErrorSource('系统', error?.message, '二维码生成失败'))
  }
  return {
    qrUrl,
    mergeOrderNo: payRes.data.merge_order_no,
    timeExpire: payRes.data.time_expire,
  }
}

function submitOrder() {
  if (ordering.value || orderCompleted.value) return
  ordering.value = true
  if (!validateForm()) { ordering.value = false; return }

  // 已有订单号，直接生成新二维码
  if (qrOrderNo.value) {
    clearTimers()
    qrVisible.value = false
    generatePayQr(qrOrderNo.value).then(({ qrUrl, mergeOrderNo, timeExpire }) => {
      qrCodeUrl.value = qrUrl
      qrVisible.value = true
      startPollPayStatus(mergeOrderNo, timeExpire)
      ordering.value = false
    }).catch(err => {
      ordering.value = false
      ElMessage.error(withErrorSource('电巢', err.message, '支付接口失败'))
    })
    return
  }

  beginOrderRequest()
  const params: Record<string, any> = {}
  for (const key of Object.keys(form)) { if (key === "remark") continue;
    const raw = fieldRawData[key]
    const src = fieldSource[key] || 'user'
    const val = key === 'dimensionTolerance' ? formatDimensionTolerance() : form[key]
    params[key] = { ...(raw || {}), value: val, source: src }
  }
  params['drillDenstity'] = { value: computedDrillDensity.value, source: 'computed' }
  // if (stackupRows.value.length) params['stackupList'] = { value: stackupRows.value, source: 'user' }
  // if (impRows.value.length) params['impList'] = { value: impRows.value, source: 'user' }
  const payload = params
  const win = window as any
  console.debug('[我→QT] 订单请求', { fieldCount: Object.keys(params).length })
  try {
    if (!win.QtBridge?.send) throw new Error('QtBridge.send 不可用')
    win.QtBridge.send('html-button-message', payload)
  } catch (error) {
    finishOrderRequest()
    reportError('订单桥接', error, '无法提交订单，请检查客户端连接')
  }
}

// ==================== 支付二维码与状态轮询 ====================
const {
  qrVisible,
  qrCodeUrl,
  qrExpired,
  qrCountdown,
  qrOrderNo,
  qrRefreshing,
  clearTimers,
  refreshQrCode,
  startPollPayStatus,
  orderPayload,
} = usePaymentFlow({
  form,
  taskId,
  userToken,
  computedDrillDensity,
  isComponentActive: () => componentActive,
  generatePayQr,
  formatDimensionTolerance,
  reportError,
})

// ==================== QtMessage ====================
async function handleQtMessage(event: Event) {
  if (!componentActive) return
  const detail = (event as CustomEvent<any>).detail
  if (!detail || typeof detail !== 'object') return

  const rn = detail.returnName
  // 仅记录消息类型和状态，不输出 Token 或完整业务数据。
  // console.debug('[QT消息]', { returnName: rn, code: detail.code })
  console.log('[QT消息]', { returnName: rn, code: detail })

  if (rn === 'token' && detail.elecnest_user_info) {
    if (detail.taskId) taskId.value = detail.taskId
    userToken.value = detail.elecnest_user_info.elecnest_user_token || ''
    userUid.value = detail.elecnest_user_info.elecnest_user_uid || ''
    tokenReady.value = Boolean(userToken.value)
    if (!tokenReady.value) ElMessage.error(withErrorSource('QT', '身份验证失败：未获取到有效 Token'))
    return
  }

  if (rn === 'PCSSize') {
    form.pcsSizeWidth = detail.PCSWidth ?? form.pcsSizeWidth
    form.pcsSizeHeight = detail.PCSHeight ?? form.pcsSizeHeight
    handleSizeBlur()
    return
  }

  if (rn === 'SetSize') {
    form.setSizeWidth = detail.SetSizeWidth ?? form.setSizeWidth
    form.setSizeHeight = detail.SetSizeHeight ?? form.setSizeHeight
    handleSizeBlur()
    return
  }

  if (rn === 'quote') {
    if (!awaitingQuoteResponse) {
      console.warn('[报价流程] 已忽略未匹配或重复的 quote 消息')
      return
    }
    finishQuoteRequest()
    if (Number(detail.code) === 200) {
      quoteData.value = detail.data
      ElMessage.success(detail.message || '报价成功')
    } else {
      ElMessage.error(withErrorSource('QT', detail.message, '报价失败'))
    }
    return
  }

  if (rn === 'ordered') {
    // 每次前端提交只允许消费一个 ordered 响应，拒绝重复、陈旧和主动注入的消息。
    if (!awaitingOrderedResponse || orderWorkflowPending) {
      console.warn('[订单流程] 已忽略未匹配或重复的 ordered 消息')
      return
    }
    awaitingOrderedResponse = false
    clearOrderResponseTimer()

    if (Number(detail.code) !== 200) {
      finishOrderRequest()
      ElMessage.error(withErrorSource('QT', detail.message, '订单提交失败'))
      return
    }

    // 已收到 Qt 响应，但在订单和支付接口完成前继续保持按钮禁用。
    orderWorkflowPending = true
    const addrId = deliveryRef.value?.selectedAddrId
    const invId = invoiceRef.value?.selectedInvoiceId
    const invType = invoiceRef.value?.invoiceType
    if (!addrId || !invId) {
      orderWorkflowPending = false
      finishOrderRequest()
      ElMessage.warning('请先选中收货地址和发票信息')
      return
    }

    // 新订单开始后立即使旧二维码刷新和旧轮询失效。
    clearTimers()
    qrVisible.value = false
    qrCodeUrl.value = ''
    qrOrderNo.value = ''

    try {
      // P10 超能力汇总：存在超P10 → 0（转人工审核），符合P10 → 1
      const auditReasons = collectP10Reasons()
      let orderRes: any
      try {
        orderRes = await orderCreate(userToken.value, {
          task_id: taskId.value,
          receiver_id: addrId,
          invoice_id: invId,
          invoice_type: Number(invType),
          freight_price: 0,
          task_audit_status: auditReasons.length ? 0 : 1,
          ...(auditReasons.length ? { audit_control_reasons: auditReasons.join('') } : {}),
          pcbQuoteParams: orderPayload(),
        })
      } catch (error: any) {
        reportError('订单创建', error, error?.message || '订单创建请求失败，请稍后重试', 'asem')
        return
      }
      if (!componentActive || !orderWorkflowPending) return

      if (Number(orderRes.code) !== 200 || !orderRes.data?.order_no) {
        ElMessage.error(withErrorSource('asem', orderRes.message, '订单创建失败'))
        return
      }

      const orderNo = orderRes.data.order_no

      // 超P10：转人工审核，成功后禁止再次提交；失败则停止，可重新点击按钮重试
      if (auditReasons.length) {
        try {
          const auditRes: any = await unpaidAuditCallback({ taskId: taskId.value, order_no: orderNo })
          if (Number(auditRes.code) === 200) {
            ElMessage.success('未付款转人工审核成功,已通知前端')
            orderCompleted.value = true
            return
          }
          ElMessage.error(withErrorSource('asem', auditRes.message, '转人工审核失败，请重新点击提交重试'))
          return
        } catch (error) {
          reportError('未付款转人工审核', error, '转人工审核请求失败，请重新点击提交重试', 'asem')
          return
        }
      }

      let paymentData: Awaited<ReturnType<typeof generatePayQr>>
      try {
        paymentData = await generatePayQr(orderNo)
      } catch (error: any) {
        reportError('支付二维码', error, error?.message || '支付接口失败', '电巢')
        return
      }
      const { qrUrl, mergeOrderNo, timeExpire } = paymentData
      if (!componentActive || !orderWorkflowPending) return
      qrCodeUrl.value = qrUrl
      qrOrderNo.value = orderNo
      qrVisible.value = true
      startPollPayStatus(mergeOrderNo, timeExpire)
    } catch (error: any) {
      reportError('订单支付流程', error, error?.message || '订单处理失败，请稍后重试')
    } finally {
      orderWorkflowPending = false
      finishOrderRequest()
    }
    return
  }

  // 表单数据
  const data = detail.parameters || detail
  applyFieldData(data)
  handleSizeBlur()
  formDataLoaded.value = true
  ElMessage.success('数据已同步')
}

const checkoutContext = {
  quoteData, submitting, ordering, tokenReady, orderCompleted, formatMoney, submitForm, submitOrder,
  qrVisible, qrCodeUrl, qrExpired, qrCountdown, qrRefreshing, clearTimers, refreshQrCode,
}

const boardStructureContext = {
  sections, stackupRows, stackupScheme, toggleStackupScheme, onMaterialChange,
  queryStackupCuType, queryStackupPpType, queryStackupCoreType, insertStackupRow, addStackupRow,
  impRows, impTypes, layerOptions, refLayerOptions, onControlLayerChange, validateRefLayer, insertImpRow, addImpRow,
}

const parameterFormContext = {
  form, sections, opts, fieldBgClass, sourceClass, sourceLabel, showGraphicBtn, showDocBtn, handleViewClick,
  queryLayerCount, onLayerCountBlur, requestPCSSize, requestSetSize, handleSizeBlur, requireClientPanelSeparation,
  onMaterialTypeChange, onMaterialBrandSelect, onMaterialBrandChange, queryMaterialBrand,
  onMaterialVersionSelect, onMaterialVersionChange, queryMaterialVersion, onMaterialTgChange, onMaterialHalogenChange,
  queryMaxWarpage, queryBoardThickness, queryThicknessTolerance, queryOuterCopperThickness,
  queryOuterBaseCopperThickness, queryInnerCopperThickness, hasInnerLayer, showEnigGold,
  queryEnigGoldThickness, queryHoleCopperThickness, showGoldFinger, queryGoldFingerThickness,
  computedDrillDensity,
}

onMounted(() => {
  componentActive = true
  // 初始叠层和阻抗为空，等层数变化或用户操作时再生成
  window.addEventListener('QtMessage', handleQtMessage)
})

onUnmounted(() => {
  componentActive = false
  window.removeEventListener('QtMessage', handleQtMessage)
  clearTimers()
  clearQuoteResponseTimer()
  clearOrderResponseTimer()
  awaitingQuoteResponse = false
  awaitingOrderedResponse = false
  orderWorkflowPending = false
})
</script>

<template>
  <div class="plugin-a-page">
    <div v-if="!formDataLoaded" class="loading-bar"></div>
    <div v-if="formDataLoaded && !tokenReady" class="token-banner">请等待身份验证完成，当前仅可编辑表单...</div>
    <div class="form-box">
      <ParameterForm :context="parameterFormContext" />

      <StackupSection :context="boardStructureContext" />
      <ImpedanceSection :context="boardStructureContext" />

      <!-- 六、开票 / 七、配送 -->
      <div :class="{ 'section-disabled': !tokenReady }">
        <InvoiceSection ref="invoiceRef" v-model:expanded="sections.invoice" :uid="userUid" :token="userToken" />
        <DeliverySection ref="deliveryRef" v-model:expanded="sections.delivery" :token="userToken" />
      </div>

      <QuoteSummary :context="checkoutContext" />
    </div>

    <PaymentDialog :context="checkoutContext" />
  </div>
</template>

<style src="./pluginA.css"></style>
