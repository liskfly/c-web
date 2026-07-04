<script setup lang="ts">
import { reactive, computed, watch, ref } from 'vue'
import {
  ElForm, ElFormItem, ElInput, ElInputNumber, ElSelect, ElOption,
  ElRadioGroup, ElRadio, ElCheckboxGroup, ElCheckbox, ElSwitch,
  ElButton, ElCard, ElCollapse, ElCollapseItem, ElTag, ElMessage, ElMessageBox,
  ElRow, ElCol, ElTable, ElTableColumn, ElIcon, ElPopconfirm,
} from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'

// ==================== 表单数据 ====================
const form = reactive<Record<string, any>>({
  pcbName: '',
  pcbFile: '',
  layerCount: 2,
  blindVia: false,
  pcsSizeWidth: null,
  pcsSizeHeight: null,
  dimensionTolerance: '+/-0.10mm',
  quantity: 10,
  deliveryUnit: 'PCS',
  panelTypesCount: 1,
  setMethod: '单片无拼板',
  clientPanelHorizontal: 1,
  clientPanelVertical: 1,
  setSizeWidth: null,
  setSizeHeight: null,
  clientPanelSeparation: '拼板&邮票孔交货',
  acceptXOut: true,

  materialType: 'FR4',
  materialTg: false,
  halogenFree: false,
  maxWarpage: '0.5%',
  boardThickness: '1.6',
  thicknessTolerance: '+/-10%',
  outerCopperThickness: '35',
  outerBaseCopperThickness: '18',
  innerCopperThickness: 1,
  minTraceWidthOuter: null,
  minTraceSpacingOuter: null,
  minTraceWidthInner: null,
  minTraceSpacingInner: null,
  minHoleSize: null,
  holeCopperThickness: '18',
  solderMaskColor: '绿色',
  silkscreenColor: '白色字符',
  surfaceFinish: '无铅喷锡',
  enigGoldThickness: 0.05,
  immersionGoldArea: null,
  viaProcess: '按Gerber文件',
  goldFingerType: '无',
  goldFingerThickness: 0.38,
  goldFingerChamferAngle: '30°',
  goldFingerChamferDepth: null,
  goldFingerChamferRemaining: null,

  acceptanceStandard: 'IPC 2',
  impedanceControl: false,
  markingRequirements: ['不需要'],
  periodFormat: 'WWYY',
  testRequirements: ['不需要'],
  shippingReports: ['不需要'],
  specialProcesses: ['不需要'],
  confirmProductionFile: false,

  eqReport: '',

  price: null,
  expediteFee: null,
})

