import { DEFAULT_ACCOUNT_ID, type ChannelPlugin, type OpenClawConfig } from 'openclaw/plugin-sdk/core';

import { CHANNEL_ID } from '@/constants';
import type { XiaolingAccount, XiaolingChannelConfig } from '@/types';

function getChannelSection(cfg: OpenClawConfig): XiaolingChannelConfig | undefined {
  return cfg.channels?.[CHANNEL_ID] as XiaolingChannelConfig | undefined;
}

export const configAdapter = {
  listAccountIds(cfg: OpenClawConfig): string[] {
    const section = getChannelSection(cfg);
    return Object.keys(section?.accounts ?? {});
  },

  resolveAccount(cfg: OpenClawConfig, accountId?: string | null): XiaolingAccount {
    const section = getChannelSection(cfg);
    const id = accountId ?? section?.defaultAccount ?? DEFAULT_ACCOUNT_ID;

    if (section?.accounts?.[id]) {
      const acct = section.accounts[id];
      return {
        accountId: id,
        apiToken: acct.apiToken,
        productId: acct.productId,
        deviceId: acct.deviceId,
        enabled: acct.enabled,
      };
    }

    return { accountId: id };
  },

  isConfigured(account: XiaolingAccount): boolean {
    return !!account.apiToken;
  },

  isEnabled(account: XiaolingAccount): boolean {
    return account.enabled !== false;
  },
} satisfies ChannelPlugin<XiaolingAccount>['config'];
