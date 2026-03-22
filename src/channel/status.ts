/**
 * Status adapter for the LSPlatform channel.
 *
 * Implements `ChannelStatusAdapter<LSPlatformAccount>` to provide account
 * health information to the OpenClaw status subsystem.
 */

import type { ChannelStatusAdapter, ChannelAccountSnapshot } from "openclaw/plugin-sdk";
import type { LSPlatformAccount } from "./types.js";

export const lsplatformStatusAdapter: ChannelStatusAdapter<LSPlatformAccount> = {
  defaultRuntime: {
    accountId: "default",
    connected: false,
    running: false,
  },

  buildAccountSnapshot({
    account,
    runtime,
  }: {
    account: LSPlatformAccount;
    runtime?: ChannelAccountSnapshot;
  }): ChannelAccountSnapshot {
    return {
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.apiToken !== null && account.apiToken.length > 0,
      connected: runtime?.connected ?? false,
      running: runtime?.running ?? false,
      lastConnectedAt: runtime?.lastConnectedAt ?? null,
      lastDisconnect: runtime?.lastDisconnect ?? null,
      lastMessageAt: runtime?.lastMessageAt ?? null,
      lastError: runtime?.lastError ?? null,
      baseUrl: account.wsUrl,
      tokenSource: account.apiToken ? "config" : undefined,
    };
  },
};
