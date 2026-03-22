/**
 * Config adapter for the LSPlatform channel.
 *
 * Implements the `ChannelConfigAdapter<LSPlatformAccount>` interface required
 * by the OpenClaw channel plugin system.
 */

import type {
  ChannelConfigAdapter,
  ChannelAccountSnapshot,
} from "openclaw/plugin-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import {
  LSPLATFORM_ACCOUNT_ID,
  getRawConfig,
  resolveAccount,
  type LSPlatformAccount,
} from "./types.js";

export const lsplatformConfigAdapter: ChannelConfigAdapter<LSPlatformAccount> = {
  listAccountIds(cfg: OpenClawConfig): string[] {
    const raw = getRawConfig(cfg);
    // Expose a single "default" account whenever any config key is present.
    if (raw.apiToken !== undefined || raw.wsUrl !== undefined) {
      return [LSPLATFORM_ACCOUNT_ID];
    }
    return [];
  },

  resolveAccount(cfg: OpenClawConfig, accountId?: string | null): LSPlatformAccount {
    return resolveAccount(cfg, accountId);
  },

  defaultAccountId(_cfg: OpenClawConfig): string {
    return LSPLATFORM_ACCOUNT_ID;
  },

  isEnabled(account: LSPlatformAccount): boolean {
    return account.enabled;
  },

  isConfigured(account: LSPlatformAccount): boolean {
    return account.apiToken !== null && account.apiToken.length > 0;
  },

  unconfiguredReason(_account: LSPlatformAccount): string {
    return (
      "No apiToken configured. Run `npx -y @listenai/openclaw-lsplatform install` " +
      "or set it manually with `openclaw config set channels.lsplatform.apiToken <token>`."
    );
  },

  describeAccount(
    account: LSPlatformAccount,
    _cfg: OpenClawConfig,
  ): ChannelAccountSnapshot {
    return {
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.apiToken !== null && account.apiToken.length > 0,
      tokenSource: account.apiToken ? "config" : undefined,
      baseUrl: account.wsUrl,
    };
  },
};
