<script setup lang="ts">
import { ElAutocomplete, ElButton, ElInput, ElInputNumber, ElOption, ElSelect, ElTable, ElTableColumn } from 'element-plus'

const props = defineProps<{ context: Record<string, any> }>()
const {
  sections, stackupRows, stackupScheme, toggleStackupScheme, onMaterialChange,
  queryStackupCuType, queryStackupPpType, queryStackupCoreType, insertStackupRow, addStackupRow,
} = props.context
</script>

<template>
<!-- 四、叠层 -->
      <div class="section-row" @click="sections.stackup = !sections.stackup" style="cursor:pointer;background:#f0f4ff;font-weight:600;color:#2756ff;font-size: 16px;padding:8px 10px;border:1px solid #e5e6eb;border-radius:0">四、叠层 <span class="arrow" :class="{ up: sections.stackup }">▼</span></div>
      <div v-if="sections.stackup" style="padding:0">
        <div style="padding:4px 0"><button class="btn-add-row" @click="toggleStackupScheme">切换叠构({{ stackupScheme === 'normal' ? 'PP→Core' : 'Core→PP' }})</button></div>
        <el-table :data="stackupRows" size="small" border style="width:100%">
          <el-table-column label="层号" width="110"><template #default="{ row }"><el-input v-model="row.layerName" size="large" /></template></el-table-column>
          <el-table-column label="材料"><template #default="{ row }"><el-select v-model="row.material" size="large" style="width:100%" @change="onMaterialChange(row)"><el-option v-for="m in ['PP','CORE','CU','光板']" :key="m" :label="m" :value="m" /></el-select></template></el-table-column>
          <el-table-column label="类型"><template #default="{ row }"><el-autocomplete v-model="row.pcbMaterialType" :fetch-suggestions="row.material === 'CU' ? queryStackupCuType : row.material === 'PP' ? queryStackupPpType : queryStackupCoreType" size="large" style="width:100%" clearable><template #default="{ item }"><div class="autocomplete-item">{{ item.value }}</div></template></el-autocomplete></template></el-table-column>
          <el-table-column label="铜厚(mil)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.copperThickness" size="large" :min="0.1" :max="10" :precision="2" :disabled="row.material!=='CU'" style="width:100%" /></template></el-table-column>
          <el-table-column label="介质厚度(mil)"><template #default="{ row }"><el-input-number :controls="false" v-model="row.dielectricThickness" size="large" :min="0.01" :max="100" :precision="2" :disabled="row.material==='CU'" style="width:100%" /></template></el-table-column>
          <el-table-column label="介电常数"><template #default="{ row }"><el-input-number :controls="false" v-model="row.dk" size="large" :min="1" :max="50" :precision="2" :disabled="row.material==='CU'" style="width:100%" /></template></el-table-column>
          <el-table-column label="操作" width="130" align="center"><template #default="{ $index }"><el-button size="small" type="primary" link @click="insertStackupRow($index)">新增</el-button><el-button size="small" type="danger" link @click="stackupRows.splice($index,1)">删除</el-button></template></el-table-column>
        </el-table>
        <div v-if="stackupRows.length === 0" style="padding:6px 0"><button class="btn-add-row" @click="addStackupRow">+ 新增一行</button></div>
      </div>
</template>

