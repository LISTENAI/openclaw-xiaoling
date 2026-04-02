import type { ChannelSetupWizard, ChannelSetupAdapter } from 'openclaw/plugin-sdk/setup';
import { createPatchedAccountSetupAdapter, patchScopedAccountConfig } from 'openclaw/plugin-sdk/setup';

import { exchangeCode } from '@/api/client';
import { CHANNEL_ID } from '@/constants';
import { configAdapter } from '@/config';

export const setupWizard: ChannelSetupWizard = {
  channel: CHANNEL_ID,

  status: {
    configuredLabel: 'configured',
    unconfiguredLabel: 'needs setup',
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
      message: '请输入6位验证码 (从 LSPlatform 获取)',
      placeholder: '000000',
      required: true,
      validate({ value }) {
        if (!/^\d{6}$/.test(value)) {
          return '验证码必须是6位数字';
        }
        return undefined;
      },
    },
  ],

  async finalize({ cfg, accountId, credentialValues }) {
    const code = credentialValues.code;
    if (!code) return;

    const result = await exchangeCode(code);

    const nextCfg = patchScopedAccountConfig({
      cfg,
      channelKey: CHANNEL_ID,
      accountId,
      patch: { apiToken: result.apiToken },
      ensureChannelEnabled: true,
      ensureAccountEnabled: true,
    });

    return { cfg: nextCfg };
  },
};

export const setupAdapter: ChannelSetupAdapter = createPatchedAccountSetupAdapter({
  channelKey: CHANNEL_ID,
  ensureChannelEnabled: true,
  ensureAccountEnabled: true,
  buildPatch(input) {
    return {
      ...(input.token ? { apiToken: input.token } : {}),
    };
  },
});
