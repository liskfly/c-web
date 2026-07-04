/**
 * Qt QWebChannel 通信桥接封装
 *
 * 在 Qt WebEngine 环境中：通过 QWebChannel 与 C++ 通信
 * 在浏览器开发环境中：降级为 mock，方便单独调试
 */

let bridge: any = null
let ready = false

/** 获取 Qt Bridge 实例 */
export async function getBridge(): Promise<any> {
  if (bridge) return bridge

  return new Promise((resolve) => {
    const win = window as any

    // 线上：Qt WebEngine 环境
    if (win.qt?.webChannelTransport && win.QWebChannel) {
      new win.QWebChannel(win.qt.webChannelTransport, (channel: any) => {
        bridge = channel.objects.bridge
        ready = true
        console.log('[Bridge] QWebChannel 已连接')
        resolve(bridge)
      })
    } else {
      // 开发环境：mock
      console.warn('[Bridge] 未检测到 Qt WebChannel，使用 Mock 模式')
      bridge = createMockBridge()
      ready = true
      resolve(bridge)
    }
  })
}

/** 是否已就绪 */
export function isBridgeReady(): boolean {
  return ready
}

function createMockBridge() {
  return {
    // —— 下面按你的 C++ Bridge 类暴露的 Q_INVOKABLE 方法来自定义 ——
    getData: () => JSON.stringify({ mock: true, message: '开发环境 mock 数据' }),
    sendToBackend: (msg: string) => console.log('[Bridge Mock] sendToBackend:', msg),
    // 信号监听（mock 下空实现）
    onSignal: {
      connect: (cb: Function) => console.log('[Bridge Mock] 注册信号监听（mock 不会触发）'),
      disconnect: () => {},
    },
  }
}
