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
      // 配对码本身不能直接写进 config——它要先通过 authExchange 换 apiToken。
      // 这里 no-op 避开 wizard 默认的 applyAccountConfig 路径，把真正的写入
      // 留给下面的 finalize；同时让 setupAdapter.validateInput 只对非交互式
      // `channels add --channel <id>` 起作用。
      applySet: ({ cfg }) => cfg,
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
  // 配对码必须通过交互式向导输入，无法用 CLI flag 传入：
  // 非交互式 `channels add --channel <id>` 路径不会跑 wizard 的 textInputs/finalize，
  // 所以这里硬性拦截，引导用户走 `openclaw channels add` 或 `openclaw setup --wizard`。
  validateInput: () =>
    '请使用 `openclaw channels add`（不要带 --channel）或 `openclaw setup --wizard` 启动交互式向导，按提示输入小程序中的 8 位配对码。',
  buildPatch: () => ({}),
});
