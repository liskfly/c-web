<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import InvoiceSection from './InvoiceSection.vue'
import DeliverySection from './DeliverySection.vue'
import { orderCreate, payCallback } from '@/api/pcb'
import { pcbPayV2, getPcbOrderStatusV2 } from '@/api/invoice'
import QRCode from 'qrcode'
import {
  ElInput,
  ElSelect,
  ElOption,
  ElInputNumber,
  ElSwitch,
  ElMessage,
  ElDialog,
} from "element-plus";

// ==================== 折叠 ====================
const sections = reactive<Record<string, boolean>>({
  basic: true,
  process: true,
  custom: true,
  stackup: true,
  impedance: true,
  invoice: true,
  delivery: true,
});

const taskId = ref('')
const invoiceRef = ref<any>(null)
const deliveryRef = ref<any>(null)

// ==================== 校验状态 ====================
const invalidFields = ref<Set<string>>(new Set())
const userModified = ref<Set<string>>(new Set())
function isInvalid(f: string): string {
  return invalidFields.value.has(f) ? 'input-error' : ''
}
function clearInvalid(f: string) {
  if (invalidFields.value.has(f)) {
    const next = new Set(invalidFields.value)
    next.delete(f)
    invalidFields.value = next
  }
  // 用户修改过的字段标记为 user 来源
  const mod = new Set(userModified.value)
  mod.add(f)
  userModified.value = mod
}

// ==================== 表单数据（V6.0 字段清单） ====================
const form = reactive<Record<string, any>>({
  pcbName: "", pcbFile: "",
  layerCount: null, blindVia: false,
  pcsSizeWidth: null, pcsSizeHeight: null,
  dimensionTolerance: "", quantity: 0, deliveryUnit: "",
  panelTypesCount: 0, setMethod: "",
  clientPanelHorizontal: 0, clientPanelVertical: 0,
  setSizeWidth: null, setSizeHeight: null,
  clientPanelSeparation: "", acceptXOut: false,
  materialType: "", materialTg: false, halogenFree: false,
  maxWarpage: "", boardThickness: null, thicknessTolerance: "",
  outerCopperThickness: null, outerBaseCopperThickness: null,
  innerCopperThickness: null,
  minTraceWidthOuter: null, minTraceSpacingOuter: null,
  minTraceWidthInner: null, minTraceSpacingInner: null,
  minHoleSize: null, holeCopperThickness: null,
  solderMaskColor: "", silkscreenColor: "", surfaceFinish: "",
  enigGoldThickness: null, immersionGoldArea: null,
  viaProcess: "", goldFingerType: "", goldFingerThickness: null,
  goldFingerChamferAngle: "", goldFingerChamferDepth: null, goldFingerChamferRemaining: null,
  acceptanceStandard: "", impedanceControl: false,
  markingRequirements: [] as string[],
  periodFormat: "",
  testRequirements: [] as string[],
  shippingReports: [] as string[],
  specialProcesses: [] as string[],
  confirmProductionFile: false,
});

// ==================== 数据来源追踪 ====================
const userToken = ref('')
const userUid = ref('')

const fieldSource = reactive<Record<string, string>>({})
const fieldRawData = reactive<Record<string, any>>({})

function sourceLabel(f: string): string { const s = fieldSource[f]; if (s==='ai') return 'AI提参'; if (s==='cam') return '文件解析'; return '--' }
function sourceClass(f: string): string { const s = fieldSource[f]; if (s==='ai') return 'badge ai'; if (s==='cam') return 'badge extracted'; return 'badge empty' }
function showGraphicBtn(f: string): boolean { const r = fieldRawData[f]; if (!r||r.source!=='cam') return false; return Array.isArray(r.items)&&r.items.length>0 }
function showDocBtn(f: string): boolean { const r = fieldRawData[f]; if (!r||r.source!=='ai') return false; return Array.isArray(r.bbox)&&r.bbox.length>0 }
function handleViewClick(f: string) { const r = fieldRawData[f];rawEventData.value = r; if(!r) return; const w=window as any; if(w.QtBridge?.send) w.QtBridge.send('html-button-message',r); else{ElMessage.info('查看: '+f);console.log(JSON.stringify(r,null,2));} }

function applyFieldData(data: Record<string, any>) {
  const boolF=['blindVia','acceptXOut','materialTg','halogenFree','impedanceControl','confirmProductionFile']
  const numF=['boardThickness','outerCopperThickness','outerBaseCopperThickness','innerCopperThickness','holeCopperThickness','enigGoldThickness','goldFingerThickness']
  const arrF=['markingRequirements','testRequirements','shippingReports','specialProcesses']
  for(const k of Object.keys(form)) {
    if(boolF.includes(k)) form[k]=false; else if(arrF.includes(k)) form[k]=[]
    else if(k==='quantity'||k==='panelTypesCount'||k==='clientPanelHorizontal'||k==='clientPanelVertical') form[k]=0
    else if(numF.includes(k)||k==='layerCount') form[k]=null
    else if(['pcsSizeWidth','pcsSizeHeight','setSizeWidth','setSizeHeight','minHoleSize','minTraceWidthOuter','minTraceSpacingOuter','minTraceWidthInner','minTraceSpacingInner','immersionGoldArea','goldFingerChamferDepth','goldFingerChamferRemaining'].includes(k)) form[k]=null
    else form[k]=''
    fieldSource[k]=''; fieldRawData[k]=null
  }
  for(const k of Object.keys(data)) {
    if(!(k in form)) continue
    const e=data[k]; const v=e?.value??e; const s=e?.source??''
    if(boolF.includes(k)) form[k]=Boolean(v); else if(numF.includes(k)) form[k]=Number(v)||0
    else if(arrF.includes(k)) form[k]=Array.isArray(v)?v:(v?[v]:[])
    else form[k]=v
    if(s) fieldSource[k]=s; fieldRawData[k]=e
  }
}

// ==================== 选项 ====================
const opts: Record<string, any[]> = {
  layerCount: [
    "1",
    "2",
    "4",
    "6",
    "8",
    "10",
    "12",
    "14",
    "16",
    "18",
    "20",
    "22",
    "24",
    "26",
    "28",
    "30",
  ],
  blindVia: [{ value: false, label: '否' }, { value: true, label: '是' }],
  dimensionTolerance: ["+/-0.10mm", "+/-0.15mm", "+/-0.20mm"],
  deliveryUnit: ["PCS", "SET"],
  setMethodPCS: ["单片无拼板", "单片加工艺边"],
  setMethodSET: ["客户拼板"],
  clientPanelSeparation: [
    "拼板&邮票孔交货",
    "拼板铣开交货",
    "拼板V-CUT+桥连交货",
    "拼板桥连+邮票孔",
    "拼板V-CUT+邮票孔",
    "拼板V-CUT桥连+邮票孔",
    "拼板桥连交货",
  ],
  acceptXOut: [{ value: true, label: '是' }, { value: false, label: '否' }],
  materialType: ["FR4", "高速板材", "高频板", "PTFE板材", "PI"],
  materialTg: [{ value: false, label: '否' }, { value: true, label: '是' }],
  halogenFree: [{ value: false, label: '否' }, { value: true, label: '是' }],
  maxWarpage: ["无要求", "0.75%", "0.5%", "IPC标准"],
  boardThickness: [
    "0.6",
    "0.7",
    "0.8",
    "0.9",
    "1.0",
    "1.1",
    "1.2",
    "1.3",
    "1.4",
    "1.5",
    "1.6",
    "1.7",
    "1.8",
    "1.9",
    "2.0",
    "2.1",
    "2.2",
    "2.3",
    "2.4",
    "2.5",
    "2.6",
    "2.7",
    "2.8",
    "2.9",
    "3.0",
    "3.1",
    "3.2",
    "3.3",
    "3.4",
    "3.5",
  ],
  thicknessTolerance: ["+/-10%"],
  outerCopperThickness: ["35", "70", "105", "140", "175", "210"],
  outerBaseCopperThickness: [
    "8",
    "12",
    "18",
    "35",
    "52.5",
    "70",
    "105",
    "140",
    "175",
    "210",
  ],
  innerCopperThickness: ["0.5", "1", "2", "3", "4", "5", "6"],
  holeCopperThickness: ["18", "20", "25", "25.4", "30", "35", "40", "45", "50"],
  solderMaskColor: ["绿色", "绿色亚光", "黑色", "黑色亚光", "蓝色", "不印阻焊"],
  silkscreenColor: ["白色字符", "黑色字符", "不印字符"],
  surfaceFinish: [
    "沉金",
    "无铅喷锡",
    "OSP",
    "喷锡",
    "沉银",
    "沉锡",
    "无需表面处理",
  ],
  enigGoldThickness: ["0.05", "0.075", "0.08", "0.1"],
  viaProcess: [
    "按Gerber文件",
    "阻焊覆盖",
    "BGA芯片处阻焊塞孔+按Gerber文件",
    "不盖阻焊",
    "阻焊塞孔",
    "非导电树脂塞孔",
    "非导电树脂塞孔+电镀填平",
  ],
  goldFingerType: ["无", "常规金手指", "分段金手指", "长短金手指"],
  goldFingerThickness: ["0.38", "0.8", "1.25"],
  goldFingerChamferAngle: ["20°", "30°", "45°", "不倒角"],
  acceptanceStandard: ["IPC 2", "IPC 3"],
  impedanceControl: [{ value: false, label: '否' }, { value: true, label: '是' }],
  markingRequirements: [
    "PCB厂家标记",
    "周期标记",
    "无铅标记",
    "rosh标记",
    "防静电标记",
    "加拿大UL",
    "不需要",
  ],
  periodFormat: ["WWYY", "YYWW", "MMYY", "YYMM", "DDMMYY", "YYMMDD"],
  testRequirements: [
    "电感测试",
    "损耗",
    "耐电压测试",
    "孔电阻测试",
    "线电阻测试",
    "不需要",
    "飞针测试",
    "夹具测试",
  ],
  shippingReports: [
    "最终产品检查报告",
    "回流焊测试报告",
    "可焊性测试报告",
    "离子污染度测试报告",
    "耐电压测试报告",
    "热应力检测报告",
    "不需要",
  ],
  specialProcesses: [
    "电镀填孔",
    "金属包边",
    "金属化半孔",
    "背钻孔",
    "锥形孔",
    "阶梯孔",
    "铣阶梯槽",
    "控深钻",
    "不需要",
  ],
  confirmProductionFile: [{ value: false, label: '否' }, { value: true, label: '是' }],
  invoiceType: ["数电增值税（普通）发票", "数电增值税（专用）发票"],
};

