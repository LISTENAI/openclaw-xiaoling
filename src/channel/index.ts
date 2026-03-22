/**
 * LSPlatform channel plugin assembly.
 *
 * Combines config, gateway, outbound, and status adapters into the
 * `ChannelPlugin` object that OpenClaw registers at startup.
 */

import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { LSPLATFORM_CHANNEL_ID, type LSPlatformAccount } from "./types.js";
import { lsplatformConfigAdapter } from "./config.js";
import { lsplatformGatewayAdapter } from "./gateway.js";
import { lsplatformOutboundAdapter } from "./outbound.js";
import { lsplatformStatusAdapter } from "./status.js";

export const lsplatformChannel: ChannelPlugin<LSPlatformAccount> = {
  id: LSPLATFORM_CHANNEL_ID,

  meta: {
    id: LSPLATFORM_CHANNEL_ID,
    label: "LSPlatform",
    selectionLabel: "LSPlatform (LISTENAI)",
    docsPath: "channels/lsplatform",
    blurb: "Connect to LISTENAI LSPlatform for persistent device messaging.",
    order: 100,
  },

  capabilities: {
    chatTypes: ["direct"],
    media: true,
  },

  config: lsplatformConfigAdapter,

  configSchema: {
    schema: {
      type: "object",
      properties: {
        apiToken: {
          type: "string",
          description: "LSPlatform API token (obtained via pairing)",
        },
        wsUrl: {
          type: "string",
          description: "LSPlatform WebSocket endpoint",
          default: "wss://lsplatform.listenai.com/ws",
        },
        apiUrl: {
          type: "string",
          description: "LSPlatform REST API base URL",
          default: "https://lsplatform.listenai.com/api",
        },
        enabled: {
          type: "boolean",
          description: "Enable this channel",
          default: true,
        },
      },
      additionalProperties: false,
    },
    uiHints: {
      apiToken: {
        label: "API Token",
        placeholder: "Obtained via pairing flow",
        sensitive: true,
      },
      wsUrl: {
        label: "WebSocket URL",
        advanced: true,
      },
      apiUrl: {
        label: "API URL",
        advanced: true,
      },
    },
  },

  reload: {
    configPrefixes: ["channels.lsplatform"],
  },

  gateway: lsplatformGatewayAdapter,
  outbound: lsplatformOutboundAdapter,
  status: lsplatformStatusAdapter,
};
