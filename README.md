# openclaw-lsplatform

An [OpenClaw](https://npm.im/openclaw) plugin that adds a **LSPlatform channel** — a persistent WebSocket connection to LISTENAI's LSPlatform service — and companion **agent tools** for device interaction.

## Features

- **LSPlatform channel**: connects OpenClaw to LSPlatform via a long-lived WebSocket, enabling bidirectional messaging with LISTENAI devices.
- **Streaming text replies**: the AI agent's responses are streamed back to LSPlatform chunk-by-chunk for real-time TTS synthesis.
- **Image reception**: inbound image messages from LSPlatform are forwarded to the AI agent.
- **Photo capture tool** (`lsplatform_capture_photo`): instructs the connected device to take a photo and returns the URL.
- **Connection status tool** (`lsplatform_connection_status`): reports the current WebSocket state.

## Installation

### Interactive (recommended)

```sh
npx -y @listenai/openclaw-lsplatform install
```

Follow the prompts:

```
1. 在「小聆AI」微信小程序中点开设备
2. 找到 OpenClaw 功能
3. 输入以下配对码：

    123456
```

### Manual

```sh
# 1. Register the plugin with OpenClaw
openclaw plugins install @listenai/openclaw-lsplatform

# 2. Set the apiToken obtained from LSPlatform
openclaw config set channels.lsplatform.apiToken <your-token>
```

## Configuration

| Key                              | Type    | Description                                        | Default                                 |
| -------------------------------- | ------- | -------------------------------------------------- | --------------------------------------- |
| `channels.lsplatform.apiToken`   | string  | API token obtained via the pairing flow            | —                                       |
| `channels.lsplatform.wsUrl`      | string  | LSPlatform WebSocket endpoint                      | `wss://lsplatform.listenai.com/ws`      |
| `channels.lsplatform.apiUrl`     | string  | LSPlatform REST API base URL                       | `https://lsplatform.listenai.com/api`   |
| `channels.lsplatform.enabled`    | boolean | Enable / disable the channel                       | `true`                                  |

## Protocol (LSPlatform WebSocket)

The WebSocket protocol is specified by the LSPlatform cloud team. The current implementation provides typed stubs in `src/protocol.ts` and integration points in `src/channel/gateway.ts` marked with `TODO` comments.

### Inbound (LSPlatform → OpenClaw)

| Message type      | Description                                 |
| ----------------- | ------------------------------------------- |
| `text`            | Complete text message from the user          |
| `image`           | Image message (URL + MIME type)             |
| `photo_response`  | Result of a `photo_request`                 |
| `ping`            | Keep-alive ping                             |

### Outbound (OpenClaw → LSPlatform)

| Message type      | Description                                         |
| ----------------- | --------------------------------------------------- |
| `text_chunk`      | Streaming text reply chunk (for real-time TTS)      |
| `text_done`       | Signals the end of a streaming reply                |
| `photo_request`   | Requests a photo capture from the connected device  |
| `pong`            | Keep-alive pong                                     |

## Development

```sh
npm install
npm run build   # compile TypeScript → dist/
npm run dev     # watch mode
```
