# Plugin A 模块说明

`PluginA.vue` 只负责页面级状态编排、Qt 消息入口与子模块装配。新增功能应优先放到对应业务目录，避免再次形成单文件页面。

## 目录职责

- `components/`：页面视图区块；参数表继续按基本信息、工艺信息和个性化服务拆分。
- `composables/`：可组合的业务状态与副作用，包括字段来源、P10 校验、叠层/阻抗和支付轮询。
- `config/`：无副作用的表单字典、默认值和材料规则。
- `domain/`：无副作用、可复用的业务规则和 Qt 候选来源解析逻辑。
- `pluginA.css`：仅作用于 `.plugin-a-page` 下的模块样式。

## 维护约定

1. 静态选项和映射放入 `config/`，不要写回页面组件。
2. 包含监听器、计时器或接口流程的逻辑放入 `composables/`，并在卸载时清理资源。
3. 独立业务区块放入 `components/`；参数表字段按所属分区维护。
4. Qt 消息仍由页面统一接收，业务数据分别交给材料、校验、订单和支付模块处理。

## 打包后切换冲突模式

构建产物根目录中的 `plugin-config.js` 是独立运行时配置，不会合并进压缩后的业务脚本：

```js
window.__AUTOLIB_RUNTIME_CONFIG__ = {
  pluginAConflictMode: true,
  pluginARemarkVisible: true,
  pluginCRemarkVisible: true,
}
```

- `true`：使用候选数组协议，开启多来源冲突判断、粉色冲突背景和来源候选下拉。
- `false`：使用单对象协议，关闭冲突提示和来源下拉，不从候选数组中默认选择数据。

`pluginARemarkVisible` 现在只控制 A 页面备注栏中的 P10 提示：`true` 显示，`false` 隐藏。接口返回的 `remark` 始终接收、显示和回传；回传的 `remark` 不包含页面生成的 P10 提示。

`pluginCRemarkVisible` 独立控制 C 页面备注栏中的 P10 提示，规则与 A 页面一致。

修改配置后刷新或重新打开页面即可生效，无需重新打包。配置文件缺失或配置值无效时默认开启冲突模式。