// ==================== 条件显示 ====================
const isPCS = computed(() => form.deliveryUnit === "PCS");
const showPanelFields = computed(() => form.setMethod === "客户拼板");
const showEnigGold = computed(() => form.surfaceFinish === "沉金");
const showGoldFinger = computed(() => form.goldFingerType !== "无");
const hasInnerLayer = computed(() => Number(form.layerCount) > 2);

// ==================== 叠层表格 ====================
interface StackupRow {
  layerName: string;
  material: string;
  pcbMaterialType: string;
  copperThickness: number | null;
  dielectricThickness: number | null;
  dk: number | null;
}
const stackupRows = ref<StackupRow[]>([]);
const ppTypes = [
  "IT-158BS",
  "NY2150",
  "S1000HB",
  "S1151GB",
  "S1150GB",
  "S1165B",
  "IT-180A",
  "TU-75P",
  "S1000-2MB",
  "S1000-2B",
  "TU-768",
  "NY2170",
  "S1190B",
  "RO4450F",
  "TU86P HF",
];
const coreTypes = [
  "IT-158",
  "NY2150",
  "S1000H",
  "S1151G",
  "S1150G",
  "S1165",
  "IT-180A",
  "TU-752",
  "S1000-2M",
  "S1000-2",
  "TU-768",
  "NY2170",
  "S1190",
];
function materialTypesFor(row: StackupRow): string[] {
  if (row.material === "PP") return ppTypes;
  if (row.material === "CORE") return coreTypes;
  return [];
}
function addStackupRow() {
  const n = stackupRows.value.length + 1;
  stackupRows.value.push({
    layerName: `L${n}`,
    material: "PP",
    pcbMaterialType: "",
    copperThickness: null,
    dielectricThickness: null,
    dk: null,
  });
}

// ==================== 阻抗表格 ====================
interface ImpRow {
  impType: string;
  controlLayer: string;
  refLayerTop: string;
  refLayerBottom: string;
  isCoated: boolean;
  lineWidth: number | null;
  lineSpacing: number | null;
  lineToCopper: number | null;
  impTarget: number | null;
  impTol: number;
}
const impTypes = [
  "外层单端",
  "外层单端共面地",
  "外层差分",
  "外层差分共面地",
  "内层单端(双层屏蔽)",
  "内层差分(双层屏蔽)",
  "内层单端(单层屏蔽)",
  "内层差分(单层屏蔽)",
  "内层单端共面地(双层屏蔽)",
  "内层差分共面地(双层屏蔽)",
  "内层层间差分(双层屏蔽)",
  "内层差分1B2A(双层屏蔽)",
  "内层差分1B2A(单层屏蔽)",
];
const impRows = ref<ImpRow[]>([]);
function addImpRow() {
  impRows.value.push({
    impType: "",
    controlLayer: "",
    refLayerTop: "",
    refLayerBottom: "",
    isCoated: false,
    lineWidth: null,
    lineSpacing: null,
    lineToCopper: null,
    impTarget: null,
    impTol: 10,
  });
}

// ==================== 提交 ====================
const submitting = ref(false)
const ordering = ref(false)

function validateForm(): boolean {
  const labelMap: Record<string, string> = {
    pcbName: '生产型号', pcbFile: 'PCB资料', layerCount: '板子层数', blindVia: '盲埋孔',
    pcsSizeWidth: 'PCS尺寸(水平)', pcsSizeHeight: 'PCS尺寸(垂直)',
    dimensionTolerance: '外形公差', quantity: '板子数量', deliveryUnit: '交货单位',
    panelTypesCount: '合拼种数', setMethod: 'Set拼板方式',
    clientPanelHorizontal: '拼板个数(水平)', clientPanelVertical: '拼板个数(垂直)',
    setSizeWidth: 'Set尺寸(水平)', setSizeHeight: 'Set尺寸(垂直)',
    clientPanelSeparation: '外形要求', acceptXOut: '是否接受打叉板',
    materialType: '板材种类', materialTg: '高TG', halogenFree: '无卤板材',
    maxWarpage: '翘曲度', boardThickness: '成品板厚', thicknessTolerance: '板厚公差',
    outerCopperThickness: '外层完成铜厚度', innerCopperThickness: '内层基铜厚度',
    minTraceWidthOuter: '外层最小线宽', minTraceSpacingOuter: '外层最小间距',
    minTraceWidthInner: '内层最小线宽', minTraceSpacingInner: '内层最小间距',
    minHoleSize: '最小孔径', holeCopperThickness: '最小孔铜',
    solderMaskColor: '阻焊颜色', silkscreenColor: '字符颜色',
    surfaceFinish: '表面处理', enigGoldThickness: '最小沉金金厚',
    immersionGoldArea: '沉金面积', viaProcess: '过孔工艺',
    goldFingerType: '金手指类型', goldFingerThickness: '金手指金厚',
    goldFingerChamferAngle: '倒角角度',
    acceptanceStandard: '验收标准', impedanceControl: '阻抗控制',
    markingRequirements: '标记要求', testRequirements: '测试要求',
    shippingReports: '出货报告', specialProcesses: '特殊工艺',
    confirmProductionFile: '光绘确认', periodFormat: '周期格式',
  }

  // 始终必填
  const alwaysRequired = [
    'pcbName', 'pcbFile', 'layerCount', 'blindVia', 'pcsSizeWidth', 'pcsSizeHeight',
    'dimensionTolerance', 'quantity', 'deliveryUnit', 'panelTypesCount', 'setMethod',
    'materialType', 'materialTg', 'halogenFree', 'maxWarpage', 'boardThickness',
    'thicknessTolerance', 'outerCopperThickness', 'innerCopperThickness',
    'minTraceWidthOuter', 'minTraceSpacingOuter', 'minHoleSize', 'holeCopperThickness',
    'solderMaskColor', 'silkscreenColor', 'surfaceFinish', 'viaProcess', 'goldFingerType',
    'acceptanceStandard', 'impedanceControl', 'markingRequirements',
    'testRequirements', 'shippingReports', 'specialProcesses', 'confirmProductionFile',
  ]

  // 有条件必填
  if (form.setMethod === '客户拼板') {
    alwaysRequired.push('clientPanelHorizontal', 'clientPanelVertical', 'setSizeWidth', 'setSizeHeight', 'clientPanelSeparation', 'acceptXOut')
  }
  if (Number(form.layerCount) > 2) {
    alwaysRequired.push('minTraceWidthInner', 'minTraceSpacingInner')
  }
  if (form.surfaceFinish === '沉金') {
    alwaysRequired.push('enigGoldThickness', 'immersionGoldArea')
  }
  if (form.goldFingerType !== '无') {
    alwaysRequired.push('goldFingerThickness', 'goldFingerChamferAngle')
  }
  if ((form.markingRequirements as string[]).includes('周期标记')) {
    alwaysRequired.push('periodFormat')
  }

  const missing: string[] = []
  for (const key of alwaysRequired) {
    const v = form[key]
    if (v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0)) {
      missing.push(labelMap[key] || key)
    }
  }
  if (typeof form.quantity === 'number' && form.quantity < 1) {
    missing.push('板子数量(需≥1)')
  }

  if (missing.length) {
    invalidFields.value = new Set(missing.map(m => {
      for (const [k, v] of Object.entries(labelMap)) { if (v === m) return k }
      return m
    }))
    ElMessage.warning('请填写必填项: ' + missing.join('、'))
    return false
  }
  invalidFields.value = new Set()
  return true
}

async function submitForm() {
  if (!validateForm()) return

  submitting.value = true;
  // 构建键值对格式的 payload
  const params: Record<string, any> = {}
  for (const key of [
    'pcbName','pcbFile','layerCount','blindVia','pcsSizeWidth','pcsSizeHeight',
    'dimensionTolerance','quantity','deliveryUnit','panelTypesCount','setMethod',
    'clientPanelHorizontal','clientPanelVertical','setSizeWidth','setSizeHeight',
    'clientPanelSeparation','acceptXOut','materialType','materialTg','halogenFree',
    'maxWarpage','boardThickness','thicknessTolerance','outerCopperThickness',
    'outerBaseCopperThickness','innerCopperThickness','minTraceWidthOuter',
    'minTraceSpacingOuter','minTraceWidthInner','minTraceSpacingInner',
    'minHoleSize','holeCopperThickness','solderMaskColor','silkscreenColor',
    'surfaceFinish','enigGoldThickness','immersionGoldArea','viaProcess',
    'goldFingerType','goldFingerThickness','goldFingerChamferAngle',
    'goldFingerChamferDepth','goldFingerChamferRemaining',
    'acceptanceStandard','impedanceControl','markingRequirements',
    'periodFormat','testRequirements','shippingReports','specialProcesses',
    'confirmProductionFile',
  ]) {
    params[key] = form[key]
  }

  if (stackupRows.value.length) params['stackupTable'] = stackupRows.value
  if (impRows.value.length) params['impedanceTable'] = impRows.value

  const payload = { taskId: taskId.value, pcbQuoteParams: params }

  const win = window as any;
  if (win.QtBridge?.send) {
    win.QtBridge.send('html-button-message', payload);
  } else {
    console.log('📋 提交报价:', JSON.stringify(payload, null, 2));
  }
  setTimeout(() => {
    submitting.value = false;
    // ElMessage.success('已提交');
  }, 500);
}

