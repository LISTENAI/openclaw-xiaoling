/**
 * Shared types for the LSPlatform channel.
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";

/** Defaults that apply when no override is configured. */
export const DEFAULT_WS_URL = "wss://lsplatform.listenai.com/ws";
export const DEFAULT_API_URL = "https://lsplatform.listenai.com/api";

/** The single account id used for the LSPlatform channel. */
export const LSPLATFORM_ACCOUNT_ID = "default";

/** Channel identifier registered with OpenClaw. */
export const LSPLATFORM_CHANNEL_ID = "lsplatform";

/** Config path prefix within the OpenClaw config file. */
export const LSPLATFORM_CONFIG_PREFIX = "channels.lsplatform";

// ---------------------------------------------------------------------------
// Raw config shape (as stored in openclaw.json)
// ---------------------------------------------------------------------------

export type LSPlatformRawConfig = {
  apiToken?: string;
  wsUrl?: string;
  apiUrl?: string;
  enabled?: boolean;
};

// ---------------------------------------------------------------------------
// Resolved account (passed to gateway / outbound adapters)
// ---------------------------------------------------------------------------

export type LSPlatformAccount = {
  accountId: string;
  apiToken: string | null;
  wsUrl: string;
  apiUrl: string;
  enabled: boolean;
};

// ---------------------------------------------------------------------------
// Config resolver
// ---------------------------------------------------------------------------

/** Extract the raw LSPlatform section from the full OpenClaw config. */
export function getRawConfig(cfg: OpenClawConfig): LSPlatformRawConfig {
  const channels = (cfg as Record<string, unknown>)["channels"];
  if (typeof channels !== "object" || channels === null) return {};
  const ls = (channels as Record<string, unknown>)["lsplatform"];
  if (typeof ls !== "object" || ls === null) return {};
  return ls as LSPlatformRawConfig;
}

/** Build a resolved LSPlatformAccount from the full OpenClaw config. */
export function resolveAccount(cfg: OpenClawConfig, accountId?: string | null): LSPlatformAccount {
  const raw = getRawConfig(cfg);
  return {
    accountId: accountId ?? LSPLATFORM_ACCOUNT_ID,
    apiToken: raw.apiToken ?? null,
    wsUrl: raw.wsUrl ?? DEFAULT_WS_URL,
    apiUrl: raw.apiUrl ?? DEFAULT_API_URL,
    enabled: raw.enabled !== false,
  };
}
