import { createChannelPluginBase, createChatChannelPlugin } from 'openclaw/plugin-sdk/core';

import { CHANNEL_ID } from '@/constants';
import { configAdapter } from '@/config';
import { gatewayAdapter } from '@/gateway';
import { setupWizard, setupAdapter } from '@/setup';
import type { XiaolingAccount } from '@/types';

const base = createChannelPluginBase<XiaolingAccount>({
  id: CHANNEL_ID,

  meta: {
    label: '小聆 AI',
    selectionLabel: '小聆 AI',
    blurb: 'OpenClaw × 小聆 AI',
  },

  capabilities: {
    chatTypes: ['direct'],
    media: true,
  },

  config: configAdapter,
  setup: setupAdapter,
  setupWizard,

  reload: { configPrefixes: [`channels.${CHANNEL_ID}`] },
});

export const channelPlugin = createChatChannelPlugin<XiaolingAccount>({
  base: {
    ...base,
    config: configAdapter,
    capabilities: {
      chatTypes: ['direct'],
      media: true,
    },
  },

  security: {
    dm: {
      channelKey: CHANNEL_ID,
      defaultPolicy: 'pairing',
      resolvePolicy: () => null,
      resolveAllowFrom: () => null,
    },
  },
});

channelPlugin.gateway = gatewayAdapter;
