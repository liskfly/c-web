<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import {
  ElInput,
  ElSelect,
  ElOption,
  ElInputNumber,
  ElSwitch,
  ElMessage,
} from "element-plus";

// ==================== 折叠 ====================
const sections = reactive<Record<string, boolean>>({
  basic: true,
  process: true,
  custom: true,
  stackup: true,
  impedance: true,
});

// ==================== 表单数据（V6.0 字段清单） ====================
const form = reactive<Record<string, any>>({
  pcbName: "",
  pcbFile: "",
  layerCount: 2,
  blindVia: false,
  pcsSizeWidth: null,
  pcsSizeHeight: null,
  dimensionTolerance: "+/-0.10mm",
  quantity: 10,
  deliveryUnit: "PCS",
  panelTypesCount: 1,
  setMethod: "单片无拼板",
  clientPanelHorizontal: 1,
  clientPanelVertical: 1,
  setSizeWidth: null,
  setSizeHeight: null,
  clientPanelSeparation: "拼板&邮票孔交货",
  acceptXOut: true,

  materialType: "FR4",
  materialTg: false,
  halogenFree: false,
  maxWarpage: "0.5%",
  boardThickness: 1.6,
  thicknessTolerance: "+/-10%",
  outerCopperThickness: 35,
  outerBaseCopperThickness: 18,
  innerCopperThickness: 1,
  minTraceWidthOuter: null,
  minTraceSpacingOuter: null,
  minTraceWidthInner: null,
  minTraceSpacingInner: null,
  minHoleSize: null,
  holeCopperThickness: 18,
  solderMaskColor: "绿色",
  silkscreenColor: "白色字符",
  surfaceFinish: "无铅喷锡",
  enigGoldThickness: 0.05,
  immersionGoldArea: null,
  viaProcess: "按Gerber文件",
  goldFingerType: "无",
  goldFingerThickness: 0.38,
  goldFingerChamferAngle: "30°",
  goldFingerChamferDepth: null,
  goldFingerChamferRemaining: null,

  acceptanceStandard: "IPC 2",
  impedanceControl: false,
  markingRequirements: ["PCB厂家标记", "周期标记", "无铅标记"] as string[],
  periodFormat: "WWYY",
  testRequirements: ["飞针测试"] as string[],
  shippingReports: ["最终产品检查报告"] as string[],
  specialProcesses: ["不需要"] as string[],
  confirmProductionFile: false,
});

