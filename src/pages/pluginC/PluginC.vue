<script setup lang="ts">
import { computed, reactive, ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import ParameterForm from './components/ParameterForm.vue'
import StackupSection from './components/StackupSection.vue'
import ImpedanceSection from './components/ImpedanceSection.vue'
import QuoteSummary from './components/QuoteSummary.vue'
import PaymentDialog from './components/PaymentDialog.vue'
import {
  getOnlineQuoteParamsInfo,
  getOrderPriceQuery,
  getQuoteInfoOffline,
  getQuoteInfoOfflinePure,
  orderCreate,
  payCallback,
  pcbModelIdCreate,
  submitTransferNotify,
  updateOrderStatus,
} from '@/api/pcb'
import { pcbPayV2, getPcbOrderStatusV2 } from '@/api/invoice'
import QRCode from 'qrcode'
import { ElMessage } from 'element-plus'
import { initialForm, defaultValues, formOptions, fieldLabels } from './config/form'
import { materialRules } from './config/materials'
import { useP10Rules } from './composables/useP10Rules'
import { useAutocompleteOptions } from './composables/useAutocompleteOptions'
import { useBoardStructure } from './composables/useBoardStructure'
import { usePanelSize } from './composables/usePanelSize'
import { useMaterialSelection } from './composables/useMaterialSelection'
import { resolveDeeplineToken } from './domain/deepline'
import { isThicknessToleranceFormatValid } from './domain/thicknessTolerance'
import { runtimeConfig } from '@/config/runtimeConfig'
import { extractImpedanceList, serializeImpedanceRows } from '@/utils/impedanceData'
import { extractStackupList, serializeStackupRows } from '@/utils/stackupData'
import { normalizeRemarks } from '@/utils/remarkData'

// ==================== 折叠 ====================
const sections = reactive<Record<string, boolean>>({ basic: true, process: true, custom: true, stackup: true, impedance: true })

// ==================== 表单 V7.0 ====================
const form = reactive<Record<string, any>>(JSON.parse(JSON.stringify(initialForm)))

// ==================== 字段状态颜色 ====================
const DEFAULT_VALUES: Record<string, any> = JSON.parse(JSON.stringify(defaultValues))
const p10RemarkVisible = runtimeConfig.pluginCRemarkVisible
const receivedRemarks = ref<string[]>([])
const displayedRemarks = computed(() => [
  ...receivedRemarks.value,
  ...(p10RemarkVisible
    ? form.remark.map((message: unknown) => {
      const text = String(message)
      return text.includes('|') ? text.split('|').slice(1).join('|') : text
    })
    : []),
])

// ==================== 数据来源追踪 ====================
const fieldSource = reactive<Record<string, string>>({})
const fieldRawData = reactive<Record<string, any>>({})
const rawEventData = ref<any>(null)
const systemDefaultFields = new Set(['pcbFile', 'quantity'])

const userModifiedFields = ref<Set<string>>(new Set())
let applyingData = false

function hasDefault(f: string): boolean {
  const v = DEFAULT_VALUES[f]
  if (v === undefined || v === null || v === '') return false
  if (Array.isArray(v) && v.length === 0) return false
  return true
}

function hasFieldValue(field: string): boolean {
  const value = form[field]
  if (value === undefined || value === null || value === '') return false
  return !Array.isArray(value) || value.length > 0
}

function fieldBgClass(f: string): string {
  // 背景色只由来源决定（有来源优先显示来源色，即使该字段有默认值）；用户改动不改变背景，只让字体变蓝
  let cls = ''
  const src = fieldSource[f]
  if (src === 'ai') cls = 'bg-green'
  else if (src === 'cam') cls = 'bg-orange'
  // 服务端默认、系统默认、默认算法规则均使用白色背景
  else if (src === 'server default' || src === 'system default' || src === 'default algorithm rule') cls = ''
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

/** 将页面公式或联动生成的字段标记为默认算法规则，并作为新的用户修改基准。 */
function markDefaultAlgorithmFields(fields: string[]) {
  for (const field of fields) {
    if (hasFieldValue(field)) fieldSource[field] = 'default algorithm rule'
    else delete fieldSource[field]
    delete fieldRawData[field]
    userBaseline[field] = JSON.parse(JSON.stringify(form[field]))
  }
  if (!applyingData) rebuildUserModified()
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

// ==================== 表单联动与 P10 能力校验 ====================
const {
  showPanelFields,
  requireClientPanelSeparation,
  syncDeliveryUnit,
  showEnigGold,
  showGoldFinger,
  hasInnerLayer,
  collectP10Reasons,
  computedDrillDensity,
} = useP10Rules(form, markDefaultAlgorithmFields)

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
  applyStackupRows,
  generateStackup,
  impRows,
  impTypes,
  layerOptions,
  refLayerOptions,
  onControlLayerChange,
  validateRefLayer,
  addImpRow,
  insertImpRow,
  applyImpedanceRows,
  generateImpedance,
} = useBoardStructure(form, currentPpModel)

// ==================== 提交 ====================
const taskId = ref('')
const userToken = ref('')
const userUid = ref('')
const submitting = ref(false)
const ordering = ref(false)
const orderCompleted = ref(false)
const notifyLoading = ref(false)

async function submitNotify() {
  if (notifyLoading.value) return
  notifyLoading.value = true
  try {
    const res: any = await submitTransferNotify({ task_id: taskId.value, user_id: 'admin' })
    if (res.code === 200 || res.success) {
      ElMessage.success('审核确认成功')
    } else {
      ElMessage.error(res.message || '确认失败')
    }
  } catch (e: any) {
    ElMessage.error('请求失败: ' + (e.message || e))
  } finally {
    notifyLoading.value = false
  }
}
const quoteData = ref<any>(null)
const oldQuoteData = ref<any>(null)
const formDataLoaded = ref(false)
const tokenReady = ref(false)
const deeplineMode = ref(false)

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

function reportError(context: string, error: unknown, message: string) {
  console.error(`[${context}]`, error)
  if (componentActive) ElMessage.error(message)
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

function normalizeExpireTimestamp(value: unknown): number {
  const now = Math.floor(Date.now() / 1000)
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return now + 300
  // 同时兼容秒级与毫秒级 Unix 时间戳。
  return Math.floor(numeric > 1_000_000_000_000 ? numeric / 1000 : numeric)
}

const labelMap = fieldLabels

type SubmittedFieldSource = 'ai' | 'cam' | 'server default' | 'system default' | 'default algorithm rule' | 'user' | ''

/** Qt 审核参数中的来源与页面来源列保持一致。 */
function submittedFieldSource(field: string): SubmittedFieldSource {
  if (!hasFieldValue(field)) return ''
  if (userModifiedFields.value.has(field)) return 'user'
  const source = fieldSource[field]
  if (source === 'ai' || source === 'cam') return source
  if (source === 'user') return 'user'
  if (source === 'system default') return 'system default'
  if (source === 'default algorithm rule') return 'default algorithm rule'
  if (systemDefaultFields.has(field)) return 'system default'
  if (source === 'server default' || hasDefault(field)) return 'server default'
  return 'user'
}

const { handleSizeBlur, requestPCSSize, requestSetSize } = usePanelSize({
  form,
  markDefaultAlgorithmFields,
})

const {
  syncPrevMaterial,
  applyMaterialPriorityRules,
  applyCopperRules,
  onMaterialTypeChange,
  onMaterialVersionSelect,
  onMaterialVersionChange,
  onMaterialBrandSelect,
  onMaterialBrandChange,
  onMaterialTgChange,
  onMaterialHalogenChange,
} = useMaterialSelection({
  form,
  currentPpModel,
  markDefaultAlgorithmFields,
})

function sourceLabel(f: string): string {
  if (!hasFieldValue(f)) return ''
  // 用户修改过 → 用户确认；否则按来源显示
  if (userModifiedFields.value.has(f)) return '用户确认'
  const s = fieldSource[f]
  if (s==='ai') return 'AI提参'
  if (s==='cam') return 'CAM提参'
  if (s === 'user') return '用户确认'
  if (s === 'system default') return '系统默认'
  if (s === 'default algorithm rule') return '默认算法规则'
  if (systemDefaultFields.has(f)) return '系统默认'
  // 服务端默认 / 有默认值但未传来源 → 默认行业标准；无默认值无来源 → 空白
  if (s==='server default' || hasDefault(f)) return '默认行业标准'
  return ''
}
function sourceClass(f: string): string {
  if (!hasFieldValue(f)) return 'badge empty'
  if (userModifiedFields.value.has(f)) return 'badge user'
  const s = fieldSource[f]
  if (s==='ai') return 'badge ai'
  if (s==='cam') return 'badge extracted'
  if (s === 'user') return 'badge user'
  if (s === 'default algorithm rule') return 'badge algorithm'
  return 'badge empty'
}
function showGraphicBtn(f: string): boolean { const r = fieldRawData[f]; if (!r||r.source!=='cam') return false; return Array.isArray(r.items)&&r.items.length>0 }
function showDocBtn(f: string): boolean { const r = fieldRawData[f]; if (!r||r.source!=='ai') return false; return Array.isArray(r.bbox)&&r.bbox.length>0 }
function handleViewClick(f: string) { const r = fieldRawData[f]; rawEventData.value = r; if(!r) return; const w=window as any; console.log('[我→QT] html-button-message:', JSON.stringify(r, null, 2)); if(w.QtBridge?.send) w.QtBridge.send('html-button-message',r); else{ElMessage.info('查看: '+f);} }

function applyReturnedStructureRows(stackupList: unknown[] | null, impedanceList: unknown[] | null) {
  const layerCount = Number(form.layerCount)
  const canGenerate = Number.isInteger(layerCount)
    && layerCount > 0
    && (layerCount <= 2 || layerCount % 2 === 0)

  if (stackupList?.length) applyStackupRows(stackupList)
  else if (canGenerate) generateStackup(layerCount, stackupScheme.value)
  else stackupRows.value = []

  if (impedanceList?.length) applyImpedanceRows(impedanceList)
  else if (canGenerate) generateImpedance(layerCount)
  else impRows.value = []
}

async function applyFieldData(data: Record<string, any>) {
  // 接口备注与页面生成的 P10 提示分开保存，避免 P10 内容随 remark 回传。
  receivedRemarks.value = normalizeRemarks(data.remark)
  const stackupList = extractStackupList(data)
  const impedanceList = extractImpedanceList(data)
  const boolF=['blindVia','acceptXOut','materialTg','halogenFree','impedanceControl','confirmProductionFile']
  const numF=['boardThickness','outerCopperThickness','outerBaseCopperThickness','innerCopperThickness','holeCopperThickness','enigGoldThickness','goldFingerThickness']
  const arrF=['markingRequirements','testRequirements','shippingReports','specialProcesses']
  applyingData = true
  for(const k of Object.keys(data)) {
    if(k === 'remark') continue
    if(!(k in form)) continue
    const e=data[k]; const v = k === 'immersionGoldArea' ? (e?.ratio ?? e?.[k] ?? e) : (e?.value ?? e?.[k] ?? e); const s=e?.source??''
    if(boolF.includes(k)) form[k]=toBoolean(v)
    else if(numF.includes(k)) { const numeric=Number(v); form[k]=Number.isFinite(numeric)?numeric:0 }
    else if(arrF.includes(k)) form[k]=Array.isArray(v)?v:(v?[v]:[])
    else form[k]=v
    if(s) fieldSource[k]=s; fieldRawData[k]=e
  }
  // 材料匹配规则：返回了型号才按型号带出；无型号不做匹配
  applyMaterialPriorityRules()
  // 外层完成铜/基铜互补规则
  applyCopperRules(data)
  // 交货单位只取决于最终的拼板方式，不采纳外部独立传值。
  syncDeliveryUnit()
  applyingData = false
  // 以本次同步后的值作为新基准：Qt/AI 回传的值（含型号匹配带出的材料项）不算用户改动
  const baselineKeys = new Set(Object.keys(data))
  ;['materialType','materialBrand','materialVersion','materialTg','halogenFree'].forEach(k => baselineKeys.add(k))
  for (const k of baselineKeys) {
    if (k in form) userBaseline[k] = JSON.parse(JSON.stringify(form[k]))
  }
  rebuildUserModified()
  await nextTick()
  applyReturnedStructureRows(stackupList, impedanceList)
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

async function submitForm() {
  if (submitting.value) return
  if (!validateForm()) return
  submitting.value = true
  const params: Record<string, any> = {}
  const fk = Object.keys(form)
  fk.forEach(k => { if (k !== "remark") params[k] = form[k] })
  params.remark = [...receivedRemarks.value]
  params['drillDenstity'] = computedDrillDensity.value
  const stackupTable = serializeStackupRows(stackupRows.value)
  if (stackupTable.length) params['stackupTable'] = stackupTable
  const impedanceTable = serializeImpedanceRows(impRows.value)
  if (impedanceTable.length) params['impedanceTable'] = impedanceTable
  try {
    const quoteRequest = deeplineMode.value ? getQuoteInfoOfflinePure : getQuoteInfoOffline
    const res: any = await quoteRequest({ taskId: taskId.value, pcbQuoteParams: params })
    if (res.code === 200) {
      quoteData.value = res.data
      ElMessage.success('报价成功')
    } else {
      ElMessage.error(res.message || '报价失败')
    }
  } catch (error: any) {
    ElMessage.error('报价请求失败: ' + (error.message || error))
  } finally {
    submitting.value = false
  }
}

async function submitOrder() {
  if (ordering.value || orderCompleted.value) return
  if (!validateForm()) return
  beginOrderRequest()

  // 先刷新按钮禁用状态并让出主线程，再执行参数组装和 Qt 调用。
  await nextTick()
  await new Promise<void>(resolve => window.setTimeout(resolve, 0))

  const params: Record<string, any> = {}
  for (const key of Object.keys(form)) { if (key === "remark") continue
    if (deeplineMode.value) {
      const raw = fieldRawData[key]
      const rawRecord = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
      params[key] = { ...rawRecord, value: form[key], source: submittedFieldSource(key) }
    } else {
      const source = fieldSource[key] === 'default algorithm rule' ? 'default algorithm rule' : 'user'
      params[key] = { value: form[key], source }
    }
  }
  params.remark = { value: [...receivedRemarks.value], source: '' }
  params['drillDenstity'] = {
    value: computedDrillDensity.value,
    source: 'default algorithm rule',
  }
  const stackupTable = serializeStackupRows(stackupRows.value)
  if (stackupTable.length) params['stackupTable'] = { value: stackupTable, source: 'user' }
  const impedanceTable = serializeImpedanceRows(impRows.value)
  if (impedanceTable.length) params['impedanceTable'] = { value: impedanceTable, source: 'user' }
  const payload = params
  const win = window as any
  console.log('[我→QT] 订单请求', { fieldCount: Object.keys(payload).length })
  try {
    if (!win.QtBridge?.send) throw new Error('QtBridge.send 不可用')
    win.QtBridge.send('html-button-message', payload)
  } catch (error: any) {
    finishOrderRequest()
    ElMessage.error('提交订单失败: ' + (error.message || error))
  }
}

// ==================== QR Code ====================
const qrVisible = ref(false); const qrCodeUrl = ref(''); const qrExpired = ref(false); const qrCountdown = ref(0); const qrOrderNo = ref(''); const qrRefreshing = ref(false)
let pollTimer: number | null = null
let countdownTimer: number | null = null
let pollRequestPending = false
let pollSessionId = 0
let pollErrorNotified = false

function clearTimers() {
  // 会话编号失效后，已经发出的旧请求即使返回也不能更新当前二维码。
  pollSessionId++
  if (pollTimer !== null) window.clearInterval(pollTimer)
  if (countdownTimer !== null) window.clearInterval(countdownTimer)
  pollTimer = null
  countdownTimer = null
  pollRequestPending = false
  qrRefreshing.value = false
}

function isQrFlowActive(sessionId: number, orderNo: string): boolean {
  return componentActive && qrVisible.value && pollSessionId === sessionId && qrOrderNo.value === orderNo
}

async function refreshQrCode() {
  if (qrRefreshing.value) return
  clearTimers()
  const refreshSessionId = pollSessionId
  const refreshOrderNo = qrOrderNo.value
  qrRefreshing.value = true
  qrExpired.value = false
  try {
    const payRes: any = await pcbPayV2(userToken.value, { order_no: refreshOrderNo })
    if (!isQrFlowActive(refreshSessionId, refreshOrderNo)) return
    if (String(payRes.code) === '10000' && payRes.data?.order_str) {
      const nextQrCodeUrl = await QRCode.toDataURL(payRes.data.order_str)
      if (!isQrFlowActive(refreshSessionId, refreshOrderNo)) return
      qrCodeUrl.value = nextQrCodeUrl
      startPollPayStatus(payRes.data.merge_order_no, payRes.data.time_expire)
    } else {
      ElMessage.error(payRes.msg || '刷新失败')
      qrVisible.value = false
    }
  } catch (error) {
    if (isQrFlowActive(refreshSessionId, refreshOrderNo)) {
      qrExpired.value = true
      reportError('刷新二维码', error, '刷新二维码失败，请稍后重试')
    }
  } finally {
    if (pollSessionId === refreshSessionId) qrRefreshing.value = false
  }
}

function startPollPayStatus(mergeNo: string, expireTimestamp: number) {
  clearTimers()
  qrExpired.value = false
  pollErrorNotified = false
  const sessionId = pollSessionId
  const expireAt = normalizeExpireTimestamp(expireTimestamp)
  qrCountdown.value = Math.max(0, expireAt - Math.floor(Date.now() / 1000))

  if (qrCountdown.value <= 0) {
    qrExpired.value = true
    return
  }

  countdownTimer = window.setInterval(() => {
    qrCountdown.value = Math.max(0, expireAt - Math.floor(Date.now() / 1000))
    if (qrCountdown.value <= 0) {
      clearTimers()
      qrExpired.value = true
    }
  }, 1000)

  const pollPayStatus = async () => {
    if (pollRequestPending || sessionId !== pollSessionId) return
    pollRequestPending = true
    try {
      const res: any = await getPcbOrderStatusV2(userToken.value, { merge_order_no: mergeNo })
      if (sessionId !== pollSessionId) return

      if (String(res.code) !== '10000') {
        if (!pollErrorNotified) {
          pollErrorNotified = true
          ElMessage.warning(res.msg || '支付状态查询暂时失败，将继续重试')
        }
        return
      }

      pollErrorNotified = false
      const payStatus = Number(res.data?.pay_status)
      if (payStatus === 1) {
        clearTimers()
        ElMessage.success('支付成功')
        try {
          await payCallback(userToken.value, { taskId: taskId.value, order_no: qrOrderNo.value, isPayed: true })
        } catch (error) {
          reportError('支付结果同步', error, '支付已成功，但订单状态同步失败，请联系客服')
        } finally {
          qrVisible.value = false
        }
      } else if (payStatus === 2) {
        clearTimers()
        ElMessage.error('支付失败')
        qrVisible.value = false
      }
    } catch (error) {
      console.error('[支付状态轮询]', error)
      if (!pollErrorNotified && sessionId === pollSessionId) {
        pollErrorNotified = true
        ElMessage.warning('支付状态查询异常，将继续重试')
      }
    } finally {
      if (sessionId === pollSessionId) pollRequestPending = false
    }
  }

  pollTimer = window.setInterval(() => { void pollPayStatus() }, 1000)
}

function orderPayload() {
  const p: Record<string, any> = {}
  Object.keys(form).forEach(k => { if (k !== "remark") p[k] = form[k] })
  p.remark = [...receivedRemarks.value]
  p['drillDenstity'] = computedDrillDensity.value
  const stackupTable = serializeStackupRows(stackupRows.value)
  if (stackupTable.length) p['stackupTable'] = stackupTable
  const impedanceTable = serializeImpedanceRows(impRows.value)
  if (impedanceTable.length) p['impedanceTable'] = impedanceTable
  return p
}

function isSuccessfulResponse(response: any): boolean {
  return response?.success === true
    || String(response?.code) === '200'
    || String(response?.code) === '10000'
}

/** DeepLine 审核由 Qt 返回 reviewed 后继续创建 PCB 模型并更新订单状态。 */
async function completeDeeplineReview() {
  orderWorkflowPending = true
  clearTimers()
  qrVisible.value = false
  qrCodeUrl.value = ''
  qrOrderNo.value = ''

  try {
    const auditReasons = collectP10Reasons()
    const modelRes: any = await pcbModelIdCreate(userToken.value, {
      task_id: taskId.value,
      receiver_id: 1,
      invoice_id: 1,
      invoice_type: 1,
      freight_price: 0,
      task_audit_status: auditReasons.length ? 0 : 1,
      ...(auditReasons.length ? { audit_control_reasons: auditReasons.join('') } : {}),
      // 与 A 页面 OrderCreate 的 pcbQuoteParams 一致，叠构/阻抗使用 stackupTable、impedanceTable。
      pcbQuoteParams: orderPayload(),
    })
    if (!componentActive || !orderWorkflowPending) return
    if (!isSuccessfulResponse(modelRes)) {
      ElMessage.error(modelRes?.msg || modelRes?.message || 'PCB模型创建失败')
      return
    }

    const statusRes: any = await updateOrderStatus({ task_id: taskId.value })
    if (!componentActive || !orderWorkflowPending) return
    if (!isSuccessfulResponse(statusRes)) {
      ElMessage.error(statusRes?.msg || statusRes?.message || '订单状态更新失败')
      return
    }
    orderCompleted.value = true
    ElMessage.success('订单提交成功')
  } catch (error: any) {
    reportError('DeepLine审核流程', error, error?.message || '订单处理失败，请稍后重试')
  } finally {
    orderWorkflowPending = false
    finishOrderRequest()
  }
}

// ==================== QtMessage ====================
// returnName = refreshShow：页面回到初始状态（等待 Qt 重新推送数据）
function resetToInitialState() {
  clearTimers()
  clearQuoteResponseTimer()
  clearOrderResponseTimer()
  awaitingQuoteResponse = false
  awaitingOrderedResponse = false
  orderWorkflowPending = false
  qrVisible.value = false
  qrCodeUrl.value = ''
  qrOrderNo.value = ''
  qrExpired.value = false
  qrCountdown.value = 0
  submitting.value = false
  ordering.value = false
  notifyLoading.value = false
  orderCompleted.value = false
  quoteData.value = null
  oldQuoteData.value = null
  stackupRows.value = []
  impRows.value = []
  stackupScheme.value = 'normal'
  currentPpModel.value = ''
  taskId.value = ''
  userToken.value = ''
  userUid.value = ''
  tokenReady.value = false
  formDataLoaded.value = false
  receivedRemarks.value = []
  deeplineMode.value = false
  applyingData = true
  const defaults = JSON.parse(JSON.stringify(DEFAULT_VALUES))
  for (const k of Object.keys(form)) {
    if (defaults[k] !== undefined) form[k] = defaults[k]
    else if (Array.isArray(form[k])) form[k] = []
  }
  // refreshShow 表示重新等待数据，恢复真正的空初始值。
  form.deliveryUnit = ''
  applyingData = false
  for (const k of Object.keys(fieldSource)) delete fieldSource[k]
  for (const k of Object.keys(fieldRawData)) delete fieldRawData[k]
  userBaseline = JSON.parse(JSON.stringify(DEFAULT_VALUES))
  rebuildUserModified()
  syncPrevMaterial()
}

async function handleQtMessage(event: Event) {
  if (!componentActive) return
  const detail = (event as CustomEvent<any>).detail
  if (!detail || typeof detail !== 'object') return

  const rn = detail.returnName
  // 仅记录消息类型和状态，不输出 Token 或完整业务数据。
  // console.debug('[QT消息]', { returnName: rn, code: detail.code })
  console.log('[QT消息]', { returnName: rn, code: detail })

  if (rn === 'token') {
    const tokenContext = resolveDeeplineToken(detail, Object.keys(form))
    deeplineMode.value = tokenContext.enabled
    userToken.value = tokenContext.token
    userUid.value = tokenContext.uid
    if (tokenContext.taskId) taskId.value = tokenContext.taskId
    tokenReady.value = Boolean(taskId.value)
    if (!tokenReady.value) { ElMessage.error('未获取到有效 TaskId'); return }
    if (deeplineMode.value) {
      await applyFieldData(tokenContext.parameters)
      handleSizeBlur()
      formDataLoaded.value = true
      quoteData.value = null
      oldQuoteData.value = null
      ElMessage.success('DeepLine 数据已同步')
      return
    }
    void loadQuoteParamsFromApi()
    return
  }

  if (rn === 'refreshShow') {
    resetToInitialState()
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
      ElMessage.error(detail.message || '报价失败')
    }
    return
  }

  if (rn === 'reviewed') {
    if (deeplineMode.value) {
      if (!awaitingOrderedResponse || orderWorkflowPending) {
        console.warn('[DeepLine审核流程] 已忽略未匹配或重复的 reviewed 消息')
        return
      }
      awaitingOrderedResponse = false
      clearOrderResponseTimer()
      if (detail.code !== undefined && detail.code !== null && Number(detail.code) !== 200) {
        finishOrderRequest()
        ElMessage.error(detail.message || '审核失败')
        return
      }
      await completeDeeplineReview()
      return
    }
    updateOrderStatus({ task_id: taskId.value }).then((res: any) => {
      if (String(res.code) === '200' || String(res.code) === '10000') {
        ElMessage.success('订单提交成功')
        orderCompleted.value = true
      } else {
        ordering.value = false
        ElMessage.error(res.msg || res.message || '订单提交失败')
      }
    }).catch((err: any) => {
      ordering.value = false
      ElMessage.error('订单提交失败: ' + (err.message || err))
    })
    return
  }

  if (rn === 'ordered') {
    if (deeplineMode.value) {
      console.warn('[DeepLine审核流程] 已忽略 ordered 消息，当前流程等待 reviewed')
      return
    }
    // 每次前端提交只允许消费一个 ordered 响应，拒绝重复、陈旧和主动注入的消息。
    if (!awaitingOrderedResponse || orderWorkflowPending) {
      console.warn('[订单流程] 已忽略未匹配或重复的 ordered 消息')
      return
    }
    awaitingOrderedResponse = false
    clearOrderResponseTimer()

    if (Number(detail.code) !== 200) {
      finishOrderRequest()
      ElMessage.error(detail.message || '订单提交失败')
      return
    }

    // 已收到 Qt 响应，但在订单和支付接口完成前继续保持按钮禁用。
    orderWorkflowPending = true
    const addrId = 1
    const invId = 1
    const invType = 1

    // 新订单开始后立即使旧二维码刷新和旧轮询失效。
    clearTimers()
    qrVisible.value = false
    qrCodeUrl.value = ''
    qrOrderNo.value = ''

    try {
      const orderRes: any = await orderCreate(userToken.value, {
        task_id: taskId.value,
        receiver_id: addrId,
        invoice_id: invId,
        invoice_type: Number(invType),
        freight_price: 0,
        pcbQuoteParams: orderPayload(),
      })
      if (!componentActive || !orderWorkflowPending) return

      if (Number(orderRes.code) !== 200 || !orderRes.data?.order_no) {
        ElMessage.error(orderRes.message || '订单创建失败')
        return
      }

      const orderNo = orderRes.data.order_no
      const payRes: any = await pcbPayV2(userToken.value, { order_no: orderNo })
      if (!componentActive || !orderWorkflowPending) return
      if (String(payRes.code) !== '10000' || !payRes.data?.order_str) {
        ElMessage.error(payRes.msg || '支付接口失败')
        return
      }

      const nextQrCodeUrl = await QRCode.toDataURL(payRes.data.order_str)
      if (!componentActive || !orderWorkflowPending) return
      qrCodeUrl.value = nextQrCodeUrl
      qrOrderNo.value = orderNo
      qrVisible.value = true
      startPollPayStatus(payRes.data.merge_order_no, payRes.data.time_expire)
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
  await applyFieldData(data)
  handleSizeBlur()
  formDataLoaded.value = true
  ElMessage.success('数据已同步')
}

// 用 API 数据填充表单
async function loadQuoteParamsFromApi() {
  if (deeplineMode.value) return
  const requestTaskId = taskId.value
  try {
    const res: any = await getOnlineQuoteParamsInfo({ task_id: requestTaskId })
    if (deeplineMode.value || requestTaskId !== taskId.value) return
    if (res.code === 200 && res.data) {
      const data = res.data
      receivedRemarks.value = normalizeRemarks(data.remark)
      applyingData = true
      for (const key of Object.keys(form)) {
        if (key === 'remark') continue
        // 同时兼容旧的纯值和 A 页面上传的 { value, source } 结构。
        if (!(key in data)) continue
        const entry = data[key]
        const v = key === 'immersionGoldArea'
          ? (entry?.ratio ?? entry?.value ?? entry?.[key] ?? entry)
          : (entry?.value ?? entry?.[key] ?? entry)
        const source = entry?.source ?? ''
        if (v !== null && v !== undefined) {
          if (Array.isArray(form[key])) {
            form[key] = Array.isArray(v) ? v : (v ? [v] : [])
          } else if (typeof form[key] === 'boolean') {
            form[key] = toBoolean(v)
          } else if (typeof form[key] === 'number') {
            const n = Number(v)
            form[key] = Number.isFinite(n) ? n : form[key]
          } else {
            form[key] = v
          }
        }
        if (source) fieldSource[key] = source
        fieldRawData[key] = entry
      }
      // 材料匹配规则：返回了型号才按型号带出；无型号不做匹配
      applyMaterialPriorityRules()
      // 外层完成铜/基铜互补规则
      applyCopperRules(data)
      // 交货单位只取决于最终的拼板方式，不采纳接口中的独立传值。
      syncDeliveryUnit()
      applyingData = false
      // 以本次 API 回填后的值作为新基准：服务端回填（含型号匹配带出的材料项）不算用户改动
      const baselineKeys = new Set(Object.keys(data))
      ;['materialType','materialBrand','materialVersion','materialTg','halogenFree'].forEach(k => baselineKeys.add(k))
      for (const key of baselineKeys) {
        if (key in form) userBaseline[key] = JSON.parse(JSON.stringify(form[key]))
      }
      rebuildUserModified()
      await nextTick()
      const stackupList = extractStackupList(data)
      const impedanceList = extractImpedanceList(data)
      applyReturnedStructureRows(stackupList, impedanceList)
      formDataLoaded.value = true
      handleSizeBlur()
      // 获取旧报价
      getOrderPriceQuery({ task_id: requestTaskId }).then((priceRes: any) => {
        if (!deeplineMode.value && requestTaskId === taskId.value && priceRes.code === 200) oldQuoteData.value = priceRes.data
      }).catch(() => {})
    }
  } catch {}
}

const checkoutContext = {
  oldQuoteData, quoteData, submitting, ordering, tokenReady, orderCompleted, notifyLoading, deeplineMode,
  formatMoney, submitForm, submitOrder, submitNotify,
  qrVisible, qrCodeUrl, qrExpired, qrCountdown, qrRefreshing, clearTimers, refreshQrCode,
}

const boardStructureContext = {
  form, sections, stackupRows, stackupScheme, toggleStackupScheme, onMaterialChange,
  queryStackupCuType, queryStackupPpType, queryStackupCoreType, insertStackupRow, addStackupRow,
  impRows, impTypes, layerOptions, refLayerOptions, onControlLayerChange, validateRefLayer, insertImpRow, addImpRow,
}

const parameterFormContext = {
  form, sections, opts, displayedRemarks, fieldBgClass, sourceClass, sourceLabel, showGraphicBtn, showDocBtn, handleViewClick,
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
  <div class="plugin-c-page">
    <div v-if="!formDataLoaded" class="loading-bar"></div>
    <div v-if="formDataLoaded && !tokenReady" class="token-banner">请等待身份验证完成，当前仅可编辑表单...</div>
    <div class="form-box">
      <ParameterForm :context="parameterFormContext" />
      <StackupSection :context="boardStructureContext" />
      <ImpedanceSection :context="boardStructureContext" />
      <QuoteSummary :context="checkoutContext" />
    </div>
    <PaymentDialog :context="checkoutContext" />
  </div>
</template>

<style src="./pluginC.css"></style>
