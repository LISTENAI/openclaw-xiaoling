import type { ChannelPlugin } from 'openclaw/plugin-sdk';

import { CHANNEL_ID } from '@/constants';

export const channelPlugin: ChannelPlugin = {
  id: CHANNEL_ID,
  meta: {
    id: CHANNEL_ID,
    label: '小聆 AI',
    selectionLabel: '小聆 AI',
    docsPath: `/channels/${CHANNEL_ID}`,
    blurb: 'OpenClaw × 小聆 AI',
  },
  capabilities: {
    chatTypes: ['direct'],
    media: true,
  },
  reload: { configPrefixes: [`channels.${CHANNEL_ID}`] },
  config: {
    listAccountIds(_cfg) {
      return [];
    },
    resolveAccount(_cfg, _accountId) {
      return null;
    },
  },
};
