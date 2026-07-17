<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { renderAsync } from 'docx-preview'
import { VueOfficePptx } from 'vue3-office-preview'
import 'vue3-office-preview/lib/style.css'
import SpreadsheetPreview from '@datagridxl/spreadsheet-preview'

type FileViewType = 'pdf' | 'word' | 'excel' | 'ppt' | 'text' | 'unsupported'

const fileName = ref('')
const fileType = ref<FileViewType>('unsupported')
const status = ref('等待 C++ 推送文件...')
const error = ref('')
const loading = ref(false)
const displayUrl = ref('')
const textContent = ref('')
const iframeRef = ref<HTMLIFrameElement>()
const docxContainer = ref<HTMLElement>()

// PPT 相关
const pptxSrc = ref('')

let currentBlobUrl = ''

// ==================== 类型映射 ====================
const excelExts = ['xlsx', 'xls', 'xlsm', 'csv']
const wordExts = ['docx', 'doc', 'rtf']
const pptExts = ['pptx', 'ppt']
const textExts = ['txt']
const pdfExts = ['pdf']

function detectFileType(ext: string): FileViewType {
  const t = ext.toLowerCase()
  if (pdfExts.includes(t)) return 'pdf'
  if (wordExts.includes(t)) return 'word'
  if (excelExts.includes(t)) return 'excel'
  if (pptExts.includes(t)) return 'ppt'
  if (textExts.includes(t)) return 'text'
  return 'unsupported'
}

