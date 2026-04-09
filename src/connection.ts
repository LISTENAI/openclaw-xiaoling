import type WebSocket from 'ws';

import type { McpOutboundFrame } from '@/api';

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

export function sendMcpRequest(
  accountId: string,
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<unknown> {
  const entry = connections.get(accountId);
  if (!entry) {
    return Promise.reject(new Error('No active connection for this account'));
  }

  const requestId = `mcp-${++requestCounter}-${Date.now()}`;

  const frame: McpOutboundFrame = {
    type: 'mcp',
    headers: { request_id: requestId },
    payload: { name, arguments: args },
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      entry.pending.delete(requestId);
      reject(new Error(`MCP request timed out: ${name}`));
    }, timeoutMs);

    entry.pending.set(requestId, { resolve, reject, timer });
    entry.ws.send(JSON.stringify(frame));
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
