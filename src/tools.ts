import { Type } from '@sinclair/typebox';
import type { OpenClawPluginToolFactory } from 'openclaw/plugin-sdk/core';

import { sendMcpToolCall, getAnyActiveAccountId } from '@/connection';
import { TAKE_PHOTO_TOOL_NAME, XiaolingToolCallError, type NormalizedMcpResult } from '@/mcp';

interface ImageToolContent {
  type: 'image';
  data: string;
  mimeType: string;
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
  url?: string;
}

type ToolContent =
  { type: 'text'; text: string } |
  ImageToolContent;

interface BuiltToolContent {
  content: ToolContent[];
  mediaUrls: string[];
}

interface XiaolingPhotoExecutionResult {
  content: ToolContent[];
  details: {
    toolName: typeof TAKE_PHOTO_TOOL_NAME;
    result: unknown;
    raw: unknown;
    media?: {
      mediaUrl: string;
      mediaUrls: string[];
    };
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
    { ...params, sync: true },
    60_000,
  );

  const built = await buildToolContent(result);

  return {
    content: built.content,
    details: {
      toolName: TAKE_PHOTO_TOOL_NAME,
      result: result.value,
      raw: result.raw,
      ...(built.mediaUrls.length > 0
        ? {
            media: {
              mediaUrl: built.mediaUrls[0]!,
              mediaUrls: built.mediaUrls,
            },
          }
        : {}),
    },
  };
}

async function fetchImageContent(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new XiaolingToolCallError(
      'DEVICE_TOOL_ERROR',
      `photo fetch failed: HTTP ${response.status}`,
    );
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  if (!mimeType.startsWith('image/')) {
    throw new XiaolingToolCallError(
      'DEVICE_TOOL_ERROR',
      `photo fetch returned non-image content-type: ${mimeType}`,
    );
  }

  return {
    data: Buffer.from(await response.arrayBuffer()).toString('base64'),
    mimeType,
  };
}

async function buildToolContent(result: NormalizedMcpResult): Promise<BuiltToolContent> {
  const content: ToolContent[] = [];
  const mediaUrls: string[] = [];
  const seenMediaUrls = new Set<string>();
  const blocks = extractMcpContentBlocks(result.value);
  const appendImageUrl = async (url: string): Promise<void> => {
    const normalizedUrl = normalizeHttpUrl(url);
    if (!normalizedUrl || seenMediaUrls.has(normalizedUrl)) return;

    seenMediaUrls.add(normalizedUrl);
    mediaUrls.push(normalizedUrl);

    try {
      const image = await fetchImageContent(normalizedUrl);
      content.push(createImageContent(image, normalizedUrl));
    } catch {
      // Keep the URL as media metadata even if the model-visible image fetch fails.
    }
  };

  for (const block of blocks) {
    if (block.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '') {
      const urls = extractHttpUrls(block.text);
      const text = stripMediaReferences(block.text, urls);
      if (text) content.push({ type: 'text', text });
      for (const url of urls) {
        await appendImageUrl(url);
      }
      continue;
    }

    if (block.type === 'image') {
      const data = typeof block.data === 'string' ? block.data : '';
      const mimeType = typeof block.mimeType === 'string' ? block.mimeType : '';

      if (!data) continue;
      const imageUrl = normalizeHttpUrl(data);
      if (imageUrl) {
        await appendImageUrl(imageUrl);
        continue;
      }

      const dataUrlImage = parseImageDataUrl(data);
      if (dataUrlImage) {
        content.push(dataUrlImage);
        continue;
      }

      if (mimeType.startsWith('image/')) {
        content.push(createImageContent({ data, mimeType }));
      } else {
        content.push({ type: 'text', text: `照片地址：${data}` });
      }
    }
  }

  if (content.length > 0) return finalizeBuiltToolContent(content, mediaUrls);

  const fallbackText = result.text || '拍照完成';
  const urls = extractHttpUrls(fallbackText);
  const text = stripMediaReferences(fallbackText, urls);
  if (text) content.push({ type: 'text', text });
  for (const url of urls) {
    await appendImageUrl(url);
  }
  if (content.length === 0) content.push({ type: 'text', text: '拍照完成' });

  return finalizeBuiltToolContent(content, mediaUrls);
}

function extractMcpContentBlocks(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || !Array.isArray(value.content)) return [];
  return value.content.filter(isRecord);
}

function extractHttpUrls(text: string): string[] {
  return [...text.matchAll(/https?:\/\/\S+/g)]
    .map((match) => normalizeHttpUrl(match[0]))
    .filter((url): url is string => url !== undefined);
}

function normalizeHttpUrl(value: string): string | undefined {
  const trimmed = value.trim().replace(/^:(?=https?:\/\/)/i, '').replace(/[)\]}>,，。；;]+$/u, '');
  if (!isHttpUrl(trimmed)) return undefined;
  return trimmed;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseImageDataUrl(value: string): ToolContent | undefined {
  const match = value.match(/^data:(image\/[^;,]+);base64,(.+)$/i);
  if (!match) return undefined;

  const mimeType = match[1];
  const data = match[2];
  if (!mimeType || !data) return undefined;

  return createImageContent({ data, mimeType });
}

function createImageContent(
  image: { data: string; mimeType: string },
  url?: string,
): ImageToolContent {
  return {
    type: 'image',
    data: image.data,
    mimeType: image.mimeType,
    source: {
      type: 'base64',
      media_type: image.mimeType,
      data: image.data,
    },
    ...(url ? { url } : {}),
  };
}

function finalizeBuiltToolContent(content: ToolContent[], mediaUrls: string[]): BuiltToolContent {
  const hasImage = content.some((block) => block.type === 'image');
  const hasText = content.some((block) => block.type === 'text' && block.text.trim() !== '');
  if (hasImage && !hasText) {
    content.unshift({ type: 'text', text: '拍照完成，图片如下。' });
  }

  return { content, mediaUrls };
}

function stripMediaReferences(text: string, urls: string[]): string {
  if (urls.length === 0 && !text.includes('MEDIA:')) return text.trim();

  return text
    .split(/\r?\n/)
    .map((line) => {
      if (line.trimStart().startsWith('MEDIA:')) return '';

      let cleaned = line;
      for (const url of urls) {
        cleaned = cleaned.split(url).join('');
      }

      return cleaned
        .replace(/(?:照片|图片|相片)?地址[：:]\s*$/u, '')
        .replace(/[，。；;,]\s*$/u, '')
        .trimEnd();
    })
    .filter((line) => line.trim() !== '')
    .join('\n')
    .trim();
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