async function submitOrder() {
  if (!validateForm()) return

  ordering.value = true
  const params: Record<string, any> = {}
  for (const key of [
    'pcbName','pcbFile','layerCount','blindVia','pcsSizeWidth','pcsSizeHeight',
    'dimensionTolerance','quantity','deliveryUnit','panelTypesCount','setMethod',
    'clientPanelHorizontal','clientPanelVertical','setSizeWidth','setSizeHeight',
    'clientPanelSeparation','acceptXOut','materialType','materialTg','halogenFree',
    'maxWarpage','boardThickness','thicknessTolerance','outerCopperThickness',
    'outerBaseCopperThickness','innerCopperThickness','minTraceWidthOuter',
    'minTraceSpacingOuter','minTraceWidthInner','minTraceSpacingInner',
    'minHoleSize','holeCopperThickness','solderMaskColor','silkscreenColor',
    'surfaceFinish','enigGoldThickness','immersionGoldArea','viaProcess',
    'goldFingerType','goldFingerThickness','goldFingerChamferAngle',
    'goldFingerChamferDepth','goldFingerChamferRemaining',
    'acceptanceStandard','impedanceControl','markingRequirements',
    'periodFormat','testRequirements','shippingReports','specialProcesses',
    'confirmProductionFile',
  ]) {
    const raw = fieldRawData[key]
    const src = userModified.value.has(key) ? 'user' : (fieldSource[key] || 'user')
    params[key] = { ...(raw || {}), value: form[key], source: src }
  }

  const payload = params

  const win = window as any
  if (win.QtBridge?.send) {
    win.QtBridge.send('html-button-message', payload)
  } else {
    console.log('📋 提交订单:', JSON.stringify(payload, null, 2))
  }
  setTimeout(() => {
    ordering.value = false
    // ElMessage.success('订单已提交')
  }, 500)
}

const formDataLoaded = ref(false)

// ==================== 接收 C++ 推送的数据 ====================
const rawEventData = ref<any>(null)
const quoteData = ref<any>(null)
const qrVisible = ref(false)
const qrCodeUrl = ref('')
const qrExpired = ref(false)
const qrCountdown = ref(0)
const qrOrderNo = ref('')

let pollTimer: any = null
let countdownTimer: any = null

async function refreshQrCode() {
  qrExpired.value = false
  const payRes: any = await pcbPayV2(userToken.value, { order_no: qrOrderNo.value })
  if (payRes.code === '10000' && payRes.data?.order_str) {
    qrCodeUrl.value = await QRCode.toDataURL(payRes.data.order_str)
    startPollPayStatus(payRes.data.merge_order_no, payRes.data.time_expire)
  } else {
    ElMessage.error(payRes.msg || '二维码刷新失败')
    qrVisible.value = false
  }
}

function clearTimers() { clearInterval(pollTimer); clearInterval(countdownTimer) }

function startPollPayStatus(mergeNo: string, expireSec: number) {
  clearInterval(pollTimer)
  clearInterval(countdownTimer)
  qrExpired.value = false
  qrCountdown.value = expireSec
  // 倒计时
  countdownTimer = setInterval(() => {
    qrCountdown.value--
    if (qrCountdown.value <= 0) { clearInterval(countdownTimer); qrExpired.value = true }
  }, 1000)
  pollTimer = setInterval(async () => {
    try {
      const res: any = await getPcbOrderStatusV2(userToken.value, { merge_order_no: mergeNo })
      if (res.code === '10000') {
        const status = res.data?.pay_status
        if (status === 1) {
          ElMessage.success('支付成功'); clearInterval(pollTimer); clearInterval(countdownTimer)
          await payCallback(userToken.value, { taskId: taskId.value, order_no: qrOrderNo.value, isPayed: true })
          qrVisible.value = false
        }
        else if (status === 2) { ElMessage.error('支付失败'); clearInterval(pollTimer); clearInterval(countdownTimer); qrVisible.value = false }
      } else { ElMessage.error(res.msg || '查询支付状态失败') }
    } catch { /* */ }
  }, 1000)
}

function orderPayload() {
  const p: Record<string, any> = {}
  for (const key of Object.keys(form)) {
    const raw = fieldRawData[key]
    const src = userModified.value.has(key) ? 'user' : (fieldSource[key] || 'user')
    p[key] = { ...(raw || {}), value: form[key], source: src }
  }
  if (stackupRows.value.length) p['stackupTable'] = { value: stackupRows.value, source: 'user' }
  if (impRows.value.length) p['impedanceTable'] = { value: impRows.value, source: 'user' }
  return p
}

onMounted(() => {
  window.addEventListener('QtMessage', async (event: any) => {
    const detail = event.detail
    if (!detail || typeof detail !== 'object') return

    const rn = detail.returnName
    if (rn === 'token' && detail.elecnest_user_info) {
      if (detail.taskId) taskId.value = detail.taskId
      userToken.value = detail.elecnest_user_info.elecnest_user_token || ''
      userUid.value = detail.elecnest_user_info.elecnest_user_uid || ''
      return
    }
    if (rn === 'quote') {
      if (detail.code === 200) {
        quoteData.value = detail.data
        ElMessage.success(detail.message || '报价成功')
      } else {
        ElMessage.error(detail.message || '报价失败')
      }
      return
    }
    if (rn === 'ordered' && detail.code === 200) {
      const addrId = deliveryRef.value?.selectedAddrId
      const invId = invoiceRef.value?.selectedInvoiceId
      const invType = invoiceRef.value?.invoiceType
      if (!addrId || !invId) { ElMessage.warning('请先选中收货地址和发票信息'); return }
      try {
        const orderRes: any = await orderCreate(userToken.value, {
          task_id: taskId.value,
          receiver_id: addrId,
          invoice_id: invId,
          invoice_type: Number(invType),
          freight_price: 0,
          pcbQuoteParams: orderPayload(),
        })
        if (orderRes.code === 200 && orderRes.data?.order_no) {
          const payRes: any = await pcbPayV2(userToken.value, { order_no: orderRes.data.order_no })
          if (payRes.code === '10000' && payRes.data?.order_str) {
            qrCodeUrl.value = await QRCode.toDataURL(payRes.data.order_str)
            qrVisible.value = true
            qrOrderNo.value = orderRes.data.order_no
            startPollPayStatus(payRes.data.merge_order_no, payRes.data.time_expire || 300)
          } else {
            ElMessage.error(payRes.msg || '支付接口失败')
          }
        } else {
          ElMessage.error(orderRes.message || '订单创建失败')
        }
      } catch { /* */ }
      return
    }
    if (rn === 'ordered') {
      ElMessage.error(detail.message || '订单提交失败')
      return
    }
    // 无 returnName：表单渲染数据
    const data = detail.parameters || detail
    applyFieldData(data)
    formDataLoaded.value = true
    ElMessage.success('数据已同步')
  })
})
</script>

