import { ElMessage } from 'element-plus'
import { withErrorSource } from '@/utils/errorSource'

interface PanelSizeOptions {
  form: Record<string, any>
  fieldSource: Record<string, string>
  userBaseline: Record<string, any>
  rebuildUserModified: () => void
}

export function usePanelSize(options: PanelSizeOptions) {
  const { form, fieldSource, userBaseline, rebuildUserModified } = options

  function handleSizeBlur() {
    const pw = Number(form.pcsSizeWidth)
    const ph = Number(form.pcsSizeHeight)
    const sw = Number(form.setSizeWidth)
    const sh = Number(form.setSizeHeight)

    // PCS 尺寸超限提醒（独立规则，不依赖 SET）
    const wOver = pw > 571.5
    const hOver = ph > 571.5
    const KEY = 'PCS_SIZE_LIMIT'
    if (Number.isFinite(pw) && Number.isFinite(ph)) {
      form.remark = form.remark.filter((m: string) => !m.startsWith(KEY + '|'))
      if (wOver && (ph <= 0 || ph > 419.1)) {
        form.remark.push(KEY + '|' + 'PCS尺寸(水平)已超过 571.5mm，PCS尺寸(垂直)需限制在 0-419.1mm 内，超出P10，走线下下单模式进行。')
      } else if (hOver && (pw <= 0 || pw > 419.1)) {
        form.remark.push(KEY + '|' + 'PCS尺寸(垂直)已超过 571.5mm，PCS尺寸(水平)需限制在 0-419.1mm 内，超出P10，走线下下单模式进行。')
      }
    }

    // SET 尺寸超限提醒（规则同 PCS）
    const swOver = sw > 571.5
    const shOver = sh > 571.5
    const KEY_SET = 'SET_SIZE_LIMIT'
    if (Number.isFinite(sw) && Number.isFinite(sh)) {
      form.remark = form.remark.filter((m: string) => !m.startsWith(KEY_SET + '|'))
      if (swOver && (sh <= 0 || sh > 419.1)) {
        form.remark.push(KEY_SET + '|' + 'SET尺寸(水平)已超过 571.5mm，SET尺寸(垂直)需限制在 0-419.1mm 内，超出P10，走线下下单模式进行。')
      } else if (shOver && (sw <= 0 || sw > 419.1)) {
        form.remark.push(KEY_SET + '|' + 'SET尺寸(垂直)已超过 571.5mm，SET尺寸(水平)需限制在 0-419.1mm 内，超出P10，走线下下单模式进行。')
      }
    }

    if (![pw, ph, sw, sh].every(v => Number.isFinite(v) && v > 0)) return

    const pcsArea = pw * ph
    const setArea = sw * sh

    if (pcsArea > setArea) {
      ElMessage.error(withErrorSource('系统', 'PCS面积不能大于SET面积'))
      return
    }

    const ratio = setArea / pcsArea

    // Set拼板方式
    if (pcsArea === setArea) {
      form.setMethod = '单片无拼板'
    } else if (ratio > 1 && ratio < 1.25) {
      form.setMethod = '单片加工艺边'
    } else if (ratio >= 1.25) {
      form.setMethod = '客户拼板'
    }

    // 拼板个数（每 1.25 倍加 1）
    form.clientPanelHorizontal = 1
    form.clientPanelVertical = Math.floor(ratio / 1.25) + 1
    // 尺寸联动计算带出的 拼板方式/拼板个数：来源标记 AI提参，并同步基准（不算用户改动）
    fieldSource['setMethod'] = 'ai'
    fieldSource['clientPanelHorizontal'] = 'ai'
    fieldSource['clientPanelVertical'] = 'ai'
    userBaseline['setMethod'] = JSON.parse(JSON.stringify(form.setMethod))
    userBaseline['clientPanelHorizontal'] = JSON.parse(JSON.stringify(form.clientPanelHorizontal))
    userBaseline['clientPanelVertical'] = JSON.parse(JSON.stringify(form.clientPanelVertical))
    rebuildUserModified()
  }

  return { handleSizeBlur }
}
