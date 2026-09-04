import { computed, ref, watch, type Ref } from 'vue'

export function useBoardStructure(form: Record<string, any>, currentPpModel: Ref<string>) {
  interface StackupRow { layerName: string; material: string; pcbMaterialType: string; copperThickness: number | null; dielectricThickness: number | null; dk: number | null }
  const stackupRows = ref<StackupRow[]>([])
  // 铜厚默认值(mil)：顶层/底层取“外层基铜厚度”(um→mil)，内层取“内层基铜厚度”(oz→mil)
  const OUTER_CU_DEFAULT = 0.7  // 外层基铜厚度缺失时回退 0.5oz ≈ 0.7mil
  const INNER_CU_DEFAULT = 1.4  // 内层基铜厚度缺失时回退 1oz ≈ 1.4mil

  function outerCuMil(): number {
    const v = Number(form.outerBaseCopperThickness)
    return Number.isFinite(v) && v > 0 ? Number((v / 25.4).toFixed(2)) : OUTER_CU_DEFAULT
  }

  function innerCuMil(): number {
    const v = Number(form.innerCopperThickness)
    return Number.isFinite(v) && v > 0 ? Number((v * 1.4).toFixed(2)) : INNER_CU_DEFAULT
  }

  function makeCu(outer: boolean): StackupRow {
    return { layerName: '', material: 'CU', pcbMaterialType: 'HTE', copperThickness: outer ? outerCuMil() : innerCuMil(), dielectricThickness: null, dk: null }
  }

  const stackupScheme = ref<'normal' | 'alt'>('normal')

  function generateStackup(N: number, scheme: 'normal' | 'alt' = 'normal') {
    const rows: StackupRow[] = []
    const M1 = scheme === 'normal' ? 'PP' : 'CORE'
    const M2 = scheme === 'normal' ? 'CORE' : 'PP'
    // PP 行“类型”默认值 = 当前匹配存储的 PP 型号
    const ppType = (m: string) => m === 'PP' ? currentPpModel.value : ''
    if (N === 1) {
      rows.push({ layerName: 'L1', material: 'CORE', pcbMaterialType: '', copperThickness: null, dielectricThickness: null, dk: null }, makeCu(true))
    } else if (N === 2) {
      rows.push(makeCu(true), { layerName: 'L2', material: 'CORE', pcbMaterialType: '', copperThickness: null, dielectricThickness: null, dk: null }, makeCu(true))
    } else if (N >= 4 && N % 2 === 0) {
      rows.push(makeCu(true))
      for (let i = 0; i < N / 2 - 1; i++) {
        rows.push({ layerName: '', material: M1, pcbMaterialType: ppType(M1), copperThickness: null, dielectricThickness: null, dk: null }, makeCu(false), { layerName: '', material: M2, pcbMaterialType: ppType(M2), copperThickness: null, dielectricThickness: null, dk: null }, makeCu(false))
      }
      rows.push({ layerName: '', material: M1, pcbMaterialType: ppType(M1), copperThickness: null, dielectricThickness: null, dk: null }, makeCu(true))
    }
    let cuIdx = 0
    stackupRows.value = rows.map(r => ({ ...r, layerName: r.material === 'CU' ? 'L' + (++cuIdx) : '' }))
  }

  // 匹配到 PP 型号后，给叠层里未填“类型”的 PP 行补默认值
  watch(currentPpModel, (pp) => {
    if (!pp) return
    stackupRows.value.forEach(r => {
      if (r.material === 'PP' && !r.pcbMaterialType) r.pcbMaterialType = pp
    })
  })

  function toggleStackupScheme() {
    stackupScheme.value = stackupScheme.value === 'normal' ? 'alt' : 'normal'
    const n = Number(form.layerCount)
    if (n >= 1) { generateStackup(n, stackupScheme.value); generateImpedance(n) }
  }

  // 层数变化自动生成叠构（值合法时才生成，输入过程中不打断）
  watch(() => form.layerCount, (val) => {
    const n = Number(val)
    if (Number.isInteger(n) && n > 0 && (n <= 2 || n % 2 === 0)) { generateStackup(n, stackupScheme.value); generateImpedance(n) }
  })

  // 层数失焦校验：只能大于0的数字，>2时只能偶数，最大80层；校验后生成叠构
  function onLayerCountBlur() {
    const str = String(form.layerCount ?? '')
    const clean = str.replace(/[^\d]/g, '')
    let n = Number(clean)
    if (!clean) { n = 2 }
    if (n <= 0) n = 2
    if (n > 60) n = 60
    if (n > 2 && n % 2 !== 0) n += 1
    form.layerCount = n
    generateStackup(n, stackupScheme.value)
    generateImpedance(n)
  }

  function addStackupRow() { const n = stackupRows.value.length + 1; stackupRows.value.push({ layerName: 'L' + n, material: 'PP', pcbMaterialType: '', copperThickness: null, dielectricThickness: null, dk: null }) }

  function insertStackupRow(index: number) {
    stackupRows.value.splice(index + 1, 0, { layerName: '', material: 'PP', pcbMaterialType: '', copperThickness: null, dielectricThickness: null, dk: null })
  }

  // 材料切换时重置字段：CU 行类型默认 HTE，非 CU 行清空铜厚
  function onMaterialChange(row: StackupRow) {
    if (row.material === 'CU') {
      row.pcbMaterialType = 'HTE'
      row.dielectricThickness = null
      row.dk = null
    } else {
      row.copperThickness = null
    }
  }

  interface ImpRow { impType: string; controlLayer: string; refLayerTop: string; refLayerBottom: string; isCoated: boolean; lineWidth: number | null; lineSpacing: number | null; lineToCopper: number | null; impTarget: number | null; impTol: number; _refTopError?: string; _refBottomError?: string }
  const impTypes = ["外层单端","外层单端共面地","外层差分","外层差分共面地","内层单端(双层屏蔽)","内层差分(双层屏蔽)","内层单端(单层屏蔽)","内层差分(单层屏蔽)","内层单端共面地(双层屏蔽)","内层差分共面地(双层屏蔽)","内层层间差分(双层屏蔽)","内层差分1B2A(双层屏蔽)","内层差分1B2A(单层屏蔽)"]
  const impRows = ref<ImpRow[]>([])

  const layerOptions = computed(() => Array.from({ length: Number(form.layerCount) || 0 }, (_, i) => 'L' + (i + 1)))
  const refLayerOptions = computed(() => ['', ...layerOptions.value])

  function onControlLayerChange(row: ImpRow) {
    const idx = parseInt(row.controlLayer?.replace('L', '')) || 0
    const total = Number(form.layerCount) || 0
    if (!idx || idx < 1 || idx > total) { row.refLayerTop = ''; row.refLayerBottom = ''; row._refTopError = ''; row._refBottomError = ''; return }
    if (idx === 1) { row.refLayerTop = ''; row.refLayerBottom = 'L2' }
    else if (idx === total) { row.refLayerTop = 'L' + (total - 1); row.refLayerBottom = '' }
    else { row.refLayerTop = 'L' + (idx - 1); row.refLayerBottom = 'L' + (idx + 1) }
    validateRefLayer(row, 'top')
    validateRefLayer(row, 'bottom')
  }

  function getExpectedRefLayer(controlLayer: string, type: 'top' | 'bottom'): string {
    const c = parseInt(controlLayer.replace('L', ''))
    const total = Number(form.layerCount) || 0
    if (isNaN(c) || c < 1 || c > total) return ''
    if (c === 1 && type === 'top') return ''
    if (c === 1 && type === 'bottom') return 'L2'
    if (c === total && type === 'top') return 'L' + (total - 1)
    if (c === total && type === 'bottom') return ''
    if (type === 'top') return 'L' + (c - 1)
    return 'L' + (c + 1)
  }

  function validateRefLayer(row: ImpRow, type: 'top' | 'bottom') {
    const errKey = type === 'top' ? '_refTopError' : '_refBottomError' as keyof ImpRow
    if (!row.controlLayer) { if (type === 'top') row._refTopError = ''; else row._refBottomError = ''; return }
    const expected = getExpectedRefLayer(row.controlLayer, type)
    const actual = type === 'top' ? row.refLayerTop : row.refLayerBottom
    const ctrl = row.controlLayer
    if (actual !== expected) {
      const label = type === 'top' ? '上参' : '下参'
      const expLabel = expected || '空'
      if (type === 'top') row._refTopError = `${label}应为${expLabel}`; else row._refBottomError = `${label}应为${expLabel}`
    } else {
      if (type === 'top') row._refTopError = ''; else row._refBottomError = ''
    }
  }

  function addImpRow() { impRows.value.push({ impType: '', controlLayer: '', refLayerTop: '', refLayerBottom: '', isCoated: false, lineWidth: null, lineSpacing: null, lineToCopper: null, impTarget: null, impTol: 10 }) }

  function insertImpRow(index: number) {
    impRows.value.splice(index + 1, 0, { impType: '', controlLayer: '', refLayerTop: '', refLayerBottom: '', isCoated: false, lineWidth: null, lineSpacing: null, lineToCopper: null, impTarget: null, impTol: 10 })
  }

  // 根据层数生成阻抗行：L1=外层单端、底层=外层差分，这两层盖油默认true，其余全空
  function generateImpedance(N: number) {
    if (N < 2) { impRows.value = []; return }
    const rows: ImpRow[] = []
    for (let i = 1; i <= N; i++) {
      const isFirst = i === 1
      const isLast = i === N
      rows.push({
        impType: isFirst ? '外层单端' : isLast ? '外层差分' : '',
        controlLayer: 'L' + i,
        refLayerTop: '',
        refLayerBottom: '',
        isCoated: isFirst || isLast,
        lineWidth: null, lineSpacing: null, lineToCopper: null, impTarget: null, impTol: 10,
      })
    }
    impRows.value = rows
    impRows.value.forEach(r => onControlLayerChange(r))
  }

  function requestPCSSize() {
    const w = window as any
    if (w.QtBridge?.send) w.QtBridge.send('html-button-message', { getPCSSize: '1' })
    else console.log('[我→QT] getPCSSize')
  }

  function requestSetSize() {
    const w = window as any
    if (w.QtBridge?.send) w.QtBridge.send('html-button-message', { getSetSize: '1' })
    else console.log('[我→QT] getSetSize')
  }

  return {
    stackupRows,
    stackupScheme,
    toggleStackupScheme,
    onLayerCountBlur,
    addStackupRow,
    insertStackupRow,
    onMaterialChange,
    impRows,
    impTypes,
    layerOptions,
    refLayerOptions,
    onControlLayerChange,
    validateRefLayer,
    addImpRow,
    insertImpRow,
    requestPCSSize,
    requestSetSize,
  }
}

