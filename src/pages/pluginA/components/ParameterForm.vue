<script setup lang="ts">
import BasicParameters from './parameters/BasicParameters.vue'
import CustomParameters from './parameters/CustomParameters.vue'
import ProcessParameters from './parameters/ProcessParameters.vue'

defineProps<{ context: Record<string, any> }>()
</script>

<template>
  <table class="param-table">
    <thead>
      <tr>
        <th style="width: 24%">项目类型名称</th>
        <th style="width: 34%">参数值</th>
        <th style="width: 22%">来源</th>
        <th style="width: 20%">查看</th>
      </tr>
    </thead>
    <tbody>
      <BasicParameters :context="context" />
      <ProcessParameters :context="context" />
      <CustomParameters :context="context" />
    </tbody>
  </table>
</template>
