/**
 * Outbound adapter for the LSPlatform channel.
 *
 * LSPlatform is a push-to-device channel — OpenClaw replies stream back over
 * the established WebSocket rather than via a separate HTTP call.  The
 * outbound adapter therefore provides no stand-alone `sendText` / `sendMedia`
 * implementation; replies are emitted from the gateway's streaming callbacks.
 *
 * A future enhancement could expose a REST-based send endpoint if LSPlatform
 * adds one.
 */

import type { ChannelOutboundAdapter } from "openclaw/plugin-sdk";

export const lsplatformOutboundAdapter: ChannelOutboundAdapter = {
  /**
   * "direct" — the gateway layer handles delivery.
   * No HTTP webhook roundtrip is needed.
   */
  deliveryMode: "direct",
};
