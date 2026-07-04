<script setup lang="ts">
import { ref } from 'vue'
import { getBridge } from '@/shared/bridge'

const inputText = ref('')
const responseText = ref('')

async function sendToBackend() {
  if (!inputText.value.trim()) return
  const bridge = await getBridge()
  if (typeof bridge.sendToBackend === 'function') {
    bridge.sendToBackend(inputText.value)
    responseText.value = `已发送: ${inputText.value}`
    inputText.value = ''
  }
}
</script>

<template>
  <div class="page">
    <h2>⚙️ 插件 B — 配置管理</h2>
    <p class="desc">向前端发指令到 C++ 后端执行</p>

    <div class="card">
      <div class="row">
        <input
          v-model="inputText"
          placeholder="输入要发送给 C++ 的指令..."
          @keydown.enter="sendToBackend"
        />
        <button class="btn" @click="sendToBackend">发送到 C++</button>
      </div>

      <div v-if="responseText" class="response">
        <pre>{{ responseText }}</pre>
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
  padding: 20px;
}

.row {
  display: flex;
  gap: 8px;
}

input {
  flex: 1;
  background: #0f1923;
  border: 1px solid #2d3b4a;
  border-radius: 6px;
  padding: 8px 10px;
  color: #c8d6e5;
  font-size: 13px;
  outline: none;
}

input:focus {
  border-color: #54a0ff;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  background: #54a0ff;
  color: #fff;
  white-space: nowrap;
}

.btn:hover {
  background: #3d8af0;
}

.response {
  margin-top: 16px;
  padding: 12px;
  background: #0f1923;
  border-radius: 6px;
}

pre {
  color: #28a745;
  font-size: 13px;
}
</style>
