<script setup lang="ts">
import { reactive, ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { orderCreate, payCallback, updateOrderStatus, getOnlineQuoteParamsInfo, getQuoteInfoOffline, getOrderPriceQuery } from '@/api/pcb'
import { pcbPayV2, getPcbOrderStatusV2 } from '@/api/invoice'
import QRCode from 'qrcode'
import { ElInput, ElSelect, ElOption, ElInputNumber, ElMessage, ElDialog, ElButton, ElAutocomplete } from 'element-plus'

// ==================== 折叠 ====================
const sections = reactive<Record<string, boolean>>({ basic: true, process: true, custom: true, stackup: true, impedance: true })

// ==================== 表单 V7.0 ====================
const form = reactive<Record<string, any>>({
  pcbName: "", pcbFile: "", layerCount: 2, blindVia: false,
  pcsSizeWidth: null, pcsSizeHeight: null, dimensionTolerance: "+/-0.10mm", quantity: 10, deliveryUnit: "PCS",
  panelTypesCount: 1, setMethod: "单片无拼板", clientPanelHorizontal: 1, clientPanelVertical: 1,
  setSizeWidth: null, setSizeHeight: null, clientPanelSeparation: "拼板&邮票孔交货", acceptXOut: false,
  materialType: "FR4", materialBrand: "", materialVersion: "", materialTg: false, halogenFree: false,
  maxWarpage: "0.75%", boardThickness: 1.6, thicknessTolerance: "+/-10%",
  outerCopperThickness: 35, outerBaseCopperThickness: 18, innerCopperThickness: 1,
  minTraceWidthOuter: null, minTraceSpacingOuter: null, minTraceWidthInner: null, minTraceSpacingInner: null,
  minHoleSize: 0.200, holeCount: null, holeCopperThickness: 20, solderMaskColor: "绿色", silkscreenColor: "白色字符",
  surfaceFinish: "无铅喷锡", enigGoldThickness: 0.05, immersionGoldArea: 20.0,
  viaProcess: "阻焊塞孔", goldFingerType: "无", goldFingerThickness: 0.38,
  goldFingerChamferAngle: "30°", goldFingerChamferDepth: 0.50, goldFingerChamferRemaining: 0.60,
  acceptanceStandard: "IPC 2", impedanceControl: false,
  markingRequirements: ["不需要"] as string[], periodFormat: "WWYY",
  testRequirements: ["不需要"] as string[], shippingReports: ["不需要"] as string[], specialProcesses: ["不需要"] as string[],
  confirmProductionFile: false,
})

// ==================== 选项 ====================
const opts: Record<string, any[]> = {
  layerCount: ["1","2","4","6","8","10","12","14","16","18","20","22","24","26","28","30"],
  blindVia: [{ value: false, label: '否' }, { value: true, label: '是' }],
  dimensionTolerance: ["+/-0.10mm","+/-0.15mm","+/-0.20mm"],
  deliveryUnit: ["PCS","SET"], setMethodAll: ["单片无拼板","单片加工艺边","客户拼板"],
  clientPanelSeparation: ["拼板&邮票孔交货","拼板铣开交货","拼板V-CUT+桥连交货","拼板桥连+邮票孔","拼板V-CUT+邮票孔","拼板V-CUT桥连+邮票孔","拼板桥连交货","拼板ROUT+V-CUT交货"],
  acceptXOut: [{ value: true, label: '是' }, { value: false, label: '否' }],
  materialType: ["FR4","高速板材","高频板","PTFE板材","PI"],
  materialBrand: ["生益","联茂","建滔","华正","超声","松下","Isola","台光","台耀","南亚","Rogers","其它"],
  materialVersion: ["IT-158","NY2150","S1000H","IT-180A","TU-752","S1000-2M","RO4350B","RO4350","RO4003C","FR408HR","S7439","IT-968","IT-958G"],
  materialTg: [{ value: false, label: '否' }, { value: true, label: '是' }],
  halogenFree: [{ value: false, label: '否' }, { value: true, label: '是' }],
  maxWarpage: ["无要求","0.75%","0.5%","IPC标准"],
  boardThickness: ["0.2","0.3","0.4","0.5","0.6","0.7","0.8","0.9","1.0","1.1","1.2","1.3","1.4","1.5","1.6","1.7","1.8","1.9","2.0","2.1","2.2","2.3","2.4","2.5","2.6","2.7","2.8","2.9","3.0","3.1","3.2","3.3","3.4","3.5","3.6","3.7","3.8","3.9","4.0","4.1","4.2","4.3","4.4","4.5","4.6","4.7","4.8","4.9","5.0","5.1","5.2","5.3","5.4","5.5","5.6","5.7","5.8","5.9","6.0"],
  thicknessTolerance: ["+/-10%","+/-0.10mm"],
  outerCopperThickness: ["35","70","105","140","175","210"],
  outerBaseCopperThickness: ["8","12","18","35","52.5","70","105","140","175","210"],
  innerCopperThickness: ["0.5","1","2","3","4","5","6"],
  holeCopperThickness: ["18","20","25","25.4","30","35","40","45","50"],
  solderMaskColor: ["绿色","绿色亚光","黑色","黑色亚光","蓝色","红色","不印阻焊"],
  silkscreenColor: ["白色字符","黑色字符","不印字符"],
  surfaceFinish: ["沉金","无铅喷锡","OSP","喷锡","沉银","沉锡","无需表面处理"],
  enigGoldThickness: ["0.05","0.075","0.08","0.1"],
  viaProcess: ["按Gerber文件","阻焊覆盖","BGA芯片处阻焊塞孔+按Gerber文件","不盖阻焊","阻焊塞孔","非导电树脂塞孔","非导电树脂塞孔+电镀填平"],
  goldFingerType: ["无","常规金手指","分段金手指","长短金手指"],
  goldFingerThickness: ["0.38","0.8","1.25"],
  goldFingerChamferAngle: ["20°","30°","45°","不倒角"],
  acceptanceStandard: ["IPC 2","IPC 3"],
  impedanceControl: [{ value: false, label: '否' }, { value: true, label: '是' }],
  markingRequirements: ["PCB厂家标记","周期标记","无铅标记","rosh标记","防静电标记","加拿大UL","不需要"],
  periodFormat: ["WWYY","YYWW","MMYY","YYMM","DDMMYY","YYMMDD"],
  testRequirements: ["电感测试","损耗","耐电压测试","孔电阻测试","线电阻测试","不需要","飞针测试","夹具测试"],
  shippingReports: ["最终产品检查报告","回流焊测试报告","可焊性测试报告","离子污染度测试报告","耐电压测试报告","热应力检测报告","不需要"],
  specialProcesses: ["电镀填孔","金属包边","金属化半孔","背钻孔","锥形孔","阶梯孔","铣阶梯槽","控深钻","不需要"],
  confirmProductionFile: [{ value: false, label: '否' }, { value: true, label: '是' }],
}

// ==================== 条件 ====================
const showPanelFields = computed(() => form.setMethod === '客户拼板')
const showEnigGold = computed(() => form.surfaceFinish === '沉金')
const showGoldFinger = computed(() => form.goldFingerType !== '无')
const hasInnerLayer = computed(() => Number(form.layerCount) > 2)
const computedDrillDensity = computed(() => {
  const v = form.clientPanelVertical
  const h = form.holeCount
  const w = form.setSizeWidth
  const sh = form.setSizeHeight
  if (v && h && w && sh && w > 0 && sh > 0) {
    return ((v * h) / (w * sh / 1000000) / 10000).toFixed(3)
  }
  return ''
})

// ==================== 自动补全查询函数 ====================
function makeQueryFn(list: string[]) {
  return (query: string, cb: (results: { value: string }[]) => void) => {
    const results = query
      ? list.filter((v: string) => v.toLowerCase().includes(query.toLowerCase()))
      : list
    cb(results.map(v => ({ value: v })))
  }
}
const queryMaterialBrand = makeQueryFn(opts.materialBrand)
const queryMaterialVersion = makeQueryFn(opts.materialVersion)
const queryThicknessTolerance = makeQueryFn(opts.thicknessTolerance)

// 数字类型字段：返回 number + watcher 过滤非数字输入
function makeNumQueryFn(list: string[]) {
  return {
    query: (q: string, cb: (results: { value: number }[]) => void) => {
      const results = q ? list.filter(v => v.toLowerCase().includes(q.toLowerCase())) : list
      cb(results.map(v => ({ value: Number(v) })))
    },
    watch: (formKey: string) => {
      watch(() => form[formKey], (val) => {
        if (typeof val === 'string' && /[^\d.]/.test(val)) {
          form[formKey] = val.replace(/[^\d.]/g, '') || ''
        }
      })
    }
  }
}

const numFields = ['boardThickness', 'outerCopperThickness', 'outerBaseCopperThickness', 'innerCopperThickness', 'enigGoldThickness', 'goldFingerThickness'] as const
numFields.forEach(k => makeNumQueryFn(opts[k]).watch(k))
const queryBoardThickness = makeNumQueryFn(opts.boardThickness).query
const queryOuterCopperThickness = makeNumQueryFn(opts.outerCopperThickness).query
const queryOuterBaseCopperThickness = makeNumQueryFn(opts.outerBaseCopperThickness).query
const queryInnerCopperThickness = makeNumQueryFn(opts.innerCopperThickness).query
const queryEnigGoldThickness = makeNumQueryFn(opts.enigGoldThickness).query
const queryGoldFingerThickness = makeNumQueryFn(opts.goldFingerThickness).query
// 最小孔铜需要返回数字且过滤非数字输入
function queryHoleCopperThickness(query: string, cb: (results: { value: number }[]) => void) {
  const results = query
    ? opts.holeCopperThickness.filter((v: string) => v.toLowerCase().includes(query.toLowerCase()))
    : opts.holeCopperThickness
  cb(results.map(v => ({ value: Number(v) })))
}
watch(() => form.holeCopperThickness, (val) => {
  if (typeof val === 'string' && /[^\d.]/.test(val)) {
    form.holeCopperThickness = val.replace(/[^\d.]/g, '') || ''
  }
})

// ==================== 叠层/阻抗 ====================
interface StackupRow { layerName: string; material: string; pcbMaterialType: string; copperThickness: number | null; dielectricThickness: number | null; dk: number | null }
const stackupRows = ref<StackupRow[]>([])
function addStackupRow() { const n = stackupRows.value.length + 1; stackupRows.value.push({ layerName: 'L' + n, material: 'PP', pcbMaterialType: '', copperThickness: null, dielectricThickness: null, dk: null }) }

interface ImpRow { impType: string; controlLayer: string; refLayerTop: string; refLayerBottom: string; isCoated: boolean; lineWidth: number | null; lineSpacing: number | null; lineToCopper: number | null; impTarget: number | null; impTol: number }
const impTypes = ["外层单端","外层单端共面地","外层差分","外层差分共面地","内层单端(双层屏蔽)","内层差分(双层屏蔽)","内层单端(单层屏蔽)","内层差分(单层屏蔽)","内层单端共面地(双层屏蔽)","内层差分共面地(双层屏蔽)","内层层间差分(双层屏蔽)","内层差分1B2A(双层屏蔽)","内层差分1B2A(单层屏蔽)"]
const impRows = ref<ImpRow[]>([])
function addImpRow() { impRows.value.push({ impType: '', controlLayer: '', refLayerTop: '', refLayerBottom: '', isCoated: false, lineWidth: null, lineSpacing: null, lineToCopper: null, impTarget: null, impTol: 10 }) }

// ==================== 提交 ====================
const taskId = ref('')
const userToken = ref('')
const userUid = ref('')
const submitting = ref(false)
const ordering = ref(false)
const orderCompleted = ref(false)
const quoteData = ref<any>(null)
const oldQuoteData = ref<any>(null)
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

const labelMap: Record<string, string> = {
  pcbFile: 'PCB资料', layerCount: '板子层数', pcsSizeWidth: 'PCS尺寸(水平)', pcsSizeHeight: 'PCS尺寸(垂直)',
  dimensionTolerance: '外形公差', quantity: '板子数量', deliveryUnit: '交货单位', panelTypesCount: '合拼种数', setMethod: 'Set拼板方式',
  materialType: '板材种类', materialTg: '高TG', halogenFree: '无卤板材', maxWarpage: '翘曲度',
  boardThickness: '成品板厚', thicknessTolerance: '板厚公差', outerCopperThickness: '外层完成铜厚度', innerCopperThickness: '内层基铜厚度',
  minTraceWidthOuter: '外层最小线宽', minTraceSpacingOuter: '外层最小线距', minTraceWidthInner: '内层最小线宽', minTraceSpacingInner: '内层最小线距',
  minHoleSize: '最小孔径', holeCopperThickness: '最小孔铜', solderMaskColor: '阻焊颜色', silkscreenColor: '字符颜色', surfaceFinish: '表面处理',
  viaProcess: '过孔工艺', goldFingerType: '金手指类型', acceptanceStandard: '验收标准', impedanceControl: '阻抗控制',
  markingRequirements: '标记要求', testRequirements: '测试要求', shippingReports: '出货报告', specialProcesses: '特殊工艺', confirmProductionFile: '光绘确认',
  clientPanelHorizontal: '拼板个数(水平)', clientPanelVertical: '拼板个数(垂直)',
  setSizeWidth: 'Set尺寸(水平)', setSizeHeight: 'Set尺寸(垂直)', clientPanelSeparation: '外形要求',
  enigGoldThickness: '最小沉金金厚', immersionGoldArea: '沉金面积',
  goldFingerThickness: '金手指金厚', goldFingerChamferAngle: '倒角角度', periodFormat: '周期格式',
}

// ==================== 数据来源追踪 ====================
const fieldSource = reactive<Record<string, string>>({})
const fieldRawData = reactive<Record<string, any>>({})
const rawEventData = ref<any>(null)

function sourceLabel(f: string): string { const s = fieldSource[f]; if (s==='ai') return 'AI提参'; if (s==='cam') return '文件解析'; return '--' }
function sourceClass(f: string): string { const s = fieldSource[f]; if (s==='ai') return 'badge ai'; if (s==='cam') return 'badge extracted'; return 'badge empty' }
function showGraphicBtn(f: string): boolean { const r = fieldRawData[f]; if (!r||r.source!=='cam') return false; return Array.isArray(r.items)&&r.items.length>0 }
function showDocBtn(f: string): boolean { const r = fieldRawData[f]; if (!r||r.source!=='ai') return false; return Array.isArray(r.bbox)&&r.bbox.length>0 }
function handleViewClick(f: string) { const r = fieldRawData[f]; rawEventData.value = r; if(!r) return; const w=window as any; console.log('[我→QT] html-button-message:', JSON.stringify(r, null, 2)); if(w.QtBridge?.send) w.QtBridge.send('html-button-message',r); else{ElMessage.info('查看: '+f);} }

function applyFieldData(data: Record<string, any>) {
  const boolF=['blindVia','acceptXOut','materialTg','halogenFree','impedanceControl','confirmProductionFile']
  const numF=['boardThickness','outerCopperThickness','outerBaseCopperThickness','innerCopperThickness','holeCopperThickness','enigGoldThickness','goldFingerThickness']
  const arrF=['markingRequirements','testRequirements','shippingReports','specialProcesses']
  for(const k of Object.keys(data)) {
    if(!(k in form)) continue
    const e=data[k]; const v=e?.value??e; const s=e?.source??''
    if(boolF.includes(k)) form[k]=toBoolean(v)
    else if(numF.includes(k)) { const numeric=Number(v); form[k]=Number.isFinite(numeric)?numeric:0 }
    else if(arrF.includes(k)) form[k]=Array.isArray(v)?v:(v?[v]:[])
    else form[k]=v
    if(s) fieldSource[k]=s; fieldRawData[k]=e
  }
}

function validateForm(): boolean {
  const alwaysRequired = ['pcbFile','layerCount','pcsSizeWidth','pcsSizeHeight','dimensionTolerance','quantity','deliveryUnit','panelTypesCount','setMethod','materialType','materialTg','halogenFree','maxWarpage','boardThickness','thicknessTolerance','outerCopperThickness','innerCopperThickness','minTraceWidthOuter','minTraceSpacingOuter','minHoleSize','holeCopperThickness','solderMaskColor','silkscreenColor','surfaceFinish','viaProcess','goldFingerType','acceptanceStandard','impedanceControl','markingRequirements','testRequirements','shippingReports','specialProcesses','confirmProductionFile']
  if (showPanelFields.value) alwaysRequired.push('clientPanelHorizontal','clientPanelVertical','setSizeWidth','setSizeHeight','clientPanelSeparation')
  if (hasInnerLayer.value) alwaysRequired.push('minTraceWidthInner','minTraceSpacingInner')
  if (form.surfaceFinish === '沉金') alwaysRequired.push('enigGoldThickness','immersionGoldArea')
  if (form.goldFingerType !== '无') alwaysRequired.push('goldFingerThickness','goldFingerChamferAngle')
  if ((form.markingRequirements as string[]).includes('周期标记')) alwaysRequired.push('periodFormat')
  const m = alwaysRequired.filter(k => { const v = form[k]; return v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0) })
  if (m.length) { ElMessage.warning('请填写: ' + m.map(k => labelMap[k] || k).join('、')); return false }
  return true
}

