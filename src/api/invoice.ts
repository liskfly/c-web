import request from '@/request/request'

// ==================== 发票 ====================

/** 获取用户发票信息列表 */
export function userInvoiceInfoList(token: string, params: {
  invoice_type: number
}) {
  return request({
    url: '/aishop/api/invoice/userInvoiceInfoListV2',
    method: 'get',
    params,
    headers: { Authorization: token },
  })
}

/** 设置默认发票 */
export function setDefaultInvoice(token: string, invoice_id: number) {
  return request({
    url: '/aishop/api/invoice/setDefaultInvoiceV2',
    method: 'post',
    data: { invoice_id },
    headers: { Authorization: token },
  })
}

/** 删除发票 */
export function delUserInvoiceInfo(token: string, invoice_id: number) {
  return request({
    url: '/aishop/api/invoice/delUserInvoiceInfoV2',
    method: 'post',
    data: { invoice_id },
    headers: { Authorization: token },
  })
}

/** 修改开票资料 */
export function setUserInvoiceInfo(token: string, data: {
  invoice_id: number; invoice_type: number; invoice_name: string
  tax_id: string; is_default_invoice: number; invoice_issuer?: number
}) {
  return request({
    url: '/aishop/api/invoice/setUserInvoiceInfoV2',
    method: 'post',
    data,
    headers: { Authorization: token },
  })
}

/** 新增开票资料 */
export function addUserInvoiceInfo(token: string, data: {
  invoice_type: number
  invoice_name: string
  tax_id: string
  is_default_invoice: number
  invoice_issuer?: number
}) {
  return request({
    url: '/aishop/api/invoice/addUserInvoiceInfoV2',
    method: 'post',
    data,
    headers: { Authorization: token },
  })
}

// ==================== 配送地址 ====================

/** 获取用户地址列表 */
export function userReceiptInfoList(token: string) {
  return request({
    url: '/aishop/api/receipt/userReceiptInfoListV2',
    method: 'get',
    headers: { Authorization: token },
  })
}

/** 新增收货地址 */
export function addUserReceiptInfo(token: string, data: {
  province_id: number; city_id: number; area_id: number
  detailed_address: string; consignee_name: string; phone: string
  is_default_address: number
}) {
  return request({
    url: '/aishop/api/receipt/addUserReceiptInfoV2',
    method: 'post',
    data,
    headers: { Authorization: token },
  })
}

/** 设置默认收货地址 */
export function setDefaultAddress(token: string, receipt_id: number) {
  return request({
    url: '/aishop/api/receipt/setDefaultAddressV2',
    method: 'post',
    data: { receipt_id },
    headers: { Authorization: token },
  })
}

/** 删除用户收货信息 */
export function delUserReceiptInfo(token: string, receipt_id: number) {
  return request({
    url: '/aishop/api/receipt/delUserReceiptInfoV2',
    method: 'post',
    data: { receipt_id },
    headers: { Authorization: token },
  })
}

/** 发起支付 */
export function pcbPayV2(token: string, data: { order_no: string }) {
  return request({
    url: '/aishop/api/pay/pcbPayV2',
    method: 'post',
    data,
    headers: { Authorization: token },
  })
}

/** 轮询获取PCB订单支付状态 */
export function getPcbOrderStatusV2(token: string, params: { merge_order_no: string }) {
  return request({
    url: '/aishop/api/pay/getPcbOrderStatusV2',
    method: 'get',
    params,
    headers: { Authorization: token, __silent: '1' },
  })
}

/** 获取省市区地址列表 */
export function getAreaList(token: string) {
  return request({ url: '/aishop/api/area/getAreaListV2', method: 'get', headers: { Authorization: token } })
}

/** 编辑收货地址 */
export function setUserReceiptInfo(token: string, data: {
  receipt_id: number
  province_id: number; city_id: number; area_id: number
  detailed_address: string; consignee_name: string; phone: string
  is_default_address: number
}) {
  return request({
    url: '/aishop/api/receipt/setUserReceiptInfoV2',
    method: 'post',
    data,
    headers: { Authorization: token },
  })
}
