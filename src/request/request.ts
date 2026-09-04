import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { ElMessage, ElLoading } from 'element-plus'
import { markErrorMessageShown, withErrorSource, type ErrorSource } from '@/utils/errorSource'

declare module 'axios' {
  interface AxiosRequestConfig {
    errorSource?: ErrorSource
    fixedErrorMessage?: string
  }
}

let loadingRequestCount = 0
let loadingInstance: any

const showLoading = () => {
  if (loadingRequestCount === 0) {
    loadingInstance = ElLoading.service({
      lock: true,
      text: '加载中……',
      background: 'rgba(0, 0, 0, 0.1)',
    })
  }
  loadingRequestCount++
}

const hideLoading = () => {
  if (loadingRequestCount <= 0) return
  loadingRequestCount--
  if (loadingRequestCount === 0) {
    loadingInstance.close()
  }
}

const service = axios.create({
  timeout: 1000 * 60 * 5,
})

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    const isUpload =
      config.method === 'post' &&
      (config.headers?.['Content-Type'] as string)?.includes('multipart/form-data')
    const isSilent = config.headers?.__silent
    if (!isUpload && !isSilent) { showLoading() }
    // 清理内部标记，不发给后端
    if (isSilent) delete config.headers.__silent
    return config
  },
  (error) => {
    hideLoading()
    return Promise.reject(error)
  },
)

// 响应拦截器
service.interceptors.response.use(
  (response) => {
    hideLoading()
    if (response.status === 200) {
      return response.data
    }
    return response.data
  },
  (error) => {
    hideLoading()
    const requestConfig = error.config as AxiosRequestConfig | undefined
    const errorSource = requestConfig?.errorSource
    const fixedErrorMessage = requestConfig?.fixedErrorMessage
    if (error.response) {
      const message = fixedErrorMessage || error.response.data?.msg || error.response.data?.message || error.message || '请求失败'
      ElMessage({ message: errorSource ? withErrorSource(errorSource, message) : message, type: 'error', duration: 5000 })
      markErrorMessageShown(error)
    } else if (error.request) {
      const requestMessage = fixedErrorMessage || '网络连接失败'
      const message = errorSource ? withErrorSource(errorSource, requestMessage) : requestMessage
      ElMessage({ message, type: 'error', duration: 5000 })
      markErrorMessageShown(error)
    }
    return Promise.reject(error)
  },
)

export default service
