import {
  createPatchedAccountSetupAdapter,
  DEFAULT_ACCOUNT_ID,
  patchScopedAccountConfig,
  type ChannelSetupAdapter,
  type ChannelSetupWizard,
} from 'openclaw/plugin-sdk/setup';

import { authExchange } from '@/api';
import { CHANNEL_ID } from '@/constants';
import { configAdapter } from '@/config';
import type { XiaolingChannelConfig } from '@/types';

export const setupWizard: ChannelSetupWizard = {
  channel: CHANNEL_ID,
  resolveAccountIdForConfigure: () => DEFAULT_ACCOUNT_ID,

  status: {
    configuredLabel: '已绑定',
    unconfiguredLabel: '未绑定',
    configuredHint: '已绑定，选择修改',
    unconfiguredHint: '未绑定',
    resolveConfigured({ cfg }) {
      const ids = configAdapter.listAccountIds(cfg);
      return ids.some((id) => {
        const account = configAdapter.resolveAccount(cfg, id);
        return configAdapter.isConfigured(account);
      });
    },
  },

  stepOrder: 'text-first',
  credentials: [],

  textInputs: [
    {
      inputKey: 'code',
      message: '请输入小程序中显示的8位配对码',
      required: true,
      validate({ value }) {
        if (!/^[0-9A-Z]{8}$/.test(value)) {
          return '配对码必须是8位数字或大写字母';
        }
        return undefined;
      },
    },
  ],

  async finalize({ cfg, accountId, credentialValues }) {
    const code = credentialValues.code;
    if (!code) return;

    const result = await authExchange(code);

    const nextCfg = patchScopedAccountConfig({
      cfg,
      channelKey: CHANNEL_ID,
      accountId,
      patch: {
        enabled: true,
        accounts: {
          [accountId]: {
            apiToken: result.api_token,
            productId: result.product_id,
            deviceId: result.device_id,
            enabled: true,
          },
        },
      } satisfies Partial<XiaolingChannelConfig>,
      ensureChannelEnabled: true,
      ensureAccountEnabled: true,
    });

    return { cfg: nextCfg };
  },
};

export const setupAdapter: ChannelSetupAdapter = createPatchedAccountSetupAdapter({
  channelKey: CHANNEL_ID,
  buildPatch: () => ({}),
});
