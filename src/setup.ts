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

  // 配对码不是要持久化的 config 字段，只是触发 authExchange 的一次性输入；
  // 因此不声明 textInputs/credentials，所有交互直接在 finalize 里手动 prompt
  // （参考 extensions/twitch/src/setup-surface.ts 的写法）。
  credentials: [],

  async finalize({ cfg, accountId, prompter }) {
    const code = (
      await prompter.text({
        message: '请输入小程序中显示的8位配对码',
        validate: (value) => {
          const trimmed = value?.trim() ?? '';
          if (!trimmed) return '请输入配对码';
          if (!/^[0-9A-Z]{8}$/.test(trimmed)) {
            return '配对码必须是8位数字或大写字母';
          }
          return undefined;
        },
      })
    ).trim();
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
  // 配对码只能在交互式向导里输入：非交互的 `channels add --channel <id>` 路径
  // 直接调 applyAccountConfig，不会跑 wizard 的 finalize，所以这里硬性拦截。
  validateInput: () =>
    '请使用 `openclaw channels add`（不要带 --channel）或 `openclaw setup --wizard` 启动交互式向导，按提示输入小程序中的 8 位配对码。',
  buildPatch: () => ({}),
});
