<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getBridge } from '@/shared/bridge'

interface LogItem {
  time: string
  text: string
}

const logs = ref<LogItem[]>([])

function addLog(text: string) {
  const now = new Date()
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  logs.value.unshift({ time, text })
  if (logs.value.length > 200) logs.value.pop()
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function clearLogs() {
  logs.value = []
}

onMounted(async () => {
  addLog('插件 C 已加载')
  const bridge = await getBridge()
  // 监听 C++ 推送的信号（示例）
  if (bridge.onSignal?.connect) {
    bridge.onSignal.connect((msg: string) => addLog(`[C++] ${msg}`))
  }
})

onUnmounted(() => {
  // 清理
})
</script>

<template>
  <div class="page">
    <h2>📋 插件 C — 日志查看</h2>
    <p class="desc">实时查看 C++ 后端推送的日志消息</p>

    <div class="card">
      <div class="toolbar">
        <span>{{ logs.length }} 条</span>
        <button class="btn" @click="clearLogs">清空</button>
      </div>
      <div class="log-box">
        <div v-if="logs.length === 0" class="empty">暂无日志</div>
        <div v-for="(item, i) in logs" :key="i" class="log-item">
          <span class="log-time">{{ item.time }}</span>
          <span class="log-text">{{ item.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 800px;
  margin: 0 auto;
}

h2 {
  font-size: 20px;
  margin-bottom: 4px;
  color: #54a0ff;
}

.desc {
  color: #8395a7;
  font-size: 13px;
  margin-bottom: 24px;
}

.card {
  background: #1a2736;
  border: 1px solid #2d3b4a;
  border-radius: 10px;
  padding: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 12px;
  color: #8395a7;
}

.btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: #2d3b4a;
  color: #8395a7;
}

.btn:hover {
  background: #3d4b5a;
}

.log-box {
  max-height: 400px;
  overflow-y: auto;
  background: #0f1923;
  border-radius: 6px;
  padding: 8px;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 12px;
}

.empty {
  color: #566574;
  text-align: center;
  padding: 40px;
}

.log-item {
  display: flex;
  gap: 8px;
  padding: 3px 4px;
}

.log-time {
  color: #566574;
  flex-shrink: 0;
}

.log-text {
  color: #c8d6e5;
  word-break: break-all;
}
</style>
