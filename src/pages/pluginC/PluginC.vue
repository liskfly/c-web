<script setup lang="ts">
import { reactive, ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { orderCreate, payCallback, updateOrderStatus, getOnlineQuoteParamsInfo, getQuoteInfoOffline, getOrderPriceQuery, submitTransferNotify } from '@/api/pcb'
import { pcbPayV2, getPcbOrderStatusV2 } from '@/api/invoice'
import QRCode from 'qrcode'
import { ElInput, ElSelect, ElOption, ElInputNumber, ElMessage, ElMessageBox, ElDialog, ElButton, ElAutocomplete, ElSwitch, ElTable, ElTableColumn } from 'element-plus'

// ==================== 折叠 ====================
const sections = reactive<Record<string, boolean>>({ basic: true, process: true, custom: true, stackup: true, impedance: true })

// ==================== 表单 V7.0 ====================
const form = reactive<Record<string, any>>({
  pcbName: "", pcbFile: "", layerCount: null, blindVia: false,
  pcsSizeWidth: null, pcsSizeHeight: null, dimensionTolerance: "+/-0.10mm", quantity: 10, deliveryUnit: "PCS",
  panelTypesCount: 1, setMethod: "单片无拼板", clientPanelHorizontal: 1, clientPanelVertical: 1,
  setSizeWidth: null, setSizeHeight: null, clientPanelSeparation: "拼板+V-CUT交货", acceptXOut: false,
  materialType: "FR4", materialBrand: "", materialVersion: "", materialTg: false, halogenFree: false,
  maxWarpage: "0.75%", boardThickness: 1.6, thicknessTolerance: "+/-10%",
  outerCopperThickness: 35, outerBaseCopperThickness: 18, innerCopperThickness: 1,
  minTraceWidthOuter: 20, minTraceSpacingOuter: 20, minTraceWidthInner: 20, minTraceSpacingInner: 20,
  minHoleSize: 0.200, holeCount: null, holeCopperThickness: 20, solderMaskColor: "绿色", silkscreenColor: "白色字符",
  surfaceFinish: "无铅喷锡", enigGoldThickness: 0.0508, immersionGoldArea: 20.0,
  viaProcess: "阻焊塞孔", goldFingerType: "无", goldFingerThickness: 0.381,
  goldFingerChamferAngle: "30°", goldFingerChamferDepth: 0.50, goldFingerChamferRemaining: 0.60,
  acceptanceStandard: "IPC 2", impedanceControl: false,
  markingRequirements: ["不需要"] as string[], periodFormat: "WWYY",
  testRequirements: ["飞针测试"] as string[], shippingReports: ["最终产品检查报告"] as string[], specialProcesses: ["不需要"] as string[],
  confirmProductionFile: false,
  remark: [] as string[],
})

// ==================== 字段状态颜色 ====================
const DEFAULT_VALUES: Record<string, any> = JSON.parse(JSON.stringify({
  pcbName: "", pcbFile: "", layerCount: null, blindVia: false,
  pcsSizeWidth: null, pcsSizeHeight: null, dimensionTolerance: "+/-0.10mm", quantity: 10, deliveryUnit: "PCS",
  panelTypesCount: 1, setMethod: "单片无拼板", clientPanelHorizontal: 1, clientPanelVertical: 1,
  setSizeWidth: null, setSizeHeight: null, clientPanelSeparation: "拼板+V-CUT交货", acceptXOut: false,
  materialType: "FR4", materialBrand: "", materialVersion: "", materialTg: false, halogenFree: false,
  maxWarpage: "0.75%", boardThickness: 1.6, thicknessTolerance: "+/-10%",
  outerCopperThickness: 35, outerBaseCopperThickness: 18, innerCopperThickness: 1,
  minTraceWidthOuter: 20, minTraceSpacingOuter: 20, minTraceWidthInner: 20, minTraceSpacingInner: 20,
  minHoleSize: 0.200, holeCount: null, holeCopperThickness: 20, solderMaskColor: "绿色", silkscreenColor: "白色字符",
  surfaceFinish: "无铅喷锡", enigGoldThickness: 0.0508, immersionGoldArea: 20.0,
  viaProcess: "阻焊塞孔", goldFingerType: "无", goldFingerThickness: 0.381,
  goldFingerChamferAngle: "30°", goldFingerChamferDepth: 0.50, goldFingerChamferRemaining: 0.60,
  acceptanceStandard: "IPC 2", impedanceControl: false,
  markingRequirements: ["不需要"], periodFormat: "WWYY",
  testRequirements: ["飞针测试"], shippingReports: ["最终产品检查报告"], specialProcesses: ["不需要"],
  confirmProductionFile: false,
}))

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
const opts: Record<string, any[]> = {
  layerCount: ["1","2","4","6","8","10","12","14","16","18","20","22","24","26","28","30"],
  blindVia: [{ value: false, label: '否' }, { value: true, label: '是' }],
  dimensionTolerance: ["+/-0.10mm","+/-0.15mm","+/-0.20mm"],
  deliveryUnit: ["PCS","SET"], setMethodAll: ["单片无拼板","单片加工艺边","客户拼板"],
  clientPanelSeparation: ["拼板&邮票孔交货","拼板铣开交货","拼板V-CUT+桥连交货","拼板桥连+邮票孔","拼板V-CUT+邮票孔","拼板V-CUT桥连+邮票孔","拼板桥连交货","拼板+V-CUT交货"],
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
  enigGoldThickness: ["0.0508","0.0762","0.080","0.1016"],
  viaProcess: ["按Gerber文件","阻焊覆盖","BGA芯片处阻焊塞孔+按Gerber文件","不盖阻焊","阻焊塞孔","非导电树脂塞孔","非导电树脂塞孔+电镀填平"],
  goldFingerType: ["无","常规金手指","分段金手指","长短金手指"],
  goldFingerThickness: ["0.381","0.762","0.8","1.25"],
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

// ==================== 材料规则表（兴森P10工厂材料清单） ====================
// 芯板型号 → { TG值, 是否无卤, 品牌 }，PP型号不参与匹配
interface VersionDetail { tg: string; halogen: boolean; brand: string }
const materialRules: Record<string, { brands: string[]; versions: string[]; tg: string[]; halogen: string[]; versionDetail: Record<string, VersionDetail> }> = {
  'FR4': {
    brands: ['联茂', '南亚', '生益', '台耀'],
    versions: ['IT-158', 'NY2150', 'S1000H', 'S1151G', 'S1150G', 'S1165', 'IT-180A', 'TU-752', 'S1000-2M', 'S1000-2', 'TU-768', 'NY2170', 'S1190'],
    tg: ['中TG', '高TG'],
    halogen: ['是', '否'],
    versionDetail: {
      'IT-158': { tg: '中TG', halogen: false, brand: '联茂' },
      'NY2150': { tg: '中TG', halogen: false, brand: '南亚' },
      'S1000H': { tg: '中TG', halogen: false, brand: '生益' },
      'S1151G': { tg: '中TG', halogen: true, brand: '生益' },
      'S1150G': { tg: '中TG', halogen: true, brand: '生益' },
      'S1165': { tg: '中TG', halogen: true, brand: '生益' },
      'IT-180A': { tg: '高TG', halogen: false, brand: '联茂' },
      'TU-752': { tg: '高TG', halogen: false, brand: '台耀' },
      'S1000-2M': { tg: '高TG', halogen: false, brand: '生益' },
      'S1000-2': { tg: '高TG', halogen: false, brand: '生益' },
      'TU-768': { tg: '高TG', halogen: true, brand: '台耀' },
      'NY2170': { tg: '高TG', halogen: false, brand: '南亚' },
      'S1190': { tg: '高TG', halogen: false, brand: '生益' },
    },
  },
  '高频': {
    brands: ['Rogers', '生益'],
    versions: ['RO4725JXR', 'RO4730G3', 'Aerowave300', 'RO4533', 'RO4350B', 'RO4835', 'RO4350', 'RO4233', 'RO4360', 'RO4360G2', 'RO4534', 'RO4535', 'RO4725', 'RO4730', 'RO4003C', 'S7136H', 'S7135（不做压合）'],
    tg: ['高TG'],
    halogen: ['否'],
    versionDetail: {
      'RO4725JXR': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4730G3': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'Aerowave300': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4533': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4350B': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4835': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4350': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4233': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4360': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4360G2': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4534': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4535': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4725': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4730': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'RO4003C': { tg: '高TG', halogen: false, brand: 'Rogers' },
      'S7136H': { tg: '高TG', halogen: false, brand: '生益' },
      'S7135（不做压合）': { tg: '高TG', halogen: false, brand: '生益' },
    },
  },
  '高速': {
    brands: ['台耀', '联茂', 'Neclo', '松下', '生益', 'Isola', '台光', '南亚'],
    versions: ['TU862 HF', 'IT-170GT', 'IT-170GRA1', 'IT-170GRA2', 'TU-872 SLK', 'TU-872 SLK SP', 'N4103-13', 'N4103-13EP', 'N4103-13SI', 'N4103-13EPSI', 'R-5725/M4', 'R-5725S/M4S', 'R-5725SS', 'R-5785GE', 'R-5785N/M7N', 'Synamic6', 'FR408HR', 'S7439', 'S7439HW', 'Synamic6N', 'EM-888', 'EM-888K', 'R-5575', 'R-5775', 'R-5775G/M6G', 'R-5775N/M6N', 'R-5775K/M6K', 'R-5775NE', 'IT-968', 'IT-958G', 'IT-968 SE', 'NY6300'],
    tg: ['高TG'],
    halogen: ['是', '否'],
    versionDetail: {
      'TU862 HF': { tg: '高TG', halogen: true, brand: '台耀' },
      'IT-170GT': { tg: '高TG', halogen: true, brand: '联茂' },
      'IT-170GRA1': { tg: '高TG', halogen: true, brand: '联茂' },
      'IT-170GRA2': { tg: '高TG', halogen: true, brand: '联茂' },
      'TU-872 SLK': { tg: '高TG', halogen: false, brand: '台耀' },
      'TU-872 SLK SP': { tg: '高TG', halogen: false, brand: '台耀' },
      'N4103-13': { tg: '高TG', halogen: false, brand: 'Neclo' },
      'N4103-13EP': { tg: '高TG', halogen: false, brand: 'Neclo' },
      'N4103-13SI': { tg: '高TG', halogen: false, brand: 'Neclo' },
      'N4103-13EPSI': { tg: '高TG', halogen: false, brand: 'Neclo' },
      'R-5725/M4': { tg: '高TG', halogen: false, brand: '松下' },
      'R-5725S/M4S': { tg: '高TG', halogen: false, brand: '松下' },
      'R-5725SS': { tg: '高TG', halogen: false, brand: '松下' },
      'R-5785GE': { tg: '高TG', halogen: false, brand: '松下' },
      'R-5785N/M7N': { tg: '高TG', halogen: false, brand: '松下' },
      'Synamic6': { tg: '高TG', halogen: false, brand: '生益' },
      'FR408HR': { tg: '高TG', halogen: false, brand: 'Isola' },
      'S7439': { tg: '高TG', halogen: false, brand: '生益' },
      'S7439HW': { tg: '高TG', halogen: false, brand: '生益' },
      'Synamic6N': { tg: '高TG', halogen: false, brand: '生益' },
      'EM-888': { tg: '高TG', halogen: true, brand: '台光' },
      'EM-888K': { tg: '高TG', halogen: true, brand: '台光' },
      'R-5575': { tg: '高TG', halogen: true, brand: '松下' },
      'R-5775': { tg: '高TG', halogen: false, brand: '松下' },
      'R-5775G/M6G': { tg: '高TG', halogen: false, brand: '松下' },
      'R-5775N/M6N': { tg: '高TG', halogen: false, brand: '松下' },
      'R-5775K/M6K': { tg: '高TG', halogen: false, brand: '松下' },
      'R-5775NE': { tg: '高TG', halogen: false, brand: '松下' },
      'IT-968': { tg: '高TG', halogen: false, brand: '联茂' },
      'IT-958G': { tg: '高TG', halogen: false, brand: '联茂' },
      'IT-968 SE': { tg: '高TG', halogen: false, brand: '联茂' },
      'NY6300': { tg: '高TG', halogen: false, brand: '南亚' },
    },
  },
  'PI': {
    brands: ['Arlon', '腾辉'],
    versions: ['85N', 'VT-901'],
    tg: ['高TG'],
    halogen: ['否'],
    versionDetail: {
      '85N': { tg: '高TG', halogen: false, brand: 'Arlon' },
      'VT-901': { tg: '高TG', halogen: false, brand: '腾辉' },
    },
  },
  '混压板': { brands: [], versions: [], tg: [], halogen: [], versionDetail: {} },
}

// 全局型号明细表
const versionDetailMap: Record<string, VersionDetail> = {}
for (const rule of Object.values(materialRules)) {
  for (const [v, d] of Object.entries(rule.versionDetail)) versionDetailMap[v] = d
}

// 芯板型号 → PP型号
const ppMap: Record<string, string> = {
  'IT-158': 'IT-158BS', 'NY2150': 'NY2150', 'S1000H': 'S1000HB', 'S1151G': 'S1151GB', 'S1150G': 'S1150GB', 'S1165': 'S1165B',
  'IT-180A': 'IT-180A', 'TU-752': 'TU-75P', 'S1000-2M': 'S1000-2MB', 'S1000-2': 'S1000-2B', 'TU-768': 'TU-768', 'NY2170': 'NY2170', 'S1190': 'S1190B',
  'RO4725JXR': 'RO4450F',
  'TU862 HF': 'TU86P HF', 'IT-170GT': 'IT-170GT', 'IT-170GRA1': 'IT-170GRA1', 'IT-170GRA2': 'IT-170GRA2', 'TU-872 SLK': 'TU-87P SLK', 'TU-872 SLK SP': 'TU-87P SLK SP',
  'N4103-13': 'N4203-13', 'N4103-13EP': 'N4203-13EP', 'N4103-13SI': 'N4203-13SI', 'N4103-13EPSI': 'N4203-13EPSI',
  'R-5725/M4': 'R-5620', 'R-5725S/M4S': 'R-5620S', 'R-5725SS': 'R-5620SS', 'R-5785GE': 'R-5680GE', 'R-5785N/M7N': 'R-5680N',
  'Synamic6': 'Synamic6B', 'FR408HR': 'FR408HR', 'S7439': 'S7439 B', 'S7439HW': 'S7439HW B', 'Synamic6N': 'Synamic6 B',
  'EM-888': 'EM-888 B', 'EM-888K': 'EM-888 BK', 'R-5575': 'R-5620',
  'R-5775': 'R-5670', 'R-5775G/M6G': 'R-5670G', 'R-5775N/M6N': 'R-5670N', 'R-5775K/M6K': 'R-5670K', 'R-5775NE': 'R-5670NE',
  'IT-968': 'IT-968 B', 'IT-958G': 'IT-958G', 'IT-968 SE': 'IT-968SE B', 'NY6300': 'NY6300P',
  '85N': '85N', 'VT-901': 'VT-901',
}

// 当前匹配到的 PP 型号（叠层生成时 PP 行“类型”的默认值）
const currentPpModel = ref('')

// 材料选项覆盖：板材种类按清单分类，芯板型号/品牌取清单中的全部值
opts.materialType = ['FR4', '高频', '高速', 'PI', '混压板']
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
const versionTypeMap: Record<string, string> = {}
for (const [typeName, rule] of Object.entries(materialRules)) {
  for (const v of rule.versions) versionTypeMap[v] = typeName
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

// 无型号时按材料类型补默认（P10工厂材料使用规则），并记录对应 PP 型号
function applyTypeDefaults(typeRaw: string, tgProvided: boolean) {
  const t = String(typeRaw)
  if (t === 'FR4' || t === 'FR-4') {
    if (tgProvided && form.materialTg === false) {
      // 提供中TG要求：S1000H + S1000HB PP，有卤
      form.materialVersion = 'S1000H'
      form.materialBrand = '生益'
      form.materialTg = false
      form.halogenFree = false
      currentPpModel.value = 'S1000HB'
    } else {
      // 默认高TG：S1000-2M + S1000-2MB PP
      form.materialVersion = 'S1000-2M'
      form.materialBrand = '生益'
      form.materialTg = true
      form.halogenFree = false
      currentPpModel.value = 'S1000-2MB'
    }
    return
  }
  const dft: Record<string, string> = { '高频': 'RO4350B', '高频板': 'RO4350B', '高速': 'IT-170GRA1', '高速板材': 'IT-170GRA1', 'PI': 'VT-901', 'PI板材': 'VT-901' }
  const v = dft[t]
  if (!v) return
  const d = versionDetailMap[v]
  form.materialVersion = v
  form.materialBrand = d ? d.brand : ''
  form.materialTg = d ? d.tg === '高TG' : true
  form.halogenFree = d ? d.halogen : false
  currentPpModel.value = ppMap[v] || ''
}

// 数据到达后的材料匹配：型号优先带出；无型号且提供类型未提供品牌 → 按类型补默认
function applyMaterialPriorityRules(data: Record<string, any>) {
  const version = form.materialVersion
  if (version && versionDetailMap[version]) {
    fillByVersion(version)
    return
  }
  const typeRaw = data.materialType?.value ?? data.materialType
  const brandRaw = data.materialBrand?.value ?? data.materialBrand
  const tgRaw = data.materialTg?.value ?? data.materialTg
  if (typeRaw && !brandRaw && !form.materialBrand) applyTypeDefaults(String(typeRaw), tgRaw !== undefined && tgRaw !== null)
  else currentPpModel.value = ''
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

// ==================== 条件 ====================
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

// 成品板厚联动板厚公差 & 超范围提醒
watch(() => form.boardThickness, (val) => {
  const n = Number(val)
  if (Number.isFinite(n)) {
    form.thicknessTolerance = n < 1.0 ? '+/-0.10mm' : '+/-10%'
  }
  const KEY = 'BOARD_THICKNESS_LIMIT'
  form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
  if (Number.isFinite(n) && n > 0 && (n < 0.6 || n > 3.5)) {
    form.remark.push(KEY + '|' + '成品板厚：P10工厂完成板厚加工能力范围：0.6~3.5mm，超范围放P10以外的其他工厂生产，电巢走线下下单模式进行')
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

// 外形公差超范围提醒（< 0.1mm 超出P10能力）
watch(() => form.dimensionTolerance, (val) => {
  const KEY = 'DIMENSION_TOLERANCE_LIMIT'
  form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
  const match = String(val ?? '').match(/[0-9]*\.?[0-9]+/)
  const n = match ? Number(match[0]) : NaN
  if (Number.isFinite(n) && n > 0 && n < 0.1) {
    form.remark.push(KEY + '|' + '外形公差：小于0.1mm，超出P10工厂能力，走线下下单模式进行')
  }
})

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
const queryMaxWarpage = makeQueryFn(opts.maxWarpage)
const queryLayerCount = makeQueryFn(opts.layerCount)

// 叠层“类型”列选项：PP → PP型号；CORE/光板 → 芯板型号；CU → 铜箔类型
const ppModelList = ['IT-158BS', 'NY2150', 'S1000HB', 'S1151GB', 'S1150GB', 'S1165B', 'IT-180A', 'TU-75P', 'S1000-2MB', 'S1000-2B', 'TU-768', 'NY2170', 'S1190B', 'RO4450F', 'TU86P HF', 'IT-170GT', 'IT-170GRA1', 'IT-170GRA2', 'TU-87P SLK', 'TU-87P SLK SP', 'N4203-13', 'N4203-13EP', 'N4203-13SI', 'N4203-13EPSI', 'R-5620', 'R-5620S', 'R-5620SS', 'R-5680GE', 'R-5680N', 'Synamic6B', 'FR408HR', 'S7439 B', 'S7439HW B', 'Synamic6 B', 'EM-888 B', 'EM-888 BK', 'R-5670', 'R-5670G', 'R-5670N', 'R-5670K', 'R-5670NE', 'IT-968 B', 'IT-958G', 'IT-968SE B', 'NY6300P', '85N', 'VT-901']
const queryStackupPpType = makeQueryFn(ppModelList)
const queryStackupCoreType = makeQueryFn(opts.materialVersion)
const queryStackupCuType = makeQueryFn(['HTE', 'RTF', 'RTF2', 'RTF3', 'HVLP', 'HVLP2', 'HVLP3', 'HVLP4'])

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
// 铜厚默认值(mil)：顶层/底层取“外层基铜厚度”(um→mil)，内层取“内层基铜厚度”(oz→mil)
const OUTER_CU_DEFAULT = 0.7  // 外层基铜厚度缺失时回退 0.5oz ≈ 0.7mil
const INNER_CU_DEFAULT = 1.4  // 内层基铜厚度缺失时回退 1oz ≈ 1.4mil

function outerCuMil(): number {
  const v = Number(form.outerBaseCopperThickness)
  return Number.isFinite(v) && v > 0 ? Number((v / 25.4).toFixed(2)) : OUTER_CU_DEFAULT
}

function innerCuMil(): number {
  const v = Number(form.innerCopperThickness)
  return Number.isFinite(v) && v > 0 ? Number((v * 1.4).toFixed(2)) : INNER_CU_DEFAULT
}

const stackupScheme = ref<'normal' | 'alt'>('normal')

function makeCu(outer: boolean): StackupRow {
  return { layerName: '', material: 'CU', pcbMaterialType: 'HTE', copperThickness: outer ? outerCuMil() : innerCuMil(), dielectricThickness: null, dk: null }
}

function generateStackup(N: number, scheme: 'normal' | 'alt' = 'normal') {
  const rows: StackupRow[] = []
  const M1 = scheme === 'normal' ? 'PP' : 'CORE'
  const M2 = scheme === 'normal' ? 'CORE' : 'PP'
  // PP 行“类型”默认值 = 当前匹配存储的 PP 型号
  const ppType = (m: string) => m === 'PP' ? currentPpModel.value : ''
  if (N === 1) {
    rows.push({ layerName: 'L1', material: 'CORE', pcbMaterialType: '', copperThickness: null, dielectricThickness: null, dk: null }, makeCu(true))
  } else if (N === 2) {
    rows.push(makeCu(true), { layerName: 'L2', material: 'CORE', pcbMaterialType: '', copperThickness: null, dielectricThickness: null, dk: null }, makeCu(true))
  } else if (N >= 4 && N % 2 === 0) {
    rows.push(makeCu(true))
    for (let i = 0; i < N / 2 - 1; i++) {
      rows.push({ layerName: '', material: M1, pcbMaterialType: ppType(M1), copperThickness: null, dielectricThickness: null, dk: null }, makeCu(false), { layerName: '', material: M2, pcbMaterialType: ppType(M2), copperThickness: null, dielectricThickness: null, dk: null }, makeCu(false))
    }
    rows.push({ layerName: '', material: M1, pcbMaterialType: ppType(M1), copperThickness: null, dielectricThickness: null, dk: null }, makeCu(true))
  }
  let cuIdx = 0
  stackupRows.value = rows.map(r => ({ ...r, layerName: r.material === 'CU' ? 'L' + (++cuIdx) : '' }))
}

// 匹配到 PP 型号后，给叠层里未填“类型”的 PP 行补默认值
watch(currentPpModel, (pp) => {
  if (!pp) return
  stackupRows.value.forEach(r => {
    if (r.material === 'PP' && !r.pcbMaterialType) r.pcbMaterialType = pp
  })
})

function toggleStackupScheme() {
  stackupScheme.value = stackupScheme.value === 'normal' ? 'alt' : 'normal'
  const n = Number(form.layerCount)
  if (n >= 1) { generateStackup(n, stackupScheme.value); generateImpedance(n) }
}

// 层数变化自动生成叠构（值合法时才生成，输入过程中不打断）
watch(() => form.layerCount, (val) => {
  const n = Number(val)
  if (Number.isInteger(n) && n > 0 && (n <= 2 || n % 2 === 0)) { generateStackup(n, stackupScheme.value); generateImpedance(n) }
})

// 层数失焦校验：只能大于0的数字，>2时只能偶数，最大60层；校验后生成叠构
function onLayerCountBlur() {
  const str = String(form.layerCount ?? '')
  const clean = str.replace(/[^\d]/g, '')
  let n = Number(clean)
  if (!clean) { n = 2 }
  if (n <= 0) n = 2
  if (n > 60) n = 60
  if (n > 2 && n % 2 !== 0) n += 1
  form.layerCount = n
  generateStackup(n, stackupScheme.value)
  generateImpedance(n)
}

function addStackupRow() { const n = stackupRows.value.length + 1; stackupRows.value.push({ layerName: 'L' + n, material: 'PP', pcbMaterialType: '', copperThickness: null, dielectricThickness: null, dk: null }) }

function insertStackupRow(index: number) {
  stackupRows.value.splice(index + 1, 0, { layerName: '', material: 'PP', pcbMaterialType: '', copperThickness: null, dielectricThickness: null, dk: null })
}

// 材料切换时重置字段：CU 行类型默认 HTE，非 CU 行清空铜厚
function onMaterialChange(row: StackupRow) {
  if (row.material === 'CU') {
    row.pcbMaterialType = 'HTE'
    row.dielectricThickness = null
    row.dk = null
  } else {
    row.copperThickness = null
  }
}

interface ImpRow { impType: string; controlLayer: string; refLayerTop: string; refLayerBottom: string; isCoated: boolean; lineWidth: number | null; lineSpacing: number | null; lineToCopper: number | null; impTarget: number | null; impTol: number; _refTopError?: string; _refBottomError?: string }
const impTypes = ["外层单端","外层单端共面地","外层差分","外层差分共面地","内层单端(双层屏蔽)","内层差分(双层屏蔽)","内层单端(单层屏蔽)","内层差分(单层屏蔽)","内层单端共面地(双层屏蔽)","内层差分共面地(双层屏蔽)","内层层间差分(双层屏蔽)","内层差分1B2A(双层屏蔽)","内层差分1B2A(单层屏蔽)"]
const impRows = ref<ImpRow[]>([])

const layerOptions = computed(() => Array.from({ length: Number(form.layerCount) || 0 }, (_, i) => 'L' + (i + 1)))
const refLayerOptions = computed(() => ['', ...layerOptions.value])

function getExpectedRefLayer(controlLayer: string, type: 'top' | 'bottom'): string {
  const c = parseInt(controlLayer.replace('L', ''))
  const total = Number(form.layerCount) || 0
  if (isNaN(c) || c < 1 || c > total) return ''
  if (c === 1 && type === 'top') return ''
  if (c === 1 && type === 'bottom') return 'L2'
  if (c === total && type === 'top') return 'L' + (total - 1)
  if (c === total && type === 'bottom') return ''
  if (type === 'top') return 'L' + (c - 1)
  return 'L' + (c + 1)
}

function onControlLayerChange(row: ImpRow) {
  const idx = parseInt(row.controlLayer?.replace('L', '')) || 0
  const total = Number(form.layerCount) || 0
  if (!idx || idx < 1 || idx > total) { row.refLayerTop = ''; row.refLayerBottom = ''; row._refTopError = ''; row._refBottomError = ''; return }
  if (idx === 1) { row.refLayerTop = ''; row.refLayerBottom = 'L2' }
  else if (idx === total) { row.refLayerTop = 'L' + (total - 1); row.refLayerBottom = '' }
  else { row.refLayerTop = 'L' + (idx - 1); row.refLayerBottom = 'L' + (idx + 1) }
  validateRefLayer(row, 'top')
  validateRefLayer(row, 'bottom')
}

function validateRefLayer(row: ImpRow, type: 'top' | 'bottom') {
  if (!row.controlLayer) { if (type === 'top') row._refTopError = ''; else row._refBottomError = ''; return }
  const expected = getExpectedRefLayer(row.controlLayer, type)
  const actual = type === 'top' ? row.refLayerTop : row.refLayerBottom
  if (actual !== expected) {
    const label = type === 'top' ? '上参' : '下参'
    const expLabel = expected || '空'
    if (type === 'top') row._refTopError = `${label}应为${expLabel}`; else row._refBottomError = `${label}应为${expLabel}`
  } else {
    if (type === 'top') row._refTopError = ''; else row._refBottomError = ''
  }
}

function addImpRow() { impRows.value.push({ impType: '', controlLayer: '', refLayerTop: '', refLayerBottom: '', isCoated: false, lineWidth: null, lineSpacing: null, lineToCopper: null, impTarget: null, impTol: 10 }) }

function insertImpRow(index: number) {
  impRows.value.splice(index + 1, 0, { impType: '', controlLayer: '', refLayerTop: '', refLayerBottom: '', isCoated: false, lineWidth: null, lineSpacing: null, lineToCopper: null, impTarget: null, impTol: 10 })
}

// 根据层数生成阻抗行：L1=外层单端、底层=外层差分，这两层盖油默认true，其余全空
function generateImpedance(N: number) {
  if (N < 2) { impRows.value = []; return }
  const rows: ImpRow[] = []
  for (let i = 1; i <= N; i++) {
    const isFirst = i === 1
    const isLast = i === N
    rows.push({
      impType: isFirst ? '外层单端' : isLast ? '外层差分' : '',
      controlLayer: 'L' + i,
      refLayerTop: '',
      refLayerBottom: '',
      isCoated: isFirst || isLast,
      lineWidth: null, lineSpacing: null, lineToCopper: null, impTarget: null, impTol: 10,
    })
  }
  impRows.value = rows
  impRows.value.forEach(r => onControlLayerChange(r))
}

// ==================== PCS/SET 尺寸联动 ====================
function handleSizeBlur() {
  const pw = Number(form.pcsSizeWidth)
  const ph = Number(form.pcsSizeHeight)
  const sw = Number(form.setSizeWidth)
  const sh = Number(form.setSizeHeight)

  // PCS 尺寸超限提醒（独立规则，不依赖 SET）
  const wOver = pw > 571.5
  const hOver = ph > 571.5
  const KEY = 'PCS_SIZE_LIMIT'
  if (Number.isFinite(pw) && Number.isFinite(ph)) {
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
    if (wOver && (ph <= 0 || ph > 419.1)) {
      form.remark.push(KEY + '|' + 'PCS尺寸(水平)已超过 571.5mm，PCS尺寸(垂直)需限制在 0-419.1mm 内，超出P10，走线下下单模式进行。')
    } else if (hOver && (pw <= 0 || pw > 419.1)) {
      form.remark.push(KEY + '|' + 'PCS尺寸(垂直)已超过 571.5mm，PCS尺寸(水平)需限制在 0-419.1mm 内，超出P10，走线下下单模式进行。')
    }
  }

  // SET 尺寸超限提醒（规则同 PCS）
  const swOver = sw > 571.5
  const shOver = sh > 571.5
  const KEY_SET = 'SET_SIZE_LIMIT'
  if (Number.isFinite(sw) && Number.isFinite(sh)) {
    form.remark = form.remark.filter((m: string) => !m.startsWith(KEY_SET + '|'))
    if (swOver && (sh <= 0 || sh > 419.1)) {
      form.remark.push(KEY_SET + '|' + 'SET尺寸(水平)已超过 571.5mm，SET尺寸(垂直)需限制在 0-419.1mm 内，超出P10，走线下下单模式进行。')
    } else if (shOver && (sw <= 0 || sw > 419.1)) {
      form.remark.push(KEY_SET + '|' + 'SET尺寸(垂直)已超过 571.5mm，SET尺寸(水平)需限制在 0-419.1mm 内，超出P10，走线下下单模式进行。')
    }
  }

  if (![pw, ph, sw, sh].every(v => Number.isFinite(v) && v > 0)) return
  const pcsArea = pw * ph
  const setArea = sw * sh

  if (pcsArea > setArea) { ElMessage.error('PCS面积不能大于SET面积'); return }
  const ratio = setArea / pcsArea
  if (pcsArea === setArea) { form.setMethod = '单片无拼板' }
  else if (ratio > 1 && ratio < 1.25) { form.setMethod = '单片加工艺边' }
  else if (ratio >= 1.25 && ratio < 2.5) { form.setMethod = '客户拼板' }
  form.clientPanelHorizontal = 1
  form.clientPanelVertical = Math.floor(ratio / 1.25) + 1
}

function requestPCSSize() {
  const w = window as any
  if (w.QtBridge?.send) w.QtBridge.send('html-button-message', { getPCSSize: '1' })
  else console.log('[我→QT] getPCSSize')
}

function requestSetSize() {
  const w = window as any
  if (w.QtBridge?.send) w.QtBridge.send('html-button-message', { getSetSize: '1' })
  else console.log('[我→QT] getSetSize')
}

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
  materialType: '板材种类', materialTg: 'TG值', halogenFree: '无卤板材', maxWarpage: '翘曲度',
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

function sourceLabel(f: string): string {
  // 用户修改过 → 用户确认；否则按来源显示
  if (userModifiedFields.value.has(f)) return '用户确认'
  const s = fieldSource[f]
  if (s==='ai') return 'AI提参'
  if (s==='cam') return 'CAM提参'
  // 服务端默认 / 有默认值但未传来源 → 默认行业标准；无默认值无来源 → 空白
  if (s==='server default' || hasDefault(f)) return '默认行业标准'
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
    const e=data[k]; const v=e?.value??e; const s=e?.source??''
    if(boolF.includes(k)) form[k]=toBoolean(v)
    else if(numF.includes(k)) { const numeric=Number(v); form[k]=Number.isFinite(numeric)?numeric:0 }
    else if(arrF.includes(k)) form[k]=Array.isArray(v)?v:(v?[v]:[])
    else form[k]=v
    if(s) fieldSource[k]=s; fieldRawData[k]=e
  }
  // 材料匹配规则：型号优先带出；无型号且提供类型未提供品牌 → 按类型补默认
  applyMaterialPriorityRules(data)
  applyingData = false
  // 以本次同步后的值作为新基准：Qt/AI 回传的值不算用户改动
  for (const k of Object.keys(data)) {
    if (k in form) userBaseline[k] = JSON.parse(JSON.stringify(form[k]))
  }
  rebuildUserModified()
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
  return true
}

async function submitForm() {
  if (submitting.value) return
  if (!validateForm()) return
  submitting.value = true
  const params: Record<string, any> = {}
  const fk = Object.keys(form)
  fk.forEach(k => { if (k !== "remark") params[k] = form[k] })
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
  for (const key of Object.keys(form)) { if (key === "remark") continue;
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
  Object.keys(form).forEach(k => { if (k !== "remark") p[k] = form[k] })
  p['drillDensity'] = computedDrillDensity.value
  if (stackupRows.value.length) p['stackupTable'] = stackupRows.value
  if (impRows.value.length) p['impedanceTable'] = impRows.value
  return p
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
  applyingData = true
  const defaults = JSON.parse(JSON.stringify(DEFAULT_VALUES))
  for (const k of Object.keys(form)) {
    if (defaults[k] !== undefined) form[k] = defaults[k]
    else if (Array.isArray(form[k])) form[k] = []
  }
  applyingData = false
  for (const k of Object.keys(fieldSource)) delete fieldSource[k]
  for (const k of Object.keys(fieldRawData)) delete fieldRawData[k]
  userBaseline = JSON.parse(JSON.stringify(DEFAULT_VALUES))
  rebuildUserModified()
  prevMaterial.materialType = form.materialType
  prevMaterial.materialVersion = form.materialVersion
  prevMaterial.materialBrand = form.materialBrand
  prevMaterial.materialTg = form.materialTg
  prevMaterial.halogenFree = form.halogenFree
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
    if (detail.taskId) taskId.value = detail.taskId
    tokenReady.value = Boolean(taskId.value)
    if (!tokenReady.value) { ElMessage.error('未获取到有效 TaskId'); return }
    loadQuoteParamsFromApi()
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
  handleSizeBlur()
  formDataLoaded.value = true
  ElMessage.success('数据已同步')
}

// 用 API 数据填充表单
async function loadQuoteParamsFromApi() {
  try {
    const res: any = await getOnlineQuoteParamsInfo({ task_id: taskId.value  })
    if (res.code === 200 && res.data) {
      const data = res.data
      applyingData = true
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
      // 材料匹配规则：型号优先带出；无型号且提供类型未提供品牌 → 按类型补默认
      applyMaterialPriorityRules(data)
      applyingData = false
      // 以本次 API 回填后的值作为新基准：服务端回填不算用户改动
      for (const key of Object.keys(data)) {
        if (key in form) userBaseline[key] = JSON.parse(JSON.stringify(form[key]))
      }
      rebuildUserModified()
      formDataLoaded.value = true
      handleSizeBlur()
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
            <tr><td>PCB 资料（客户品名）<span class="req">*</span></td><td :class="fieldBgClass('pcbFile')"><el-input v-model="form.pcbFile" size="small" /></td><td class="td-src"><span :class="sourceClass('pcbFile')">{{ sourceLabel('pcbFile') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('pcbFile')" class="btn-view graphic" @click="handleViewClick('pcbFile')">图形</button><button v-if="showDocBtn('pcbFile')" class="btn-view doc" @click="handleViewClick('pcbFile')">加工文档</button></td></tr>
            <tr><td>板子层数<span class="req">*</span></td><td :class="fieldBgClass('layerCount')"><el-autocomplete v-model="form.layerCount" :fetch-suggestions="queryLayerCount" size="small" style="width:100%" placeholder="输入板子层数" clearable @blur="onLayerCountBlur"><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete><span class="unit">层</span></td><td class="td-src"><span :class="sourceClass('layerCount')">{{ sourceLabel('layerCount') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('layerCount')" class="btn-view graphic" @click="handleViewClick('layerCount')">图形</button><button v-if="showDocBtn('layerCount')" class="btn-view doc" @click="handleViewClick('layerCount')">加工文档</button></td></tr>
            <tr><td>盲埋孔</td><td :class="fieldBgClass('blindVia')"><el-select v-model="form.blindVia" size="small" style="width:100%"><el-option v-for="v in opts.blindVia" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('blindVia')">{{ sourceLabel('blindVia') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('blindVia')" class="btn-view graphic" @click="handleViewClick('blindVia')">图形</button><button v-if="showDocBtn('blindVia')" class="btn-view doc" @click="handleViewClick('blindVia')">加工文档</button></td></tr>
            <tr><td>PCS尺寸(水平)<span class="req">*</span> <el-button type="primary" @click="requestPCSSize">获取尺寸</el-button></td><td :class="fieldBgClass('pcsSizeWidth')"><el-input-number :controls="false" v-model="form.pcsSizeWidth" @blur="handleSizeBlur" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('pcsSizeWidth')">{{ sourceLabel('pcsSizeWidth') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('pcsSizeWidth')" class="btn-view graphic" @click="handleViewClick('pcsSizeWidth')">图形</button><button v-if="showDocBtn('pcsSizeWidth')" class="btn-view doc" @click="handleViewClick('pcsSizeWidth')">加工文档</button></td></tr>
            <tr><td>PCS尺寸(垂直)<span class="req">*</span></td><td :class="fieldBgClass('pcsSizeHeight')"><el-input-number :controls="false" v-model="form.pcsSizeHeight" @blur="handleSizeBlur" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('pcsSizeHeight')">{{ sourceLabel('pcsSizeHeight') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('pcsSizeHeight')" class="btn-view graphic" @click="handleViewClick('pcsSizeHeight')">图形</button><button v-if="showDocBtn('pcsSizeHeight')" class="btn-view doc" @click="handleViewClick('pcsSizeHeight')">加工文档</button></td></tr>
            <tr><td>外形公差<span class="req">*</span></td><td :class="fieldBgClass('dimensionTolerance')"><el-select v-model="form.dimensionTolerance" size="small" style="width:100%"><el-option v-for="v in opts.dimensionTolerance" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('dimensionTolerance')">{{ sourceLabel('dimensionTolerance') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('dimensionTolerance')" class="btn-view graphic" @click="handleViewClick('dimensionTolerance')">图形</button><button v-if="showDocBtn('dimensionTolerance')" class="btn-view doc" @click="handleViewClick('dimensionTolerance')">加工文档</button></td></tr>
            <tr><td>板子数量<span class="req">*</span></td><td :class="fieldBgClass('quantity')"><el-input-number :controls="false" v-model="form.quantity" :min="1" size="small" style="width:100%" /></td><td class="td-src"><span :class="sourceClass('quantity')">{{ sourceLabel('quantity') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('quantity')" class="btn-view graphic" @click="handleViewClick('quantity')">图形</button><button v-if="showDocBtn('quantity')" class="btn-view doc" @click="handleViewClick('quantity')">加工文档</button></td></tr>
            <tr><td>交货单位<span class="req">*</span></td><td :class="fieldBgClass('deliveryUnit')"><el-select v-model="form.deliveryUnit" size="small" style="width:100%"><el-option v-for="v in opts.deliveryUnit" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('deliveryUnit')">{{ sourceLabel('deliveryUnit') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('deliveryUnit')" class="btn-view graphic" @click="handleViewClick('deliveryUnit')">图形</button><button v-if="showDocBtn('deliveryUnit')" class="btn-view doc" @click="handleViewClick('deliveryUnit')">加工文档</button></td></tr>
            <tr><td>合拼种数<span class="req">*</span></td><td :class="fieldBgClass('panelTypesCount')"><el-input-number :controls="false" v-model="form.panelTypesCount" :min="1" :max="100" size="small" style="width:100%" /></td><td class="td-src"><span :class="sourceClass('panelTypesCount')">{{ sourceLabel('panelTypesCount') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('panelTypesCount')" class="btn-view graphic" @click="handleViewClick('panelTypesCount')">图形</button><button v-if="showDocBtn('panelTypesCount')" class="btn-view doc" @click="handleViewClick('panelTypesCount')">加工文档</button></td></tr>
            <tr><td>Set拼板方式<span class="req">*</span></td><td :class="fieldBgClass('setMethod')"><el-select v-model="form.setMethod" size="small" style="width:100%"><el-option v-for="v in opts.setMethodAll" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('setMethod')">{{ sourceLabel('setMethod') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('setMethod')" class="btn-view graphic" @click="handleViewClick('setMethod')">图形</button><button v-if="showDocBtn('setMethod')" class="btn-view doc" @click="handleViewClick('setMethod')">加工文档</button></td></tr>
              <tr><td>拼板个数(水平)<span class="req">*</span></td><td :class="fieldBgClass('clientPanelHorizontal')"><el-input-number :controls="false" v-model="form.clientPanelHorizontal" :min="1" :max="500" size="small" style="width:100%" /></td><td class="td-src"><span :class="sourceClass('clientPanelHorizontal')">{{ sourceLabel('clientPanelHorizontal') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('clientPanelHorizontal')" class="btn-view graphic" @click="handleViewClick('clientPanelHorizontal')">图形</button><button v-if="showDocBtn('clientPanelHorizontal')" class="btn-view doc" @click="handleViewClick('clientPanelHorizontal')">加工文档</button></td></tr>
              <tr><td>拼板个数(垂直)<span class="req">*</span></td><td :class="fieldBgClass('clientPanelVertical')"><el-input-number :controls="false" v-model="form.clientPanelVertical" :min="1" :max="500" size="small" style="width:100%" /></td><td class="td-src"><span :class="sourceClass('clientPanelVertical')">{{ sourceLabel('clientPanelVertical') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('clientPanelVertical')" class="btn-view graphic" @click="handleViewClick('clientPanelVertical')">图形</button><button v-if="showDocBtn('clientPanelVertical')" class="btn-view doc" @click="handleViewClick('clientPanelVertical')">加工文档</button></td></tr>
              <tr><td>Set尺寸(水平)<span class="req">*</span> <el-button type="primary" @click="requestSetSize">获取尺寸</el-button></td><td :class="fieldBgClass('setSizeWidth')"><el-input-number :controls="false" v-model="form.setSizeWidth" @blur="handleSizeBlur" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('setSizeWidth')">{{ sourceLabel('setSizeWidth') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('setSizeWidth')" class="btn-view graphic" @click="handleViewClick('setSizeWidth')">图形</button><button v-if="showDocBtn('setSizeWidth')" class="btn-view doc" @click="handleViewClick('setSizeWidth')">加工文档</button></td></tr>
              <tr><td>Set尺寸(垂直)<span class="req">*</span></td><td :class="fieldBgClass('setSizeHeight')"><el-input-number :controls="false" v-model="form.setSizeHeight" @blur="handleSizeBlur" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('setSizeHeight')">{{ sourceLabel('setSizeHeight') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('setSizeHeight')" class="btn-view graphic" @click="handleViewClick('setSizeHeight')">图形</button><button v-if="showDocBtn('setSizeHeight')" class="btn-view doc" @click="handleViewClick('setSizeHeight')">加工文档</button></td></tr>
              <tr v-if="requireClientPanelSeparation"><td>外形要求<span class="req">*</span></td><td :class="fieldBgClass('clientPanelSeparation')"><el-select v-model="form.clientPanelSeparation" placeholder=" " size="small" style="width:100%"><el-option v-for="v in opts.clientPanelSeparation" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('clientPanelSeparation')">{{ sourceLabel('clientPanelSeparation') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('clientPanelSeparation')" class="btn-view graphic" @click="handleViewClick('clientPanelSeparation')">图形</button><button v-if="showDocBtn('clientPanelSeparation')" class="btn-view doc" @click="handleViewClick('clientPanelSeparation')">加工文档</button></td></tr>
              <tr><td>是否接受打叉板</td><td :class="fieldBgClass('acceptXOut')"><el-select v-model="form.acceptXOut" size="small" style="width:100%"><el-option v-for="v in opts.acceptXOut" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('acceptXOut')">{{ sourceLabel('acceptXOut') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('acceptXOut')" class="btn-view graphic" @click="handleViewClick('acceptXOut')">图形</button><button v-if="showDocBtn('acceptXOut')" class="btn-view doc" @click="handleViewClick('acceptXOut')">加工文档</button></td></tr>
          </template>

          <!-- 二、工艺信息 -->
          <tr class="section-row" @click="sections.process = !sections.process"><td colspan="4">二、PCB 工艺信息 <span class="arrow" :class="{ up: sections.process }">▼</span></td></tr>
          <template v-if="sections.process">
            <tr><td>板材种类<span class="req">*</span></td><td :class="fieldBgClass('materialType')"><el-select v-model="form.materialType" @change="onMaterialTypeChange" size="small" style="width:100%"><el-option v-for="v in opts.materialType" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('materialType')">{{ sourceLabel('materialType') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('materialType')" class="btn-view graphic" @click="handleViewClick('materialType')">图形</button><button v-if="showDocBtn('materialType')" class="btn-view doc" @click="handleViewClick('materialType')">加工文档</button></td></tr>
            <tr><td>板材品牌</td><td :class="fieldBgClass('materialBrand')"><el-autocomplete v-model="form.materialBrand" @select="onMaterialBrandSelect" @change="onMaterialBrandChange" :fetch-suggestions="queryMaterialBrand" size="small" style="width:100%" placeholder="输入搜索板材品牌" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete></td><td class="td-src"><span :class="sourceClass('materialBrand')">{{ sourceLabel('materialBrand') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('materialBrand')" class="btn-view graphic" @click="handleViewClick('materialBrand')">图形</button><button v-if="showDocBtn('materialBrand')" class="btn-view doc" @click="handleViewClick('materialBrand')">加工文档</button></td></tr>
            <tr><td>板材型号</td><td :class="fieldBgClass('materialVersion')"><el-autocomplete v-model="form.materialVersion" @select="onMaterialVersionSelect" @change="onMaterialVersionChange" :fetch-suggestions="queryMaterialVersion" size="small" style="width:100%" placeholder="输入搜索板材型号" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete></td><td class="td-src"><span :class="sourceClass('materialVersion')">{{ sourceLabel('materialVersion') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('materialVersion')" class="btn-view graphic" @click="handleViewClick('materialVersion')">图形</button><button v-if="showDocBtn('materialVersion')" class="btn-view doc" @click="handleViewClick('materialVersion')">加工文档</button></td></tr>
            <tr><td>TG值<span class="req">*</span></td><td :class="fieldBgClass('materialTg')"><el-select v-model="form.materialTg" @change="onMaterialTgChange" size="small" style="width:100%"><el-option v-for="v in opts.materialTg" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('materialTg')">{{ sourceLabel('materialTg') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('materialTg')" class="btn-view graphic" @click="handleViewClick('materialTg')">图形</button><button v-if="showDocBtn('materialTg')" class="btn-view doc" @click="handleViewClick('materialTg')">加工文档</button></td></tr>
            <tr><td>无卤板材<span class="req">*</span></td><td :class="fieldBgClass('halogenFree')"><el-select v-model="form.halogenFree" @change="onMaterialHalogenChange" size="small" style="width:100%"><el-option v-for="v in opts.halogenFree" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('halogenFree')">{{ sourceLabel('halogenFree') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('halogenFree')" class="btn-view graphic" @click="handleViewClick('halogenFree')">图形</button><button v-if="showDocBtn('halogenFree')" class="btn-view doc" @click="handleViewClick('halogenFree')">加工文档</button></td></tr>
            <tr><td>翘曲度<span class="req">*</span></td><td :class="fieldBgClass('maxWarpage')"><el-autocomplete v-model="form.maxWarpage" :fetch-suggestions="queryMaxWarpage" size="small" style="width:100%" placeholder="输入搜索翘曲度" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete></td><td class="td-src"><span :class="sourceClass('maxWarpage')">{{ sourceLabel('maxWarpage') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('maxWarpage')" class="btn-view graphic" @click="handleViewClick('maxWarpage')">图形</button><button v-if="showDocBtn('maxWarpage')" class="btn-view doc" @click="handleViewClick('maxWarpage')">加工文档</button></td></tr>
            <tr><td>成品板厚<span class="req">*</span></td><td :class="fieldBgClass('boardThickness')"><el-autocomplete v-model="form.boardThickness" :fetch-suggestions="queryBoardThickness" @select="(item: any) => { form.boardThickness = item.value }" size="small" style="width:100%" placeholder="输入搜索成品板厚" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('boardThickness')">{{ sourceLabel('boardThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('boardThickness')" class="btn-view graphic" @click="handleViewClick('boardThickness')">图形</button><button v-if="showDocBtn('boardThickness')" class="btn-view doc" @click="handleViewClick('boardThickness')">加工文档</button></td></tr>
            <tr><td>板厚公差<span class="req">*</span></td><td :class="fieldBgClass('thicknessTolerance')"><el-autocomplete v-model="form.thicknessTolerance" :fetch-suggestions="queryThicknessTolerance" size="small" style="width:100%" placeholder="输入搜索板厚公差" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete></td><td class="td-src"><span :class="sourceClass('thicknessTolerance')">{{ sourceLabel('thicknessTolerance') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('thicknessTolerance')" class="btn-view graphic" @click="handleViewClick('thicknessTolerance')">图形</button><button v-if="showDocBtn('thicknessTolerance')" class="btn-view doc" @click="handleViewClick('thicknessTolerance')">加工文档</button></td></tr>
            <tr><td>外层完成铜厚度<span class="req">*</span></td><td :class="fieldBgClass('outerCopperThickness')"><el-autocomplete v-model="form.outerCopperThickness" :fetch-suggestions="queryOuterCopperThickness" @select="(item: any) => { form.outerCopperThickness = item.value }" size="small" style="width:100%" placeholder="输入搜索外层完成铜厚度" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete><span class="unit">um</span></td><td class="td-src"><span :class="sourceClass('outerCopperThickness')">{{ sourceLabel('outerCopperThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('outerCopperThickness')" class="btn-view graphic" @click="handleViewClick('outerCopperThickness')">图形</button><button v-if="showDocBtn('outerCopperThickness')" class="btn-view doc" @click="handleViewClick('outerCopperThickness')">加工文档</button></td></tr>
            <tr><td>外层基铜厚度</td><td :class="fieldBgClass('outerBaseCopperThickness')"><el-autocomplete v-model="form.outerBaseCopperThickness" :fetch-suggestions="queryOuterBaseCopperThickness" @select="(item: any) => { form.outerBaseCopperThickness = item.value }" size="small" style="width:100%" placeholder="输入搜索外层基铜厚度" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete><span class="unit">um</span></td><td class="td-src"><span :class="sourceClass('outerBaseCopperThickness')">{{ sourceLabel('outerBaseCopperThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('outerBaseCopperThickness')" class="btn-view graphic" @click="handleViewClick('outerBaseCopperThickness')">图形</button><button v-if="showDocBtn('outerBaseCopperThickness')" class="btn-view doc" @click="handleViewClick('outerBaseCopperThickness')">加工文档</button></td></tr>
            <template v-if="hasInnerLayer"><tr><td>内层基铜厚度<span class="req">*</span></td><td :class="fieldBgClass('innerCopperThickness')"><el-autocomplete v-model="form.innerCopperThickness" :fetch-suggestions="queryInnerCopperThickness" size="small" style="width:100%" placeholder="输入搜索内层基铜厚度" clearable @select="(item: any) => { form.innerCopperThickness = item.value }"><template #default="{ item }"><div class="autocomplete-item">{{ item.value }} oz</div></template></el-autocomplete><span class="unit">oz</span></td><td class="td-src"><span :class="sourceClass('innerCopperThickness')">{{ sourceLabel('innerCopperThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('innerCopperThickness')" class="btn-view graphic" @click="handleViewClick('innerCopperThickness')">图形</button><button v-if="showDocBtn('innerCopperThickness')" class="btn-view doc" @click="handleViewClick('innerCopperThickness')">加工文档</button></td></tr></template>
            <tr><td>外层最小线宽<span class="req">*</span></td><td :class="fieldBgClass('minTraceWidthOuter')"><el-input-number :controls="false" v-model="form.minTraceWidthOuter" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mil</span></td><td class="td-src"><span :class="sourceClass('minTraceWidthOuter')">{{ sourceLabel('minTraceWidthOuter') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('minTraceWidthOuter')" class="btn-view graphic" @click="handleViewClick('minTraceWidthOuter')">图形</button><button v-if="showDocBtn('minTraceWidthOuter')" class="btn-view doc" @click="handleViewClick('minTraceWidthOuter')">加工文档</button></td></tr>
            <tr><td>外层最小线距<span class="req">*</span></td><td :class="fieldBgClass('minTraceSpacingOuter')"><el-input-number :controls="false" v-model="form.minTraceSpacingOuter" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mil</span></td><td class="td-src"><span :class="sourceClass('minTraceSpacingOuter')">{{ sourceLabel('minTraceSpacingOuter') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('minTraceSpacingOuter')" class="btn-view graphic" @click="handleViewClick('minTraceSpacingOuter')">图形</button><button v-if="showDocBtn('minTraceSpacingOuter')" class="btn-view doc" @click="handleViewClick('minTraceSpacingOuter')">加工文档</button></td></tr>
              <template v-if="hasInnerLayer">
              <tr><td>内层最小线宽<span class="req">*</span></td><td :class="fieldBgClass('minTraceWidthInner')"><el-input-number :controls="false" v-model="form.minTraceWidthInner" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mil</span></td><td class="td-src"><span :class="sourceClass('minTraceWidthInner')">{{ sourceLabel('minTraceWidthInner') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('minTraceWidthInner')" class="btn-view graphic" @click="handleViewClick('minTraceWidthInner')">图形</button><button v-if="showDocBtn('minTraceWidthInner')" class="btn-view doc" @click="handleViewClick('minTraceWidthInner')">加工文档</button></td></tr>
              <tr><td>内层最小线距<span class="req">*</span></td><td :class="fieldBgClass('minTraceSpacingInner')"><el-input-number :controls="false" v-model="form.minTraceSpacingInner" :min="0" :precision="2" size="small" style="width:100%" /><span class="unit">mil</span></td><td class="td-src"><span :class="sourceClass('minTraceSpacingInner')">{{ sourceLabel('minTraceSpacingInner') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('minTraceSpacingInner')" class="btn-view graphic" @click="handleViewClick('minTraceSpacingInner')">图形</button><button v-if="showDocBtn('minTraceSpacingInner')" class="btn-view doc" @click="handleViewClick('minTraceSpacingInner')">加工文档</button></td></tr>
              </template>
            <tr><td>最小孔径<span class="req">*</span></td><td :class="fieldBgClass('minHoleSize')"><el-input-number :controls="false" v-model="form.minHoleSize" :min="0" :precision="3" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('minHoleSize')">{{ sourceLabel('minHoleSize') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('minHoleSize')" class="btn-view graphic" @click="handleViewClick('minHoleSize')">图形</button><button v-if="showDocBtn('minHoleSize')" class="btn-view doc" @click="handleViewClick('minHoleSize')">加工文档</button></td></tr>
			            <tr><td>钻孔密度</td><td><span style="display:inline-block;padding:4px 8px;">{{ computedDrillDensity || '--' }}</span><span class="unit">万孔/平米</span></td><td class="td-src"><span class="badge empty"></span></td><td class="td-view"></td></tr>
			            <tr><td>通孔孔数/PCS</td><td :class="fieldBgClass('holeCount')"><el-input-number :controls="false" v-model="form.holeCount" :min="0" :precision="0" size="small" style="width:100%" /></td><td class="td-src"><span :class="sourceClass('holeCount')">{{ sourceLabel('holeCount') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('holeCount')" class="btn-view graphic" @click="handleViewClick('holeCount')">图形</button><button v-if="showDocBtn('holeCount')" class="btn-view doc" @click="handleViewClick('holeCount')">加工文档</button></td></tr>
            <tr><td>最小孔铜<span class="req">*</span></td><td :class="fieldBgClass('holeCopperThickness')"><el-autocomplete v-model="form.holeCopperThickness" :fetch-suggestions="queryHoleCopperThickness" size="small" style="width:100%" placeholder="输入或选择" clearable @select="(item: any) => { form.holeCopperThickness = item.value }"><template #default="{ item }"><div class="autocomplete-item">{{ item.value }} um</div></template></el-autocomplete><span class="unit">um</span></td><td class="td-src"><span :class="sourceClass('holeCopperThickness')">{{ sourceLabel('holeCopperThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('holeCopperThickness')" class="btn-view graphic" @click="handleViewClick('holeCopperThickness')">图形</button><button v-if="showDocBtn('holeCopperThickness')" class="btn-view doc" @click="handleViewClick('holeCopperThickness')">加工文档</button></td></tr>
            <tr><td>阻焊颜色<span class="req">*</span></td><td :class="fieldBgClass('solderMaskColor')"><el-select v-model="form.solderMaskColor" size="small" style="width:100%"><el-option v-for="v in opts.solderMaskColor" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('solderMaskColor')">{{ sourceLabel('solderMaskColor') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('solderMaskColor')" class="btn-view graphic" @click="handleViewClick('solderMaskColor')">图形</button><button v-if="showDocBtn('solderMaskColor')" class="btn-view doc" @click="handleViewClick('solderMaskColor')">加工文档</button></td></tr>
            <tr><td>字符颜色<span class="req">*</span></td><td :class="fieldBgClass('silkscreenColor')"><el-select v-model="form.silkscreenColor" size="small" style="width:100%"><el-option v-for="v in opts.silkscreenColor" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('silkscreenColor')">{{ sourceLabel('silkscreenColor') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('silkscreenColor')" class="btn-view graphic" @click="handleViewClick('silkscreenColor')">图形</button><button v-if="showDocBtn('silkscreenColor')" class="btn-view doc" @click="handleViewClick('silkscreenColor')">加工文档</button></td></tr>
            <tr><td>表面处理<span class="req">*</span></td><td :class="fieldBgClass('surfaceFinish')"><el-select v-model="form.surfaceFinish" size="small" style="width:100%"><el-option v-for="v in opts.surfaceFinish" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('surfaceFinish')">{{ sourceLabel('surfaceFinish') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('surfaceFinish')" class="btn-view graphic" @click="handleViewClick('surfaceFinish')">图形</button><button v-if="showDocBtn('surfaceFinish')" class="btn-view doc" @click="handleViewClick('surfaceFinish')">加工文档</button></td></tr>
              <template v-if="showEnigGold">
              <tr><td>最小沉金金厚<span class="req">*</span></td><td :class="fieldBgClass('enigGoldThickness')"><el-autocomplete v-model="form.enigGoldThickness" :fetch-suggestions="queryEnigGoldThickness" size="small" style="width:100%" placeholder="输入搜索最小沉金金厚" clearable @select="(item: any) => { form.enigGoldThickness = item.value }"><template #default="{ item }"><div class="autocomplete-item">{{ item.value }} um</div></template></el-autocomplete><span class="unit">um</span></td><td class="td-src"><span :class="sourceClass('enigGoldThickness')">{{ sourceLabel('enigGoldThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('enigGoldThickness')" class="btn-view graphic" @click="handleViewClick('enigGoldThickness')">图形</button><button v-if="showDocBtn('enigGoldThickness')" class="btn-view doc" @click="handleViewClick('enigGoldThickness')">加工文档</button></td></tr>
              <tr><td>沉金面积（双面之和）<span class="req">*</span></td><td :class="fieldBgClass('immersionGoldArea')"><el-input-number :controls="false" v-model="form.immersionGoldArea" :min="0" :precision="1" size="small" style="width:100%" /><span class="unit">%</span></td><td class="td-src"><span :class="sourceClass('immersionGoldArea')">{{ sourceLabel('immersionGoldArea') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('immersionGoldArea')" class="btn-view graphic" @click="handleViewClick('immersionGoldArea')">图形</button><button v-if="showDocBtn('immersionGoldArea')" class="btn-view doc" @click="handleViewClick('immersionGoldArea')">加工文档</button></td></tr>
              </template>
            <tr><td>过孔工艺<span class="req">*</span></td><td :class="fieldBgClass('viaProcess')"><el-select v-model="form.viaProcess" size="small" style="width:100%"><el-option v-for="v in opts.viaProcess" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('viaProcess')">{{ sourceLabel('viaProcess') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('viaProcess')" class="btn-view graphic" @click="handleViewClick('viaProcess')">图形</button><button v-if="showDocBtn('viaProcess')" class="btn-view doc" @click="handleViewClick('viaProcess')">加工文档</button></td></tr>
            <tr><td>金手指类型<span class="req">*</span></td><td :class="fieldBgClass('goldFingerType')"><el-select v-model="form.goldFingerType" size="small" style="width:100%"><el-option v-for="v in opts.goldFingerType" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('goldFingerType')">{{ sourceLabel('goldFingerType') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('goldFingerType')" class="btn-view graphic" @click="handleViewClick('goldFingerType')">图形</button><button v-if="showDocBtn('goldFingerType')" class="btn-view doc" @click="handleViewClick('goldFingerType')">加工文档</button></td></tr>
              <template v-if="showGoldFinger">
              <tr><td>金手指金厚<span class="req">*</span></td><td :class="fieldBgClass('goldFingerThickness')"><el-autocomplete v-model="form.goldFingerThickness" :fetch-suggestions="queryGoldFingerThickness" size="small" style="width:100%" placeholder="输入搜索金手指金厚" clearable @select="(item: any) => { form.goldFingerThickness = item.value }"><template #default="{ item }"><div class="autocomplete-item">{{ item.value }} um</div></template></el-autocomplete><span class="unit">um</span></td><td class="td-src"><span :class="sourceClass('goldFingerThickness')">{{ sourceLabel('goldFingerThickness') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('goldFingerThickness')" class="btn-view graphic" @click="handleViewClick('goldFingerThickness')">图形</button><button v-if="showDocBtn('goldFingerThickness')" class="btn-view doc" @click="handleViewClick('goldFingerThickness')">加工文档</button></td></tr>
              <tr><td>倒角角度<span class="req">*</span></td><td :class="fieldBgClass('goldFingerChamferAngle')"><el-select v-model="form.goldFingerChamferAngle" size="small" style="width:100%"><el-option v-for="v in opts.goldFingerChamferAngle" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('goldFingerChamferAngle')">{{ sourceLabel('goldFingerChamferAngle') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('goldFingerChamferAngle')" class="btn-view graphic" @click="handleViewClick('goldFingerChamferAngle')">图形</button><button v-if="showDocBtn('goldFingerChamferAngle')" class="btn-view doc" @click="handleViewClick('goldFingerChamferAngle')">加工文档</button></td></tr>
              <tr><td>倒角深度</td><td :class="fieldBgClass('goldFingerChamferDepth')"><el-input-number :controls="false" v-model="form.goldFingerChamferDepth" :min="0" :max="10" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('goldFingerChamferDepth')">{{ sourceLabel('goldFingerChamferDepth') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('goldFingerChamferDepth')" class="btn-view graphic" @click="handleViewClick('goldFingerChamferDepth')">图形</button><button v-if="showDocBtn('goldFingerChamferDepth')" class="btn-view doc" @click="handleViewClick('goldFingerChamferDepth')">加工文档</button></td></tr>
              <tr><td>金手指倒角余厚</td><td :class="fieldBgClass('goldFingerChamferRemaining')"><el-input-number :controls="false" v-model="form.goldFingerChamferRemaining" :min="0" :max="10" :precision="2" size="small" style="width:100%" /><span class="unit">mm</span></td><td class="td-src"><span :class="sourceClass('goldFingerChamferRemaining')">{{ sourceLabel('goldFingerChamferRemaining') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('goldFingerChamferRemaining')" class="btn-view graphic" @click="handleViewClick('goldFingerChamferRemaining')">图形</button><button v-if="showDocBtn('goldFingerChamferRemaining')" class="btn-view doc" @click="handleViewClick('goldFingerChamferRemaining')">加工文档</button></td></tr>
              </template>
          </template>

          <!-- 三、个性化服务 -->
          <tr class="section-row" @click="sections.custom = !sections.custom"><td colspan="4">三、个性化服务 <span class="arrow" :class="{ up: sections.custom }">▼</span></td></tr>
          <template v-if="sections.custom">
            <tr><td>验收标准<span class="req">*</span></td><td :class="fieldBgClass('acceptanceStandard')"><el-select v-model="form.acceptanceStandard" size="small" style="width:100%"><el-option v-for="v in opts.acceptanceStandard" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('acceptanceStandard')">{{ sourceLabel('acceptanceStandard') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('acceptanceStandard')" class="btn-view graphic" @click="handleViewClick('acceptanceStandard')">图形</button><button v-if="showDocBtn('acceptanceStandard')" class="btn-view doc" @click="handleViewClick('acceptanceStandard')">加工文档</button></td></tr>
            <tr><td>阻抗控制<span class="req">*</span></td><td :class="fieldBgClass('impedanceControl')"><el-select v-model="form.impedanceControl" size="small" style="width:100%"><el-option v-for="v in opts.impedanceControl" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('impedanceControl')">{{ sourceLabel('impedanceControl') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('impedanceControl')" class="btn-view graphic" @click="handleViewClick('impedanceControl')">图形</button><button v-if="showDocBtn('impedanceControl')" class="btn-view doc" @click="handleViewClick('impedanceControl')">加工文档</button></td></tr>
            <tr><td>标记要求<span class="req">*</span></td><td :class="fieldBgClass('markingRequirements')"><el-select v-model="form.markingRequirements" size="small" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.markingRequirements" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('markingRequirements')">{{ sourceLabel('markingRequirements') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('markingRequirements')" class="btn-view graphic" @click="handleViewClick('markingRequirements')">图形</button><button v-if="showDocBtn('markingRequirements')" class="btn-view doc" @click="handleViewClick('markingRequirements')">加工文档</button></td></tr>
            <tr><td>周期格式<span class="req">*</span></td><td :class="fieldBgClass('periodFormat')"><el-select v-model="form.periodFormat" size="small" style="width:100%"><el-option v-for="v in opts.periodFormat" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('periodFormat')">{{ sourceLabel('periodFormat') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('periodFormat')" class="btn-view graphic" @click="handleViewClick('periodFormat')">图形</button><button v-if="showDocBtn('periodFormat')" class="btn-view doc" @click="handleViewClick('periodFormat')">加工文档</button></td></tr>
            <tr><td>测试要求<span class="req">*</span></td><td :class="fieldBgClass('testRequirements')"><el-select v-model="form.testRequirements" size="small" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.testRequirements" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('testRequirements')">{{ sourceLabel('testRequirements') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('testRequirements')" class="btn-view graphic" @click="handleViewClick('testRequirements')">图形</button><button v-if="showDocBtn('testRequirements')" class="btn-view doc" @click="handleViewClick('testRequirements')">加工文档</button></td></tr>
            <tr><td>出货报告<span class="req">*</span></td><td :class="fieldBgClass('shippingReports')"><el-select v-model="form.shippingReports" size="small" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.shippingReports" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('shippingReports')">{{ sourceLabel('shippingReports') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('shippingReports')" class="btn-view graphic" @click="handleViewClick('shippingReports')">图形</button><button v-if="showDocBtn('shippingReports')" class="btn-view doc" @click="handleViewClick('shippingReports')">加工文档</button></td></tr>
            <tr><td>特殊工艺<span class="req">*</span></td><td :class="fieldBgClass('specialProcesses')"><el-select v-model="form.specialProcesses" size="small" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.specialProcesses" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('specialProcesses')">{{ sourceLabel('specialProcesses') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('specialProcesses')" class="btn-view graphic" @click="handleViewClick('specialProcesses')">图形</button><button v-if="showDocBtn('specialProcesses')" class="btn-view doc" @click="handleViewClick('specialProcesses')">加工文档</button></td></tr>
            <tr><td>光绘确认<span class="req">*</span></td><td :class="fieldBgClass('confirmProductionFile')"><el-select v-model="form.confirmProductionFile" size="small" style="width:100%"><el-option v-for="v in opts.confirmProductionFile" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('confirmProductionFile')">{{ sourceLabel('confirmProductionFile') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('confirmProductionFile')" class="btn-view graphic" @click="handleViewClick('confirmProductionFile')">图形</button><button v-if="showDocBtn('confirmProductionFile')" class="btn-view doc" @click="handleViewClick('confirmProductionFile')">加工文档</button></td></tr>
            <tr><td colspan="4" style="padding:12px 8px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span style="font-size:13px;font-weight:600;color:#333">📝 备注</span></div><div style="min-height:180px;background:linear-gradient(135deg,#f8f9fb 0%,#fff 100%);border:1px solid #e8eaef;border-left:3px solid #2756ff;border-radius:6px;padding:14px 16px;color:#555;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;box-shadow:0 1px 3px rgba(0,0,0,0.04)"><template v-if="form.remark.length"><div v-for="(msg, i) in form.remark" :key="i" style="margin-bottom:4px">{{ String(Number(i) + 1) }}. {{ (msg as string).includes('|') ? (msg as string).split('|').slice(1).join('|') : msg }}</div></template><template v-else><span style="color:#bbb">暂无备注信息</span></template></div></td></tr>
          </template>

        </tbody>
      </table>

      <!-- 四、叠层 -->
      <div class="section-row" @click="sections.stackup = !sections.stackup" style="cursor:pointer;background:#f0f4ff;font-weight:600;color:#2756ff;font-size:15px;padding:8px 10px;border:1px solid #e5e6eb;border-radius:0">四、叠层 <span class="arrow" :class="{ up: sections.stackup }">▼</span></div>
      <div v-if="sections.stackup" style="padding:0">
        <div v-if="Number(form.layerCount) >= 4" style="padding:4px 0"><button class="btn-add-row" @click="toggleStackupScheme">切换叠构({{ stackupScheme === 'normal' ? 'PP→Core' : 'Core→PP' }})</button></div>
        <el-table :data="stackupRows" size="small" border style="width:100%">
          <el-table-column label="层号" width="70"><template #default="{ row }"><el-input v-model="row.layerName" size="small" /></template></el-table-column>
          <el-table-column label="材料"><template #default="{ row }"><el-select v-model="row.material" size="small" style="width:100%" @change="onMaterialChange(row)"><el-option v-for="m in ['PP','CORE','CU','光板']" :key="m" :label="m" :value="m" /></el-select></template></el-table-column>
          <el-table-column label="类型"><template #default="{ row }"><el-autocomplete v-model="row.pcbMaterialType" :fetch-suggestions="row.material === 'CU' ? queryStackupCuType : row.material === 'PP' ? queryStackupPpType : queryStackupCoreType" size="small" style="width:100%" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete></template></el-table-column>
          <el-table-column label="铜厚(mil)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.copperThickness" size="small" :min="0.1" :max="10" :precision="2" :disabled="row.material!=='CU'" style="width:100%" /></template></el-table-column>
          <el-table-column label="介质厚度(mil)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.dielectricThickness" size="small" :min="0.01" :max="100" :precision="2" :disabled="row.material==='CU'" style="width:100%" /></template></el-table-column>
          <el-table-column label="介电常数"><template #default="{ row }"><el-input-number :controls="false" v-model="row.dk" size="small" :min="1" :max="50" :precision="2" :disabled="row.material==='CU'" style="width:100%" /></template></el-table-column>
          <el-table-column label="操作" width="130" align="center"><template #default="{ $index }"><el-button size="small" type="primary" link @click="insertStackupRow($index)">新增</el-button><el-button size="small" type="danger" link @click="stackupRows.splice($index,1)">删除</el-button></template></el-table-column>
        </el-table>
        <div v-if="stackupRows.length === 0" style="padding:6px 0"><button class="btn-add-row" @click="addStackupRow">+ 新增一行</button></div>
      </div>

      <!-- 五、阻抗 -->
      <div class="section-row" @click="sections.impedance = !sections.impedance" style="cursor:pointer;background:#f0f4ff;font-weight:600;color:#2756ff;font-size:15px;padding:8px 10px;border:1px solid #e5e6eb;border-radius:0">五、阻抗控制要求 <span class="arrow" :class="{ up: sections.impedance }">▼</span></div>
      <div v-if="sections.impedance" style="padding:0">
        <el-table :data="impRows" size="small" border style="width:100%">
          <el-table-column label="阻抗类型"><template #default="{ row }"><el-select v-model="row.impType" size="small" style="width:100%"><el-option v-for="t in impTypes" :key="t" :label="t" :value="t" /></el-select></template></el-table-column>
          <el-table-column label="控制层"><template #default="{ row }"><div><el-select v-model="row.controlLayer" size="small" style="width:100%" @change="onControlLayerChange(row)"><el-option v-for="l in layerOptions" :key="l" :label="l" :value="l" /></el-select></div></template></el-table-column>
          <el-table-column label="上参"><template #default="{ row }"><div><el-select v-model="row.refLayerTop" size="small" style="width:100%" @change="validateRefLayer(row, 'top')"><el-option v-for="l in refLayerOptions" :key="l" :label="l || '空'" :value="l" /></el-select><div v-if="row._refTopError" style="color:#f56c6c;font-size:11px;margin-top:2px;line-height:1.2">{{ row._refTopError }}</div></div></template></el-table-column>
          <el-table-column label="下参"><template #default="{ row }"><div><el-select v-model="row.refLayerBottom" size="small" style="width:100%" @change="validateRefLayer(row, 'bottom')"><el-option v-for="l in refLayerOptions" :key="l" :label="l || '空'" :value="l" /></el-select><div v-if="row._refBottomError" style="color:#f56c6c;font-size:11px;margin-top:2px;line-height:1.2">{{ row._refBottomError }}</div></div></template></el-table-column>
          <el-table-column label="盖油" width="60" align="center"><template #default="{ row }"><el-switch v-model="row.isCoated" size="small" /></template></el-table-column>
          <el-table-column label="线宽(mil)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.lineWidth" :min="1" :max="100" :precision="2" size="small" style="width:100%" /></template></el-table-column>
          <el-table-column label="线距(mil)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.lineSpacing" :min="1" :max="100" :precision="2" size="small" style="width:100%" /></template></el-table-column>
          <el-table-column label="线铜(mil)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.lineToCopper" :min="1" :max="100" :precision="2" size="small" style="width:100%" /></template></el-table-column>
          <el-table-column label="阻抗(ohm)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.impTarget" :min="1" :max="200" :precision="2" size="small" style="width:100%" /></template></el-table-column>
          <el-table-column label="公差(%)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.impTol" :min="1" :max="50" :precision="1" size="small" style="width:100%" /></template></el-table-column>
          <el-table-column label="操作" width="130" align="center"><template #default="{ $index }"><el-button size="small" type="primary" link @click="insertImpRow($index)">新增</el-button><el-button size="small" type="danger" link @click="impRows.splice($index,1)">删除</el-button></template></el-table-column>
        </el-table>
        <div v-if="impRows.length === 0" style="padding:6px 0"><button class="btn-add-row" @click="addImpRow">+ 新增一行</button></div>
      </div>

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
        <button class="btn-submit" :disabled="!orderCompleted || notifyLoading" @click="submitNotify" style="background:linear-gradient(90deg,#00b42a,#00a057)">{{ notifyLoading ? '确认中...' : '审核确认' }}</button>
        <p class="qc-note">价格仅供参考，以审核为准</p>
      </div>
    </div>

    <!-- QR -->
    <el-dialog v-model="qrVisible" title="扫码支付" width="360px" :close-on-click-modal="false" @close="clearTimers">
      <div style="text-align:center;position:relative">
        <img v-if="qrCodeUrl" :src="qrCodeUrl" style="width:280px;height:280px" :style="{ opacity: qrExpired ? 0.2 : 1 }" />
        <p v-if="!qrExpired" style="margin-top:12px;color:#666;font-size:14px">请扫码支付（{{ Math.floor(qrCountdown/60) }}:{{ String(qrCountdown%60).padStart(2,'0') }}）</p>
        <div v-if="qrExpired" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,0.6)">
          <p style="color:#f53f3f;font-size:14px;font-weight:600;margin-bottom:12px">二维码已过期</p>
          <el-button type="primary" size="small" :loading="qrRefreshing" :disabled="qrRefreshing" @click="refreshQrCode">重新加载</el-button>
        </div>
      </div>
    </el-dialog>
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
.badge.empty:empty { display: none; }
.badge.user { background: #f0faf2; color: #00b42a; border: 1px solid #b7ebc2; }
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
:deep(.bg-light-red .el-input__wrapper) { background: #fff1f0; box-shadow: 0 0 0 1px #ffccc7 inset; }
:deep(.bg-light-red .el-select__wrapper) { background: #fff1f0; box-shadow: 0 0 0 1px #ffccc7 inset; }
:deep(.bg-light-gray .el-input__wrapper) { background: #f5f5f5; box-shadow: 0 0 0 1px #e0e0e0 inset; }
:deep(.bg-light-gray .el-select__wrapper) { background: #f5f5f5; box-shadow: 0 0 0 1px #e0e0e0 inset; }
:deep(.bg-green .el-input__wrapper) { background: #f6ffed; box-shadow: 0 0 0 1px #b7eb8f inset; }
:deep(.bg-green .el-select__wrapper) { background: #f6ffed; box-shadow: 0 0 0 1px #b7eb8f inset; }
:deep(.bg-orange .el-input__wrapper) { background: #fff7e6; box-shadow: 0 0 0 1px #ffd591 inset; }
:deep(.bg-orange .el-select__wrapper) { background: #fff7e6; box-shadow: 0 0 0 1px #ffd591 inset; }
/* 用户修改过的值：蓝色字体 */
:deep(.font-blue .el-input__inner) { color: #2756ff; }
:deep(.font-blue .el-select__selected-item) { color: #2756ff; }
:deep(.font-blue .el-tag) { color: #2756ff; }
:deep(.el-table) { font-size: 14px; }
:deep(.el-table th) { font-size: 14px; }
</style>