// ==================== 选项 ====================
const opts: Record<string, { label: string; value: any }[]> = {
  layerCount: [1,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30].map(v => ({ label: v+'层', value: v })),
  dimensionTolerance: ['+/-0.10mm','+/-0.15mm','+/-0.20mm'].map(v => ({ label: v, value: v })),
  deliveryUnit: [{ label: 'PCS', value: 'PCS' }, { label: 'SET', value: 'SET' }],
  pcsSetMethod: [{ label: '单片无拼板', value: '单片无拼板' }, { label: '单片加工艺边', value: '单片加工艺边' }],
  setSetMethod: [{ label: '客户拼板', value: '客户拼板' }],
  clientPanelSeparation: ['拼板&邮票孔交货','拼板铣开交货','拼板V-CUT+桥连交货','拼板桥连+邮票孔','拼板V-CUT+邮票孔','拼板V-CUT桥连+邮票孔','拼板桥连交货'].map(v => ({ label: v, value: v })),
  materialType: ['FR4','高速板材','高频板','PTFE板材','PI'].map(v => ({ label: v, value: v })),
  maxWarpage: ['无要求','0.75%','0.5%','IPC标准'].map(v => ({ label: v, value: v })),
  boardThickness: ['0.6','0.7','0.8','0.9','1.0','1.1','1.2','1.3','1.4','1.5','1.6','1.7','1.8','1.9','2.0'].map(v => ({ label: v+'mm', value: v })),
  thicknessTolerance: [{ label: '+/-10%', value: '+/-10%' }],
  outerCopperThickness: ['35','70','105','140','175','210'].map(v => ({ label: v+'um', value: v })),
  outerBaseCopperThickness: ['8','12','18','35','52.5','70','105','140','175','210'].map(v => ({ label: v+'um', value: v })),
  innerCopperThickness: [0.5,1,2,3,4,5,6].map(v => ({ label: v+'oz', value: v })),
  holeCopperThickness: ['18','20','25','25.4','30','35','40','45','50'].map(v => ({ label: v+'um', value: v })),
  solderMaskColor: ['绿色','绿色亚光','黑色','黑色亚光','蓝色','不印阻焊'].map(v => ({ label: v, value: v })),
  silkscreenColor: ['白色字符','黑色字符','不印字符'].map(v => ({ label: v, value: v })),
  surfaceFinish: ['沉金','无铅喷锡','OSP','喷锡','沉银','沉锡','无需表面处理'].map(v => ({ label: v, value: v })),
  enigGoldThickness: [0.05,0.075,0.08,0.1].map(v => ({ label: v+'um', value: v })),
  viaProcess: ['按Gerber文件','阻焊覆盖','BGA芯片处阻焊塞孔+按Gerber文件','不盖阻焊','阻焊塞孔','非导电树脂塞孔','非导电树脂塞孔+电镀填平'].map(v => ({ label: v, value: v })),
  goldFingerType: ['无','常规金手指','分段金手指','长短金手指'].map(v => ({ label: v, value: v })),
  goldFingerThickness: [0.38,0.8,1.25].map(v => ({ label: v+'um', value: v })),
  goldFingerChamferAngle: ['20°','30°','45°','不倒角'].map(v => ({ label: v, value: v })),
  acceptanceStandard: ['IPC 2','IPC 3'].map(v => ({ label: v, value: v })),
  periodFormat: ['WWYY','YYWW','MMYY','YYMM','DDMMYY','YYMMDD'].map(v => ({ label: v, value: v })),
  markingRequirements: ['PCB厂家标记','周期标记','无铅标记','rosh标记','防静电标记','加拿大UL','不需要'].map(v => ({ label: v, value: v })),
  testRequirements: ['电感测试','损耗','耐电压测试','孔电阻测试','线电阻测试','不需要','飞针测试','夹具测试'].map(v => ({ label: v, value: v })),
  shippingReports: ['最终产品检查报告','回流焊测试报告','可焊性测试报告','离子污染度测试报告','耐电压测试报告','热应力检测报告','不需要'].map(v => ({ label: v, value: v })),
  specialProcesses: ['电镀填孔','金属包边','金属化半孔','背钻孔','锥形孔','阶梯孔','铣阶梯槽','控深钻','不需要'].map(v => ({ label: v, value: v })),
}

// ==================== 条件显示 ====================
const isPCS = computed(() => form.deliveryUnit === 'PCS')
const isSET = computed(() => form.deliveryUnit === 'SET')
const showPanelFields = computed(() => form.setMethod === '客户拼板')
const showEnigGold = computed(() => form.surfaceFinish === '沉金')
const showGoldFinger = computed(() => form.goldFingerType !== '无')
const showImpedance = computed(() => form.impedanceControl)
const showPeriodFormat = computed(() => (form.markingRequirements as string[]).includes('周期标记'))
const hasInnerLayer = computed(() => Number(form.layerCount) > 2)

watch(() => form.deliveryUnit, (val) => {
  form.setMethod = val === 'PCS' ? '单片无拼板' : '客户拼板'
})

// ==================== 4、叠层表格 ====================
interface StackupRow {
  layerName: string
  material: string   // PP / CORE / CU
  pcbMaterialType: string
  copperThickness: number | null
  dielectricThickness: number | null
  dk: number | null
}

