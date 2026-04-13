import type WebSocket from 'ws';

import type { McpToolCallFrame, OutboundFrame } from '@/api';
import type { GatewayContext } from '@/types';

interface PendingRequest {
  resolve: (data: unknown) => void;
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

export function sendMcpRequest(
  accountId: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<unknown> {
  const entry = connections.get(accountId);
  if (!entry) {
    return Promise.reject(new Error('No active connection for this account'));
  }

  const requestId = `mcp-${++requestCounter}-${Date.now()}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      entry.pending.delete(requestId);
      reject(new Error('MCP request timed out: tool.call'));
    }, timeoutMs);

    entry.pending.set(requestId, { resolve, reject, timer });
    sendFrame(accountId, {
      type: 'mcp',
      headers: { request_id: requestId },
      payload: { name: 'tool.call', arguments: args },
    } satisfies McpToolCallFrame);
  });
}

export function handleMcpResult(accountId: string, requestId: string, data: unknown): void {
  const entry = connections.get(accountId);
  if (!entry) return;

  const pending = entry.pending.get(requestId);
  if (!pending) return;

  clearTimeout(pending.timer);
  entry.pending.delete(requestId);
  pending.resolve(data);
}

export function handleRequestError(accountId: string, requestId: string, code: string, message: string): void {
  const entry = connections.get(accountId);
  if (!entry) return;

  const pending = entry.pending.get(requestId);
  if (!pending) return;

  clearTimeout(pending.timer);
  entry.pending.delete(requestId);
  pending.reject(new Error(`${code}: ${message}`));
}