// ==================== 基础工具 ====================
function base64ToBlobUrl(base64: string, mime: string): string {
  const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64
  const binary = atob(pureBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const pure = base64.includes(',') ? base64.split(',')[1] : base64
  const binary = atob(pure)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function getMime(ext: string): string {
  const t = ext.toLowerCase()
  if (pdfExts.includes(t)) return 'application/pdf'
  if (wordExts.includes(t)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (['xlsx', 'xlsm'].includes(t)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (t === 'xls') return 'application/vnd.ms-excel'
  if (t === 'csv') return 'text/csv'
  if (pptExts.includes(t)) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (t === 'txt') return 'text/plain'
  return 'application/octet-stream'
}

// ==================== PDF ====================
function waitForPdfApp(win: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let count = 0
    const timer = window.setInterval(() => {
      const app = win?.PDFViewerApplication
      if (app?.eventBus && app?.pdfViewer) { window.clearInterval(timer); resolve(app); return }
      if (++count > 100) { window.clearInterval(timer); reject(new Error('PDFViewerApplication 初始化超时')) }
    }, 100)
  })
}

let currentHighlight: { page: number; boxes: { x: number; y: number; w: number; h: number }[] } | null = null

async function handlePdfIframeLoad() {
  const iframe = iframeRef.value
  if (!iframe?.contentWindow) return
  try {
    const app = await waitForPdfApp(iframe.contentWindow)
    status.value = '已加载 PDF'

    // 画框逻辑
    if (currentHighlight) {
      const win = iframe.contentWindow as any
      app.eventBus.on('pagerendered', () => drawHighlightBoxes(app, win))
      setTimeout(() => drawHighlightBoxes(app, win), 500)
    }
  } catch (e: any) { error.value = e.message || 'PDF 初始化失败'; status.value = '加载失败' }
}

function drawHighlightBoxes(app: any, win: any) {
  if (!currentHighlight) return
  const { page, boxes } = currentHighlight
  const pageView = app.pdfViewer.getPageView(page - 1)
  if (!pageView?.div) return

  const pageDiv = pageView.div as HTMLElement
  if (win.getComputedStyle(pageDiv).position === 'static') {
    pageDiv.style.position = 'relative'
  }

  let layer = pageDiv.querySelector('.highlight-layer') as HTMLElement | null
  if (!layer) {
    layer = win.document.createElement('div')
    layer.className = 'highlight-layer'
    layer.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:50'
    pageDiv.appendChild(layer)
  }
  layer.innerHTML = ''

  boxes.forEach(b => {
    const box = win.document.createElement('div')
    box.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;border:2px solid red;background:rgba(255,0,0,0.08);box-sizing:border-box`
    layer!.appendChild(box)
  })
}

function loadPdf(page?: number) {
  const hash = page ? `#page=${page}` : ''
  displayUrl.value = `./pdfjs/web/viewer.html?file=${encodeURIComponent(currentBlobUrl)}${hash}`
}

// ==================== PPT → VueOfficePptx 渲染 ====================
function loadPpt(base64: string) {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64
  pptxSrc.value = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${clean}`
}

// ==================== Word → docx-preview 渲染 ====================
async function loadWord(base64: string) {
  await nextTick()
  if (!docxContainer.value) return
  docxContainer.value.innerHTML = ''
  const buffer = base64ToArrayBuffer(base64)
  await renderAsync(buffer, docxContainer.value, undefined, {
    className: 'docx-page',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    experimental: false,
    trimXmlDeclaration: true,
    useBase64URL: false,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
  })
}

// ==================== Excel → SpreadsheetPreview ====================
async function loadExcel() {
  await nextTick()
  const container = document.getElementById('excel-preview')
  if (!container) return
  container.innerHTML = ''
  new SpreadsheetPreview(container, {
    file: currentBlobUrl,
    height: '100%',
  })
}

// ==================== 纯文本 ====================
function loadText(base64: string) {
  const binary = atob(base64.includes(',') ? base64.split(',')[1] : base64)
  textContent.value = binary
}

// ==================== 入口 ====================
function loadFile(base64: string, name: string, ext: string) {
  // 重置所有展示状态
  loading.value = true
  error.value = ''
  displayUrl.value = ''
  textContent.value = ''
  pptxSrc.value = ''
  if (docxContainer.value) docxContainer.value.innerHTML = ''

  try {
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = '' }

    const type = detectFileType(ext)
    fileType.value = type
    fileName.value = name

    if (type === 'unsupported') {
      throw new Error('不支持的文件类型: .' + ext)
    }

    const mime = getMime(ext)
    currentBlobUrl = base64ToBlobUrl(base64, mime)

    switch (type) {
      case 'pdf':
        loadPdf(currentHighlight?.page)
        break
      case 'word':
        loadWord(base64)
        break
      case 'ppt':
        loadPpt(base64)
        break
      case 'excel':
        loadExcel()
        break
      case 'text':
        loadText(base64)
        break
    }

    status.value = '已加载'
  } catch (e: any) {
    error.value = '加载失败: ' + (e.message || e)
    status.value = '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  window.addEventListener('QtMessage', (event: any) => {
    const detail = event.detail
    if (!detail?.base64) return
    // detail = { base64: "...", name: "xxx", type: "pdf", json: { page: 1, bbox: [[90,229,152,241]] } }
    if (detail.json) {
      const h = detail.json
      currentHighlight = {
        page: h.page || 1,
        boxes: (h.bbox || []).map((b: number[]) => ({
          x: b[0], y: b[1],
          w: b[2] - b[0], h: b[3] - b[1],
        })),
      }
    } else {
      currentHighlight = null
    }
    loadFile(detail.base64, detail.name || '未知文件', detail.type || '')
  })
})

onBeforeUnmount(() => {
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
})
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <span class="label">文件查看器</span>
      <span v-if="fileType !== 'unsupported'" class="type-badge">{{ fileType.toUpperCase() }}</span>
      <span class="status">{{ status }}</span>
      <span v-if="loading" class="loading-tag">加载中...</span>
      <span v-if="fileName" class="file-name">{{ fileName }}</span>
    </div>

    <div class="viewer">
      <div v-if="error" class="error-msg">{{ error }}</div>

      <!-- PDF -->
      <iframe
        v-if="displayUrl && fileType === 'pdf'"
        ref="iframeRef"
        class="doc-frame"
        :src="displayUrl"
        frameborder="0"
        @load="handlePdfIframeLoad()"
      />

      <!-- Word -->
      <div v-else-if="fileType === 'word'" class="docx-viewer">
        <div ref="docxContainer" class="docx-container" />
      </div>

      <!-- PPT -->
      <div v-else-if="fileType === 'ppt'" class="ppt-viewer">
        <VueOfficePptx v-if="pptxSrc" :src="pptxSrc" style="width:100%;height:100%" @error="(e: any) => { error = 'PPT 渲染失败: ' + (e.message || e) }" />
      </div>

      <!-- Excel -->
      <div v-else-if="fileType === 'excel'" class="excel-viewer">
        <div id="excel-preview" style="width:100%;height:100%"></div>
      </div>

      <!-- 纯文本 -->
      <div v-else-if="fileType === 'text'" class="text-viewer">
        <pre class="text-content">{{ textContent }}</pre>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading" class="empty">
        <p>暂无文件</p>
        <p class="hint">等待 C++ 端推送文件数据...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { height: 100vh; display: flex; flex-direction: column; background: #f5f6fa; }

.toolbar { display: flex; align-items: center; gap: 10px; padding: 10px 20px; background: #fff; border-bottom: 1px solid #e5e6eb; font-size: 13px; flex-shrink: 0; }
.label { font-weight: 600; color: #333; }
.type-badge { font-size: 10px; font-weight: 600; padding: 1px 8px; border-radius: 3px; background: #e8f0ff; color: #2756ff; }
.status { color: #2756ff; font-size: 12px; }
.loading-tag { color: #d46b08; font-size: 12px; }
.file-name { color: #999; font-size: 11px; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 360px; }

.viewer { flex: 1; overflow: hidden; position: relative; }

.doc-frame { width: 100%; height: 100%; border: none; }

/* PPT */
.ppt-viewer { width: 100%; height: 100%; }

/* Excel */
.excel-viewer { width: 100%; height: 100%; display: flex; flex-direction: column; background: #fff; }
.empty-inner { display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 14px; }

/* 纯文本 */
/* Word */
.docx-viewer { width: 100%; height: 100%; overflow: auto; background: #e8e8e8; }
.docx-container { min-height: 100%; display: flex; justify-content: center; padding: 20px; }
.docx-container :deep(.docx-page) { background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.15); margin: 0 auto 20px; padding: 40px 50px; max-width: 820px; min-height: 100px; }

.text-viewer { width: 100%; height: 100%; overflow: auto; background: #fff; }
.text-content { padding: 16px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }

.error-msg { padding: 10px 20px; background: #fff2f0; color: #f53f3f; font-size: 13px; }

.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 14px; }
.hint { font-size: 12px; color: #ccc; margin-top: 6px; }
</style>
