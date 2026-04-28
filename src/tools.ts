import { Type } from '@sinclair/typebox';
import type { OpenClawPluginToolFactory } from 'openclaw/plugin-sdk/core';

import { sendMcpToolCall, getAnyActiveAccountId } from '@/connection';
import { TAKE_PHOTO_TOOL_NAME, XiaolingToolCallError, type NormalizedMcpResult } from '@/mcp';

type ToolContent =
  { type: 'text'; text: string } |
  { type: 'image'; data: string; mimeType: string };

interface XiaolingPhotoExecutionResult {
  content: ToolContent[];
  details: {
    toolName: typeof TAKE_PHOTO_TOOL_NAME;
    result: unknown;
    raw: unknown;
  };
}

export async function executeXiaolingTakePhoto(
  params: Record<string, unknown> = {},
): Promise<XiaolingPhotoExecutionResult> {
  const accountId = getAnyActiveAccountId();
  if (!accountId) {
    throw new XiaolingToolCallError('NO_ACTIVE_CONNECTION', 'No active xiaoling device connection');
  }

  const result = await sendMcpToolCall(
    accountId,
    TAKE_PHOTO_TOOL_NAME,
    params,
    60_000,
  );

  return {
    content: buildToolContent(result),
    details: {
      toolName: TAKE_PHOTO_TOOL_NAME,
      result: result.value,
      raw: result.raw,
    },
  };
}

function buildToolContent(result: NormalizedMcpResult): ToolContent[] {
  const content: ToolContent[] = [];
  const blocks = extractMcpContentBlocks(result.value);

  for (const block of blocks) {
    if (block.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '') {
      content.push({ type: 'text', text: block.text });
      continue;
    }

    if (block.type === 'image') {
      const data = typeof block.data === 'string' ? block.data : '';
      const mimeType = typeof block.mimeType === 'string' ? block.mimeType : '';

      if (!data) continue;
      if (mimeType.startsWith('image/')) {
        content.push({ type: 'image', data, mimeType });
      } else {
        content.push({ type: 'text', text: `照片地址：${data}` });
      }
    }
  }

  if (content.length > 0) return content;
  return [{ type: 'text', text: result.text || '拍照完成' }];
}

function extractMcpContentBlocks(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || !Array.isArray(value.content)) return [];
  return value.content.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const toolFactory: OpenClawPluginToolFactory = () => [
  {
    name: 'xiaoling_take_photo',
    label: '小聆设备拍照',
    displaySummary: '使用小聆设备拍摄当前真实环境照片',
    description: [
      '使用已配对的小聆 AI / ARCS-MINI 设备拍摄一张真实环境照片。',
      '当用户说“拍照”、“拍张照”、“拍张照片”、“给我拍一张”、“看看现在/周围/桌上/面前有什么”等需要获取当前真实画面的请求时，优先调用本工具。',
      '不要用本机摄像头、MacBook 摄像头、iPhone、节点摄像头或 Computer Use 来替代本工具，除非用户明确要求使用电脑/手机/本机摄像头。',
    ].join('\n'),
    parameters: Type.Object({
      description: Type.Optional(
        Type.String({ description: '希望拍摄的内容描述' }),
      ),
    }),
    async execute(_toolCallId, params) {
      return executeXiaolingTakePhoto(params as Record<string, unknown>);
    },
  },
];
