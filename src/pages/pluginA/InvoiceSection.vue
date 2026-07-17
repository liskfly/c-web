<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElSelect, ElOption, ElTabs, ElTabPane, ElDialog, ElRadioGroup, ElRadio, ElInput, ElCheckbox, ElMessage, ElButton } from 'element-plus'
import { addUserInvoiceInfo, userInvoiceInfoList, setUserInvoiceInfo, delUserInvoiceInfo, setDefaultInvoice } from '@/api/invoice'

interface InvoiceItem {
  invoice_id: number
  invoice_type: number
  invoice_name: string
  tax_id: string
  is_default_invoice: number
  invoice_issuer: string
}

const props = defineProps<{ uid: string; token: string }>()
const invoiceType = ref('2')
const expanded = defineModel<boolean>('expanded', { default: true })
const invoiceList = ref<InvoiceItem[]>([])
const debugRes = ref<any>(null)
const debugReq = ref<any>(null)

defineExpose({ invoiceType })

// 获取 uid 后拉取发票列表
async function fetchList() {
  if (!props.token) return
  try {
    debugReq.value = { token: props.token ? '(已获取)' : '(空)', invoice_type: Number(invoiceType.value) }
    const res: any = await userInvoiceInfoList(props.token, { invoice_type: Number(invoiceType.value) })
    debugRes.value = res
    if (res.code === '10000') invoiceList.value = res.data || []
  } catch (e: any) { debugRes.value = e?.response?.data || e.message || String(e) }
}

async function setDefault(id: number) {
  try {
    const res: any = await setDefaultInvoice(props.token, id)
    if (res.code === '10000') { ElMessage.success(res.msg || '设置成功'); fetchList() }
    else { ElMessage.error(res.msg || '设置失败') }
  } catch { /* */ }
}

async function delInvoice(id: number) {
  try {
    const res: any = await delUserInvoiceInfo(props.token, id)
    if (res.code === '10000') { ElMessage.success(res.msg || '删除成功'); fetchList() }
    else { ElMessage.error(res.msg || '删除失败') }
  } catch { /* */ }
}

watch(() => props.uid, fetchList, { immediate: true })
watch(invoiceType, fetchList)

const hintText = `依据平台相关规则，一个账号仅支持填写一个企业主体信息。请您确认所填的企业抬头和税号与贵司税务登记证信息一致，避免因开票信息填写错误导致无法使用，给贵司带来损失。\n若当前存在已审核通过的公司开票信息，仅支持新增个人开票信息的开票信息。如有疑问，请联系客服。`

// ==================== Dialog 状态 ====================
const dialogVisible = ref(false)
const dialogTitle = ref('新增发票信息')
const editingId = ref(0)
const submitting = ref(false)
const activeTab = ref('special')
const form = ref({ invoiceSubject: 1, invoiceName: '', taxNo: '', isDefault: false })

// ==================== 打开 dialog ====================
function openDialog(invoice?: InvoiceItem) {
  form.value = {
    invoiceSubject: invoice?.invoice_issuer ? Number(invoice.invoice_issuer) : 1,
    invoiceName: invoice?.invoice_name || '',
    taxNo: invoice?.tax_id || '',
    isDefault: invoice?.is_default_invoice === 1,
  }
  activeTab.value = invoice?.invoice_type === 1 ? 'special' : 'normal'
  editingId.value = invoice?.invoice_id || 0
  dialogTitle.value = invoice ? '编辑发票信息' : '新增发票信息'
  dialogVisible.value = true
}

// ==================== 提交 ====================
async function handleConfirm() {
  if (!form.value.invoiceName) { ElMessage.warning('请填写公司名称'); return }
  if (!form.value.taxNo) { ElMessage.warning('请填写税号'); return }
  submitting.value = true
  try {
    const isSpecial = activeTab.value === 'special'
    const reqData = {
      invoice_type: isSpecial ? 1 : 2,
      invoice_name: form.value.invoiceName,
      tax_id: form.value.taxNo,
      is_default_invoice: form.value.isDefault ? 1 : 0,
      invoice_issuer: isSpecial ? undefined : form.value.invoiceSubject,
    }
    debugReq.value = reqData
    let res: any
    if (editingId.value) {
      res = await setUserInvoiceInfo(props.token, { invoice_id: editingId.value, ...reqData })
    } else {
      res = await addUserInvoiceInfo(props.token, reqData)
    }
    if (res.code === '10000') {
      ElMessage.success(res.msg || '新增成功')
      dialogVisible.value = false
      // 刷新列表
      await fetchList()
    } else {
      ElMessage.error(res.msg || '新增失败')
    }
  } catch { /* 拦截器已处理 */ }
  finally { submitting.value = false }
}
</script>

