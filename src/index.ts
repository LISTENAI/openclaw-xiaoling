/**
 * Main plugin entry point for the LSPlatform OpenClaw plugin.
 *
 * Registered by OpenClaw when the plugin is installed:
 *   openclaw plugins install @listenai/openclaw-lsplatform
 *
 * Manual token configuration (alternative to interactive install):
 *   openclaw config set channels.lsplatform.apiToken <token>
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { lsplatformChannel } from "./channel/index.js";
import { registerTools } from "./tools/index.js";

const lsplatformPlugin = {
  id: "lsplatform",
  name: "LSPlatform",
  description:
    "Connect OpenClaw to LISTENAI LSPlatform — persistent WebSocket channel for device messaging.",

  register(api: OpenClawPluginApi): void {
    // Register the LSPlatform channel (WebSocket gateway + config adapters).
    api.registerChannel(lsplatformChannel);

    // Register agent tools (photo capture, connection status).
    registerTools(api);

    api.logger.info("[lsplatform] Plugin registered");
  },
};

export default lsplatformPlugin;
