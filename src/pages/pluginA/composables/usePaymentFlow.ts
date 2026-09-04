import { ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { payCallback } from '@/api/pcb'
import { getPcbOrderStatusV2 } from '@/api/invoice'
import { withErrorSource, type ErrorSource } from '@/utils/errorSource'

interface PaymentFlowOptions {
  form: Record<string, any>
  taskId: Ref<string>
  userToken: Ref<string>
  computedDrillDensity: ComputedRef<string>
  isComponentActive: () => boolean
  generatePayQr: (orderNo: string) => Promise<{ qrUrl: string; mergeOrderNo: string; timeExpire: number }>
  formatDimensionTolerance: () => string
  reportError: (context: string, error: unknown, message: string, source?: ErrorSource) => void
}

function normalizeExpireTimestamp(value: unknown): number {
  const now = Math.floor(Date.now() / 1000)
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return now + 300
  return Math.floor(numeric > 1_000_000_000_000 ? numeric / 1000 : numeric)
}

export function usePaymentFlow(options: PaymentFlowOptions) {
  const {
    form, taskId, userToken, computedDrillDensity, isComponentActive,
    generatePayQr, formatDimensionTolerance, reportError,
  } = options

  const qrVisible = ref(false); const qrCodeUrl = ref(''); const qrExpired = ref(false); const qrCountdown = ref(0); const qrOrderNo = ref(''); const qrRefreshing = ref(false)
  let pollTimer: number | null = null
  let countdownTimer: number | null = null
  let pollRequestPending = false
  let pollSessionId = 0
  let pollErrorNotified = false

  function clearTimers() {
    // 会话编号失效后，已经发出的旧请求即使返回也不能更新当前二维码。
    pollSessionId++
    if (pollTimer !== null) window.clearInterval(pollTimer)
    if (countdownTimer !== null) window.clearInterval(countdownTimer)
    pollTimer = null
    countdownTimer = null
    pollRequestPending = false
    qrRefreshing.value = false
  }

  function isQrFlowActive(sessionId: number, orderNo: string): boolean {
    return isComponentActive() && qrVisible.value && pollSessionId === sessionId && qrOrderNo.value === orderNo
  }

  async function refreshQrCode() {
    if (qrRefreshing.value) return
    clearTimers()
    const refreshSessionId = pollSessionId
    const refreshOrderNo = qrOrderNo.value
    qrRefreshing.value = true
    qrExpired.value = false
    try {
      try {
        const { qrUrl, mergeOrderNo, timeExpire } = await generatePayQr(refreshOrderNo)
        if (!isQrFlowActive(refreshSessionId, refreshOrderNo)) return
        qrCodeUrl.value = qrUrl
        startPollPayStatus(mergeOrderNo, timeExpire)
      } catch (err: any) {
        if (isQrFlowActive(refreshSessionId, refreshOrderNo)) {
          ElMessage.error(withErrorSource('电巢', err.message, '刷新失败'))
        }
      }
    } catch (error) {
      if (isQrFlowActive(refreshSessionId, refreshOrderNo)) {
        qrExpired.value = true
        reportError('刷新二维码', error, '刷新二维码失败，请稍后重试')
      }
    } finally {
      if (pollSessionId === refreshSessionId) qrRefreshing.value = false
    }
  }

  function startPollPayStatus(mergeNo: string, expireTimestamp: number) {
    clearTimers()
    qrExpired.value = false
    pollErrorNotified = false
    const sessionId = pollSessionId
    const expireAt = normalizeExpireTimestamp(expireTimestamp)
    qrCountdown.value = Math.max(0, expireAt - Math.floor(Date.now() / 1000))

    if (qrCountdown.value <= 0) {
      qrExpired.value = true
      return
    }

    countdownTimer = window.setInterval(() => {
      qrCountdown.value = Math.max(0, expireAt - Math.floor(Date.now() / 1000))
      if (qrCountdown.value <= 0) {
        clearTimers()
        qrExpired.value = true
      }
    }, 1000)

    const pollPayStatus = async () => {
      if (pollRequestPending || sessionId !== pollSessionId) return
      pollRequestPending = true
      try {
        const res: any = await getPcbOrderStatusV2(userToken.value, { merge_order_no: mergeNo })
        if (sessionId !== pollSessionId) return

        if (String(res.code) !== '10000') {
          if (!pollErrorNotified) {
            pollErrorNotified = true
            ElMessage.warning(withErrorSource('电巢', res.msg, '支付状态查询暂时失败，将继续重试'))
          }
          return
        }

        pollErrorNotified = false
        const payStatus = Number(res.data?.pay_status)
        if (payStatus === 1) {
          clearTimers()
          ElMessage.success('支付成功')
          try {
            await payCallback(userToken.value, { taskId: taskId.value, order_no: qrOrderNo.value, isPayed: true })
          } catch (error) {
            reportError('支付结果同步', error, '支付已成功，但订单状态同步失败，请联系客服', 'asem')
          } finally {
            qrVisible.value = false
          }
        } else if (payStatus === 2) {
          clearTimers()
          ElMessage.error(withErrorSource('电巢', '支付失败'))
          qrVisible.value = false
        }
      } catch (error) {
        console.error('[支付状态轮询]', error)
        if (!pollErrorNotified && sessionId === pollSessionId) {
          pollErrorNotified = true
          ElMessage.warning(withErrorSource('电巢', '支付状态查询异常，将继续重试'))
        }
      } finally {
        if (sessionId === pollSessionId) pollRequestPending = false
      }
    }

    pollTimer = window.setInterval(() => { void pollPayStatus() }, 1000)
  }

  function orderPayload() {
    const p: Record<string, any> = {}
    Object.keys(form).forEach(k => { if (k !== "remark") p[k] = k === 'dimensionTolerance' ? formatDimensionTolerance() : form[k] })
    p['drillDenstity'] = computedDrillDensity.value
    // if (stackupRows.value.length) p['stackupList'] = stackupRows.value
    // if (impRows.value.length) p['impList'] = impRows.value
    return p
  }

  return {
    qrVisible,
    qrCodeUrl,
    qrExpired,
    qrCountdown,
    qrOrderNo,
    qrRefreshing,
    clearTimers,
    refreshQrCode,
    startPollPayStatus,
    orderPayload,
  }
}
