function readBoolean(value: unknown, fallback: boolean): boolean {
  if (value === true || value === 'true' || value === 1 || value === '1') return true
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  return fallback
}

const externalConfig = window.__AUTOLIB_RUNTIME_CONFIG__

/** 缺少或误删外部配置时，默认保持当前的冲突版本。 */
export const runtimeConfig = Object.freeze({
  pluginAConflictMode: readBoolean(externalConfig?.pluginAConflictMode, true),
  pluginARemarkVisible: readBoolean(externalConfig?.pluginARemarkVisible, true),
  pluginCRemarkVisible: readBoolean(externalConfig?.pluginCRemarkVisible, true),
})
