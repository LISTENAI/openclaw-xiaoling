import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/core';

import { channelPlugin } from '@/channel';
import { toolFactory } from '@/tools';

export default defineChannelPluginEntry({
  id: 'openclaw-xiaoling',
  name: '小聆 AI',
  description: 'OpenClaw × 小聆 AI 插件',
  plugin: channelPlugin,
  registerFull(api) {
    api.registerTool(toolFactory, { name: 'xiaoling_take_photo' });
  },
});
