import { Type } from '@sinclair/typebox';
import type { OpenClawPluginToolFactory } from 'openclaw/plugin-sdk/core';

import { sendMcpRequest } from '@/connection';

export const toolFactory: OpenClawPluginToolFactory = (ctx) => {
  const accountId = ctx.agentAccountId;
  if (!accountId) return null;

  return [
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
        const result = await sendMcpRequest(accountId, 'tool.call', { tool: 'camera.describe', ...params });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          details: result,
        };
      },
    },
  ];
};