<template>
  <div class="page-wrapper">
    <!-- 加载遮罩 -->
    <!-- <div v-if="!formDataLoaded" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>等待数据加载...</p>
    </div> -->

    <div class="form-box">
      <table class="param-table">
        <thead>
          <tr>
            <th class="col-name">项目类型名称</th>
            <th class="col-value">参数值</th>
            <th class="col-source">数据来源</th>
            <th class="col-view">查看</th>
          </tr>
        </thead>
        <tbody>
          <!-- ====== 一、PCB基本信息 ====== -->
          <tr class="section-row" @click="sections.basic = !sections.basic">
            <td colspan="4">
              一、PCB基本信息
              <span class="arrow" :class="{ up: sections.basic }">▼</span>
            </td>
          </tr>
          <template v-if="sections.basic">
            <tr>
              <td class="td-name">生产型号<span class="req">*</span></td>
              <td class="td-val"><el-input v-model="form.pcbName" :class="isInvalid('pcbName')" @change="clearInvalid('pcbName')" size="small" placeholder="生产型号" /></td>
              <td class="td-src"><span :class="sourceClass('pcbName')">{{ sourceLabel('pcbName') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('pcbName')" class="btn-view graphic" @click="handleViewClick('pcbName')">图形</button>
                <button v-if="showDocBtn('pcbName')" class="btn-view doc" @click="handleViewClick('pcbName')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">PCB 资料<span class="req">*</span></td>
              <td class="td-val"><el-input v-model="form.pcbFile" :class="isInvalid('pcbFile')" @change="clearInvalid('pcbFile')" size="small" placeholder="PCB 资料" /></td>
              <td class="td-src"><span :class="sourceClass('pcbFile')">{{ sourceLabel('pcbFile') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('pcbFile')" class="btn-view graphic" @click="handleViewClick('pcbFile')">图形</button>
                <button v-if="showDocBtn('pcbFile')" class="btn-view doc" @click="handleViewClick('pcbFile')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">板子层数<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.layerCount" :class="isInvalid('layerCount')" @change="clearInvalid('layerCount')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.layerCount"
                    :key="v"
                    :label="v + '层'"
                    :value="Number(v)"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('layerCount')">{{ sourceLabel('layerCount') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('layerCount')" class="btn-view graphic" @click="handleViewClick('layerCount')">图形</button>
                <button v-if="showDocBtn('layerCount')" class="btn-view doc" @click="handleViewClick('layerCount')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">盲埋孔<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.blindVia" :class="isInvalid('blindVia')" @change="clearInvalid('blindVia')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.blindVia"
                    :key="v.value"
                    :label="v.label"
                    :value="v.value"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('blindVia')">{{ sourceLabel('blindVia') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('blindVia')" class="btn-view graphic" @click="handleViewClick('blindVia')">图形</button>
                <button v-if="showDocBtn('blindVia')" class="btn-view doc" @click="handleViewClick('blindVia')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">PCS尺寸(水平)<span class="req">*</span></td>
              <td class="td-val">
                <el-input-number
                  v-model="form.pcsSizeWidth" :class="isInvalid('pcsSizeWidth')" @change="clearInvalid('pcsSizeWidth')"
                  size="small"
                  :min="0"
                  :max="571.5"
                  :precision="2"
                  style="width: 100%"
                  placeholder="0-571.5"
                /><span class="unit">mm</span>
              </td>
              <td class="td-src">
                <span :class="sourceClass('pcsSizeWidth')">{{ sourceLabel('pcsSizeWidth') }}</span>
              </td>
              <td class="td-view">
                <button v-if="showGraphicBtn('pcsSizeWidth')" class="btn-view graphic" @click="handleViewClick('pcsSizeWidth')">图形</button>
                <button v-if="showDocBtn('pcsSizeWidth')" class="btn-view doc" @click="handleViewClick('pcsSizeWidth')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">PCS尺寸(垂直)<span class="req">*</span></td>
              <td class="td-val">
                <el-input-number
                  v-model="form.pcsSizeHeight" :class="isInvalid('pcsSizeHeight')" @change="clearInvalid('pcsSizeHeight')"
                  size="small"
                  :min="0"
                  :max="571.5"
                  :precision="2"
                  style="width: 100%"
                  placeholder="0-571.5"
                /><span class="unit">mm</span>
              </td>
              <td class="td-src">
                <span :class="sourceClass('pcsSizeHeight')">{{ sourceLabel('pcsSizeHeight') }}</span>
              </td>
              <td class="td-view">
                <button v-if="showGraphicBtn('pcsSizeHeight')" class="btn-view graphic" @click="handleViewClick('pcsSizeHeight')">图形</button>
                <button v-if="showDocBtn('pcsSizeHeight')" class="btn-view doc" @click="handleViewClick('pcsSizeHeight')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">外形公差<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.dimensionTolerance" :class="isInvalid('dimensionTolerance')" @change="clearInvalid('dimensionTolerance')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.dimensionTolerance"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src">
                <span :class="sourceClass('dimensionTolerance')">{{ sourceLabel('dimensionTolerance') }}</span>
              </td>
              <td class="td-view">
                <button v-if="showGraphicBtn('dimensionTolerance')" class="btn-view graphic" @click="handleViewClick('dimensionTolerance')">图形</button>
                <button v-if="showDocBtn('dimensionTolerance')" class="btn-view doc" @click="handleViewClick('dimensionTolerance')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">板子数量<span class="req">*</span></td>
              <td class="td-val">
                <el-input-number
                  v-model="form.quantity" :class="isInvalid('quantity')" @change="clearInvalid('quantity')"
                  size="small"
                  :min="1"
                  style="width: 100%"
                />
              </td>
              <td class="td-src"><span :class="sourceClass('quantity')">{{ sourceLabel('quantity') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('quantity')" class="btn-view graphic" @click="handleViewClick('quantity')">图形</button>
                <button v-if="showDocBtn('quantity')" class="btn-view doc" @click="handleViewClick('quantity')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">交货单位<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.deliveryUnit" :class="isInvalid('deliveryUnit')" @change="clearInvalid('deliveryUnit')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.deliveryUnit"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('deliveryUnit')">{{ sourceLabel('deliveryUnit') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('deliveryUnit')" class="btn-view graphic" @click="handleViewClick('deliveryUnit')">图形</button>
                <button v-if="showDocBtn('deliveryUnit')" class="btn-view doc" @click="handleViewClick('deliveryUnit')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">合拼种数<span class="req">*</span></td>
              <td class="td-val">
                <el-input-number
                  v-model="form.panelTypesCount" :class="isInvalid('panelTypesCount')" @change="clearInvalid('panelTypesCount')"
                  size="small"
                  :min="1"
                  :max="100"
                  style="width: 100%"
                />
              </td>
              <td class="td-src"><span :class="sourceClass('panelTypesCount')">{{ sourceLabel('panelTypesCount') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('panelTypesCount')" class="btn-view graphic" @click="handleViewClick('panelTypesCount')">图形</button>
                <button v-if="showDocBtn('panelTypesCount')" class="btn-view doc" @click="handleViewClick('panelTypesCount')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">Set拼板方式<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.setMethod" :class="isInvalid('setMethod')" @change="clearInvalid('setMethod')"
                  size="small"
                  style="width: 100%"
                >
                  <template v-if="isPCS"
                    ><el-option
                      v-for="v in opts.setMethodPCS"
                      :key="v"
                      :label="v"
                      :value="v"
                  /></template>
                  <template v-else
                    ><el-option
                      v-for="v in opts.setMethodSET"
                      :key="v"
                      :label="v"
                      :value="v"
                  /></template>
                </el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('setMethod')">{{ sourceLabel('setMethod') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('setMethod')" class="btn-view graphic" @click="handleViewClick('setMethod')">图形</button>
                <button v-if="showDocBtn('setMethod')" class="btn-view doc" @click="handleViewClick('setMethod')">加工文档</button>
              </td>
            </tr>
            <template v-if="showPanelFields">
              <tr>
                <td class="td-name">
                  拼板个数(水平)<span class="req">*</span>
                </td>
                <td class="td-val">
                  <el-input-number
                    v-model="form.clientPanelHorizontal" :class="isInvalid('clientPanelHorizontal')" @change="clearInvalid('clientPanelHorizontal')"
                    size="small"
                    :min="1"
                    :max="100"
                    style="width: 100%"
                  />
                </td>
                <td class="td-src"><span :class="sourceClass('clientPanelHorizontal')">{{ sourceLabel('clientPanelHorizontal') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('clientPanelHorizontal')" class="btn-view graphic" @click="handleViewClick('clientPanelHorizontal')">图形</button>
                  <button v-if="showDocBtn('clientPanelHorizontal')" class="btn-view doc" @click="handleViewClick('clientPanelHorizontal')">加工文档</button>
                </td>
              </tr>
              <tr>
                <td class="td-name">
                  拼板个数(垂直)<span class="req">*</span>
                </td>
                <td class="td-val">
                  <el-input-number
                    v-model="form.clientPanelVertical" :class="isInvalid('clientPanelVertical')" @change="clearInvalid('clientPanelVertical')"
                    size="small"
                    :min="1"
                    :max="100"
                    style="width: 100%"
                  />
                </td>
                <td class="td-src"><span :class="sourceClass('clientPanelVertical')">{{ sourceLabel('clientPanelVertical') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('clientPanelVertical')" class="btn-view graphic" @click="handleViewClick('clientPanelVertical')">图形</button>
                  <button v-if="showDocBtn('clientPanelVertical')" class="btn-view doc" @click="handleViewClick('clientPanelVertical')">加工文档</button>
                </td>
              </tr>
              <tr>
                <td class="td-name">Set尺寸(水平)<span class="req">*</span></td>
                <td class="td-val">
                  <el-input-number
                    v-model="form.setSizeWidth" :class="isInvalid('setSizeWidth')" @change="clearInvalid('setSizeWidth')"
                    size="small"
                    :min="0"
                    :max="571.5"
                    :precision="2"
                    style="width: 100%"
                    placeholder="0-571.5"
                  /><span class="unit">mm</span>
                </td>
                <td class="td-src"><span :class="sourceClass('setSizeWidth')">{{ sourceLabel('setSizeWidth') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('setSizeWidth')" class="btn-view graphic" @click="handleViewClick('setSizeWidth')">图形</button>
                  <button v-if="showDocBtn('setSizeWidth')" class="btn-view doc" @click="handleViewClick('setSizeWidth')">加工文档</button>
                </td>
              </tr>
              <tr>
                <td class="td-name">Set尺寸(垂直)<span class="req">*</span></td>
                <td class="td-val">
                  <el-input-number
                    v-model="form.setSizeHeight" :class="isInvalid('setSizeHeight')" @change="clearInvalid('setSizeHeight')"
                    size="small"
                    :min="0"
                    :max="571.5"
                    :precision="2"
                    style="width: 100%"
                    placeholder="0-571.5"
                  /><span class="unit">mm</span>
                </td>
                <td class="td-src"><span :class="sourceClass('setSizeHeight')">{{ sourceLabel('setSizeHeight') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('setSizeHeight')" class="btn-view graphic" @click="handleViewClick('setSizeHeight')">图形</button>
                  <button v-if="showDocBtn('setSizeHeight')" class="btn-view doc" @click="handleViewClick('setSizeHeight')">加工文档</button>
                </td>
              </tr>
              <tr>
                <td class="td-name">外形要求<span class="req">*</span></td>
                <td class="td-val">
                  <el-select
                    v-model="form.clientPanelSeparation" :class="isInvalid('clientPanelSeparation')" @change="clearInvalid('clientPanelSeparation')"
                    size="small"
                    style="width: 100%"
                    ><el-option
                      v-for="v in opts.clientPanelSeparation"
                      :key="v"
                      :label="v"
                      :value="v"
                  /></el-select>
                </td>
                <td class="td-src"><span :class="sourceClass('clientPanelSeparation')">{{ sourceLabel('clientPanelSeparation') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('clientPanelSeparation')" class="btn-view graphic" @click="handleViewClick('clientPanelSeparation')">图形</button>
                  <button v-if="showDocBtn('clientPanelSeparation')" class="btn-view doc" @click="handleViewClick('clientPanelSeparation')">加工文档</button>
                </td>
              </tr>
              <tr>
                <td class="td-name">
                  是否接受打叉板<span class="req">*</span>
                </td>
                <td class="td-val">
                  <el-select
                    v-model="form.acceptXOut" :class="isInvalid('acceptXOut')" @change="clearInvalid('acceptXOut')"
                    size="small"
                    style="width: 100%"
                    ><el-option
                      v-for="v in opts.acceptXOut"
                    :key="v.value"
                    :label="v.label"
                    :value="v.value"
                  /></el-select>
                </td>
                <td class="td-src"><span :class="sourceClass('acceptXOut')">{{ sourceLabel('acceptXOut') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('acceptXOut')" class="btn-view graphic" @click="handleViewClick('acceptXOut')">图形</button>
                  <button v-if="showDocBtn('acceptXOut')" class="btn-view doc" @click="handleViewClick('acceptXOut')">加工文档</button>
                </td>
              </tr>
            </template>
          </template>

          <!-- ====== 二、PCB工艺信息 ====== -->
          <tr class="section-row" @click="sections.process = !sections.process">
            <td colspan="4">
              二、PCB工艺信息
              <span class="arrow" :class="{ up: sections.process }">▼</span>
            </td>
          </tr>
          <template v-if="sections.process">
            <tr>
              <td class="td-name">板材种类<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.materialType" :class="isInvalid('materialType')" @change="clearInvalid('materialType')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.materialType"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('materialType')">{{ sourceLabel('materialType') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('materialType')" class="btn-view graphic" @click="handleViewClick('materialType')">图形</button>
                <button v-if="showDocBtn('materialType')" class="btn-view doc" @click="handleViewClick('materialType')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">高TG<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.materialTg" :class="isInvalid('materialTg')" @change="clearInvalid('materialTg')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.materialTg"
                    :key="v.value"
                    :label="v.label"
                    :value="v.value"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('materialTg')">{{ sourceLabel('materialTg') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('materialTg')" class="btn-view graphic" @click="handleViewClick('materialTg')">图形</button>
                <button v-if="showDocBtn('materialTg')" class="btn-view doc" @click="handleViewClick('materialTg')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">无卤板材<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.halogenFree" :class="isInvalid('halogenFree')" @change="clearInvalid('halogenFree')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.halogenFree"
                    :key="v.value"
                    :label="v.label"
                    :value="v.value"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('halogenFree')">{{ sourceLabel('halogenFree') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('halogenFree')" class="btn-view graphic" @click="handleViewClick('halogenFree')">图形</button>
                <button v-if="showDocBtn('halogenFree')" class="btn-view doc" @click="handleViewClick('halogenFree')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">翘曲度<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.maxWarpage" :class="isInvalid('maxWarpage')" @change="clearInvalid('maxWarpage')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.maxWarpage"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('maxWarpage')">{{ sourceLabel('maxWarpage') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('maxWarpage')" class="btn-view graphic" @click="handleViewClick('maxWarpage')">图形</button>
                <button v-if="showDocBtn('maxWarpage')" class="btn-view doc" @click="handleViewClick('maxWarpage')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">成品板厚<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.boardThickness" :class="isInvalid('boardThickness')" @change="clearInvalid('boardThickness')"
                  size="small"
                  filterable
                  allow-create
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.boardThickness"
                    :key="v"
                    :label="v + 'mm'"
                    :value="Number(v)"
                /></el-select>
              </td>
              <td class="td-src">
                <span :class="sourceClass('boardThickness')">{{ sourceLabel('boardThickness') }}</span>
              </td>
              <td class="td-view">
                <button v-if="showGraphicBtn('boardThickness')" class="btn-view graphic" @click="handleViewClick('boardThickness')">图形</button>
                <button v-if="showDocBtn('boardThickness')" class="btn-view doc" @click="handleViewClick('boardThickness')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">板厚公差<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.thicknessTolerance" :class="isInvalid('thicknessTolerance')" @change="clearInvalid('thicknessTolerance')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.thicknessTolerance"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('thicknessTolerance')">{{ sourceLabel('thicknessTolerance') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('thicknessTolerance')" class="btn-view graphic" @click="handleViewClick('thicknessTolerance')">图形</button>
                <button v-if="showDocBtn('thicknessTolerance')" class="btn-view doc" @click="handleViewClick('thicknessTolerance')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">外层完成铜厚度<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.outerCopperThickness" :class="isInvalid('outerCopperThickness')" @change="clearInvalid('outerCopperThickness')"
                  size="small"
                  filterable
                  allow-create
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.outerCopperThickness"
                    :key="v"
                    :label="v + 'um'"
                    :value="Number(v)"
                /></el-select>
              </td>
              <td class="td-src">
                <span :class="sourceClass('outerCopperThickness')">{{ sourceLabel('outerCopperThickness') }}</span>
              </td>
              <td class="td-view">
                <button v-if="showGraphicBtn('outerCopperThickness')" class="btn-view graphic" @click="handleViewClick('outerCopperThickness')">图形</button>
                <button v-if="showDocBtn('outerCopperThickness')" class="btn-view doc" @click="handleViewClick('outerCopperThickness')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">内层基铜厚度<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.innerCopperThickness" :class="isInvalid('innerCopperThickness')" @change="clearInvalid('innerCopperThickness')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.innerCopperThickness"
                    :key="v"
                    :label="v + 'oz'"
                    :value="Number(v)"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('innerCopperThickness')">{{ sourceLabel('innerCopperThickness') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('innerCopperThickness')" class="btn-view graphic" @click="handleViewClick('innerCopperThickness')">图形</button>
                <button v-if="showDocBtn('innerCopperThickness')" class="btn-view doc" @click="handleViewClick('innerCopperThickness')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">外层最小线宽<span class="req">*</span></td>
              <td class="td-val">
                <el-input-number
                  v-model="form.minTraceWidthOuter" :class="isInvalid('minTraceWidthOuter')" @change="clearInvalid('minTraceWidthOuter')"
                  size="small"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                /><span class="unit">mil</span>
              </td>
              <td class="td-src">
                <span :class="sourceClass('minTraceWidthOuter')">{{ sourceLabel('minTraceWidthOuter') }}</span>
              </td>
              <td class="td-view">
                <button v-if="showGraphicBtn('minTraceWidthOuter')" class="btn-view graphic" @click="handleViewClick('minTraceWidthOuter')">图形</button>
                <button v-if="showDocBtn('minTraceWidthOuter')" class="btn-view doc" @click="handleViewClick('minTraceWidthOuter')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">外层最小间距<span class="req">*</span></td>
              <td class="td-val">
                <el-input-number
                  v-model="form.minTraceSpacingOuter" :class="isInvalid('minTraceSpacingOuter')" @change="clearInvalid('minTraceSpacingOuter')"
                  size="small"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                /><span class="unit">mil</span>
              </td>
              <td class="td-src">
                <span :class="sourceClass('minTraceSpacingOuter')">{{ sourceLabel('minTraceSpacingOuter') }}</span>
              </td>
              <td class="td-view">
                <button v-if="showGraphicBtn('minTraceSpacingOuter')" class="btn-view graphic" @click="handleViewClick('minTraceSpacingOuter')">图形</button>
                <button v-if="showDocBtn('minTraceSpacingOuter')" class="btn-view doc" @click="handleViewClick('minTraceSpacingOuter')">加工文档</button>
              </td>
            </tr>
            <template v-if="hasInnerLayer">
              <tr>
                <td class="td-name">内层最小线宽<span class="req">*</span></td>
                <td class="td-val">
                  <el-input-number
                    v-model="form.minTraceWidthInner" :class="isInvalid('minTraceWidthInner')" @change="clearInvalid('minTraceWidthInner')"
                    size="small"
                    :min="0"
                    :precision="2"
                    style="width: 100%"
                  /><span class="unit">mil</span>
                </td>
                <td class="td-src">
                <span :class="sourceClass('minTraceWidthInner')">{{ sourceLabel('minTraceWidthInner') }}</span>
              </td>
              <td class="td-view">
                <button v-if="showGraphicBtn('minTraceWidthInner')" class="btn-view graphic" @click="handleViewClick('minTraceWidthInner')">图形</button>
                <button v-if="showDocBtn('minTraceWidthInner')" class="btn-view doc" @click="handleViewClick('minTraceWidthInner')">加工文档</button>
              </td>
              </tr>
              <tr>
                <td class="td-name">内层最小间距<span class="req">*</span></td>
                <td class="td-val">
                  <el-input-number
                    v-model="form.minTraceSpacingInner" :class="isInvalid('minTraceSpacingInner')" @change="clearInvalid('minTraceSpacingInner')"
                    size="small"
                    :min="0"
                    :precision="2"
                    style="width: 100%"
                  /><span class="unit">mil</span>
                </td>
                <td class="td-src">
                <span :class="sourceClass('minTraceSpacingInner')">{{ sourceLabel('minTraceSpacingInner') }}</span>
              </td>
              <td class="td-view">
                <button v-if="showGraphicBtn('minTraceSpacingInner')" class="btn-view graphic" @click="handleViewClick('minTraceSpacingInner')">图形</button>
                <button v-if="showDocBtn('minTraceSpacingInner')" class="btn-view doc" @click="handleViewClick('minTraceSpacingInner')">加工文档</button>
              </td>
              </tr>
            </template>
            <tr>
              <td class="td-name">最小孔径<span class="req">*</span></td>
              <td class="td-val">
                <el-input-number
                  v-model="form.minHoleSize" :class="isInvalid('minHoleSize')" @change="clearInvalid('minHoleSize')"
                  size="small"
                  :min="0"
                  :precision="3"
                  style="width: 100%"
                /><span class="unit">mm</span>
              </td>
              <td class="td-src">
                <span :class="sourceClass('minHoleSize')">{{ sourceLabel('minHoleSize') }}</span>
              </td>
              <td class="td-view">
                <button v-if="showGraphicBtn('minHoleSize')" class="btn-view graphic" @click="handleViewClick('minHoleSize')">图形</button>
                <button v-if="showDocBtn('minHoleSize')" class="btn-view doc" @click="handleViewClick('minHoleSize')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">最小孔铜<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.holeCopperThickness" :class="isInvalid('holeCopperThickness')" @change="clearInvalid('holeCopperThickness')"
                  size="small"
                  filterable
                  allow-create
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.holeCopperThickness"
                    :key="v"
                    :label="v + 'um'"
                    :value="Number(v)"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('holeCopperThickness')">{{ sourceLabel('holeCopperThickness') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('holeCopperThickness')" class="btn-view graphic" @click="handleViewClick('holeCopperThickness')">图形</button>
                <button v-if="showDocBtn('holeCopperThickness')" class="btn-view doc" @click="handleViewClick('holeCopperThickness')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">阻焊颜色<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.solderMaskColor" :class="isInvalid('solderMaskColor')" @change="clearInvalid('solderMaskColor')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.solderMaskColor"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('solderMaskColor')">{{ sourceLabel('solderMaskColor') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('solderMaskColor')" class="btn-view graphic" @click="handleViewClick('solderMaskColor')">图形</button>
                <button v-if="showDocBtn('solderMaskColor')" class="btn-view doc" @click="handleViewClick('solderMaskColor')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">字符颜色<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.silkscreenColor" :class="isInvalid('silkscreenColor')" @change="clearInvalid('silkscreenColor')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.silkscreenColor"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('silkscreenColor')">{{ sourceLabel('silkscreenColor') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('silkscreenColor')" class="btn-view graphic" @click="handleViewClick('silkscreenColor')">图形</button>
                <button v-if="showDocBtn('silkscreenColor')" class="btn-view doc" @click="handleViewClick('silkscreenColor')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">表面处理<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.surfaceFinish" :class="isInvalid('surfaceFinish')" @change="clearInvalid('surfaceFinish')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.surfaceFinish"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('surfaceFinish')">{{ sourceLabel('surfaceFinish') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('surfaceFinish')" class="btn-view graphic" @click="handleViewClick('surfaceFinish')">图形</button>
                <button v-if="showDocBtn('surfaceFinish')" class="btn-view doc" @click="handleViewClick('surfaceFinish')">加工文档</button>
              </td>
            </tr>
            <template v-if="showEnigGold">
              <tr>
                <td class="td-name">最小沉金金厚<span class="req">*</span></td>
                <td class="td-val">
                  <el-select
                    v-model="form.enigGoldThickness" :class="isInvalid('enigGoldThickness')" @change="clearInvalid('enigGoldThickness')"
                    size="small"
                    style="width: 100%"
                    ><el-option
                      v-for="v in opts.enigGoldThickness"
                      :key="v"
                      :label="v + 'um'"
                      :value="Number(v)"
                  /></el-select>
                </td>
                <td class="td-src"><span :class="sourceClass('enigGoldThickness')">{{ sourceLabel('enigGoldThickness') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('enigGoldThickness')" class="btn-view graphic" @click="handleViewClick('enigGoldThickness')">图形</button>
                  <button v-if="showDocBtn('enigGoldThickness')" class="btn-view doc" @click="handleViewClick('enigGoldThickness')">加工文档</button>
                </td>
              </tr>
              <tr>
                <td class="td-name">沉金面积（双面之和）</td>
                <td class="td-val">
                  <el-input-number
                    v-model="form.immersionGoldArea" :class="isInvalid('immersionGoldArea')" @change="clearInvalid('immersionGoldArea')"
                    size="small"
                    :min="0"
                    :precision="1"
                    style="width: 100%"
                  /><span class="unit">%</span>
                </td>
                <td class="td-src"><span :class="sourceClass('immersionGoldArea')">{{ sourceLabel('immersionGoldArea') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('immersionGoldArea')" class="btn-view graphic" @click="handleViewClick('immersionGoldArea')">图形</button>
                  <button v-if="showDocBtn('immersionGoldArea')" class="btn-view doc" @click="handleViewClick('immersionGoldArea')">加工文档</button>
                </td>
              </tr>
            </template>
            <tr>
              <td class="td-name">过孔工艺<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.viaProcess" :class="isInvalid('viaProcess')" @change="clearInvalid('viaProcess')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.viaProcess"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('viaProcess')">{{ sourceLabel('viaProcess') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('viaProcess')" class="btn-view graphic" @click="handleViewClick('viaProcess')">图形</button>
                <button v-if="showDocBtn('viaProcess')" class="btn-view doc" @click="handleViewClick('viaProcess')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">金手指类型<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.goldFingerType" :class="isInvalid('goldFingerType')" @change="clearInvalid('goldFingerType')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.goldFingerType"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('goldFingerType')">{{ sourceLabel('goldFingerType') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('goldFingerType')" class="btn-view graphic" @click="handleViewClick('goldFingerType')">图形</button>
                <button v-if="showDocBtn('goldFingerType')" class="btn-view doc" @click="handleViewClick('goldFingerType')">加工文档</button>
              </td>
            </tr>
            <template v-if="showGoldFinger">
              <tr>
                <td class="td-name">金手指金厚<span class="req">*</span></td>
                <td class="td-val">
                  <el-select
                    v-model="form.goldFingerThickness" :class="isInvalid('goldFingerThickness')" @change="clearInvalid('goldFingerThickness')"
                    size="small"
                    style="width: 100%"
                    ><el-option
                      v-for="v in opts.goldFingerThickness"
                      :key="v"
                      :label="v + 'um'"
                      :value="Number(v)"
                  /></el-select>
                </td>
                <td class="td-src"><span :class="sourceClass('goldFingerThickness')">{{ sourceLabel('goldFingerThickness') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('goldFingerThickness')" class="btn-view graphic" @click="handleViewClick('goldFingerThickness')">图形</button>
                  <button v-if="showDocBtn('goldFingerThickness')" class="btn-view doc" @click="handleViewClick('goldFingerThickness')">加工文档</button>
                </td>
              </tr>
              <tr>
                <td class="td-name">倒角角度<span class="req">*</span></td>
                <td class="td-val">
                  <el-select
                    v-model="form.goldFingerChamferAngle" :class="isInvalid('goldFingerChamferAngle')" @change="clearInvalid('goldFingerChamferAngle')"
                    size="small"
                    style="width: 100%"
                    ><el-option
                      v-for="v in opts.goldFingerChamferAngle"
                      :key="v"
                      :label="v"
                      :value="v"
                  /></el-select>
                </td>
                <td class="td-src"><span :class="sourceClass('goldFingerChamferAngle')">{{ sourceLabel('goldFingerChamferAngle') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('goldFingerChamferAngle')" class="btn-view graphic" @click="handleViewClick('goldFingerChamferAngle')">图形</button>
                  <button v-if="showDocBtn('goldFingerChamferAngle')" class="btn-view doc" @click="handleViewClick('goldFingerChamferAngle')">加工文档</button>
                </td>
              </tr>
              <tr>
                <td class="td-name">倒角深度</td>
                <td class="td-val">
                  <el-input-number
                    v-model="form.goldFingerChamferDepth" :class="isInvalid('goldFingerChamferDepth')" @change="clearInvalid('goldFingerChamferDepth')"
                    size="small"
                    :min="0"
                    :max="10"
                    :precision="2"
                    style="width: 100%"
                  /><span class="unit">mm</span>
                </td>
                <td class="td-src"><span :class="sourceClass('goldFingerChamferDepth')">{{ sourceLabel('goldFingerChamferDepth') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('goldFingerChamferDepth')" class="btn-view graphic" @click="handleViewClick('goldFingerChamferDepth')">图形</button>
                  <button v-if="showDocBtn('goldFingerChamferDepth')" class="btn-view doc" @click="handleViewClick('goldFingerChamferDepth')">加工文档</button>
                </td>
              </tr>
              <tr>
                <td class="td-name">金手指倒角余厚</td>
                <td class="td-val">
                  <el-input-number
                    v-model="form.goldFingerChamferRemaining" :class="isInvalid('goldFingerChamferRemaining')" @change="clearInvalid('goldFingerChamferRemaining')"
                    size="small"
                    :min="0"
                    :max="10"
                    :precision="2"
                    style="width: 100%"
                  /><span class="unit">mm</span>
                </td>
                <td class="td-src"><span :class="sourceClass('goldFingerChamferRemaining')">{{ sourceLabel('goldFingerChamferRemaining') }}</span></td>
                <td class="td-view">
                  <button v-if="showGraphicBtn('goldFingerChamferRemaining')" class="btn-view graphic" @click="handleViewClick('goldFingerChamferRemaining')">图形</button>
                  <button v-if="showDocBtn('goldFingerChamferRemaining')" class="btn-view doc" @click="handleViewClick('goldFingerChamferRemaining')">加工文档</button>
                </td>
              </tr>
            </template>
          </template>

          <!-- ====== 三、个性化服务 ====== -->
          <tr class="section-row" @click="sections.custom = !sections.custom">
            <td colspan="4">
              三、个性化服务
              <span class="arrow" :class="{ up: sections.custom }">▼</span>
            </td>
          </tr>
          <template v-if="sections.custom">
            <tr>
              <td class="td-name">验收标准<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.acceptanceStandard" :class="isInvalid('acceptanceStandard')" @change="clearInvalid('acceptanceStandard')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.acceptanceStandard"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('acceptanceStandard')">{{ sourceLabel('acceptanceStandard') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('acceptanceStandard')" class="btn-view graphic" @click="handleViewClick('acceptanceStandard')">图形</button>
                <button v-if="showDocBtn('acceptanceStandard')" class="btn-view doc" @click="handleViewClick('acceptanceStandard')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">阻抗控制<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.impedanceControl" :class="isInvalid('impedanceControl')" @change="clearInvalid('impedanceControl')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.impedanceControl"
                    :key="v.value"
                    :label="v.label"
                    :value="v.value"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('impedanceControl')">{{ sourceLabel('impedanceControl') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('impedanceControl')" class="btn-view graphic" @click="handleViewClick('impedanceControl')">图形</button>
                <button v-if="showDocBtn('impedanceControl')" class="btn-view doc" @click="handleViewClick('impedanceControl')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">标记要求<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.markingRequirements" :class="isInvalid('markingRequirements')" @change="clearInvalid('markingRequirements')"
                  size="small"
                  multiple
                  collapse-tags
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.markingRequirements"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('markingRequirements')">{{ sourceLabel('markingRequirements') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('markingRequirements')" class="btn-view graphic" @click="handleViewClick('markingRequirements')">图形</button>
                <button v-if="showDocBtn('markingRequirements')" class="btn-view doc" @click="handleViewClick('markingRequirements')">加工文档</button>
              </td>
            </tr>
            <tr v-if="form.markingRequirements.includes('周期标记')">
              <td class="td-name">周期格式<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.periodFormat" :class="isInvalid('periodFormat')" @change="clearInvalid('periodFormat')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.periodFormat"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('periodFormat')">{{ sourceLabel('periodFormat') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('periodFormat')" class="btn-view graphic" @click="handleViewClick('periodFormat')">图形</button>
                <button v-if="showDocBtn('periodFormat')" class="btn-view doc" @click="handleViewClick('periodFormat')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">测试要求<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.testRequirements" :class="isInvalid('testRequirements')" @change="clearInvalid('testRequirements')"
                  size="small"
                  multiple
                  collapse-tags
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.testRequirements"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('testRequirements')">{{ sourceLabel('testRequirements') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('testRequirements')" class="btn-view graphic" @click="handleViewClick('testRequirements')">图形</button>
                <button v-if="showDocBtn('testRequirements')" class="btn-view doc" @click="handleViewClick('testRequirements')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">出货报告<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.shippingReports" :class="isInvalid('shippingReports')" @change="clearInvalid('shippingReports')"
                  size="small"
                  multiple
                  collapse-tags
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.shippingReports"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('shippingReports')">{{ sourceLabel('shippingReports') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('shippingReports')" class="btn-view graphic" @click="handleViewClick('shippingReports')">图形</button>
                <button v-if="showDocBtn('shippingReports')" class="btn-view doc" @click="handleViewClick('shippingReports')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">特殊工艺<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.specialProcesses" :class="isInvalid('specialProcesses')" @change="clearInvalid('specialProcesses')"
                  size="small"
                  multiple
                  collapse-tags
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.specialProcesses"
                    :key="v"
                    :label="v"
                    :value="v"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('specialProcesses')">{{ sourceLabel('specialProcesses') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('specialProcesses')" class="btn-view graphic" @click="handleViewClick('specialProcesses')">图形</button>
                <button v-if="showDocBtn('specialProcesses')" class="btn-view doc" @click="handleViewClick('specialProcesses')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">光绘确认<span class="req">*</span></td>
              <td class="td-val">
                <el-select
                  v-model="form.confirmProductionFile" :class="isInvalid('confirmProductionFile')" @change="clearInvalid('confirmProductionFile')"
                  size="small"
                  style="width: 100%"
                  ><el-option
                    v-for="v in opts.confirmProductionFile"
                    :key="v.value"
                    :label="v.label"
                    :value="v.value"
                /></el-select>
              </td>
              <td class="td-src"><span :class="sourceClass('confirmProductionFile')">{{ sourceLabel('confirmProductionFile') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('confirmProductionFile')" class="btn-view graphic" @click="handleViewClick('confirmProductionFile')">图形</button>
                <button v-if="showDocBtn('confirmProductionFile')" class="btn-view doc" @click="handleViewClick('confirmProductionFile')">加工文档</button>
              </td>
            </tr>
          </template>

          <!-- ====== 四、叠层 ====== -->
          <tr class="section-row" @click="sections.stackup = !sections.stackup">
            <td colspan="4">
              四、叠层
              <span class="arrow" :class="{ up: sections.stackup }">▼</span>
            </td>
          </tr>
          <tr v-if="sections.stackup">
            <td colspan="4">
              <table class="inner-table">
                <thead>
                  <tr>
                    <th>层号</th>
                    <th>材料</th>
                    <th>类型</th>
                    <th>铜厚(mil)</th>
                    <th>介质厚度(mil)</th>
                    <th>介电常数</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in stackupRows" :key="i">
                    <td><el-input v-model="row.layerName" size="small" /></td>
                    <td>
                      <el-select
                        v-model="row.material"
                        size="small"
                        style="width: 100%"
                        ><el-option
                          v-for="m in ['PP', 'CORE', 'CU']"
                          :key="m"
                          :label="m"
                          :value="m"
                      /></el-select>
                    </td>
                    <td>
                      <el-select
                        v-model="row.pcbMaterialType"
                        size="small"
                        filterable
                        :disabled="row.material === 'CU'"
                        style="width: 100%"
                        ><el-option
                          v-for="m in materialTypesFor(row)"
                          :key="m"
                          :label="m"
                          :value="m"
                      /></el-select>
                    </td>
                    <td>
                      <el-input-number
                        v-model="row.copperThickness"
                        size="small"
                        :min="0.1"
                        :max="10"
                        :precision="2"
                        :disabled="row.material !== 'CU'"
                        style="width: 100%"
                      />
                    </td>
                    <td>
                      <el-input-number
                        v-model="row.dielectricThickness"
                        size="small"
                        :min="0.01"
                        :max="100"
                        :precision="2"
                        :disabled="row.material === 'CU'"
                        style="width: 100%"
                      />
                    </td>
                    <td>
                      <el-input-number
                        v-model="row.dk"
                        size="small"
                        :min="1"
                        :max="50"
                        :precision="2"
                        :disabled="row.material === 'CU'"
                        style="width: 100%"
                      />
                    </td>
                    <td>
                      <button
                        class="btn-del-row"
                        @click="stackupRows.splice(i, 1)"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <button class="btn-add-row" @click="addStackupRow">
                + 新增一行
              </button>
            </td>
          </tr>

          <!-- ====== 五、阻抗控制要求 ====== -->
          <tr
            class="section-row"
            @click="sections.impedance = !sections.impedance"
          >
            <td colspan="4">
              五、阻抗控制要求
              <span class="arrow" :class="{ up: sections.impedance }">▼</span>
            </td>
          </tr>
          <tr v-if="sections.impedance">
            <td colspan="4">
              <table class="inner-table">
                <thead>
                  <tr>
                    <th>阻抗类型</th>
                    <th>控制层</th>
                    <th>上参</th>
                    <th>下参</th>
                    <th>盖油</th>
                    <th>线宽(mil)</th>
                    <th>线距(mil)</th>
                    <th>线铜(mil)</th>
                    <th>阻抗(ohm)</th>
                    <th>公差(%)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in impRows" :key="i">
                    <td>
                      <el-select
                        v-model="row.impType"
                        size="small"
                        style="width: 100%"
                        ><el-option
                          v-for="t in impTypes"
                          :key="t"
                          :label="t"
                          :value="t"
                      /></el-select>
                    </td>
                    <td>
                      <el-input v-model="row.controlLayer" size="small" />
                    </td>
                    <td><el-input v-model="row.refLayerTop" size="small" /></td>
                    <td>
                      <el-input v-model="row.refLayerBottom" size="small" />
                    </td>
                    <td><el-switch v-model="row.isCoated" size="small" /></td>
                    <td>
                      <el-input-number
                        v-model="row.lineWidth"
                        size="small"
                        :min="1"
                        :max="100"
                        :precision="2"
                        style="width: 100%"
                      />
                    </td>
                    <td>
                      <el-input-number
                        v-model="row.lineSpacing"
                        size="small"
                        :min="1"
                        :max="100"
                        :precision="2"
                        style="width: 100%"
                      />
                    </td>
                    <td>
                      <el-input-number
                        v-model="row.lineToCopper"
                        size="small"
                        :min="1"
                        :max="100"
                        :precision="2"
                        style="width: 100%"
                      />
                    </td>
                    <td>
                      <el-input-number
                        v-model="row.impTarget"
                        size="small"
                        :min="1"
                        :max="200"
                        :precision="2"
                        style="width: 100%"
                      />
                    </td>
                    <td>
                      <el-input-number
                        v-model="row.impTol"
                        size="small"
                        :min="1"
                        :max="50"
                        :precision="1"
                        style="width: 100%"
                      />
                    </td>
                    <td>
                      <button class="btn-del-row" @click="impRows.splice(i, 1)">
                        ✕
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <button class="btn-add-row" @click="addImpRow">+ 新增一行</button>
              </td>
          </tr>
        </tbody>
      </table>

      <!-- ====== 六、开票资料 ====== -->
      <InvoiceSection ref="invoiceRef" v-model:expanded="sections.invoice" :uid="userUid" :token="userToken" />

      <!-- ====== 七、配送信息 ====== -->
      <DeliverySection ref="deliveryRef" v-model:expanded="sections.delivery" :token="userToken" />

      <!-- 报价摘要 + 提交 -->
      <div class="quote-card">
        <div class="qc-title">💰 报价摘要</div>
        <div class="qc-grid">
          <!-- <div class="qc-row"><span>数量</span><span class="qcv">{{ form.quantity }} pcs</span></div> -->
          <!-- <div class="qc-row"><span>层数</span><span class="qcv">{{ form.layerCount }}层</span></div> -->
          <!-- <div class="qc-row"><span>板厚</span><span class="qcv">{{ form.boardThickness }}mm</span></div> -->
          <!-- <div class="qc-row"><span>板材</span><span class="qcv">{{ form.materialType }}</span></div> -->
          <!-- <div class="qc-row"><span>表面处理</span><span class="qcv">{{ form.surfaceFinish }}</span></div> -->
          <div class="qc-row"><span>制板费</span><span class="qcv">¥{{ quoteData?.boardBaseFee?.toFixed(2) || '--' }}</span></div>
          <div class="qc-row"><span>工程费</span><span class="qcv">¥{{ quoteData?.engineeringFee?.toFixed(2) || '--' }}</span></div>
          <div class="qc-row"><span>特殊工艺加价</span><span class="qcv">¥{{ quoteData?.specialProcessFee?.toFixed(2) || '--' }}</span></div>
          <div class="qc-row"><span>加急费</span><span class="qcv">¥{{ quoteData?.expediteFee || '--' }}</span></div>
          <div class="qc-row"><span>单价</span><span class="qcv">{{ quoteData ? '¥' + quoteData.price?.toFixed(2) + ' / PCS' : '--' }}</span></div>
        </div>
        <div class="qc-divider"></div>
        <div class="qc-total">
          <span>预估总价<br /><small>(不含税运)</small></span>
          <span class="qc-price">{{ quoteData ? '¥' + quoteData.totalFee?.toFixed(2) : '--' }}</span>
        </div>
        <button class="btn-submit" :disabled="submitting" @click="submitForm">
          {{ submitting ? "提交中..." : "获取报价" }}
        </button>
        <button class="btn-submit btn-order" :disabled="ordering || !quoteData" @click="submitOrder">
          {{ ordering ? "提交中..." : "提交订单" }}
        </button>
        <p class="qc-note">价格仅供参考，以审核为准</p>
      </div>
    </div>

    <!-- 调试面板 -->
      <!-- <div class="debug-panel">
        <details>
          <summary class="debug-title">📋 QtMessage 原始数据（点击展开/收起）</summary>
          <pre class="debug-json">{{ JSON.stringify(rawEventData, null, 2) }}</pre>
        </details>
      </div> -->
    <el-dialog v-model="qrVisible" title="扫码支付" width="360px" :close-on-click-modal="false" @close="clearTimers()">
      <div style="text-align:center;position:relative">
        <img v-if="qrCodeUrl" :src="qrCodeUrl" style="width:280px;height:280px" :style="{ opacity: qrExpired ? 0.2 : 1 }" />
        <p v-if="!qrExpired" style="margin-top:12px;color:#666;font-size:12px">请使用手机扫码完成支付（{{ Math.floor(qrCountdown / 60) }}:{{ String(qrCountdown % 60).padStart(2, '0') }}）</p>
        <!-- 过期蒙层 -->
        <div v-if="qrExpired" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,0.6)">
          <p style="color:#f53f3f;font-size:14px;font-weight:600;margin-bottom:12px">二维码已过期</p>
          <el-button type="primary" size="small" @click="refreshQrCode()">重新加载</el-button>
        </div>
      </div>
    </el-dialog>

  </div>
</template>

<style scoped>
.page-wrapper {
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #f5f6fa;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 12px;
}
.form-box {
  width: 100%;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.form-box {
  width: 100%;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.param-table thead th {
  background: #f7f8fa;
  color: #666;
  font-weight: 600;
  padding: 8px 10px;
  border: 1px solid #e5e6eb;
  text-align: center;
  font-size: 11px;
  position: sticky;
  top: 0;
  z-index: 2;
}
.col-name {
  width: 24%;
}
.col-value {
  width: 34%;
}
.col-source {
  width: 22%;
  text-align: center;
}
.col-view {
  width: 20%;
  text-align: center;
}

.section-row {
  cursor: pointer;
}
.section-row td {
  background: #f0f4ff;
  font-weight: 600;
  color: #2756ff;
  font-size: 13px;
  padding: 8px 10px;
  border: 1px solid #e5e6eb;
  transition: 0.2s;
}
.section-row td:hover {
  background: #e0eaff;
}
.arrow {
  float: right;
  font-size: 10px;
  color: #999;
  transition: 0.3s;
  display: inline-block;
}
.arrow.up {
  transform: rotate(-180deg);
}

.param-table td {
  padding: 6px 8px;
  border: 1px solid #f0f0f0;
  vertical-align: middle;
}
.td-name {
  font-size: 12px;
  color: #555;
  font-weight: 500;
}
.td-name .req {
  color: #f53f3f;
  margin-left: 2px;
}
.td-val {
  display: flex;
  align-items: center;
  gap: 4px;
}
.td-val .unit {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
}
.td-src {
  text-align: center;
}
.td-view {
  text-align: center;
}
.src-tag {
  font-size: 12px;
  color: #999;
}
.src-tag.empty {
  color: #ccc;
}

.badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  white-space: nowrap;
}
.badge.extracted {
  background: #e8f0ff;
  color: #2756ff;
  border: 1px solid #c4d8ff;
}
.badge.ai {
  background: #f3e8ff;
  color: #7c3aed;
  border: 1px solid #d8b4fe;
}
.badge.empty {
  background: #f5f5f5;
  color: #999;
  border: 1px solid #e0e0e0;
}

.btn-view {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  padding: 2px 8px;
  border: 1px solid #c4d8ff;
  border-radius: 10px;
  background: #f5f8ff;
  color: #2756ff;
  cursor: pointer;
  white-space: nowrap;
  border: none;
}
.btn-view.graphic {
  border: 1px solid #b7ebc2;
  background: #f0faf2;
  color: #00b42a;
}
.btn-view.doc {
  border: 1px solid #ffe0b2;
  background: #fffaf0;
  color: #d46b08;
}

.inner-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  margin-bottom: 6px;
}
.inner-table th {
  background: #f7f8fa;
  padding: 4px 6px;
  border: 1px solid #e5e6eb;
  font-weight: 600;
  color: #666;
}
.inner-table td {
  padding: 4px 6px;
  border: 1px solid #f0f0f0;
}
.btn-del-row {
  border: none;
  background: none;
  color: #f53f3f;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
}
.btn-add-row {
  padding: 4px 12px;
  border: 1px dashed #c4d8ff;
  border-radius: 4px;
  background: #f5f8ff;
  color: #2756ff;
  font-size: 11px;
  cursor: pointer;
}

.quote-card {
  background: #f7f8fc;
  border-radius: 8px;
  padding: 14px 16px;
  margin: 12px 16px 16px;
  border: 1px solid #e5e6eb;
}
.qc-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 10px;
}
.qc-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.qc-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #666;
  line-height: 1.7;
}
.qcv {
  color: #333;
  font-weight: 500;
}
.qc-divider {
  border-top: 1px dashed #ddd;
  margin: 8px 0;
}
.qc-total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 4px;
}
.qc-total span {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}
.qc-total small {
  font-size: 11px;
  color: #999;
}
.qc-price {
  font-size: 22px;
  font-weight: 700;
  color: #2756ff;
}
.btn-submit {
  width: 100%;
  height: 40px;
  background: linear-gradient(90deg, #2756ff, #4360df);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 10px;
  transition: 0.3s;
}
.btn-submit:hover {
  opacity: 0.9;
}
.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.qc-note {
  font-size: 11px;
  color: #aaa;
  text-align: center;
  margin: 6px 0 0;
}

.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255,255,255,0.9);
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #666;
  font-size: 14px;
}
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e6eb;
  border-top-color: #2756ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.debug-panel { margin: 0 16px 16px; background: #1e1e1e; border-radius: 6px; overflow: hidden; }
.debug-title { padding: 8px 14px; font-size: 12px; font-weight: 600; color: #ccc; cursor: pointer; user-select: none; background: #2a2a2a; }
.debug-title:hover { color: #fff; }
.debug-json { max-height: 360px; overflow: auto; margin: 0; padding: 12px 14px; font-size: 11px; line-height: 1.5; color: #ce9178; white-space: pre-wrap; word-break: break-all; }
:deep(.input-error .el-input__wrapper) { box-shadow: 0 0 0 1px #f56c6c inset !important; }
:deep(.input-error .el-input__inner) { color: #f56c6c; }
</style>