const stackupRows = ref<StackupRow[]>([{
  layerName: 'L1', material: 'CU', pcbMaterialType: '',
  copperThickness: 1, dielectricThickness: null, dk: null,
}])

const stackupMaterialOpts = ['PP', 'CORE', 'CU']
const ppMaterialTypes = ['IT-158BS','NY2150','S1000HB','S1151GB','S1150GB','S1165B','IT-180A','TU-75P','S1000-2MB','S1000-2B','TU-768','NY2170','S1190B','RO4450F','TU86P HF','IT-170GT','IT-170GRA1','IT-170GRA2','TU-87P SLK','TU-87P SLK SP','N4203-13','N4203-13EP','N4203-13SI','N4203-13EPSI','R-5620','R-5620S','R-5620SS','R-5680GE','R-5680N','Synamic6B','FR408HR','S7439 B','S7439HW B','Synamic6 B','EM-888 B','EM-888 BK','R-5670','R-5670G','R-5670N','R-5670K','R-5670NE','IT-968 B','IT-958G','IT-968SE B','NY6300P','85N','VT-901']
const coreMaterialTypes = ['IT-158','NY2150','S1000H','S1151G','S1150G','S1165','IT-180A','TU-752','S1000-2M','S1000-2','TU-768','NY2170','S1190','RO4725JXR','RO4730G3','Aerowave300','RO4533','RO4350B','RO4835','RO4350','RO4233','RO4360','RO4360G2','RO4534','RO4535','RO4725','RO4730','RO4003C','S7136H','S7135（不做压合）','TU862 HF','IT-170GT','IT-170GRA1','IT-170GRA2','TU-872 SLK','TU-872 SLK SP','N4103-13','N4103-13EP','N4103-13SI','N4103-13EPSI','R-5725/M4','R-5725S/M4S','R-5725SS','R-5785GE','R-5785N/M7N','Synamic6','FR408HR','S7439','S7439HW','Synamic6N','EM-888','EM-888K','R-5575','R-5775','R-5775G/M6G','R-5775N/M6N','R-5775K/M6K','R-5775NE','IT-968','IT-958G','IT-968 SE','NY6300','85N','VT-901']

function stackupMaterialTypesFor(row: StackupRow): string[] {
  if (row.material === 'PP') return ppMaterialTypes
  if (row.material === 'CORE') return coreMaterialTypes
  return []
}

function addStackupRow() {
  const last = stackupRows.value[stackupRows.value.length - 1]
  const nextNum = stackupRows.value.length + 1
  stackupRows.value.push({
    layerName: `L${nextNum}`,
    material: 'PP',
    pcbMaterialType: '',
    copperThickness: null,
    dielectricThickness: null,
    dk: null,
  })
}

function delStackupRow(idx: number) {
  stackupRows.value.splice(idx, 1)
}

// ==================== 5、阻抗控制要求表格 ====================
interface ImpedanceRow {
  impType: string
  controlLayer: string
  refLayerTop: string
  refLayerBottom: string
  isCoated: boolean
  lineWidth: number | null
  lineSpacing: number | null
  lineToCopper: number | null
  impTarget: number | null
  impTol: number
}

const impTypes = ['外层单端','外层单端共面地','外层差分','外层差分共面地','内层单端(双层屏蔽)','内层差分(双层屏蔽)','内层单端(单层屏蔽)','内层差分(单层屏蔽)','内层单端共面地(双层屏蔽)','内层差分共面地(双层屏蔽)','内层层间差分(双层屏蔽)','内层差分1B2A(双层屏蔽)','内层差分1B2A(单层屏蔽)']

