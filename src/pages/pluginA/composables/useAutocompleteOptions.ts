import { watch } from 'vue'

export function useAutocompleteOptions(form: Record<string, any>, opts: Record<string, any[]>) {
  function makeQueryFn(list: string[]) {
    return (query: string, cb: (results: { value: string }[]) => void) => {
      const results = query
        ? list.filter((v: string) => v.toLowerCase().includes(query.toLowerCase()))
        : list
      cb(results.map(v => ({ value: v })))
    }
  }
  const queryMaterialBrand = makeQueryFn(opts.materialBrand)
  const queryMaterialVersion = makeQueryFn(opts.materialVersion)
  // 叠层“类型”列选项：PP → PP型号；CORE/光板 → 芯板型号；CU → 铜箔类型
  const ppModelList = ['IT-158BS', 'NY2150', 'S1000HB', 'S1151GB', 'S1150GB', 'S1165B', 'IT-180A', 'TU-75P', 'S1000-2MB', 'S1000-2B', 'TU-768', 'NY2170', 'S1190B', 'RO4450F', 'TU86P HF', 'IT-170GT', 'IT-170GRA1', 'IT-170GRA2', 'TU-87P SLK', 'TU-87P SLK SP', 'N4203-13', 'N4203-13EP', 'N4203-13SI', 'N4203-13EPSI', 'R-5620', 'R-5620S', 'R-5620SS', 'R-5680GE', 'R-5680N', 'Synamic6B', 'FR408HR', 'S7439 B', 'S7439HW B', 'Synamic6 B', 'EM-888 B', 'EM-888 BK', 'R-5670', 'R-5670G', 'R-5670N', 'R-5670K', 'R-5670NE', 'IT-968 B', 'IT-958G', 'IT-968SE B', 'NY6300P', '85N', 'VT-901']
  const queryStackupPpType = makeQueryFn(ppModelList)
  const queryStackupCoreType = makeQueryFn(opts.materialVersion)
  const queryStackupCuType = makeQueryFn(['HTE', 'RTF', 'RTF2', 'RTF3', 'HVLP', 'HVLP2', 'HVLP3', 'HVLP4'])
  const queryLayerCount = makeQueryFn(opts.layerCount)
  const queryThicknessTolerance = makeQueryFn(opts.thicknessTolerance)
  const queryMaxWarpage = makeQueryFn(opts.maxWarpage)

  // 数字类型字段：返回 number + watcher 过滤非数字输入
  function makeNumQueryFn(list: string[]) {
    return {
      query: (q: string, cb: (results: { value: number }[]) => void) => {
        const results = q ? list.filter(v => v.toLowerCase().includes(q.toLowerCase())) : list
        cb(results.map(v => ({ value: Number(v) })))
      },
      watch: (formKey: string) => {
        watch(() => form[formKey], (val) => {
          if (typeof val === 'string' && /[^\d.]/.test(val)) {
            form[formKey] = val.replace(/[^\d.]/g, '') || ''
          }
        })
      }
    }
  }

  const numFields = ['boardThickness', 'outerCopperThickness', 'outerBaseCopperThickness', 'innerCopperThickness', 'enigGoldThickness', 'goldFingerThickness'] as const
  numFields.forEach(k => makeNumQueryFn(opts[k]).watch(k))
  const queryBoardThickness = makeNumQueryFn(opts.boardThickness).query
  const queryOuterCopperThickness = makeNumQueryFn(opts.outerCopperThickness).query
  const queryOuterBaseCopperThickness = makeNumQueryFn(opts.outerBaseCopperThickness).query
  const queryInnerCopperThickness = makeNumQueryFn(opts.innerCopperThickness).query
  const queryEnigGoldThickness = makeNumQueryFn(opts.enigGoldThickness).query
  const queryGoldFingerThickness = makeNumQueryFn(opts.goldFingerThickness).query
  // 最小孔铜需要返回数字且过滤非数字输入
  function queryHoleCopperThickness(query: string, cb: (results: { value: number }[]) => void) {
    const results = query
      ? opts.holeCopperThickness.filter((v: string) => v.toLowerCase().includes(query.toLowerCase()))
      : opts.holeCopperThickness
    cb(results.map(v => ({ value: Number(v) })))
  }
  watch(() => form.holeCopperThickness, (val) => {
    if (typeof val === 'string' && /[^\d.]/.test(val)) {
      form.holeCopperThickness = val.replace(/[^\d.]/g, '') || ''
    }
  })

  return {
    queryMaterialBrand,
    queryMaterialVersion,
    queryStackupPpType,
    queryStackupCoreType,
    queryStackupCuType,
    queryLayerCount,
    queryThicknessTolerance,
    queryMaxWarpage,
    queryBoardThickness,
    queryOuterCopperThickness,
    queryOuterBaseCopperThickness,
    queryInnerCopperThickness,
    queryEnigGoldThickness,
    queryGoldFingerThickness,
    queryHoleCopperThickness,
  }
}

