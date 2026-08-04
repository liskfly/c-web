import request from '@/request/request'

/** 创建订单 */
export function orderCreate(token: string, data: {
  task_id: string
  receiver_id: number
  invoice_id: number
  invoice_type: number
  freight_price: number
  pcbQuoteParams: Record<string, any>
}) {
  return request({
    url: '/proxy/asem/elecnest/OrderCreate',
    method: 'post',
    data,
    headers: { Authorization: token },
  })
}

/** 支付回调 */
export function payCallback(token: string, data: {
  taskId: string
  order_no: string
  isPayed: boolean
}) {
  return request({
    url: '/proxy/asem/elecnest/PayCallback',
    method: 'post',
    data,
    headers: { Authorization: token },
  })
}

/** 更新订单状态 */
export function updateOrderStatus(data: { task_id: string }) {
  return request({
    url: '/proxy/asem/elecnest/UpdateOrderStatus',
    method: 'post',
    data,
  })
}

/** 获取旧报价 */
export function getOrderPriceQuery(data: { task_id: string }) {
  return request({
    url: '/proxy/asem/elecnest/OrderPriceQuery',
    method: 'post',
    data,
  })
}

/** 获取线上报价参数 */
export function getOnlineQuoteParamsInfo(data: { task_id: string }) {
  return request({
    url: '/proxy/asem/pcb/getOnlineQuoteParamsInfo',
    method: 'post',
    data,
  })
}

/** 获取报价信息（离线） */
export function getQuoteInfoOffline(data: { taskId: string; pcbQuoteParams: Record<string, any> }) {
  return request({
    url: '/proxy/asem/pcb/getQuoteInfoOffline',
    method: 'post',
    data,
  })
}

/** 审核确认通知 */
export function submitTransferNotify(data: { task_id: string; user_id: string }) {
  return request({
    url: '/proxy-notify/api/v1/transfer/files/notify',
    method: 'post',
    data,
  })
}