// 需要填线距的阻抗类型
const impTypesNeedSpacing = ['外层差分','外层差分共面地','内层差分(双层屏蔽)','内层差分(单层屏蔽)','内层差分共面地(双层屏蔽)','内层层间差分(双层屏蔽)','内层差分1B2A(双层屏蔽)','内层差分1B2A(单层屏蔽)']

// 需要填线铜的阻抗类型
const impTypesNeedLineToCopper = ['外层单端共面地','外层差分共面地','内层单端共面地(双层屏蔽)','内层差分共面地(双层屏蔽)']

const impedanceRows = ref<ImpedanceRow[]>([{
  impType: '', controlLayer: '', refLayerTop: '', refLayerBottom: '',
  isCoated: false, lineWidth: null, lineSpacing: null, lineToCopper: null,
  impTarget: null, impTol: 10,
}])

function needSpacing(type: string) { return impTypesNeedSpacing.includes(type) }
function needLineToCopper(type: string) { return impTypesNeedLineToCopper.includes(type) }

function addImpedanceRow() {
  impedanceRows.value.push({
    impType: '', controlLayer: '', refLayerTop: '', refLayerBottom: '',
    isCoated: false, lineWidth: null, lineSpacing: null, lineToCopper: null,
    impTarget: null, impTol: 10,
  })
}

function delImpedanceRow(idx: number) {
  impedanceRows.value.splice(idx, 1)
}

// ==================== 提交 ====================
const submitting = ref(false)
const activeSection = ref('1')

async function submitForm() {
  submitting.value = true
  const payload = {
    ...form,
    stackupTable: stackupRows.value,
    impedanceTable: impedanceRows.value,
  }

  const qt = (window as any).qtBridge
  if (qt?.onWebButtonClick) {
    // Qt 环境：通过 qtBridge 把 JSON 数据传给 C++
    qt.onWebButtonClick(JSON.stringify(payload))
  } else {
    // 开发环境：控制台输出
    console.log('📋 提交 PCB 预审表单:', JSON.stringify(payload, null, 2))
  }

  await new Promise(r => setTimeout(r, 500))
  submitting.value = false
  ElMessage.success('表单数据已提交')
}

