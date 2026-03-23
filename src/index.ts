import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/core';

import { channelPlugin } from '@/channel';

export default defineChannelPluginEntry({
  id: 'openclaw-xiaoling',
  name: '小聆 AI',
  description: 'OpenClaw × 小聆 AI 插件',
  plugin: channelPlugin,
});
