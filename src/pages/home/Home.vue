<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getBridge, isBridgeReady } from '@/shared/bridge'

const router = useRouter()
const bridgeStatus = ref('检测中...')

onMounted(async () => {
  try {
    await getBridge()
    bridgeStatus.value = isBridgeReady() ? '已连接' : 'Mock 模式'
  } catch {
    bridgeStatus.value = '连接失败'
  }
})

const plugins = [
  { path: '/plugin-a', name: '插件 A', desc: '数据仪表盘 / 监控面板' },
  { path: '/plugin-b', name: '插件 B', desc: '配置管理 / 参数设置' },
  { path: '/plugin-c', name: '插件 C', desc: '日志查看 / 调试工具' },
]
</script>

<template>
  <div class="home">
    <h1>asem 插件中心</h1>
    <p class="subtitle">Bridge 状态：<span class="status">{{ bridgeStatus }}</span></p>

    <div class="plugin-list">
      <div
        v-for="p in plugins"
        :key="p.path"
        class="plugin-card"
        @click="router.push(p.path)"
      >
        <h3>{{ p.name }}</h3>
        <p>{{ p.desc }}</p>
        <span class="arrow">→</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  max-width: 700px;
  margin: 0 auto;
}

h1 {
  font-size: 24px;
  margin-bottom: 8px;
  color: #54a0ff;
}

.subtitle {
  color: #8395a7;
  margin-bottom: 32px;
  font-size: 14px;
}

.status {
  color: #28a745;
  font-weight: 600;
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plugin-card {
  background: #1a2736;
  border: 1px solid #2d3b4a;
  border-radius: 10px;
  padding: 20px 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: border-color 0.2s, background 0.2s;
}

.plugin-card:hover {
  border-color: #54a0ff;
  background: #1f3042;
}

.plugin-card h3 {
  color: #54a0ff;
  font-size: 16px;
  white-space: nowrap;
}

.plugin-card p {
  color: #8395a7;
  font-size: 13px;
  flex: 1;
}

.arrow {
  color: #566574;
  font-size: 18px;
  transition: color 0.2s;
}

.plugin-card:hover .arrow {
  color: #54a0ff;
}
</style>
