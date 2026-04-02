import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import { CHANNEL_ID } from '@/constants';
import type { XiaolingAccount, XiaolingChannelConfig } from '@/types';

function getChannelSection(cfg: OpenClawConfig): XiaolingChannelConfig | undefined {
  return cfg.channels?.[CHANNEL_ID] as XiaolingChannelConfig | undefined;
}

export const configAdapter = {
  listAccountIds(cfg: OpenClawConfig): string[] {
    const section = getChannelSection(cfg);
    if (!section) return [];
    if (section.accounts) {
      const ids = Object.keys(section.accounts);
      if (ids.length > 0) return ids;
    }
    if (section.apiToken) return ['default'];
    return [];
  },

  resolveAccount(cfg: OpenClawConfig, accountId?: string | null): XiaolingAccount {
    const section = getChannelSection(cfg);
    const id = accountId ?? section?.defaultAccount ?? 'default';

    if (section?.accounts?.[id]) {
      const acct = section.accounts[id];
      return {
        accountId: id,
        apiToken: acct.apiToken,
        enabled: acct.enabled,
      };
    }

    if (id === 'default' && section?.apiToken) {
      return {
        accountId: 'default',
        apiToken: section.apiToken,
        enabled: section.enabled,
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
} satisfies import('openclaw/plugin-sdk/core').ChannelPlugin<XiaolingAccount>['config'];
