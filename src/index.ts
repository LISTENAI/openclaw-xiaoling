import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/core';

import { channelPlugin } from '@/channel';
import { toolFactory } from '@/tools';

const XIAOLING_PHOTO_ROUTING_PROMPT = [
  '重要：小聆设备拍照路由规则：',
  '- 当用户要求“拍照 / 拍张照 / 拍张照片 / 给我拍一张 / 再拍一张”，或要求查看当前真实环境、桌上、面前、周围有什么时，使用工具 xiaoling_take_photo。',
  '- xiaoling_take_photo 控制的是已配对的小聆 AI / ARCS-MINI 设备，不是本机摄像头。',
  '- 不要把这类小聆设备拍照请求路由到 Computer Use、MacBook 摄像头、iPhone、节点摄像头或其它本机相机工具；只有用户明确说要用电脑/手机/本机摄像头时才使用那些工具。',
].join('\n');

export default defineChannelPluginEntry({
  id: 'openclaw-xiaoling',
  name: '小聆 AI',
  description: 'OpenClaw × 小聆 AI 插件',
  plugin: channelPlugin,
  registerFull(api) {
    api.registerTool(toolFactory, { name: 'xiaoling_take_photo' });
    api.on('before_prompt_build', () => ({
      prependSystemContext: XIAOLING_PHOTO_ROUTING_PROMPT,
    }));
  },
});