async function submitForm() {
  if (submitting.value) return
  if (!validateForm()) return
  submitting.value = true
  const params: Record<string, any> = {}
  const fk = Object.keys(form)
  fk.forEach(k => { params[k] = form[k] })
  params['drillDensity'] = computedDrillDensity.value
  if (stackupRows.value.length) params['stackupTable'] = stackupRows.value
  if (impRows.value.length) params['impedanceTable'] = impRows.value
  try {
    const res: any = await getQuoteInfoOffline({ taskId: taskId.value, pcbQuoteParams: params })
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
  ordering.value = true
  const params: Record<string, any> = {}
  for (const key of Object.keys(form)) {
    params[key] = { value: form[key], source: 'user' }
  }
  params['drillDensity'] = { value: computedDrillDensity.value, source: 'computed' }
  if (stackupRows.value.length) params['stackupTable'] = { value: stackupRows.value, source: 'user' }
  if (impRows.value.length) params['impedanceTable'] = { value: impRows.value, source: 'user' }
  const payload = params
  const win = window as any
  console.log('[我→QT] 订单请求:', JSON.stringify(payload, null, 2))
  try {
    if (!win.QtBridge?.send) throw new Error('QtBridge.send 不可用')
    win.QtBridge.send('html-button-message', payload)
  } catch (error: any) {
    ordering.value = false
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
  Object.keys(form).forEach(k => { p[k] = form[k] })
  p['drillDensity'] = computedDrillDensity.value
  if (stackupRows.value.length) p['stackupTable'] = stackupRows.value
  if (impRows.value.length) p['impedanceTable'] = impRows.value
  return p
}

// ==================== QtMessage ====================
async function handleQtMessage(event: Event) {
  if (!componentActive) return
  const detail = (event as CustomEvent<any>).detail
  if (!detail || typeof detail !== 'object') return

  const rn = detail.returnName
  // 仅记录消息类型和状态，不输出 Token 或完整业务数据。
  // console.debug('[QT消息]', { returnName: rn, code: detail.code })
  console.log('[QT消息]', { returnName: rn, code: detail })

  if (rn === 'token') {
    if (detail.taskId) taskId.value = detail.taskId
    tokenReady.value = Boolean(taskId.value)
    if (!tokenReady.value) { ElMessage.error('未获取到有效 TaskId'); return }
    loadQuoteParamsFromApi()
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
    updateOrderStatus({ taskId: taskId.value }).then((res: any) => {
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
    } catch (error) {
      reportError('订单支付流程', error, '订单处理失败，请稍后重试')
    } finally {
      orderWorkflowPending = false
      finishOrderRequest()
    }
    return
  }

  // 表单数据
  const data = detail.parameters || detail
  applyFieldData(data)
  formDataLoaded.value = true
  ElMessage.success('数据已同步')
}

// 用 API 数据填充表单
async function loadQuoteParamsFromApi() {
  try {
    const res: any = await getOnlineQuoteParamsInfo({ task_id: taskId.value  })
    if (res.code === 200 && res.data) {
      const data = res.data
      for (const key of Object.keys(form)) {
        // API 返回字段名与表单 key 一致，直接用
        if (!(key in data)) continue
        const v = data[key]
        if (v !== null && v !== undefined) {
          if (Array.isArray(form[key])) {
            form[key] = Array.isArray(v) ? v : (v ? [v] : [])
          } else if (typeof form[key] === 'boolean') {
            form[key] = Boolean(v)
          } else if (typeof form[key] === 'number') {
            const n = Number(v)
            form[key] = Number.isFinite(n) ? n : form[key]
          } else {
            form[key] = v
          }
        }
      }
      formDataLoaded.value = true
      // 获取旧报价
      getOrderPriceQuery({ task_id: taskId.value  }).then((priceRes: any) => {
        if (priceRes.code === 200) oldQuoteData.value = priceRes.data
      }).catch(() => {})
    }
  } catch {}
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
  <div class="page">
    <div v-if="!formDataLoaded" class="loading-bar"></div>
    <div v-if="formDataLoaded && !tokenReady" class="token-banner">请等待身份验证完成，当前仅可编辑表单...</div>
    <div class="form-box">
      <table class="param-table">
        <thead><tr><th style="width:24%">项目类型名称</th><th style="width:34%">参数值</th><th style="width:22%">来源</th><th style="width:20%">查看</th></tr></thead>
        <tbody>
          <!-- 一、基本信息 -->
          <tr class="section-row" @click="sections.basic = !sections.basic"><td colspan="4">一、PCB 基本信息 <span class="arrow" :class="{ up: sections.basic }">▼</span></td></tr>
          <template v-if="sections.basic">
            <tr><td>生产型号</td><td><el-input v-model="form.pcbName" size="small" /></td><td class="td-src"><span :class="sourceClass('pcbName')">{{ sourceLabel('pcbName') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('pcbName')" class="btn-view graphic" @click="handleViewClick('pcbName')">图形</button><button v-if="showDocBtn('pcbName')" class="btn-view doc" @click="handleViewClick('pcbName')">加工文档</button></td></tr>
            <tr><td>PCB 资料（客户品名）<span class="req">*</span></td><td><el-input v-model="form.pcbFile" size="small" /></td><td class="td-src"><span :class="sourceClass('pcbFile')">{{ sourceLabel('pcbFile') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('pcbFile')" class="btn-view graphic" @click="handleViewClick('pcbFile')">图形</button><button v-if="showDocBtn('pcbFile')" class="btn-view doc" @click="handleViewClick('pcbFile')">加工文档</button></td></tr>
            <tr><td>板子层数<span class="req">*</span></td><td><el-select v-model="form.layerCount" size="small" style="width:100%"><el-option v-for="v in opts.layerCount" :key="v" :label="v+'层'" :value="Number(v)" /></el-select></td><td class="td-src"><span :class="sourceClass('layerCount')">{{ sourceLabel('layerCount') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('layerCount')" class="btn-view graphic" @click="handleViewClick('layerCount')">图形</button><button v-if="showDocBtn('layerCount')" class="btn-view doc" @click="handleViewClick('layerCount')">加工文档</button></td></tr>
            <tr><td>盲埋孔</td><td><el-select v-model="form.blindVia" size="small" style="width:100%"><el-option v-for="v in opts.blindVia" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('blindVia')">{{ sourceLabel('blindVia') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('blindVia')" class="btn-view graphic" @click="handleViewClick('blindVia')">图形</button><button v-if="showDocBtn('blindVia')" class="btn-view doc" @click="handleViewClick('blindVia')">加工文档</button></td></tr>
            <tr><td>PCS尺寸(水平)<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.pcsSizeWidth" :min="0" :max="571.5" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('pcsSizeWidth')">{{ sourceLabel('pcsSizeWidth') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('pcsSizeWidth')" class="btn-view graphic" @click="handleViewClick('pcsSizeWidth')">图形</button><button v-if="showDocBtn('pcsSizeWidth')" class="btn-view doc" @click="handleViewClick('pcsSizeWidth')">加工文档</button></td></tr>
            <tr><td>PCS尺寸(垂直)<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.pcsSizeHeight" :min="0" :max="571.5" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('pcsSizeHeight')">{{ sourceLabel('pcsSizeHeight') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('pcsSizeHeight')" class="btn-view graphic" @click="handleViewClick('pcsSizeHeight')">图形</button><button v-if="showDocBtn('pcsSizeHeight')" class="btn-view doc" @click="handleViewClick('pcsSizeHeight')">加工文档</button></td></tr>
            <tr><td>外形公差<span class="req">*</span></td><td><el-select v-model="form.dimensionTolerance" size="small" style="width:100%"><el-option v-for="v in opts.dimensionTolerance" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('dimensionTolerance')">{{ sourceLabel('dimensionTolerance') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('dimensionTolerance')" class="btn-view graphic" @click="handleViewClick('dimensionTolerance')">图形</button><button v-if="showDocBtn('dimensionTolerance')" class="btn-view doc" @click="handleViewClick('dimensionTolerance')">加工文档</button></td></tr>
            <tr><td>板子数量<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.quantity" :min="1" size="small" style="width:100%" /></td><td class="td-src"><span :class="sourceClass('quantity')">{{ sourceLabel('quantity') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('quantity')" class="btn-view graphic" @click="handleViewClick('quantity')">图形</button><button v-if="showDocBtn('quantity')" class="btn-view doc" @click="handleViewClick('quantity')">加工文档</button></td></tr>
            <tr><td>交货单位<span class="req">*</span></td><td><el-select v-model="form.deliveryUnit" size="small" style="width:100%"><el-option v-for="v in opts.deliveryUnit" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('deliveryUnit')">{{ sourceLabel('deliveryUnit') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('deliveryUnit')" class="btn-view graphic" @click="handleViewClick('deliveryUnit')">图形</button><button v-if="showDocBtn('deliveryUnit')" class="btn-view doc" @click="handleViewClick('deliveryUnit')">加工文档</button></td></tr>
            <tr><td>合拼种数<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.panelTypesCount" :min="1" :max="100" size="small" style="width:100%" /></td><td class="td-src"><span :class="sourceClass('panelTypesCount')">{{ sourceLabel('panelTypesCount') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('panelTypesCount')" class="btn-view graphic" @click="handleViewClick('panelTypesCount')">图形</button><button v-if="showDocBtn('panelTypesCount')" class="btn-view doc" @click="handleViewClick('panelTypesCount')">加工文档</button></td></tr>
            <tr><td>Set拼板方式<span class="req">*</span></td><td><el-select v-model="form.setMethod" size="small" style="width:100%"><el-option v-for="v in opts.setMethodAll" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('setMethod')">{{ sourceLabel('setMethod') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('setMethod')" class="btn-view graphic" @click="handleViewClick('setMethod')">图形</button><button v-if="showDocBtn('setMethod')" class="btn-view doc" @click="handleViewClick('setMethod')">加工文档</button></td></tr>
              <template v-if="showPanelFields">
              <tr><td>拼板个数(水平)<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.clientPanelHorizontal" :min="1" :max="500" size="small" style="width:100%" /></td><td class="td-src"><span :class="sourceClass('clientPanelHorizontal')">{{ sourceLabel('clientPanelHorizontal') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('clientPanelHorizontal')" class="btn-view graphic" @click="handleViewClick('clientPanelHorizontal')">图形</button><button v-if="showDocBtn('clientPanelHorizontal')" class="btn-view doc" @click="handleViewClick('clientPanelHorizontal')">加工文档</button></td></tr>
              <tr><td>拼板个数(垂直)<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.clientPanelVertical" :min="1" :max="500" size="small" style="width:100%" /></td><td class="td-src"><span :class="sourceClass('clientPanelVertical')">{{ sourceLabel('clientPanelVertical') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('clientPanelVertical')" class="btn-view graphic" @click="handleViewClick('clientPanelVertical')">图形</button><button v-if="showDocBtn('clientPanelVertical')" class="btn-view doc" @click="handleViewClick('clientPanelVertical')">加工文档</button></td></tr>
              <tr><td>Set尺寸(水平)<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.setSizeWidth" :min="0" :max="571.5" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('setSizeWidth')">{{ sourceLabel('setSizeWidth') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('setSizeWidth')" class="btn-view graphic" @click="handleViewClick('setSizeWidth')">图形</button><button v-if="showDocBtn('setSizeWidth')" class="btn-view doc" @click="handleViewClick('setSizeWidth')">加工文档</button></td></tr>
              <tr><td>Set尺寸(垂直)<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.setSizeHeight" :min="0" :max="571.5" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('setSizeHeight')">{{ sourceLabel('setSizeHeight') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('setSizeHeight')" class="btn-view graphic" @click="handleViewClick('setSizeHeight')">图形</button><button v-if="showDocBtn('setSizeHeight')" class="btn-view doc" @click="handleViewClick('setSizeHeight')">加工文档</button></td></tr>
              <tr><td>外形要求<span class="req">*</span></td><td><el-select v-model="form.clientPanelSeparation" size="small" style="width:100%"><el-option v-for="v in opts.clientPanelSeparation" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('clientPanelSeparation')">{{ sourceLabel('clientPanelSeparation') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('clientPanelSeparation')" class="btn-view graphic" @click="handleViewClick('clientPanelSeparation')">图形</button><button v-if="showDocBtn('clientPanelSeparation')" class="btn-view doc" @click="handleViewClick('clientPanelSeparation')">加工文档</button></td></tr>
              <tr><td>是否接受打叉板</td><td><el-select v-model="form.acceptXOut" size="small" style="width:100%"><el-option v-for="v in opts.acceptXOut" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('acceptXOut')">{{ sourceLabel('acceptXOut') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('acceptXOut')" class="btn-view graphic" @click="handleViewClick('acceptXOut')">图形</button><button v-if="showDocBtn('acceptXOut')" class="btn-view doc" @click="handleViewClick('acceptXOut')">加工文档</button></td></tr>
              </template>
          </template>

          <!-- 二、工艺信息 -->
          <tr class="section-row" @click="sections.process = !sections.process"><td colspan="4">二、PCB 工艺信息 <span class="arrow" :class="{ up: sections.process }">▼</span></td></tr>
          <template v-if="sections.process">
            <tr><td>板材种类<span class="req">*</span></td><td><el-select v-model="form.materialType" size="small" style="width:100%"><el-option v-for="v in opts.materialType" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('materialType')">{{ sourceLabel('materialType') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('materialType')" class="btn-view graphic" @click="handleViewClick('materialType')">图形</button><button v-if="showDocBtn('materialType')" class="btn-view doc" @click="handleViewClick('materialType')">加工文档</button></td></tr>
            <tr><td>板材品牌</td><td><el-autocomplete v-model="form.materialBrand" :fetch-suggestions="queryMaterialBrand" size="small" style="width:100%" placeholder="输入搜索板材品牌" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete></td><td class="td-src"><span :class="sourceClass('materialBrand')">{{ sourceLabel('materialBrand') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('materialBrand')" class="btn-view graphic" @click="handleViewClick('materialBrand')">图形</button><button v-if="showDocBtn('materialBrand')" class="btn-view doc" @click="handleViewClick('materialBrand')">加工文档</button></td></tr>
            <tr><td>板材型号</td><td><el-autocomplete v-model="form.materialVersion" :fetch-suggestions="queryMaterialVersion" size="small" style="width:100%" placeholder="输入搜索板材型号" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete></td><td class="td-src"><span :class="sourceClass('materialVersion')">{{ sourceLabel('materialVersion') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('materialVersion')" class="btn-view graphic" @click="handleViewClick('materialVersion')">图形</button><button v-if="showDocBtn('materialVersion')" class="btn-view doc" @click="handleViewClick('materialVersion')">加工文档</button></td></tr>
            <tr><td>高TG<span class="req">*</span></td><td><el-select v-model="form.materialTg" size="small" style="width:100%"><el-option v-for="v in opts.materialTg" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('materialTg')">{{ sourceLabel('materialTg') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('materialTg')" class="btn-view graphic" @click="handleViewClick('materialTg')">图形</button><button v-if="showDocBtn('materialTg')" class="btn-view doc" @click="handleViewClick('materialTg')">加工文档</button></td></tr>
            <tr><td>无卤板材<span class="req">*</span></td><td><el-select v-model="form.halogenFree" size="small" style="width:100%"><el-option v-for="v in opts.halogenFree" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('halogenFree')">{{ sourceLabel('halogenFree') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('halogenFree')" class="btn-view graphic" @click="handleViewClick('halogenFree')">图形</button><button v-if="showDocBtn('halogenFree')" class="btn-view doc" @click="handleViewClick('halogenFree')">加工文档</button></td></tr>
            <tr><td>翘曲度<span class="req">*</span></td><td><el-select v-model="form.maxWarpage" size="small" style="width:100%"><el-option v-for="v in opts.maxWarpage" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('maxWarpage')">{{ sourceLabel('maxWarpage') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('maxWarpage')" class="btn-view graphic" @click="handleViewClick('maxWarpage')">图形</button><button v-if="showDocBtn('maxWarpage')" class="btn-view doc" @click="handleViewClick('maxWarpage')">加工文档</button></td></tr>
            <tr><td>成品板厚<span class="req">*</span></td><td><el-autocomplete v-model="form.boardThickness" :fetch-suggestions="queryBoardThickness" @select="(item: any) => { form.boardThickness = item.value }" size="small" style="width:100%" placeholder="输入搜索成品板厚" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('boardThickness')">{{ sourceLabel('boardThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('boardThickness')" class="btn-view graphic" @click="handleViewClick('boardThickness')">图形</button><button v-if="showDocBtn('boardThickness')" class="btn-view doc" @click="handleViewClick('boardThickness')">加工文档</button></td></tr>
            <tr><td>板厚公差<span class="req">*</span></td><td><el-autocomplete v-model="form.thicknessTolerance" :fetch-suggestions="queryThicknessTolerance" size="small" style="width:100%" placeholder="输入搜索板厚公差" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete></td><td class="td-src"><span :class="sourceClass('thicknessTolerance')">{{ sourceLabel('thicknessTolerance') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('thicknessTolerance')" class="btn-view graphic" @click="handleViewClick('thicknessTolerance')">图形</button><button v-if="showDocBtn('thicknessTolerance')" class="btn-view doc" @click="handleViewClick('thicknessTolerance')">加工文档</button></td></tr>
            <tr><td>外层完成铜厚度<span class="req">*</span></td><td><el-autocomplete v-model="form.outerCopperThickness" :fetch-suggestions="queryOuterCopperThickness" @select="(item: any) => { form.outerCopperThickness = item.value }" size="small" style="width:100%" placeholder="输入搜索外层完成铜厚度" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete><span class="unit">um</span></td><td class="td-src"><span :class="sourceClass('outerCopperThickness')">{{ sourceLabel('outerCopperThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('outerCopperThickness')" class="btn-view graphic" @click="handleViewClick('outerCopperThickness')">图形</button><button v-if="showDocBtn('outerCopperThickness')" class="btn-view doc" @click="handleViewClick('outerCopperThickness')">加工文档</button></td></tr>
            <tr><td>外层基铜厚度</td><td><el-autocomplete v-model="form.outerBaseCopperThickness" :fetch-suggestions="queryOuterBaseCopperThickness" @select="(item: any) => { form.outerBaseCopperThickness = item.value }" size="small" style="width:100%" placeholder="输入搜索外层基铜厚度" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete><span class="unit">um</span></td><td class="td-src"><span :class="sourceClass('outerBaseCopperThickness')">{{ sourceLabel('outerBaseCopperThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('outerBaseCopperThickness')" class="btn-view graphic" @click="handleViewClick('outerBaseCopperThickness')">图形</button><button v-if="showDocBtn('outerBaseCopperThickness')" class="btn-view doc" @click="handleViewClick('outerBaseCopperThickness')">加工文档</button></td></tr>
            <tr><td>内层基铜厚度<span class="req">*</span></td><td><el-autocomplete v-model="form.innerCopperThickness" :fetch-suggestions="queryInnerCopperThickness" size="small" style="width:100%" placeholder="输入搜索内层基铜厚度" clearable @select="(item: any) => { form.innerCopperThickness = item.value }"><template #default="{ item }"><div class="autocomplete-item">{{ item.value }} oz</div></template></el-autocomplete><span class="unit">oz</span></td><td class="td-src"><span :class="sourceClass('innerCopperThickness')">{{ sourceLabel('innerCopperThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('innerCopperThickness')" class="btn-view graphic" @click="handleViewClick('innerCopperThickness')">图形</button><button v-if="showDocBtn('innerCopperThickness')" class="btn-view doc" @click="handleViewClick('innerCopperThickness')">加工文档</button></td></tr>
            <tr><td>外层最小线宽<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.minTraceWidthOuter" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mil</span></td><td class="td-src"><span :class="sourceClass('minTraceWidthOuter')">{{ sourceLabel('minTraceWidthOuter') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('minTraceWidthOuter')" class="btn-view graphic" @click="handleViewClick('minTraceWidthOuter')">图形</button><button v-if="showDocBtn('minTraceWidthOuter')" class="btn-view doc" @click="handleViewClick('minTraceWidthOuter')">加工文档</button></td></tr>
            <tr><td>外层最小线距<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.minTraceSpacingOuter" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mil</span></td><td class="td-src"><span :class="sourceClass('minTraceSpacingOuter')">{{ sourceLabel('minTraceSpacingOuter') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('minTraceSpacingOuter')" class="btn-view graphic" @click="handleViewClick('minTraceSpacingOuter')">图形</button><button v-if="showDocBtn('minTraceSpacingOuter')" class="btn-view doc" @click="handleViewClick('minTraceSpacingOuter')">加工文档</button></td></tr>
              <template v-if="hasInnerLayer">
              <tr><td>内层最小线宽<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.minTraceWidthInner" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mil</span></td><td class="td-src"><span :class="sourceClass('minTraceWidthInner')">{{ sourceLabel('minTraceWidthInner') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('minTraceWidthInner')" class="btn-view graphic" @click="handleViewClick('minTraceWidthInner')">图形</button><button v-if="showDocBtn('minTraceWidthInner')" class="btn-view doc" @click="handleViewClick('minTraceWidthInner')">加工文档</button></td></tr>
              <tr><td>内层最小线距<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.minTraceSpacingInner" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mil</span></td><td class="td-src"><span :class="sourceClass('minTraceSpacingInner')">{{ sourceLabel('minTraceSpacingInner') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('minTraceSpacingInner')" class="btn-view graphic" @click="handleViewClick('minTraceSpacingInner')">图形</button><button v-if="showDocBtn('minTraceSpacingInner')" class="btn-view doc" @click="handleViewClick('minTraceSpacingInner')">加工文档</button></td></tr>
              </template>
            <tr><td>最小孔径<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.minHoleSize" :min="0" :precision="3" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('minHoleSize')">{{ sourceLabel('minHoleSize') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('minHoleSize')" class="btn-view graphic" @click="handleViewClick('minHoleSize')">图形</button><button v-if="showDocBtn('minHoleSize')" class="btn-view doc" @click="handleViewClick('minHoleSize')">加工文档</button></td></tr>
			            <tr><td>孔密度</td><td><span style="display:inline-block;padding:4px 8px;">{{ computedDrillDensity || '--' }}</span></td><td class="td-src"><span class="badge empty">--</span></td><td class="td-view"></td></tr>
			            <tr><td>通孔孔数（SET或PCS）</td><td><el-input-number :controls="false" v-model="form.holeCount" :min="0" :precision="0" size="small" style="width:100%" /></td><td class="td-src"><span :class="sourceClass('holeCount')">{{ sourceLabel('holeCount') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('holeCount')" class="btn-view graphic" @click="handleViewClick('holeCount')">图形</button><button v-if="showDocBtn('holeCount')" class="btn-view doc" @click="handleViewClick('holeCount')">加工文档</button></td></tr>
            <tr><td>最小孔铜<span class="req">*</span></td><td><el-autocomplete v-model="form.holeCopperThickness" :fetch-suggestions="queryHoleCopperThickness" size="small" style="width:100%" placeholder="输入或选择" clearable @select="(item: any) => { form.holeCopperThickness = item.value }"><template #default="{ item }"><div class="autocomplete-item">{{ item.value }} um</div></template></el-autocomplete><span class="unit">um</span></td><td class="td-src"><span :class="sourceClass('holeCopperThickness')">{{ sourceLabel('holeCopperThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('holeCopperThickness')" class="btn-view graphic" @click="handleViewClick('holeCopperThickness')">图形</button><button v-if="showDocBtn('holeCopperThickness')" class="btn-view doc" @click="handleViewClick('holeCopperThickness')">加工文档</button></td></tr>
            <tr><td>阻焊颜色<span class="req">*</span></td><td><el-select v-model="form.solderMaskColor" size="small" style="width:100%"><el-option v-for="v in opts.solderMaskColor" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('solderMaskColor')">{{ sourceLabel('solderMaskColor') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('solderMaskColor')" class="btn-view graphic" @click="handleViewClick('solderMaskColor')">图形</button><button v-if="showDocBtn('solderMaskColor')" class="btn-view doc" @click="handleViewClick('solderMaskColor')">加工文档</button></td></tr>
            <tr><td>字符颜色<span class="req">*</span></td><td><el-select v-model="form.silkscreenColor" size="small" style="width:100%"><el-option v-for="v in opts.silkscreenColor" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('silkscreenColor')">{{ sourceLabel('silkscreenColor') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('silkscreenColor')" class="btn-view graphic" @click="handleViewClick('silkscreenColor')">图形</button><button v-if="showDocBtn('silkscreenColor')" class="btn-view doc" @click="handleViewClick('silkscreenColor')">加工文档</button></td></tr>
            <tr><td>表面处理<span class="req">*</span></td><td><el-select v-model="form.surfaceFinish" size="small" style="width:100%"><el-option v-for="v in opts.surfaceFinish" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('surfaceFinish')">{{ sourceLabel('surfaceFinish') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('surfaceFinish')" class="btn-view graphic" @click="handleViewClick('surfaceFinish')">图形</button><button v-if="showDocBtn('surfaceFinish')" class="btn-view doc" @click="handleViewClick('surfaceFinish')">加工文档</button></td></tr>
              <template v-if="showEnigGold">
              <tr><td>最小沉金金厚<span class="req">*</span></td><td><el-autocomplete v-model="form.enigGoldThickness" :fetch-suggestions="queryEnigGoldThickness" size="small" style="width:100%" placeholder="输入搜索最小沉金金厚" clearable @select="(item: any) => { form.enigGoldThickness = item.value }"><template #default="{ item }"><div class="autocomplete-item">{{ item.value }} um</div></template></el-autocomplete><span class="unit">um</span></td><td class="td-src"><span :class="sourceClass('enigGoldThickness')">{{ sourceLabel('enigGoldThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('enigGoldThickness')" class="btn-view graphic" @click="handleViewClick('enigGoldThickness')">图形</button><button v-if="showDocBtn('enigGoldThickness')" class="btn-view doc" @click="handleViewClick('enigGoldThickness')">加工文档</button></td></tr>
              <tr><td>沉金面积（双面之和）<span class="req">*</span></td><td><el-input-number :controls="false" v-model="form.immersionGoldArea" :min="0" :precision="1" size="small" style="width:100%" /><span class="unit">%</span></td><td class="td-src"><span :class="sourceClass('immersionGoldArea')">{{ sourceLabel('immersionGoldArea') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('immersionGoldArea')" class="btn-view graphic" @click="handleViewClick('immersionGoldArea')">图形</button><button v-if="showDocBtn('immersionGoldArea')" class="btn-view doc" @click="handleViewClick('immersionGoldArea')">加工文档</button></td></tr>
              </template>
            <tr><td>过孔工艺<span class="req">*</span></td><td><el-select v-model="form.viaProcess" size="small" style="width:100%"><el-option v-for="v in opts.viaProcess" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('viaProcess')">{{ sourceLabel('viaProcess') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('viaProcess')" class="btn-view graphic" @click="handleViewClick('viaProcess')">图形</button><button v-if="showDocBtn('viaProcess')" class="btn-view doc" @click="handleViewClick('viaProcess')">加工文档</button></td></tr>
            <tr><td>金手指类型<span class="req">*</span></td><td><el-select v-model="form.goldFingerType" size="small" style="width:100%"><el-option v-for="v in opts.goldFingerType" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('goldFingerType')">{{ sourceLabel('goldFingerType') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('goldFingerType')" class="btn-view graphic" @click="handleViewClick('goldFingerType')">图形</button><button v-if="showDocBtn('goldFingerType')" class="btn-view doc" @click="handleViewClick('goldFingerType')">加工文档</button></td></tr>
              <template v-if="showGoldFinger">
              <tr><td>金手指金厚<span class="req">*</span></td><td><el-autocomplete v-model="form.goldFingerThickness" :fetch-suggestions="queryGoldFingerThickness" size="small" style="width:100%" placeholder="输入搜索金手指金厚" clearable @select="(item: any) => { form.goldFingerThickness = item.value }"><template #default="{ item }"><div class="autocomplete-item">{{ item.value }} um</div></template></el-autocomplete><span class="unit">um</span></td><td class="td-src"><span :class="sourceClass('goldFingerThickness')">{{ sourceLabel('goldFingerThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('goldFingerThickness')" class="btn-view graphic" @click="handleViewClick('goldFingerThickness')">图形</button><button v-if="showDocBtn('goldFingerThickness')" class="btn-view doc" @click="handleViewClick('goldFingerThickness')">加工文档</button></td></tr>
              <tr><td>倒角角度<span class="req">*</span></td><td><el-select v-model="form.goldFingerChamferAngle" size="small" style="width:100%"><el-option v-for="v in opts.goldFingerChamferAngle" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('goldFingerChamferAngle')">{{ sourceLabel('goldFingerChamferAngle') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('goldFingerChamferAngle')" class="btn-view graphic" @click="handleViewClick('goldFingerChamferAngle')">图形</button><button v-if="showDocBtn('goldFingerChamferAngle')" class="btn-view doc" @click="handleViewClick('goldFingerChamferAngle')">加工文档</button></td></tr>
              <tr><td>倒角深度</td><td><el-input-number :controls="false" v-model="form.goldFingerChamferDepth" :min="0" :max="10" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('goldFingerChamferDepth')">{{ sourceLabel('goldFingerChamferDepth') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('goldFingerChamferDepth')" class="btn-view graphic" @click="handleViewClick('goldFingerChamferDepth')">图形</button><button v-if="showDocBtn('goldFingerChamferDepth')" class="btn-view doc" @click="handleViewClick('goldFingerChamferDepth')">加工文档</button></td></tr>
              <tr><td>金手指倒角余厚</td><td><el-input-number :controls="false" v-model="form.goldFingerChamferRemaining" :min="0" :max="10" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('goldFingerChamferRemaining')">{{ sourceLabel('goldFingerChamferRemaining') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('goldFingerChamferRemaining')" class="btn-view graphic" @click="handleViewClick('goldFingerChamferRemaining')">图形</button><button v-if="showDocBtn('goldFingerChamferRemaining')" class="btn-view doc" @click="handleViewClick('goldFingerChamferRemaining')">加工文档</button></td></tr>
              </template>
          </template>

          <!-- 三、个性化服务 -->
          <tr class="section-row" @click="sections.custom = !sections.custom"><td colspan="4">三、个性化服务 <span class="arrow" :class="{ up: sections.custom }">▼</span></td></tr>
          <template v-if="sections.custom">
            <tr><td>验收标准<span class="req">*</span></td><td><el-select v-model="form.acceptanceStandard" size="small" style="width:100%"><el-option v-for="v in opts.acceptanceStandard" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('acceptanceStandard')">{{ sourceLabel('acceptanceStandard') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('acceptanceStandard')" class="btn-view graphic" @click="handleViewClick('acceptanceStandard')">图形</button><button v-if="showDocBtn('acceptanceStandard')" class="btn-view doc" @click="handleViewClick('acceptanceStandard')">加工文档</button></td></tr>
            <tr><td>阻抗控制<span class="req">*</span></td><td><el-select v-model="form.impedanceControl" size="small" style="width:100%"><el-option v-for="v in opts.impedanceControl" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('impedanceControl')">{{ sourceLabel('impedanceControl') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('impedanceControl')" class="btn-view graphic" @click="handleViewClick('impedanceControl')">图形</button><button v-if="showDocBtn('impedanceControl')" class="btn-view doc" @click="handleViewClick('impedanceControl')">加工文档</button></td></tr>
            <tr><td>标记要求<span class="req">*</span></td><td><el-select v-model="form.markingRequirements" size="small" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.markingRequirements" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('markingRequirements')">{{ sourceLabel('markingRequirements') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('markingRequirements')" class="btn-view graphic" @click="handleViewClick('markingRequirements')">图形</button><button v-if="showDocBtn('markingRequirements')" class="btn-view doc" @click="handleViewClick('markingRequirements')">加工文档</button></td></tr>
            <tr><td>周期格式<span class="req">*</span></td><td><el-select v-model="form.periodFormat" size="small" style="width:100%"><el-option v-for="v in opts.periodFormat" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('periodFormat')">{{ sourceLabel('periodFormat') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('periodFormat')" class="btn-view graphic" @click="handleViewClick('periodFormat')">图形</button><button v-if="showDocBtn('periodFormat')" class="btn-view doc" @click="handleViewClick('periodFormat')">加工文档</button></td></tr>
            <tr><td>测试要求<span class="req">*</span></td><td><el-select v-model="form.testRequirements" size="small" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.testRequirements" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('testRequirements')">{{ sourceLabel('testRequirements') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('testRequirements')" class="btn-view graphic" @click="handleViewClick('testRequirements')">图形</button><button v-if="showDocBtn('testRequirements')" class="btn-view doc" @click="handleViewClick('testRequirements')">加工文档</button></td></tr>
            <tr><td>出货报告<span class="req">*</span></td><td><el-select v-model="form.shippingReports" size="small" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.shippingReports" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('shippingReports')">{{ sourceLabel('shippingReports') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('shippingReports')" class="btn-view graphic" @click="handleViewClick('shippingReports')">图形</button><button v-if="showDocBtn('shippingReports')" class="btn-view doc" @click="handleViewClick('shippingReports')">加工文档</button></td></tr>
            <tr><td>特殊工艺<span class="req">*</span></td><td><el-select v-model="form.specialProcesses" size="small" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.specialProcesses" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('specialProcesses')">{{ sourceLabel('specialProcesses') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('specialProcesses')" class="btn-view graphic" @click="handleViewClick('specialProcesses')">图形</button><button v-if="showDocBtn('specialProcesses')" class="btn-view doc" @click="handleViewClick('specialProcesses')">加工文档</button></td></tr>
            <tr><td>光绘确认<span class="req">*</span></td><td><el-select v-model="form.confirmProductionFile" size="small" style="width:100%"><el-option v-for="v in opts.confirmProductionFile" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('confirmProductionFile')">{{ sourceLabel('confirmProductionFile') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('confirmProductionFile')" class="btn-view graphic" @click="handleViewClick('confirmProductionFile')">图形</button><button v-if="showDocBtn('confirmProductionFile')" class="btn-view doc" @click="handleViewClick('confirmProductionFile')">加工文档</button></td></tr>
          </template>

          <!-- 四、叠层 -->
          <tr class="section-row" @click="sections.stackup = !sections.stackup"><td colspan="4">四、叠层 <span class="arrow" :class="{ up: sections.stackup }">▼</span></td></tr>
          <tr v-if="sections.stackup"><td colspan="4"><table class="inner-table"><thead><tr><th>层号</th><th>材料</th><th>类型</th><th>铜厚(mil)</th><th>介质厚度(mil)</th><th>介电常数</th><th></th></tr></thead><tbody><tr v-for="(row,i) in stackupRows" :key="i"><td><el-input v-model="row.layerName" size="small" /></td><td><el-select v-model="row.material" size="small"><el-option v-for="m in ['PP','CORE','CU','光板']" :key="m" :label="m" :value="m" /></el-select></td><td><el-input v-model="row.pcbMaterialType" size="small" :disabled="row.material==='CU'" /></td><td><el-input-number :controls="false" v-model="row.copperThickness" size="small" :min="0.1" :max="10" :precision="2" :disabled="row.material!=='CU'" /></td><td><el-input-number :controls="false" v-model="row.dielectricThickness" size="small" :min="0.01" :max="100" :precision="2" :disabled="row.material==='CU'" /></td><td><el-input-number :controls="false" v-model="row.dk" size="small" :min="1" :max="50" :precision="2" :disabled="row.material==='CU'" /></td><td><button class="btn-del-row" @click="stackupRows.splice(i,1)">✕</button></td></tr></tbody></table><button class="btn-add-row" @click="addStackupRow">+ 新增一行</button></td></tr>

          <!-- 五、阻抗 -->
          <tr class="section-row" @click="sections.impedance = !sections.impedance"><td colspan="4">五、阻抗控制要求 <span class="arrow" :class="{ up: sections.impedance }">▼</span></td></tr>
          <tr v-if="sections.impedance"><td colspan="4"><table class="inner-table"><thead><tr><th>阻抗类型</th><th>控制层</th><th>上参</th><th>下参</th><th>盖油</th><th>线宽(mil)</th><th>线距(mil)</th><th>线铜(mil)</th><th>阻抗(ohm)</th><th>公差(%)</th><th></th></tr></thead><tbody><tr v-for="(row,i) in impRows" :key="i"><td><el-select v-model="row.impType" size="small"><el-option v-for="t in impTypes" :key="t" :label="t" :value="t" /></el-select></td><td><el-input v-model="row.controlLayer" size="small" /></td><td><el-input v-model="row.refLayerTop" size="small" /></td><td><el-input v-model="row.refLayerBottom" size="small" /></td><td><el-switch v-model="row.isCoated" size="small" /></td><td><el-input-number :controls="false" v-model="row.lineWidth" :min="1" :max="100" :precision="2" size="small" /></td><td><el-input-number :controls="false" v-model="row.lineSpacing" :min="1" :max="100" :precision="2" size="small" /></td><td><el-input-number :controls="false" v-model="row.lineToCopper" :min="1" :max="100" :precision="2" size="small" /></td><td><el-input-number :controls="false" v-model="row.impTarget" :min="1" :max="200" :precision="2" size="small" /></td><td><el-input-number :controls="false" v-model="row.impTol" :min="1" :max="50" :precision="1" size="small" /></td><td><button class="btn-del-row" @click="impRows.splice(i,1)">✕</button></td></tr></tbody></table><button class="btn-add-row" @click="addImpRow">+ 新增一行</button></td></tr>
        </tbody>
      </table>


      <!-- 线上旧报价 -->
      <div v-if="oldQuoteData" class="quote-card old-quote-card">
        <div class="qc-title">📋 线上报价</div>
        <template v-if="oldQuoteData.items && oldQuoteData.items.length">
          <div class="qc-grid" v-for="(item, idx) in oldQuoteData.items" :key="idx">
            <div class="qc-row"><span>制板费</span><span class="qcv">¥{{ formatMoney(item.ai_analysis_price_data?.board_base_fee) }}</span></div>
            <div class="qc-row"><span>工程费</span><span class="qcv">¥{{ formatMoney(item.ai_analysis_price_data?.engineering_fee) }}</span></div>
            <div class="qc-row"><span>特殊工艺加价</span><span class="qcv">¥{{ formatMoney(item.ai_analysis_price_data?.special_process_fee) }}</span></div>
            <div class="qc-row"><span>加急费</span><span class="qcv">¥{{ formatMoney(item.ai_analysis_price_data?.expedite_fee) }}</span></div>
            <div class="qc-row"><span>交期</span><span class="qcv">{{ item.ai_analysis_price_data?.delivery_days || '--' }} 天</span></div>
            <div class="qc-row"><span>单价</span><span class="qcv">¥{{ formatMoney(item.ai_analysis_price_data?.price) }}</span></div>
          </div>
        </template>
        <div class="qc-divider"></div>
        <div class="qc-row"><span>运费</span><span class="qcv">¥{{ formatMoney(oldQuoteData.items?.[0]?.ai_analysis_price_data?.freight_price) }}</span></div>
        <div class="qc-total"><span>总价</span><span class="qc-price">¥{{ formatMoney(oldQuoteData.total_price) }}</span></div>
      </div>

      <!-- 报价 -->
      <div class="quote-card">
        <div class="qc-title">💰 报价摘要</div>
        <div class="qc-grid">
          <div class="qc-row"><span>制板费</span><span class="qcv">¥{{ formatMoney(quoteData?.boardBaseFee) }}</span></div>
          <div class="qc-row"><span>工程费</span><span class="qcv">¥{{ formatMoney(quoteData?.engineeringFee) }}</span></div>
          <div class="qc-row"><span>特殊工艺加价</span><span class="qcv">¥{{ formatMoney(quoteData?.specialProcessFee) }}</span></div>
          <div class="qc-row"><span>加急费</span><span class="qcv">¥{{ quoteData?.expediteFee || '--' }}</span></div>
          <div class="qc-row"><span>单价</span><span class="qcv">{{ quoteData ? '¥' + formatMoney(quoteData.price) + ' / PCS' : '--' }}</span></div>
        </div>
        <div class="qc-total"><span>预估总价<br><small>(不含税运)</small></span><span class="qc-price">{{ quoteData ? '¥' + formatMoney(quoteData.totalFee) : '--' }}</span></div>
        <button class="btn-submit" :disabled="submitting || !tokenReady" @click="submitForm">{{ submitting ? '提交中...' : '获取报价' }}</button>
        <button class="btn-submit btn-order" :disabled="ordering || !quoteData || !tokenReady || orderCompleted" @click="submitOrder">{{ orderCompleted ? '已提交' : ordering ? '提交中...' : '提交审核' }}</button>
        <p class="qc-note">价格仅供参考，以审核为准</p>
      </div>
    </div>

  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: #f5f6fa; padding: 12px; }
.form-box { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); overflow: hidden; }
.param-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.param-table td { padding: 6px 8px; border: 1px solid #f0f0f0; }
.param-table td:nth-child(2) { display: flex; align-items: center; }
.param-table th { background: #f7f8fa; padding: 8px 10px; border: 1px solid #e5e6eb; font-weight: 600; color: #666; font-size: 11px; }
.section-row { cursor: pointer; }
.section-row td { background: #f0f4ff; font-weight: 600; color: #2756ff; font-size: 13px; padding: 8px 10px; border: 1px solid #e5e6eb; }
.section-row td:hover { background: #e0eaff; }
.arrow { float: right; font-size: 10px; color: #999; display: inline-block; }
.arrow.up { transform: rotate(-180deg); }
.req { color: #f53f3f; margin-left: 2px; }
.inner-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 6px; }
.inner-table th { background: #f7f8fa; padding: 4px 6px; border: 1px solid #e5e6eb; }
.inner-table td { padding: 4px 6px; border: 1px solid #f0f0f0; }

/* 单位 */
.unit { font-size: 11px; color: #999; margin-left: 4px; flex-shrink: 0; }

/* 来源标签 */
.badge { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 500; white-space: nowrap; }
.badge.extracted { background: #e8f0ff; color: #2756ff; border: 1px solid #c4d8ff; }
.badge.ai { background: #f3e8ff; color: #7c3aed; border: 1px solid #d8b4fe; }
.badge.empty { background: #f5f5f5; color: #999; border: 1px solid #e0e0e0; }
.td-src { text-align: center; }
.td-view { text-align: center; }

/* 查看按钮 */
.btn-view { display: inline-flex; align-items: center; font-size: 10px; padding: 2px 8px; border-radius: 10px; cursor: pointer; white-space: nowrap; border: none; }
.btn-view.graphic { border: 1px solid #b7ebc2; background: #f0faf2; color: #00b42a; }
.btn-view.doc { border: 1px solid #ffe0b2; background: #fffaf0; color: #d46b08; }
.autocomplete-item { padding: 2px 0; }
.btn-del-row { border: none; background: none; color: #f53f3f; cursor: pointer; font-size: 14px; }
.btn-add-row { padding: 4px 12px; border: 1px dashed #c4d8ff; border-radius: 4px; background: #f5f8ff; color: #2756ff; font-size: 11px; cursor: pointer; }
.quote-card { background: #f7f8fc; border-radius: 8px; padding: 14px 16px; margin: 12px 16px 16px; border: 1px solid #e5e6eb; }
.qc-title { font-size: 13px; font-weight: 600; color: #333; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; margin-bottom: 10px; }
.qc-grid { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
.qc-row { display: flex; justify-content: space-between; font-size: 11px; color: #666; line-height: 1.7; }
.qcv { color: #333; font-weight: 500; }
.qc-divider { border-top: 1px dashed #ddd; margin: 8px 0; }
.qc-total { display: flex; justify-content: space-between; align-items: baseline; padding-top: 4px; }
.qc-total span { font-size: 13px; font-weight: 600; color: #333; }
.qc-total small { font-size: 11px; color: #999; }
.qc-price { font-size: 22px; font-weight: 700; color: #2756ff; }
.btn-submit { width: 100%; height: 40px; background: linear-gradient(90deg,#2756ff,#4360df); color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 10px; }
.btn-submit:hover { opacity: 0.9; }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.qc-note { font-size: 11px; color: #aaa; text-align: center; margin: 6px 0 0; }

.loading-bar {
  position: fixed; top: 0; left: 0; height: 2px; z-index: 9999;
  background: linear-gradient(90deg, #2756ff, #4360df, #2756ff);
  background-size: 200% 100%;
  animation: loading-slide 1.5s linear infinite;
}
@keyframes loading-slide {
  0% { width: 0; left: 0; }
  50% { width: 60%; left: 20%; }
  100% { width: 0; left: 100%; }
}
.token-banner { text-align: center; padding: 8px 16px; background: #fff7e6; color: #d46b08; font-size: 12px; border-bottom: 1px solid #ffd591; }
</style>