function resetForm() {
  ElMessageBox.confirm('确定要重置所有字段吗？', '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    .then(() => window.location.reload())
    .catch(() => {})
}
</script>

<template>
  <div class="pcb-form">
    <div class="header">
      <h2>PCB 在线预审报价</h2>
      <el-tag type="info" size="small">字段清单 V6.0（2026-07-01）</el-tag>
    </div>

    <el-form label-position="top" size="default">
      <el-collapse v-model="activeSection">

        <!-- ============ 1、PCB 基本信息 ============ -->
        <el-collapse-item title="1、PCB 基本信息" name="1">
          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="生产型号" required>
                <el-input v-model="form.pcbName" placeholder="PCB资料文件名" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="PCB 资料" required>
                <el-input v-model="form.pcbFile" placeholder="上传或输入路径" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="板子层数" required>
                <el-select v-model="form.layerCount" style="width:100%">
                  <el-option v-for="o in opts.layerCount" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="盲埋孔" required>
                <el-radio-group v-model="form.blindVia">
                  <el-radio :value="false">否</el-radio>
                  <el-radio :value="true">是</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="PCS尺寸(水平)" required>
                <el-input-number v-model="form.pcsSizeWidth" :min="0" :max="571.5" :precision="2" placeholder="0-571.5" style="width:100%" />
                <template #extra><span class="unit-hint">mm</span></template>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="PCS尺寸(垂直)" required>
                <el-input-number v-model="form.pcsSizeHeight" :min="0" :max="571.5" :precision="2" placeholder="0-571.5" style="width:100%" />
                <template #extra><span class="unit-hint">mm</span></template>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="外形公差" required>
                <el-select v-model="form.dimensionTolerance" style="width:100%">
                  <el-option v-for="o in opts.dimensionTolerance" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="板子数量" required>
                <el-input-number v-model="form.quantity" :min="1" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="交货单位" required>
                <el-select v-model="form.deliveryUnit" style="width:100%">
                  <el-option v-for="o in opts.deliveryUnit" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="合拼种数" required>
                <el-input-number v-model="form.panelTypesCount" :min="1" :max="100" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="Set拼板方式" required>
                <el-select v-model="form.setMethod" style="width:100%">
                  <template v-if="isPCS">
                    <el-option v-for="o in opts.pcsSetMethod" :key="o.value" :label="o.label" :value="o.value" />
                  </template>
                  <template v-if="isSET">
                    <el-option v-for="o in opts.setSetMethod" :key="o.value" :label="o.label" :value="o.value" />
                  </template>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <template v-if="showPanelFields">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="拼板个数(水平)" required>
                  <el-input-number v-model="form.clientPanelHorizontal" :min="1" :max="100" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="拼板个数(垂直)" required>
                  <el-input-number v-model="form.clientPanelVertical" :min="1" :max="100" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="Set尺寸(水平)" required>
                  <el-input-number v-model="form.setSizeWidth" :min="0" :max="571.5" :precision="2" placeholder="0-571.5" style="width:100%" />
                  <template #extra><span class="unit-hint">mm</span></template>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Set尺寸(垂直)" required>
                  <el-input-number v-model="form.setSizeHeight" :min="0" :max="571.5" :precision="2" placeholder="0-571.5" style="width:100%" />
                  <template #extra><span class="unit-hint">mm</span></template>
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="16">
              <el-col :span="24">
                <el-form-item label="外形要求" required>
                  <el-select v-model="form.clientPanelSeparation" style="width:100%">
                    <el-option v-for="o in opts.clientPanelSeparation" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="16">
              <el-col :span="24">
                <el-form-item label="是否接受打叉板" required>
                  <el-radio-group v-model="form.acceptXOut">
                    <el-radio :value="true">是</el-radio>
                    <el-radio :value="false">否</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
            </el-row>
          </template>
        </el-collapse-item>

        <!-- ============ 2、PCB 工艺信息 ============ -->
        <el-collapse-item title="2、PCB 工艺信息" name="2">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="板材种类" required>
                <el-select v-model="form.materialType" style="width:100%">
                  <el-option v-for="o in opts.materialType" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="成品板厚" required>
                <el-select v-model="form.boardThickness" filterable allow-create style="width:100%">
                  <el-option v-for="o in opts.boardThickness" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="高TG" required>
                <el-radio-group v-model="form.materialTg">
                  <el-radio :value="false">否</el-radio>
                  <el-radio :value="true">是</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="无卤板材" required>
                <el-radio-group v-model="form.halogenFree">
                  <el-radio :value="false">否</el-radio>
                  <el-radio :value="true">是</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="翘曲度" required>
                <el-select v-model="form.maxWarpage" style="width:100%">
                  <el-option v-for="o in opts.maxWarpage" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="板厚公差" required>
                <el-select v-model="form.thicknessTolerance" style="width:100%">
                  <el-option v-for="o in opts.thicknessTolerance" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="外层完成铜厚度" required>
                <el-select v-model="form.outerCopperThickness" filterable allow-create style="width:100%">
                  <el-option v-for="o in opts.outerCopperThickness" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="内层基铜厚度" required>
                <el-select v-model="form.innerCopperThickness" style="width:100%">
                  <el-option v-for="o in opts.innerCopperThickness" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="外层最小线宽" required>
                <el-input-number v-model="form.minTraceWidthOuter" :min="0" :precision="2" style="width:100%" />
                <template #extra><span class="unit-hint">mil</span></template>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="外层最小间距" required>
                <el-input-number v-model="form.minTraceSpacingOuter" :min="0" :precision="2" style="width:100%" />
                <template #extra><span class="unit-hint">mil</span></template>
              </el-form-item>
            </el-col>
          </el-row>

          <template v-if="hasInnerLayer">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="内层最小线宽" required>
                  <el-input-number v-model="form.minTraceWidthInner" :min="0" :precision="2" style="width:100%" />
                  <template #extra><span class="unit-hint">mil</span></template>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="内层最小间距" required>
                  <el-input-number v-model="form.minTraceSpacingInner" :min="0" :precision="2" style="width:100%" />
                  <template #extra><span class="unit-hint">mil</span></template>
                </el-form-item>
              </el-col>
            </el-row>
          </template>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="最小孔径" required>
                <el-input-number v-model="form.minHoleSize" :min="0" :precision="3" style="width:100%" />
                <template #extra><span class="unit-hint">mm</span></template>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="最小孔铜" required>
                <el-select v-model="form.holeCopperThickness" filterable allow-create style="width:100%">
                  <el-option v-for="o in opts.holeCopperThickness" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="阻焊颜色" required>
                <el-select v-model="form.solderMaskColor" style="width:100%">
                  <el-option v-for="o in opts.solderMaskColor" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="字符颜色" required>
                <el-select v-model="form.silkscreenColor" style="width:100%">
                  <el-option v-for="o in opts.silkscreenColor" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="表面处理" required>
                <el-select v-model="form.surfaceFinish" style="width:100%">
                  <el-option v-for="o in opts.surfaceFinish" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <template v-if="showEnigGold">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="最小沉金金厚" required>
                  <el-select v-model="form.enigGoldThickness" style="width:100%">
                    <el-option v-for="o in opts.enigGoldThickness" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="沉金面积（双面之和）">
                  <el-input-number v-model="form.immersionGoldArea" :min="0" :precision="1" style="width:100%" />
                  <template #extra><span class="unit-hint">%</span></template>
                </el-form-item>
              </el-col>
            </el-row>
          </template>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="过孔工艺" required>
                <el-select v-model="form.viaProcess" style="width:100%">
                  <el-option v-for="o in opts.viaProcess" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="金手指类型" required>
                <el-select v-model="form.goldFingerType" style="width:100%">
                  <el-option v-for="o in opts.goldFingerType" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <template v-if="showGoldFinger">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="金手指金厚" required>
                  <el-select v-model="form.goldFingerThickness" style="width:100%">
                    <el-option v-for="o in opts.goldFingerThickness" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="倒角角度" required>
                  <el-select v-model="form.goldFingerChamferAngle" style="width:100%">
                    <el-option v-for="o in opts.goldFingerChamferAngle" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="倒角深度">
                  <el-input-number v-model="form.goldFingerChamferDepth" :min="0" :max="10" :precision="2" style="width:100%" />
                  <template #extra><span class="unit-hint">mm</span></template>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="金手指倒角余厚">
                  <el-input-number v-model="form.goldFingerChamferRemaining" :min="0" :max="10" :precision="2" style="width:100%" />
                  <template #extra><span class="unit-hint">mm</span></template>
                </el-form-item>
              </el-col>
            </el-row>
          </template>
        </el-collapse-item>

        <!-- ============ 3、个性化服务 ============ -->
        <el-collapse-item title="3、个性化服务" name="3">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="验收标准" required>
                <el-select v-model="form.acceptanceStandard" style="width:100%">
                  <el-option v-for="o in opts.acceptanceStandard" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="光绘确认" required>
                <el-radio-group v-model="form.confirmProductionFile">
                  <el-radio :value="false">否</el-radio>
                  <el-radio :value="true">是</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="阻抗控制" required>
                <el-radio-group v-model="form.impedanceControl">
                  <el-radio :value="false">否</el-radio>
                  <el-radio :value="true">是</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>

          <template v-if="showImpedance">
            <el-row :gutter="16">
              <el-col :span="24">
                <el-form-item label="阻抗控制要求">
                  <el-tag type="warning">阻抗控制要求表格（待展开）</el-tag>
                </el-form-item>
              </el-col>
            </el-row>
          </template>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="标记要求" required>
                <el-checkbox-group v-model="form.markingRequirements">
                  <el-checkbox v-for="o in opts.markingRequirements" :key="o.value" :label="o.value" :value="o.value">{{ o.label }}</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </el-col>
          </el-row>

          <template v-if="showPeriodFormat">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="周期格式" required>
                  <el-select v-model="form.periodFormat" style="width:100%">
                    <el-option v-for="o in opts.periodFormat" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </template>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="测试要求" required>
                <el-checkbox-group v-model="form.testRequirements">
                  <el-checkbox v-for="o in opts.testRequirements" :key="o.value" :label="o.value" :value="o.value">{{ o.label }}</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="出货报告" required>
                <el-checkbox-group v-model="form.shippingReports">
                  <el-checkbox v-for="o in opts.shippingReports" :key="o.value" :label="o.value" :value="o.value">{{ o.label }}</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="特殊工艺" required>
                <el-checkbox-group v-model="form.specialProcesses">
                  <el-checkbox v-for="o in opts.specialProcesses" :key="o.value" :label="o.value" :value="o.value">{{ o.label }}</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </el-col>
          </el-row>
        </el-collapse-item>

        <!-- ============ 4、叠层 ============ -->
        <el-collapse-item title="4、叠层" name="4">
          <el-table :data="stackupRows" border size="small" style="width:100%">
            <el-table-column prop="layerName" label="层号" width="80">
              <template #default="{ row }">
                <el-input v-model="row.layerName" size="small" />
              </template>
            </el-table-column>
            <el-table-column prop="material" label="材料" width="110">
              <template #default="{ row }">
                <el-select v-model="row.material" size="small" style="width:100%">
                  <el-option v-for="m in stackupMaterialOpts" :key="m" :label="m" :value="m" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column prop="pcbMaterialType" label="类型" min-width="160">
              <template #default="{ row }">
                <el-select v-model="row.pcbMaterialType" size="small" filterable :disabled="row.material === 'CU'" style="width:100%">
                  <el-option v-for="m in stackupMaterialTypesFor(row)" :key="m" :label="m" :value="m" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column prop="copperThickness" label="铜厚(mil)" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.copperThickness" size="small" :min="0.1" :max="10" :precision="2" :disabled="row.material !== 'CU'" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column prop="dielectricThickness" label="介质厚度(mil)" width="140">
              <template #default="{ row }">
                <el-input-number v-model="row.dielectricThickness" size="small" :min="0.01" :max="100" :precision="2" :disabled="row.material === 'CU'" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column prop="dk" label="介电常数" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.dk" size="small" :min="1" :max="50" :precision="2" :disabled="row.material === 'CU'" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="60" fixed="right">
              <template #default="{ $index }">
                <el-button size="small" type="danger" :icon="Delete" circle @click="delStackupRow($index)" />
              </template>
            </el-table-column>
          </el-table>
          <div style="margin-top:8px">
            <el-button size="small" :icon="Plus" @click="addStackupRow">新增一行</el-button>
          </div>
        </el-collapse-item>

        <!-- ============ 5、阻抗控制要求 ============ -->
        <el-collapse-item title="5、阻抗控制要求" name="5">
          <el-table :data="impedanceRows" border size="small" style="width:100%">
            <el-table-column prop="impType" label="阻抗类型" width="180">
              <template #default="{ row }">
                <el-select v-model="row.impType" size="small" style="width:100%">
                  <el-option v-for="t in impTypes" :key="t" :label="t" :value="t" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column prop="controlLayer" label="控制层" width="90">
              <template #default="{ row }">
                <el-input v-model="row.controlLayer" size="small" />
              </template>
            </el-table-column>
            <el-table-column prop="refLayerTop" label="上参" width="90">
              <template #default="{ row }">
                <el-input v-model="row.refLayerTop" size="small" />
              </template>
            </el-table-column>
            <el-table-column prop="refLayerBottom" label="下参" width="90">
              <template #default="{ row }">
                <el-input v-model="row.refLayerBottom" size="small" />
              </template>
            </el-table-column>
            <el-table-column prop="isCoated" label="盖油" width="80">
              <template #default="{ row }">
                <el-switch v-model="row.isCoated" size="small" />
              </template>
            </el-table-column>
            <el-table-column prop="lineWidth" label="线宽(mil)" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.lineWidth" size="small" :min="1" :max="100" :precision="2" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column prop="lineSpacing" label="线距(mil)" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.lineSpacing" size="small" :min="1" :max="100" :precision="2" :disabled="!needSpacing(row.impType)" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column prop="lineToCopper" label="线铜(mil)" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.lineToCopper" size="small" :min="1" :max="100" :precision="2" :disabled="!needLineToCopper(row.impType)" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column prop="impTarget" label="阻抗要求(ohm)" width="140">
              <template #default="{ row }">
                <el-input-number v-model="row.impTarget" size="small" :min="1" :max="200" :precision="2" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column prop="impTol" label="公差(%)" width="110">
              <template #default="{ row }">
                <el-input-number v-model="row.impTol" size="small" :min="1" :max="50" :precision="1" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="60" fixed="right">
              <template #default="{ $index }">
                <el-button size="small" type="danger" :icon="Delete" circle @click="delImpedanceRow($index)" />
              </template>
            </el-table-column>
          </el-table>
          <div style="margin-top:8px">
            <el-button size="small" :icon="Plus" @click="addImpedanceRow">新增一行</el-button>
          </div>
        </el-collapse-item>

        <!-- ============ 6、EQ报告 ============ -->
        <el-collapse-item title="6、EQ报告" name="6">
          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="EQ报告">
                <el-input v-model="form.eqReport" type="textarea" :rows="4" placeholder="EQ报告内容..." />
              </el-form-item>
            </el-col>
          </el-row>
        </el-collapse-item>

        <!-- ============ 7、订单费用 ============ -->
        <el-collapse-item title="7、订单费用" name="7">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="单价" required>
                <el-input-number v-model="form.price" :min="0" :precision="2" style="width:100%" />
                <template #extra><span class="unit-hint">¥ / ＄</span></template>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="加急费">
                <el-input-number v-model="form.expediteFee" :min="0" :precision="2" style="width:100%" />
                <template #extra><span class="unit-hint">¥ / ＄</span></template>
              </el-form-item>
            </el-col>
          </el-row>
        </el-collapse-item>

      </el-collapse>
    </el-form>

    <!-- 操作按钮 -->
    <div class="actions">
      <el-button type="primary" size="large" :loading="submitting" @click="submitForm">提 交 预 审</el-button>
      <el-button size="large" @click="resetForm">重置</el-button>
    </div>
  </div>
</template>

<style scoped>
.pcb-form {
  max-width: 820px;
  margin: 0 auto;
  padding: 20px 0;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.header h2 {
  font-size: 20px;
  margin: 0;
}

:deep(.el-collapse) {
  border: none;
}

:deep(.el-collapse-item) {
  margin-bottom: 12px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

:deep(.el-collapse-item__header) {
  background: #fff;
  font-weight: 600;
  font-size: 15px;
  border: none;
  padding: 14px 20px;
}

:deep(.el-collapse-item__wrap) {
  background: #fff;
  border: none;
  border-top: 1px solid #ebeef5;
}

:deep(.el-collapse-item__content) {
  padding: 20px;
}

:deep(.el-form-item__label) {
  font-size: 13px;
}

:deep(.el-radio) {
  margin-right: 16px;
}

:deep(.el-checkbox) {
  margin-right: 12px;
  margin-bottom: 4px;
}

:deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
}

:deep(.el-row) {
  margin-bottom: 0;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
