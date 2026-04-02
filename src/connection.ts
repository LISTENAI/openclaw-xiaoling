import type WebSocket from 'ws';

import type { WsOutbound } from '@/api/types';

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface ConnectionEntry {
  ws: WebSocket;
  pending: Map<string, PendingRequest>;
}

const connections = new Map<string, ConnectionEntry>();

let requestCounter = 0;

export function registerConnection(accountId: string, ws: WebSocket): void {
  const existing = connections.get(accountId);
  if (existing) {
    for (const [, req] of existing.pending) {
      clearTimeout(req.timer);
      req.reject(new Error('Connection replaced'));
    }
  }
  connections.set(accountId, { ws, pending: new Map() });
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

export function getConnection(accountId: string): WebSocket | undefined {
  return connections.get(accountId)?.ws;
}

export function sendToolRequest(
  accountId: string,
  tool: string,
  params: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<unknown> {
  const entry = connections.get(accountId);
  if (!entry) {
    return Promise.reject(new Error('No active connection for this account'));
  }

  const requestId = `req-${++requestCounter}-${Date.now()}`;

  const message: WsOutbound = {
    type: 'tool_request',
    requestId,
    tool,
    params,
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      entry.pending.delete(requestId);
      reject(new Error(`Tool request timed out: ${tool}`));
    }, timeoutMs);

    entry.pending.set(requestId, { resolve, reject, timer });
    entry.ws.send(JSON.stringify(message));
  });
}

export function handleToolResult(accountId: string, requestId: string, data: unknown): void {
  const entry = connections.get(accountId);
  if (!entry) return;

  const pending = entry.pending.get(requestId);
  if (!pending) return;

  clearTimeout(pending.timer);
  entry.pending.delete(requestId);
  pending.resolve(data);
}
