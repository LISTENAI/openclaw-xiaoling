import type { McpJsonRpcError } from '@/api';

export const TAKE_PHOTO_TOOL_NAME = 'ls.built_in.take_photo';

const ALLOWED_DEVICE_TOOLS = [
  TAKE_PHOTO_TOOL_NAME,
  'self.camera.take_photo',
] as const;

export type AllowedDeviceToolName = typeof ALLOWED_DEVICE_TOOLS[number];

export type XiaolingToolErrorCode =
  'NO_ACTIVE_CONNECTION' |
  'WS_NOT_OPEN' |
  'MCP_TIMEOUT' |
  'MCP_PROTOCOL_ERROR' |
  'MCP_SERVER_ERROR' |
  'DEVICE_TOOL_ERROR' |
  'DEVICE_TOOL_NOT_ALLOWED' |
  'AUTH_FAILED';

export interface NormalizedMcpResult {
  value: unknown;
  text: string;
  raw: unknown;
}

export class XiaolingToolCallError extends Error {
  readonly code: XiaolingToolErrorCode;
  readonly details?: unknown;

  constructor(code: XiaolingToolErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'XiaolingToolCallError';
    this.code = code;
    this.details = details;
  }
}

export function assertAllowedDeviceToolName(toolName: string): asserts toolName is AllowedDeviceToolName {
  if (!(ALLOWED_DEVICE_TOOLS as readonly string[]).includes(toolName)) {
    throw new XiaolingToolCallError(
      'DEVICE_TOOL_NOT_ALLOWED',
      `Device tool is not allowed: ${toolName}`,
      { toolName, allowedTools: ALLOWED_DEVICE_TOOLS },
    );
  }
}

export function normalizeMcpToolResponse(payload: unknown): NormalizedMcpResult {
  if (hasJsonRpcError(payload)) {
    throw classifyJsonRpcError(payload.error);
  }

  const rawResult = extractRawResult(payload);
  const unwrapped = unwrapMcpResult(rawResult);

  if (hasJsonRpcError(unwrapped)) {
    throw classifyJsonRpcError(unwrapped.error);
  }

  if (isDeviceErrorResult(unwrapped)) {
    throw new XiaolingToolCallError(
      'DEVICE_TOOL_ERROR',
      extractResultText(unwrapped) || 'Device tool returned an error',
      unwrapped,
    );
  }

  const value = extractMcpContentResult(unwrapped);
  const text = extractResultText(value);

  return {
    value,
    text,
    raw: payload,
  };
}

function classifyJsonRpcError(error: McpJsonRpcError): XiaolingToolCallError {
  const lowerMessage = error.message.toLowerCase();
  if (
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('auth') ||
    lowerMessage.includes('token')
  ) {
    return new XiaolingToolCallError('AUTH_FAILED', error.message, error);
  }

  return new XiaolingToolCallError('MCP_SERVER_ERROR', error.message, error);
}

function hasJsonRpcError(payload: unknown): payload is { error: McpJsonRpcError } {
  if (!isRecord(payload)) return false;
  if (!isRecord(payload.error)) return false;
  return typeof payload.error.message === 'string';
}

function extractRawResult(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;

  if (payload.name === 'tool.result' && 'result' in payload) {
    return payload.result;
  }

  if ('result' in payload) {
    return payload.result;
  }

  return payload;
}

function unwrapMcpResult(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const hasJsonRpc = typeof value.jsonrpc === 'string';
  const hasResult = 'result' in value;
  const hasError = 'error' in value;

  if (hasError) return value;
  if ((hasJsonRpc && hasResult) || (!hasJsonRpc && hasResult)) {
    return unwrapMcpResult(value.result);
  }

  return value;
}

function extractMcpContentResult(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    return value;
  }

  const contentItems = value.content.filter(isRecord);
  const hasNonTextItem = contentItems.some((item) => item.type !== 'text');
  if (hasNonTextItem) return value;

  const textItems = contentItems
    .filter((item) => typeof item.text === 'string')
    .map((item) => item.text as string);

  if (textItems.length === 0) return value;

  if (textItems.length === 1) {
    return parseJsonTextOrString(textItems[0]!);
  }

  return textItems.join('\n');
}

function isDeviceErrorResult(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.isError === true) return true;
  return typeof value.error === 'string' && value.error.trim() !== '';
}

function extractResultText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;

  if (isRecord(value)) {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.text === 'string') return value.text;
    if (Array.isArray(value.content)) {
      const textItems = value.content
        .filter(isRecord)
        .filter((item) => item.type === 'text' && typeof item.text === 'string')
        .map((item) => item.text as string);

      if (textItems.length > 0) return textItems.join('\n');
    }

    const contentResult = extractMcpContentResult(value);
    if (contentResult !== value) return extractResultText(contentResult);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseJsonTextOrString(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
