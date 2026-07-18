<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElInput, ElDialog, ElCheckbox, ElMessage, ElButton, ElCascader } from 'element-plus'
import { userReceiptInfoList, addUserReceiptInfo, getAreaList, setUserReceiptInfo, setDefaultAddress, delUserReceiptInfo } from '@/api/invoice'

interface AddressItem {
  receipt_id: number
  province_name: string; city_name: string; area_name: string
  detailed_address: string; consignee_name: string; phone: string
  is_default_address: number
}
interface AreaNode { id: number; pid: number; name: string; childlist: AreaNode[] }

const props = defineProps<{ token: string }>()
const expanded = defineModel<boolean>('expanded', { default: true })
const addressList = ref<AddressItem[]>([])
const selectedAddrId = ref(0)

defineExpose({ selectedAddrId })
const cascaderOptions = ref<any[]>([])
const rawAreas = ref<AreaNode[]>([])

async function fetchList() {
  if (!props.token) return
  try { const res: any = await userReceiptInfoList(props.token); if (res.code === '10000') {
    addressList.value = res.data || []
    const def = addressList.value.find(a => a.is_default_address === 1)
    if (def) selectedAddrId.value = def.receipt_id
    else if (addressList.value.length) selectedAddrId.value = addressList.value[0].receipt_id
  }}
  catch { /* */ }
}
async function delAddress(id: number) {
  try {
    const res: any = await delUserReceiptInfo(props.token, id)
    if (res.code === '10000') { ElMessage.success(res.msg || '删除成功'); fetchList() }
    else { ElMessage.error(res.msg || '删除失败') }
  } catch { /* */ }
}

async function setDefault(id: number) {
  try {
    const res: any = await setDefaultAddress(props.token, id)
    if (res.code === '10000') { ElMessage.success(res.msg || '设置成功'); fetchList() }
    else { ElMessage.error(res.msg || '设置失败') }
  } catch { /* */ }
}

async function fetchAreas() {
  console.log('fetchAreas token=', !!props.token, 'len=', rawAreas.value.length)
  if (!props.token || rawAreas.value.length) return
  try { const res: any = await getAreaList(props.token); if (res.code === '10000') { rawAreas.value = res.data || []; cascaderOptions.value = toCascader(rawAreas.value) } }
  catch { /* */ }
}
watch(() => props.token, (t) => { if (t) { fetchList(); fetchAreas() } }, { immediate: true })

// ==================== 新增/编辑地址 Dialog ====================
const dialogVisible = ref(false)
const dialogTitle = ref('新增收货地址')
const submitting = ref(false)
const editingId = ref(0)
const selectedArea = ref<number[]>([])
const form = ref({ detailed_address: '', consignee_name: '', phone: '', is_default: false })

function toCascader(list: AreaNode[]): any[] {
  return list.map(item => ({
    value: item.id, label: item.name,
    children: item.childlist?.length ? toCascader(item.childlist) : undefined,
  }))
}

// 从 area 数据中根据名称递归查找 ID
function findAreaId(list: AreaNode[], name: string): number {
  for (const item of list) {
    if (item.name === name) return item.id
    if (item.childlist?.length) {
      const found = findAreaId(item.childlist, name)
      if (found) return found
    }
  }
  return 0
}

async function openDialog(addr?: AddressItem) {
  form.value = { detailed_address: addr?.detailed_address || '', consignee_name: addr?.consignee_name || '', phone: addr?.phone || '', is_default: addr?.is_default_address === 1 }
  selectedArea.value = []
  editingId.value = addr?.receipt_id || 0
  dialogTitle.value = addr ? '编辑收货地址' : '新增收货地址'
  // 编辑时，根据地名反查 ID 填入 cascader
  if (addr && rawAreas.value.length) {
    const pNode = rawAreas.value.find(a => a.name === addr.province_name)
    const cNode = pNode?.childlist?.find(a => a.name === addr.city_name)
    const aNode = cNode?.childlist?.find(a => a.name === addr.area_name)
    const pId = pNode?.id || 0
    const cId = cNode?.id || 0
    const aId = aNode?.id || 0
    console.log('findAreaId:', { province: addr.province_name, pId }, { city: addr.city_name, cId }, { area: addr.area_name, aId })
    if (pId && cId && aId) selectedArea.value = [pId, cId, aId]
  } else {
    console.log('rawAreas empty or no addr', { hasAddr: !!addr, areasLen: rawAreas.value.length })
  }
  dialogVisible.value = true
}