// ==================== 数据来源追踪 ====================
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
    else if(numF.includes(k)||k==='layerCount'||k==='quantity'||k==='panelTypesCount') form[k]=0
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
const opts: Record<string, string[]> = {
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
const submitting = ref(false);
async function submitForm() {
  submitting.value = true;
  const payload = {
    ...form,
    stackupTable: stackupRows.value,
    impedanceTable: impRows.value,
  };

  const win = window as any;
  if (win.QtBridge?.send) {
    win.QtBridge.send('html-button-message', payload);
  } else {
    console.log('📋 提交:', JSON.stringify(payload, null, 2));
  }
  setTimeout(() => {
    submitting.value = false;
    ElMessage.success("已提交");
  }, 500);
}

// 接收 C++ 推送的数据
const rawEventData = ref<any>(null)

onMounted(() => {
  window.addEventListener('QtMessage', (event: any) => {
    const detail = event.detail
    // rawEventData.value = detail
    if (detail && typeof detail === 'object') {
      const data = detail.parameters || detail
      applyFieldData(data)
      ElMessage.success('数据已同步')
    }
  })
})
</script>

<template>
  <div class="page-wrapper">
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
              <td class="td-val"><el-input v-model="form.pcbName" size="small" placeholder="生产型号" /></td>
              <td class="td-src"><span :class="sourceClass('pcbName')">{{ sourceLabel('pcbName') }}</span></td>
              <td class="td-view">
                <button v-if="showGraphicBtn('pcbName')" class="btn-view graphic" @click="handleViewClick('pcbName')">图形</button>
                <button v-if="showDocBtn('pcbName')" class="btn-view doc" @click="handleViewClick('pcbName')">加工文档</button>
              </td>
            </tr>
            <tr>
              <td class="td-name">PCB 资料<span class="req">*</span></td>
              <td class="td-val"><el-input v-model="form.pcbFile" size="small" placeholder="PCB 资料" /></td>
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
                  v-model="form.layerCount"
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
                  v-model="form.blindVia"
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
                  v-model="form.pcsSizeWidth"
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
                  v-model="form.pcsSizeHeight"
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
                  v-model="form.dimensionTolerance"
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
                  v-model="form.quantity"
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
                  v-model="form.deliveryUnit"
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
                  v-model="form.panelTypesCount"
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
                  v-model="form.setMethod"
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
                    v-model="form.clientPanelHorizontal"
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
                    v-model="form.clientPanelVertical"
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
                    v-model="form.setSizeWidth"
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
                    v-model="form.setSizeHeight"
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
                    v-model="form.clientPanelSeparation"
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
                    v-model="form.acceptXOut"
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
                  v-model="form.materialType"
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
                  v-model="form.materialTg"
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
                  v-model="form.halogenFree"
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
                  v-model="form.maxWarpage"
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
                  v-model="form.boardThickness"
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
                  v-model="form.thicknessTolerance"
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
                  v-model="form.outerCopperThickness"
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
                  v-model="form.innerCopperThickness"
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
                  v-model="form.minTraceWidthOuter"
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
                  v-model="form.minTraceSpacingOuter"
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
                    v-model="form.minTraceWidthInner"
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
                    v-model="form.minTraceSpacingInner"
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
                  v-model="form.minHoleSize"
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
                  v-model="form.holeCopperThickness"
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
                  v-model="form.solderMaskColor"
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
                  v-model="form.silkscreenColor"
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
                  v-model="form.surfaceFinish"
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
                    v-model="form.enigGoldThickness"
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
                    v-model="form.immersionGoldArea"
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
                  v-model="form.viaProcess"
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
                  v-model="form.goldFingerType"
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
                    v-model="form.goldFingerThickness"
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
                    v-model="form.goldFingerChamferAngle"
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
                    v-model="form.goldFingerChamferDepth"
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
                    v-model="form.goldFingerChamferRemaining"
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
                  v-model="form.acceptanceStandard"
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
                  v-model="form.impedanceControl"
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
                  v-model="form.markingRequirements"
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
                  v-model="form.periodFormat"
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
                  v-model="form.testRequirements"
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
                  v-model="form.shippingReports"
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
                  v-model="form.specialProcesses"
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
                  v-model="form.confirmProductionFile"
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

      <!-- 报价摘要 + 提交 -->
      <div class="quote-card">
        <div class="qc-title">💰 报价摘要</div>
        <div class="qc-grid">
          <div class="qc-row">
            <span>数量</span><span class="qcv">{{ form.quantity }} pcs</span>
          </div>
          <div class="qc-row">
            <span>层数</span><span class="qcv">{{ form.layerCount }}层</span>
          </div>
          <div class="qc-row">
            <span>板厚</span
            ><span class="qcv">{{ form.boardThickness }}mm</span>
          </div>
          <div class="qc-row">
            <span>板材</span><span class="qcv">{{ form.materialType }}</span>
          </div>
          <div class="qc-row">
            <span>表面处理</span
            ><span class="qcv">{{ form.surfaceFinish }}</span>
          </div>
        </div>
        <div class="qc-divider"></div>
        <div class="qc-total">
          <span>预估总价<br /><small>(不含税运)</small></span>
          <span class="qc-price">--</span>
        </div>
        <button class="btn-submit" :disabled="submitting" @click="submitForm">
          {{ submitting ? "提交中..." : "获取报价" }}
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

.debug-panel { margin: 0 16px 16px; background: #1e1e1e; border-radius: 6px; overflow: hidden; }
.debug-title { padding: 8px 14px; font-size: 12px; font-weight: 600; color: #ccc; cursor: pointer; user-select: none; background: #2a2a2a; }
.debug-title:hover { color: #fff; }
.debug-json { max-height: 360px; overflow: auto; margin: 0; padding: 12px 14px; font-size: 11px; line-height: 1.5; color: #ce9178; white-space: pre-wrap; word-break: break-all; }
</style>