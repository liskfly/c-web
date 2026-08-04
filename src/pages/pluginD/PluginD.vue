<script setup lang="ts">
import { ref } from 'vue'

const iframeSrc = ref('')
const status = ref('')
const uploading = ref(false)
const selectedFile = ref<File | null>(null)

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

async function startAnalysis() {
  if (!selectedFile.value || uploading.value) return
  uploading.value = true
  iframeSrc.value = ''

  try {
    // 1. 上传文件分析
    status.value = '正在上传文件...'
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('is4Test', 'true')
    formData.append('notify_deepline', 'true')

    const uploadRes = await fetch('/proxy/asem/pcb/ParamsAnalysis4test', {
      method: 'POST',
      body: formData,
    })
    const uploadResult = await uploadRes.json()
    if (uploadResult.code !== 200) throw new Error(uploadResult.message || '分析任务提交失败')

    const taskId = uploadResult.data.taskId
    status.value = `任务已提交，正在分析中...`

    // 2. 轮询分析状态
    const data = await new Promise<any>((resolve, reject) => {
      let count = 0
      const timer = setInterval(async () => {
        try {
          const res = await fetch('/proxy/asem/pcb/getAnalyzeStatusInfo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId }),
          })
          const json = await res.json()
          const d = json.data
          if (d.status === 'SUCCESS') {
            clearInterval(timer)
            resolve(d)
          } else if (d.status === 'FAILED') {
            clearInterval(timer)
            reject(new Error(json.message || '分析失败'))
          } else {
            status.value = `分析中... ${Math.round((d.progress || 0) * 100)}%`
            if (++count > 300) {
              clearInterval(timer)
              reject(new Error('分析超时'))
            }
          }
        } catch { /* 网络异常继续轮询 */ }
      }, 2000)
    })

    // 3. 获取 viewerUrl
    status.value = '正在获取预览地址...'
    const viewerRes = await fetch('/proxy/asem/pcb/getDockerInfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    })
    const viewerJson = await viewerRes.json()
    const viewerUrl = viewerJson.data?.dockerInfo?.viewerUrl
    if (!viewerUrl) throw new Error('未获取到 viewerUrl')
    iframeSrc.value = 'http://10.0.18.99' + viewerUrl;
    status.value = '加载完成'
  } catch (e: any) {
    status.value = '分析失败: ' + (e.message || e)
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div style="display:flex;flex-direction:column;height:100vh">
    <div style="height:60px;line-height:60px;background:#1a2736;color:#fff;padding:0 16px;font-size:14px;flex-shrink:0;display:flex;gap:16px;align-items:center">
      <span>VM Viewer</span>
      <span style="font-size:12px;color:#8395a7">|</span>
      <label style="font-size:12px;color:#54a0ff;cursor:pointer;line-height:60px">
        <input type="file" style="display:none" @change="handleFileChange" />
        {{ selectedFile ? selectedFile.name : '选择文件' }}
      </label>
      <button
        :disabled="!selectedFile || uploading"
        @click="startAnalysis"
        style="padding:4px 16px;background:#54a0ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;line-height:normal"
        :style="{ opacity: !selectedFile || uploading ? 0.5 : 1, cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer' }"
      >
        {{ uploading ? '分析中...' : '开始分析' }}
      </button>
      <span style="font-size:12px;color:#8395a7;line-height:60px;flex:1">{{ status }}</span>
    </div>
    <iframe v-if="iframeSrc" :src="iframeSrc" style="display:block;width:100%;flex:1;border:none" />
    <div v-else style="flex:1;display:flex;align-items:center;justify-content:center;color:#8395a7;font-size:14px">
      {{ selectedFile ? '点击"开始分析"上传文件' : '请选择文件开始分析' }}
    </div>
  </div>
</template>
