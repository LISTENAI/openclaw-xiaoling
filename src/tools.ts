import { Type } from '@sinclair/typebox';
import type { OpenClawPluginToolFactory } from 'openclaw/plugin-sdk/core';

import { sendMcpRequest, getAnyActiveAccountId } from '@/connection';

export const toolFactory: OpenClawPluginToolFactory = () => [
  {
    name: 'xiaoling_take_photo',
    label: '拍照',
    description: '请求小聆设备拍摄一张照片',
    parameters: Type.Object({
      description: Type.Optional(
        Type.String({ description: '希望拍摄的内容描述' }),
      ),
    }),
    async execute(_toolCallId, params) {
      const accountId = getAnyActiveAccountId();
      if (!accountId) {
        throw new Error('No active xiaoling device connection');
      }
      const result = await sendMcpRequest(accountId, 'tool.call', { tool: 'camera.describe', ...params });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        details: result,
      };
    },
  },
];
