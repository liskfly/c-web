<template>
  <RouterView />
</template>

<script>
import vconsole from 'vconsole'
new vconsole()
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #f5f7fa;
  color: #303133;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

:root {
  --el-font-size-base: 16px;
}

.el-select-dropdown__item {
  font-size: 16px !important;
}

.el-autocomplete-suggestion li {
  font-size: 16px !important;
}
</style>
