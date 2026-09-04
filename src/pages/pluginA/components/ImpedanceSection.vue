<script setup lang="ts">
import { ElButton, ElInputNumber, ElOption, ElSelect, ElSwitch, ElTable, ElTableColumn } from 'element-plus'

const props = defineProps<{ context: Record<string, any> }>()
const {
  sections, impRows, impTypes, layerOptions, refLayerOptions, onControlLayerChange,
  validateRefLayer, insertImpRow, addImpRow,
} = props.context
</script>

<template>
<!-- 五、阻抗 -->
      <div class="section-row" @click="sections.impedance = !sections.impedance" style="cursor:pointer;background:#f0f4ff;font-weight:600;color:#2756ff;font-size: 16px;padding:8px 10px;border:1px solid #e5e6eb;border-radius:0">五、阻抗控制要求 <span class="arrow" :class="{ up: sections.impedance }">▼</span></div>
      <div v-if="sections.impedance" style="padding:0">
        <el-table :data="impRows" size="small" border style="width:100%">
          <el-table-column label="阻抗类型"><template #default="{ row }"><el-select v-model="row.impType" size="large" style="width:100%"><el-option v-for="t in impTypes" :key="t" :label="t" :value="t" /></el-select></template></el-table-column>
          <el-table-column label="控制层"><template #default="{ row }"><div><el-select v-model="row.controlLayer" size="large" style="width:100%" @change="onControlLayerChange(row)"><el-option v-for="l in layerOptions" :key="l" :label="l" :value="l" /></el-select></div></template></el-table-column>
          <el-table-column label="上参"><template #default="{ row }"><div><el-select v-model="row.refLayerTop" size="large" style="width:100%" @change="validateRefLayer(row, 'top')"><el-option v-for="l in refLayerOptions" :key="l" :label="l || '空'" :value="l" /></el-select><div v-if="row._refTopError" style="color:#f56c6c;font-size: 16px;margin-top:2px;line-height:1.2">{{ row._refTopError }}</div></div></template></el-table-column>
          <el-table-column label="下参"><template #default="{ row }"><div><el-select v-model="row.refLayerBottom" size="large" style="width:100%" @change="validateRefLayer(row, 'bottom')"><el-option v-for="l in refLayerOptions" :key="l" :label="l || '空'" :value="l" /></el-select><div v-if="row._refBottomError" style="color:#f56c6c;font-size: 16px;margin-top:2px;line-height:1.2">{{ row._refBottomError }}</div></div></template></el-table-column>
          <el-table-column label="盖油" width="60" align="center"><template #default="{ row }"><el-switch v-model="row.isCoated" size="small" /></template></el-table-column>
          <el-table-column label="线宽(mil)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.lineWidth" :min="1" :max="100" :precision="2" size="large" style="width:100%" /></template></el-table-column>
          <el-table-column label="线距(mil)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.lineSpacing" :min="1" :max="100" :precision="2" size="large" style="width:100%" /></template></el-table-column>
          <el-table-column label="线铜(mil)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.lineToCopper" :min="1" :max="100" :precision="2" size="large" style="width:100%" /></template></el-table-column>
          <el-table-column label="阻抗(ohm)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.impTarget" :min="1" :max="200" :precision="2" size="large" style="width:100%" /></template></el-table-column>
          <el-table-column label="公差(%)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.impTol" :min="1" :max="50" :precision="1" size="large" style="width:100%" /></template></el-table-column>
          <el-table-column label="操作" width="130" align="center"><template #default="{ $index }"><el-button size="small" type="primary" link @click="insertImpRow($index)">新增</el-button><el-button size="small" type="danger" link @click="impRows.splice($index,1)">删除</el-button></template></el-table-column>
        </el-table>
        <div v-if="impRows.length === 0" style="padding:6px 0"><button class="btn-add-row" @click="addImpRow">+ 新增一行</button></div>
      </div>
</template>

