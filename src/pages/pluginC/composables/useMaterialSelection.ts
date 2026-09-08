import { ElMessageBox } from 'element-plus'
import { materialRules, ppMap, versionDetailMap } from '../config/materials'

interface MaterialSelectionOptions {
  form: Record<string, any>
  fieldSource: Record<string, string>
  userBaseline: Record<string, any>
  currentPpModel: { value: string }
}

export function useMaterialSelection(options: MaterialSelectionOptions) {
  const { form, fieldSource, userBaseline, currentPpModel } = options

  // 材料字段旧值：弹窗提示不可更改时回滚
  const prevMaterial: Record<string, any> = {
    materialType: form.materialType, materialVersion: form.materialVersion,
    materialBrand: form.materialBrand, materialTg: form.materialTg, halogenFree: form.halogenFree,
  }
  let materialConfirmOpen = false
  
  function syncPrevMaterial() {
    prevMaterial.materialType = form.materialType
    prevMaterial.materialVersion = form.materialVersion
    prevMaterial.materialBrand = form.materialBrand
    prevMaterial.materialTg = form.materialTg
    prevMaterial.halogenFree = form.halogenFree
  }
  
  // 型号 → 所属板材种类（板材型号优先级最高，用于带出材料类型）
  // 清单分类键 → 页面显示分类名（高速板材/高频板 等旧称呼）
  const CATEGORY_ALIAS: Record<string, string> = { 'FR4': 'FR4', '高频': '高频板', '高速': '高速板材', 'PI': 'PI' }
  const versionTypeMap: Record<string, string> = {}
  for (const [typeName, rule] of Object.entries(materialRules)) {
    const displayName = CATEGORY_ALIAS[typeName] || typeName
    for (const v of rule.versions) versionTypeMap[v] = displayName
  }
  
  // 按芯板型号带出 材料类型/品牌/TG/无卤，并记录对应 PP 型号
  function fillByVersion(version: string) {
    const d = versionDetailMap[version]
    if (!d) return
    form.materialType = versionTypeMap[version] || form.materialType
    form.materialBrand = d.brand
    form.materialTg = d.tg === '高TG'
    form.halogenFree = d.halogen
    currentPpModel.value = ppMap[version] || ''
  }
  
  // 数据到达后的材料匹配：仅当返回了型号时按型号带出；
  // 无型号不做匹配（型号保持空），其余字段有传值用传值、没传值用默认值
  function applyMaterialPriorityRules() {
    const version = form.materialVersion
    if (version && versionDetailMap[version]) {
      fillByVersion(version)
      // 型号匹配带出的项：来源标记为 AI提参（不算用户改动，不显示用户确认）
      ;['materialType','materialBrand','materialTg','halogenFree'].forEach(k => { fieldSource[k] = 'ai' })
      return
    }
    currentPpModel.value = ''
  }
  
  // 补出的值：来源标 AI提参 + 同步基准（不算用户改动）
  function markAiAndBaseline(k: string) {
    fieldSource[k] = 'ai'
    userBaseline[k] = JSON.parse(JSON.stringify(form[k]))
  }
  
  // 外层完成铜厚度/外层基铜厚度互补规则：只传其一时按规则补另一个
  // 只有基铜：完成铜 = 基铜 + (>=35 ? 35 : 18)
  // 只有完成铜：>=70 → 基铜 = 完成铜-35；<56 → 完成铜-18；56~70 → 相等
  // 两个都传按传值；都没传按默认值
  function applyCopperRules(data: Record<string, any>) {
    const baseRaw = data.outerBaseCopperThickness?.value ?? data.outerBaseCopperThickness
    const doneRaw = data.outerCopperThickness?.value ?? data.outerCopperThickness
    const baseGiven = baseRaw !== undefined && baseRaw !== null && baseRaw !== ''
    const doneGiven = doneRaw !== undefined && doneRaw !== null && doneRaw !== ''
    if (baseGiven && !doneGiven) {
      const base = Number(form.outerBaseCopperThickness)
      if (Number.isFinite(base)) {
        form.outerCopperThickness = base + (base >= 35 ? 35 : 18)
        markAiAndBaseline('outerCopperThickness')
      }
    } else if (doneGiven && !baseGiven) {
      const done = Number(form.outerCopperThickness)
      if (Number.isFinite(done)) {
        form.outerBaseCopperThickness = done >= 70 ? done - 35 : done < 56 ? done - 18 : done
        markAiAndBaseline('outerBaseCopperThickness')
      }
    }
  }
  
  // 板材种类变化：已匹配板材型号时不可更改（混压板例外，可自由改）
  function onMaterialTypeChange() {
    if (materialConfirmOpen) return
    const oldType = prevMaterial.materialType
    const version = form.materialVersion
    if (!version || form.materialType === '混压板') { prevMaterial.materialType = form.materialType; return }
    materialConfirmOpen = true
    ElMessageBox.alert('当前的值已匹配板材型号，不可更改', '提示', {
      confirmButtonText: '确定', type: 'warning',
    }).finally(() => {
      form.materialType = oldType
      prevMaterial.materialType = oldType
      materialConfirmOpen = false
    })
  }
  
  // 下拉选中建议项时 v-model 尚未更新，先写入值再走校验
  function onMaterialVersionSelect(item: Record<string, any>) {
    form.materialVersion = item.value
    onMaterialVersionChange()
  }
  
  // 板材型号变化：选中后自动带出 材料类型/品牌/TG/无卤（混压板时保留混压板，只带品牌/TG/无卤）
  function onMaterialVersionChange() {
    if (materialConfirmOpen) return
    if (form.materialVersion === prevMaterial.materialVersion) return
    const version = form.materialVersion
    if (!version) { currentPpModel.value = ''; syncPrevMaterial(); return }
    const d = versionDetailMap[version]
    if (!d) { currentPpModel.value = ''; syncPrevMaterial(); return }
    currentPpModel.value = ppMap[version] || ''
    if (form.materialType === '混压板') {
      form.materialBrand = d.brand
      form.materialTg = d.tg === '高TG'
      form.halogenFree = d.halogen
    } else {
      fillByVersion(version)
    }
    syncPrevMaterial()
  }
  
  // 下拉选中建议项时 v-model 尚未更新，先写入值再走校验
  function onMaterialBrandSelect(item: Record<string, any>) {
    form.materialBrand = item.value
    onMaterialBrandChange()
  }
  
  // 板材品牌变化：已匹配板材型号时不可更改（混压板例外）
  function onMaterialBrandChange() {
    if (materialConfirmOpen) return
    const oldBrand = prevMaterial.materialBrand
    if (form.materialBrand === oldBrand) return
    if (!form.materialVersion || form.materialType === '混压板') { prevMaterial.materialBrand = form.materialBrand; return }
    materialConfirmOpen = true
    ElMessageBox.alert('当前的值已匹配板材型号，不可更改', '提示', {
      confirmButtonText: '确定', type: 'warning',
    }).finally(() => {
      form.materialBrand = oldBrand
      materialConfirmOpen = false
    })
  }
  
  // TG值变化：已匹配板材型号时不可更改（混压板例外）
  function onMaterialTgChange() {
    if (materialConfirmOpen) return
    const oldTg = prevMaterial.materialTg
    if (form.materialTg === oldTg) return
    if (!form.materialVersion || form.materialType === '混压板') { prevMaterial.materialTg = form.materialTg; return }
    materialConfirmOpen = true
    ElMessageBox.alert('当前的值已匹配板材型号，不可更改', '提示', {
      confirmButtonText: '确定', type: 'warning',
    }).finally(() => {
      form.materialTg = oldTg
      materialConfirmOpen = false
    })
  }
  
  // 无卤变化：已匹配板材型号时不可更改（混压板例外）
  function onMaterialHalogenChange() {
    if (materialConfirmOpen) return
    const oldHalogen = prevMaterial.halogenFree
    if (form.halogenFree === oldHalogen) return
    if (!form.materialVersion || form.materialType === '混压板') { prevMaterial.halogenFree = form.halogenFree; return }
    materialConfirmOpen = true
    ElMessageBox.alert('当前的值已匹配板材型号，不可更改', '提示', {
      confirmButtonText: '确定', type: 'warning',
    }).finally(() => {
      form.halogenFree = oldHalogen
      materialConfirmOpen = false
    })
  }

  return {
    syncPrevMaterial,
    applyMaterialPriorityRules,
    applyCopperRules,
    onMaterialTypeChange,
    onMaterialVersionSelect,
    onMaterialVersionChange,
    onMaterialBrandSelect,
    onMaterialBrandChange,
    onMaterialTgChange,
    onMaterialHalogenChange,
  }
}
