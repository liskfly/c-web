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