async function handleConfirm() {
  if (selectedArea.value.length !== 3) { ElMessage.warning('请选择所在地区'); return }
  if (!form.value.detailed_address) { ElMessage.warning('请填写详细地址'); return }
  if (!form.value.consignee_name) { ElMessage.warning('请填写收货人'); return }
  if (!form.value.phone) { ElMessage.warning('请填写手机号'); return }
  submitting.value = true
  try {
    const params = {
      province_id: selectedArea.value[0], city_id: selectedArea.value[1], area_id: selectedArea.value[2],
      detailed_address: form.value.detailed_address, consignee_name: form.value.consignee_name,
      phone: form.value.phone, is_default_address: form.value.is_default ? 1 : 0,
    }
    let res: any
    if (editingId.value) {
      res = await setUserReceiptInfo(props.token, { receipt_id: editingId.value, ...params })
    } else {
      res = await addUserReceiptInfo(props.token, params)
    }
    if (res.code === '10000') { ElMessage.success(res.msg || (editingId.value ? '编辑成功' : '新增成功')); dialogVisible.value = false; fetchList() }
    else { ElMessage.error(res.msg || '操作失败') }
  } catch { /* */ }
  finally { submitting.value = false }
}
</script>

<template>
  <div class="extra-card">
    <div class="extra-title" @click="expanded = !expanded">
      🚚 配送信息 <span class="arrow" :class="{ up: expanded }">▼</span>
      <button class="add-addr-btn" @click.stop="openDialog()">+ 添加地址</button>
    </div>
    <template v-if="expanded">
      <div style="padding:12px 16px">
        <div v-if="addressList.length === 0" style="text-align:center;color:#ccc;padding:24px">暂无地址信息</div>
        <div v-for="item in addressList" :key="item.receipt_id" class="addr-card">
          <input type="radio" name="selectedAddr" :checked="selectedAddrId === item.receipt_id" @change="selectedAddrId = item.receipt_id" style="flex-shrink:0;margin-right:12px" />
          <div class="addr-left">
            <div class="addr-row1">
              <span class="addr-name">{{ item.consignee_name }}</span>
              <span class="addr-phone">{{ item.phone }}</span>
            </div>
            <div class="addr-row2">{{ item.province_name }}-{{ item.city_name }}-{{ item.area_name }}-{{ item.detailed_address }}</div>
          </div>
          <div class="addr-actions">
            <button class="act-btn" :disabled="item.is_default_address === 1" @click.stop="setDefault(item.receipt_id)">设为默认</button>
            <button class="act-btn" @click.stop="openDialog(item)">编辑</button>
            <button class="act-btn act-del" @click.stop="delAddress(item.receipt_id)">删除</button>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- Dialog -->
  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" :close-on-click-modal="false">
    <div class="form-item">
      <span class="form-label"><span class="req">*</span> 所在地区</span>
      <el-cascader v-model="selectedArea" :options="cascaderOptions" size="small" placeholder="请选择省/市/区" style="flex:1" clearable />
    </div>
    <div class="form-item">
      <span class="form-label"><span class="req">*</span> 详细地址</span>
      <el-input v-model="form.detailed_address" size="small" style="flex:1" placeholder="请输入" />
    </div>
    <div class="form-item">
      <span class="form-label"><span class="req">*</span> 收货人</span>
      <el-input v-model="form.consignee_name" size="small" style="flex:1" placeholder="请输入" />
    </div>
    <div class="form-item">
      <span class="form-label"><span class="req">*</span> 手机号</span>
      <el-input v-model="form.phone" size="small" style="flex:1" placeholder="请输入" />
    </div>
    <div class="form-item">
      <span class="form-label"></span>
      <el-checkbox v-model="form.is_default">设置为默认收货地址</el-checkbox>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleConfirm">确认</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.extra-card { margin: 12px 16px; background: #fff; border-radius: 8px; border: 1px solid #e5e6eb; overflow: hidden; }
.extra-title { padding: 10px 16px; font-size: 13px; font-weight: 600; color: #2756ff; background: #f7f8fc; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.arrow { font-size: 10px; color: #999; display: inline-block; }
.arrow.up { transform: rotate(-180deg); }
.add-addr-btn { margin-left: auto; padding: 3px 12px; border: 1px dashed #c4d8ff; border-radius: 4px; background: #f5f8ff; color: #2756ff; font-size: 11px; cursor: pointer; }
.addr-card { display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 8px; border: 1px solid #e5e6eb; border-radius: 6px; background: #fafbfc; }
.addr-left { flex: 1; min-width: 0; }
.addr-row1 { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.addr-name { font-size: 13px; font-weight: 600; color: #333; }
.addr-phone { font-size: 13px; color: #666; }
.addr-tag { font-size: 10px; padding: 1px 6px; background: #e8f0ff; color: #2756ff; border-radius: 2px; }
.addr-row2 { font-size: 12px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.addr-actions { flex-shrink: 0; margin-left: 12px; white-space: nowrap; }
.act-btn { border: 1px solid #d9d9d9; background: #fff; padding: 2px 10px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-left: 6px; color: #666; }
.act-btn:hover { border-color: #2756ff; color: #2756ff; }
.act-btn:disabled { color: #ccc; cursor: not-allowed; }
.act-btn.act-del { color: #f53f3f; border-color: #ffccc7; }
.act-btn.act-del:hover { background: #fff2f0; }
.form-item { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.form-label { font-size: 13px; color: #333; min-width: 80px; text-align: right; flex-shrink: 0; }
.req { color: #f53f3f; margin-right: 2px; }
</style>
