<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ElAutocomplete, ElButton, ElInput, ElInputNumber, ElOption, ElSelect } from 'element-plus'

const props = defineProps<{ context: Record<string, any> }>()
const {
  form, sections, opts, fieldBgClass, sourceClass, sourceLabel, showGraphicBtn, showDocBtn, handleViewClick,
  queryLayerCount, onLayerCountBlur, requestPCSSize, requestSetSize, handleSizeBlur, requireClientPanelSeparation,
  onMaterialTypeChange, onMaterialBrandSelect, onMaterialBrandChange, queryMaterialBrand,
  onMaterialVersionSelect, onMaterialVersionChange, queryMaterialVersion, onMaterialTgChange, onMaterialHalogenChange,
  queryMaxWarpage, queryBoardThickness, queryThicknessTolerance, queryOuterCopperThickness,
  queryOuterBaseCopperThickness, queryInnerCopperThickness, hasInnerLayer, showEnigGold,
  queryEnigGoldThickness, queryHoleCopperThickness, showGoldFinger, queryGoldFingerThickness,
} = props.context

const remarkBoxRef = ref<HTMLElement | null>(null)

// Qt 页面区域高度有限，备注变化后滚到最新一条，历史内容仍可在框内滚动查看。
watch(
  () => form.remark.join('\n'),
  async () => {
    await nextTick()
    const remarkBox = remarkBoxRef.value
    if (remarkBox) remarkBox.scrollTop = remarkBox.scrollHeight
  },
  { flush: 'post' },
)
</script>

<template>
<!-- 三、个性化服务 -->
          <tr class="section-row" @click="sections.custom = !sections.custom"><td colspan="4">三、个性化服务 <span class="arrow" :class="{ up: sections.custom }">▼</span></td></tr>
          <template v-if="sections.custom">
            <tr><td>验收标准<span class="req">*</span></td><td :class="fieldBgClass('acceptanceStandard')"><el-select v-model="form.acceptanceStandard" size="large" style="width:100%"><el-option v-for="v in opts.acceptanceStandard" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('acceptanceStandard')">{{ sourceLabel('acceptanceStandard') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('acceptanceStandard')" class="btn-view graphic" @click="handleViewClick('acceptanceStandard')">图形</button><button v-if="showDocBtn('acceptanceStandard')" class="btn-view doc" @click="handleViewClick('acceptanceStandard')">加工文档</button></td></tr>
            <tr><td>阻抗控制<span class="req">*</span></td><td :class="fieldBgClass('impedanceControl')"><el-select v-model="form.impedanceControl" size="large" style="width:100%"><el-option v-for="v in opts.impedanceControl" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('impedanceControl')">{{ sourceLabel('impedanceControl') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('impedanceControl')" class="btn-view graphic" @click="handleViewClick('impedanceControl')">图形</button><button v-if="showDocBtn('impedanceControl')" class="btn-view doc" @click="handleViewClick('impedanceControl')">加工文档</button></td></tr>
            <tr><td>标记要求<span class="req">*</span></td><td :class="fieldBgClass('markingRequirements')"><el-select v-model="form.markingRequirements" size="large" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.markingRequirements" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('markingRequirements')">{{ sourceLabel('markingRequirements') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('markingRequirements')" class="btn-view graphic" @click="handleViewClick('markingRequirements')">图形</button><button v-if="showDocBtn('markingRequirements')" class="btn-view doc" @click="handleViewClick('markingRequirements')">加工文档</button></td></tr>
            <tr><td>周期格式<span class="req">*</span></td><td :class="fieldBgClass('periodFormat')"><el-select v-model="form.periodFormat" size="large" style="width:100%"><el-option v-for="v in opts.periodFormat" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('periodFormat')">{{ sourceLabel('periodFormat') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('periodFormat')" class="btn-view graphic" @click="handleViewClick('periodFormat')">图形</button><button v-if="showDocBtn('periodFormat')" class="btn-view doc" @click="handleViewClick('periodFormat')">加工文档</button></td></tr>
            <tr><td>测试要求<span class="req">*</span></td><td :class="fieldBgClass('testRequirements')"><el-select v-model="form.testRequirements" size="large" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.testRequirements" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('testRequirements')">{{ sourceLabel('testRequirements') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('testRequirements')" class="btn-view graphic" @click="handleViewClick('testRequirements')">图形</button><button v-if="showDocBtn('testRequirements')" class="btn-view doc" @click="handleViewClick('testRequirements')">加工文档</button></td></tr>
            <tr><td>出货报告<span class="req">*</span></td><td :class="fieldBgClass('shippingReports')"><el-select v-model="form.shippingReports" size="large" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.shippingReports" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('shippingReports')">{{ sourceLabel('shippingReports') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('shippingReports')" class="btn-view graphic" @click="handleViewClick('shippingReports')">图形</button><button v-if="showDocBtn('shippingReports')" class="btn-view doc" @click="handleViewClick('shippingReports')">加工文档</button></td></tr>
            <tr><td>特殊工艺<span class="req">*</span></td><td :class="fieldBgClass('specialProcesses')"><el-select v-model="form.specialProcesses" size="large" multiple collapse-tags style="width:100%"><el-option v-for="v in opts.specialProcesses" :key="v" :label="v" :value="v" /></el-select></td><td class="td-src"><span :class="sourceClass('specialProcesses')">{{ sourceLabel('specialProcesses') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('specialProcesses')" class="btn-view graphic" @click="handleViewClick('specialProcesses')">图形</button><button v-if="showDocBtn('specialProcesses')" class="btn-view doc" @click="handleViewClick('specialProcesses')">加工文档</button></td></tr>
            <tr><td>光绘确认<span class="req">*</span></td><td :class="fieldBgClass('confirmProductionFile')"><el-select v-model="form.confirmProductionFile" size="large" style="width:100%"><el-option v-for="v in opts.confirmProductionFile" :key="v.value" :label="v.label" :value="v.value" /></el-select></td><td class="td-src"><span :class="sourceClass('confirmProductionFile')">{{ sourceLabel('confirmProductionFile') }}</span></td><td class="td-view"><button v-if="showGraphicBtn('confirmProductionFile')" class="btn-view graphic" @click="handleViewClick('confirmProductionFile')">图形</button><button v-if="showDocBtn('confirmProductionFile')" class="btn-view doc" @click="handleViewClick('confirmProductionFile')">加工文档</button></td></tr>
            <tr><td colspan="4" class="remark-cell"><div class="remark-title">📝 备注</div><div ref="remarkBoxRef" class="remark-box"><template v-if="form.remark.length"><div v-for="(msg, i) in form.remark" :key="i" class="remark-item">{{ String(Number(i) + 1) }}. {{ (msg as string).includes('|') ? (msg as string).split('|').slice(1).join('|') : msg }}</div></template><template v-else><span class="remark-empty">暂无备注信息</span></template></div></td></tr>
          </template>
</template>
