import type WebSocket from 'ws';

import type { McpToolCallFrame, OutboundFrame } from '@/api';
import {
  assertAllowedDeviceToolName,
  normalizeMcpToolResponse,
  XiaolingToolCallError,
  type AllowedDeviceToolName,
  type NormalizedMcpResult,
} from '@/mcp';
import type { GatewayContext } from '@/types';

interface PendingRequest {
  resolve: (data: NormalizedMcpResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface ConnectionEntry {
  ws: WebSocket;
  ctx: GatewayContext;
  pending: Map<string, PendingRequest>;
  lastMessageId: string | null;
}

const connections = new Map<string, ConnectionEntry>();

let requestCounter = 0;

export function registerConnection(accountId: string, ws: WebSocket, ctx: GatewayContext): void {
  const existing = connections.get(accountId);
  if (existing) {
    for (const [, req] of existing.pending) {
      clearTimeout(req.timer);
      req.reject(new Error('Connection replaced'));
    }
  }
  connections.set(accountId, { ws, ctx, pending: new Map(), lastMessageId: null });
}

export function unregisterConnection(accountId: string): void {
  const entry = connections.get(accountId);
  if (!entry) return;
  for (const [, req] of entry.pending) {
    clearTimeout(req.timer);
    req.reject(new Error('Connection closed'));
  }
  connections.delete(accountId);
}

export function getAnyActiveAccountId(): string | undefined {
  for (const [accountId, entry] of connections) {
    if (entry.ws.readyState === 1 /* WebSocket.OPEN */) return accountId;
  }
  return undefined;
}

export function setLastMessageId(accountId: string, messageId: string): void {
  const entry = connections.get(accountId);
  if (entry) entry.lastMessageId = messageId;
}

export function getLastMessageId(accountId: string): string | null {
  return connections.get(accountId)?.lastMessageId ?? null;
}

export function sendFrame(accountId: string, frame: OutboundFrame): void {
  const entry = connections.get(accountId);
  if (!entry) throw new Error('No active connection for this account');
  if (entry.ws.readyState !== 1 /* WebSocket.OPEN */) {
    entry.ctx.log?.warn('WebSocket not open, cannot send frame');
    return;
  }
  const data = JSON.stringify(frame);
  entry.ctx.log?.info(`WS TX >> ${data}`);
  entry.ws.send(data);
}

function sendFrameOrThrow(entry: ConnectionEntry, frame: OutboundFrame): void {
  if (entry.ws.readyState !== 1 /* WebSocket.OPEN */) {
    throw new XiaolingToolCallError('WS_NOT_OPEN', 'WebSocket is not open');
  }

  const data = JSON.stringify(frame);
  entry.ctx.log?.info(`WS TX >> ${data}`);
  entry.ws.send(data);
}

export function sendMcpToolCall(
  accountId: string,
  toolName: AllowedDeviceToolName,
  args: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<NormalizedMcpResult> {
  assertAllowedDeviceToolName(toolName);

  const entry = connections.get(accountId);
  if (!entry) {
    return Promise.reject(new XiaolingToolCallError('NO_ACTIVE_CONNECTION', 'No active xiaoling device connection'));
  }
  if (entry.ws.readyState !== 1 /* WebSocket.OPEN */) {
    return Promise.reject(new XiaolingToolCallError('WS_NOT_OPEN', 'WebSocket is not open'));
  }

  const requestId = `mcp-${++requestCounter}-${Date.now()}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      entry.pending.delete(requestId);
      reject(new XiaolingToolCallError('MCP_TIMEOUT', `MCP request timed out: ${toolName}`, { requestId, toolName }));
    }, timeoutMs);

    entry.pending.set(requestId, { resolve, reject, timer });
    try {
      sendFrameOrThrow(entry, {
        type: 'mcp',
        headers: { request_id: requestId },
        payload: {
          jsonrpc: '2.0',
          id: requestId,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        },
      } satisfies McpToolCallFrame);
    } catch (error) {
      clearTimeout(timer);
      entry.pending.delete(requestId);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function handleMcpResponse(accountId: string, requestId: string, payload: unknown): void {
  const entry = connections.get(accountId);
  if (!entry) return;

  const pending = entry.pending.get(requestId);
  if (!pending) return;

  clearTimeout(pending.timer);
  entry.pending.delete(requestId);

  try {
    pending.resolve(normalizeMcpToolResponse(payload));
  } catch (error) {
    pending.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

export function handleRequestError(accountId: string, requestId: string, code: string, message: string): void {
  const entry = connections.get(accountId);
  if (!entry) return;

  const pending = entry.pending.get(requestId);
  if (!pending) return;

  clearTimeout(pending.timer);
  entry.pending.delete(requestId);
  pending.reject(new XiaolingToolCallError('MCP_SERVER_ERROR', `${code}: ${message}`, { code, message }));
}
