import request from '@/request/request'

interface OrderCreatePayload {
  task_id: string
  receiver_id: number
  invoice_id: number
  invoice_type: number
  freight_price: number
  task_audit_status?: number
  audit_control_reasons?: string
  pcbQuoteParams: Record<string, any>
}

/** 创建订单 */
export function orderCreate(token: string, data: OrderCreatePayload) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/elecnest/OrderCreate',
    method: 'post',
    data,
    headers: { Authorization: token },
  })
}

/** 创建 PCB 模型（DeepLine 流程） */
export function pcbModelIdCreate(token: string, data: OrderCreatePayload) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/elecnest/PCBModelIDCreate',
    method: 'post',
    data,
    headers: { Authorization: token },
  })
}

/** 未付款转人工审核回调 */
export function unpaidAuditCallback(data: { taskId: string; order_no: string }) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/elecnest/UnpaidAuditCallback',
    method: 'post',
    data,
  })
}

/** 支付回调 */
export function payCallback(token: string, data: {
  taskId: string
  order_no: string
  isPayed: boolean
}) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/elecnest/PayCallback',
    method: 'post',
    data,
    headers: { Authorization: token },
  })
}

/** 更新订单状态 */
export function updateOrderStatus(data: { task_id: string }) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/elecnest/UpdateOrderStatus',
    method: 'post',
    data,
  })
}

/** 获取旧报价 */
export function getOrderPriceQuery(data: { task_id: string }) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/elecnest/OrderPriceQuery',
    method: 'post',
    data,
  })
}

/** 获取线上报价参数 */
export function getOnlineQuoteParamsInfo(data: { task_id: string }) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/pcb/getOnlineQuoteParamsInfo',
    method: 'post',
    data,
  })
}

/** 获取报价信息（离线） */
export function getQuoteInfoOffline(data: { taskId: string; pcbQuoteParams: Record<string, any> }) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/pcb/getQuoteInfoOffline',
    method: 'post',
    data,
  })
}

/** 获取报价信息（DeepLine 纯离线流程） */
export function getQuoteInfoOfflinePure(data: { taskId: string; pcbQuoteParams: Record<string, any> }) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/pcb/getQuoteInfoOfflinePure',
    method: 'post',
    data,
  })
}

/** 审核确认通知 */
export function submitTransferNotify(data: { task_id: string; user_id: string }) {
  return request({
    errorSource: 'asem',
    url: '/proxy-notify/api/v1/transfer/files/notify',
    method: 'post',
    data,
  })
}

interface OnlineManualAiIdentity {
  uid: string
  userName?: string
}

interface SubmitManualRegionParamsAnalysisPayload extends OnlineManualAiIdentity {
  parentTaskId: string
  file: File
}

interface QueryManualRegionParamsAnalysisPayload extends OnlineManualAiIdentity {
  manualTaskId: string
}

interface SubmitManualRegionParamsAnalysisOfflinePayload {
  parentTaskId: string
  file: File
  deeplineUsername: string
}

interface QueryManualRegionParamsAnalysisOfflinePayload {
  manualTaskId: string
  deeplineUsername: string
}

function onlineManualAiHeaders(identity: OnlineManualAiIdentity) {
  return {
    Uid: identity.uid,
    ...(identity.userName ? { Uname: encodeURIComponent(identity.userName) } : {}),
  }
}

/** 提交线上手动区域 AI 提参任务。参数类型由 PDF 文件名前缀决定。 */
export function submitManualRegionParamsAnalysis(data: SubmitManualRegionParamsAnalysisPayload) {
  const formData = new FormData()
  formData.append('parentTaskId', data.parentTaskId)
  formData.append('file', data.file)
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/pcb/ManualRegionParamsAnalysis',
    method: 'post',
    data: formData,
    headers: onlineManualAiHeaders(data),
  })
}

/** 查询线上手动区域 AI 提参任务状态。 */
export function getManualRegionParamsAnalysisStatusInfo(data: QueryManualRegionParamsAnalysisPayload) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/pcb/getManualRegionParamsAnalysisStatusInfo',
    method: 'post',
    data: { manualTaskId: data.manualTaskId },
    headers: {
      ...onlineManualAiHeaders(data),
      // 轮询期间由页面自己的整页锁定层展示状态，避免全局 loading 每两秒闪烁。
      __silent: '1',
    },
  })
}


/** 提交线下手动区域 AI 提参任务。 */
export function submitManualRegionParamsAnalysisOffline(data: SubmitManualRegionParamsAnalysisOfflinePayload) {
  const formData = new FormData()
  formData.append('parentTaskId', data.parentTaskId)
  formData.append('file', data.file)
  formData.append('deepline_username', data.deeplineUsername)
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/pcb/ManualRegionParamsAnalysisOffline',
    method: 'post',
    data: formData,
  })
}

/** 查询线下手动区域 AI 提参任务状态。 */
export function getManualRegionParamsAnalysisStatusInfoOffline(
  data: QueryManualRegionParamsAnalysisOfflinePayload,
) {
  return request({
    errorSource: 'asem',
    url: '/proxy/asem/pcb/getManualRegionParamsAnalysisStatusInfoOffline',
    method: 'post',
    data: {
      manualTaskId: data.manualTaskId,
      deepline_username: data.deeplineUsername,
    },
    headers: { __silent: '1' },
  })
}