<template>
  <div class="extra-card">
    <div class="extra-title" @click="expanded = !expanded">
      📄 开票资料 <span class="arrow" :class="{ up: expanded }">▼</span>
    </div>
    <template v-if="expanded">
      <!-- 发票类型 -->
      <div style="padding:12px 16px;display:flex;align-items:center;gap:10px">
        <span style="font-size:11px;color:#888">发票类型</span>
        <el-select v-model="invoiceType" size="small" style="width:320px">
          <el-option label="数电增值税（专用）发票" value="1" />
          <el-option label="数电增值税（普通）发票" value="2" />
        </el-select>
      </div>
      <!-- 发票表格 -->
      <table class="invoice-table">
        <thead><tr><th>抬头</th><th>税号</th><th class="no-header"></th></tr></thead>
        <tbody>
          <tr v-if="invoiceList.length === 0"><td colspan="3" style="text-align:center;color:#ccc;padding:24px">暂无开票资料</td></tr>
          <tr v-for="item in invoiceList" :key="item.invoice_id">
            <td>{{ item.invoice_name }}</td>
            <td>{{ item.tax_id }}</td>
            <td style="white-space:nowrap;text-align:right">
              <button class="act-btn" :disabled="item.is_default_invoice === 1" @click.stop="setDefault(item.invoice_id)">设为默认</button>
              <button class="act-btn" @click.stop="openDialog(item)">编辑</button>
              <button class="act-btn act-del" @click.stop="delInvoice(item.invoice_id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div style="padding:12px 16px">
        <button class="btn-add-row" @click="openDialog()">+ 新增开票资料</button>
      </div>
    </template>

    <!-- 调试 -->
    <div style="margin:12px 16px;padding:12px;background:#f5f5f5;border-radius:4px;font-size:11px;max-height:300px;overflow:auto">
      <div><b>uid:</b> {{ props.uid || '(空)' }}</div>
      <div><b>token:</b> {{ props.token ? '已获取(' + props.token.substring(0, 20) + '...)' : '(空)' }}</div>
      <div v-if="debugReq"><b>请求参数:</b> <pre>{{ JSON.stringify(debugReq, null, 2) }}</pre></div>
      <div v-if="debugRes"><b>返回结果:</b> <pre>{{ JSON.stringify(debugRes, null, 2) }}</pre></div>
    </div>
  </div>

  <!-- ==================== Dialog ==================== -->
  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px" :close-on-click-modal="false">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="数电增值税（普通）发票" name="normal">
        <div class="hint-box">{{ hintText }}</div>
        <div class="form-row">
          <span class="form-label"><span class="req">*</span> 开票主体</span>
          <el-radio-group v-model="form.invoiceSubject">
            <el-radio :value="1">公司</el-radio>
            <el-radio :value="2">个人</el-radio>
          </el-radio-group>
        </div>
        <div class="form-row">
          <span class="form-label"><span class="req">*</span> 开票公司名称</span>
          <el-input v-model="form.invoiceName" size="small" placeholder="请输入" style="width:320px" />
        </div>
        <div class="form-row">
          <span class="form-label"><span class="req">*</span> 税号</span>
          <el-input v-model="form.taxNo" size="small" placeholder="请输入" style="width:320px" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="数电增值税（专用）发票" name="special">
        <div class="hint-box">{{ hintText }}</div>
        <div class="form-row">
          <span class="form-label"><span class="req">*</span> 开票公司名称</span>
          <el-input v-model="form.invoiceName" size="small" placeholder="请输入" style="width:320px" />
        </div>
        <div class="form-row">
          <span class="form-label"><span class="req">*</span> 税号</span>
          <el-input v-model="form.taxNo" size="small" placeholder="请输入" style="width:320px" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <div class="form-row">
      <el-checkbox v-model="form.isDefault">设置为默认发票</el-checkbox>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.extra-card { margin: 12px 16px; background: #fff; border-radius: 8px; border: 1px solid #e5e6eb; overflow: hidden; }
.extra-title { padding: 10px 16px; font-size: 13px; font-weight: 600; color: #2756ff; background: #f7f8fc; cursor: pointer; }
.arrow { float: right; font-size: 10px; color: #999; display: inline-block; }
.arrow.up { transform: rotate(-180deg); }
.invoice-table { width: calc(100% - 32px); margin: 0 16px; border-collapse: collapse; font-size: 12px; }
.invoice-table th { background: #f7f8fa; padding: 8px 10px; border: 1px solid #e5e6eb; text-align: left; font-weight: 600; color: #666; }
.invoice-table th.no-header { background: #fff; border: none; width: 160px; }
.invoice-table td { padding: 8px 10px; border: 1px solid #f0f0f0; }
.btn-add-row { padding: 4px 12px; border: 1px dashed #c4d8ff; border-radius: 4px; background: #f5f8ff; color: #2756ff; font-size: 11px; cursor: pointer; }

.hint-box { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 4px; padding: 10px 12px; font-size: 12px; color: #ad6800; line-height: 1.6; margin-bottom: 16px; white-space: pre-line; }
.form-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.form-label { font-size: 13px; color: #333; min-width: 120px; text-align: right; }
.req { color: #f53f3f; margin-right: 2px; }
.act-btn { border: 1px solid #d9d9d9; background: #fff; padding: 2px 10px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-left: 6px; color: #666; }
.act-btn:hover { border-color: #2756ff; color: #2756ff; }
.act-btn:disabled { color: #ccc; cursor: not-allowed; }
.act-btn.act-del { color: #f53f3f; border-color: #ffccc7; }
.act-btn.act-del:hover { background: #fff2f0; }
</style>
