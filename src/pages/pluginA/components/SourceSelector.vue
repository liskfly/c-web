<script setup lang="ts">
import { computed } from 'vue'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'

const props = defineProps<{
  field: string
  context: Record<string, any>
}>()

const label = computed(() => props.context.sourceLabel(props.field))
const options = computed(() => props.context.sourceOptions(props.field))
</script>

<template>
  <el-dropdown
    v-if="label"
    trigger="click"
    placement="bottom"
    popper-class="plugin-a-source-dropdown"
    @command="(optionId: string) => context.selectSource(field, optionId)"
  >
    <span :class="[context.sourceClass(field), 'source-trigger']">
      {{ label }}<span class="source-caret">▼</span>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="option in options"
          :key="option.id"
          :command="option.id"
        >
          <span class="source-option-label">{{ option.label }}</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
