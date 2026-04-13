# OpenClaw x 小聆 AI 插件 (`@listenai/openclaw-xiaoling`)

OpenClaw 的 channel plugin，让 OpenClaw 通过 WebSocket 长连接与 LISTENAI 的小聆设备通信。

## 构建

```bash
npm run build    # tsc --noEmit && tsdown
npm run dev      # tsdown -w
```

类型检查和打包分开：`tsc --noEmit` 只做类型检查，`tsdown`（基于 rolldown）做打包。rolldown 的 native binding 在某些环境下可能缺失，此时 `npx tsc --noEmit` 可单独验证类型。

## 调试

按照 README 的说明通过 `docker compose up` 启动调试用的 OpenClaw 实例。Compose 同时会起一个 tsdown watch 进程，监听源文件修改并自动同步打包产物。修改代码后需要 `docker compose restart openclaw` 让修改生效。

## 项目结构

- `src/api.ts` — WS 帧类型定义（`WsFrame<T, P>` 泛型）、HTTP API（`authExchange`）、`getWsUrl`
- `src/connection.ts` — 连接注册表，管理 per-account 的 WebSocket 连接、帧发送（`sendFrame`）、MCP 请求/响应跟踪
- `src/gateway.ts` — WebSocket 网关适配器，负责建连、心跳、消息分发、流式回复、断线重连
- `src/channel.ts` — Channel plugin 定义，组装 config/setup/gateway
- `src/config.ts` — 配置适配器，读取 account 配置
- `src/setup.ts` — 绑定向导（配对码 -> token 交换）和 setup adapter
- `src/tools.ts` — 跨 channel 的工具注册（`xiaoling_take_photo`），通过任意活跃连接发送 MCP 请求
- `src/types.ts` — 共享类型（`XiaolingAccount`、`XiaolingChannelConfig`、`GatewayContext`）
- `src/constants.ts` — Channel ID、API/WS 端点地址
- `src/index.ts` — Plugin 入口，注册 channel 和 tool
- `openclaw.plugin.json` — 插件清单，声明 channel 和 tool contracts

## 关键设计决策

- **帧类型使用泛型** `WsFrame<T extends string, P>`，所有帧共享 `{ type, headers: { request_id }, payload }` 结构
- **MCP 帧用字面量 name** — `McpToolCallFrame` 固定 `name: 'tool.call'`，`McpToolResultFrame` 固定 `name: 'tool.result'`
- **工具跨 channel 可用** — `xiaoling_take_photo` 不依赖当前 session 的 channel，通过 `getAnyActiveAccountId()` 找到任意活跃的小聆连接
- **工具注册需要双声明** — `openclaw.plugin.json` 的 `contracts.tools` + `api.registerTool(factory, { name })` 两处都要有
- **GatewayContext 放在 types.ts** — 避免 gateway.ts 和 connection.ts 之间的循环导入
- **不要自己造 SDK 里已有的接口** — 直接用 plugin-sdk 导出的类型

## 注意事项

- `registerTool` 一次只能注册一个工具
- 工具 factory 被调用时可能没有 `agentAccountId`（catalog listing 阶段），此时仍需返回工具定义，把连接检查放在 `execute` 里
- 重连时旧 WebSocket 的 `close` 事件可能晚于新连接的 `open`，close handler 需检查 `abortSignal.aborted` 防止误清理新连接

## TODO

- **Reply 帧的 message_id 关联方式需要改进**：当前通过 `connection.lastMessageId` 记录上一个 inbound message 的 id，在 reply 时读取。这基于"一问一答"的假设，但不够健壮。理想方案是让 OpenClaw 的 reply dispatch pipeline 把 `MessageSid` 回传到 deliver 回调，或者找到其他方式让 reply 帧的 `message_id` 与触发它的 inbound message 严格绑定，而不依赖全局状态。
