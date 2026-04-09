import WebSocket from 'ws';
import type { ChannelPlugin } from 'openclaw/plugin-sdk/core';

import { getWsUrl } from '@/api';
import type { InboundFrame, MessageFrame, ReplyStreamFrame } from '@/api';
import { CHANNEL_ID } from '@/constants';
import { registerConnection, unregisterConnection, handleMcpResult } from '@/connection';
import type { XiaolingAccount } from '@/types';

type GatewayAdapter = NonNullable<ChannelPlugin<XiaolingAccount>['gateway']>;
type GatewayContext = Parameters<NonNullable<GatewayAdapter['startAccount']>>[0];

// Per-account abort controllers to prevent duplicate connection loops
const accountAbortControllers = new Map<string, AbortController>();

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

function connectAndListen(ctx: GatewayContext): Promise<void> {
  const { account, accountId, log } = ctx;

  // Abort any previous connection loop for this account
  accountAbortControllers.get(accountId)?.abort();
  const localAbort = new AbortController();
  accountAbortControllers.set(accountId, localAbort);

  // Abort when either the ctx signal or our local signal fires
  const abortSignal = localAbort.signal;
  ctx.abortSignal.addEventListener('abort', () => localAbort.abort(), { once: true });

  if (!account.apiToken) {
    log?.error?.('No apiToken configured, cannot connect');
    return Promise.resolve();
  }

  const url = getWsUrl(account.apiToken);
  let reconnectAttempt = 0;

  // Never resolve until aborted — framework expects startAccount to
  // block for the lifetime of the connection.
  const lifetimePromise = new Promise<void>((resolve) => {
    abortSignal.addEventListener('abort', () => resolve(), { once: true });
  });

  function connect() {
    if (abortSignal.aborted) return;

    log?.info?.(`Connecting to LSPlatform: ${url}`);
    const ws = new WebSocket(url);

    let pingInterval: ReturnType<typeof setInterval> | undefined;

    function sendPing() {
      if (ws.readyState !== WebSocket.OPEN) return;
      const frame = {
        type: 'ping',
        headers: { request_id: `ping-${Date.now()}` },
        payload: { ts: Math.floor(Date.now() / 1000) },
      };
      const data = JSON.stringify(frame);
      log?.info?.(`WS send: ${data}`);
      ws.send(data);
    }

    ws.on('open', () => {
      log?.info?.('Connected to LSPlatform');
      reconnectAttempt = 0;
      registerConnection(accountId, ws);
      ctx.setStatus({
        accountId,
        connected: true,
        running: true,
        lastConnectedAt: Date.now(),
      });

      // Send initial ping immediately, then every 30s
      sendPing();
      pingInterval = setInterval(sendPing, 30_000);


    });

    ws.on('message', (raw) => {
      const text = String(raw);
      log?.info?.(`WS recv: ${text.slice(0, 200)}`);

      let msg: { type: string; headers?: { request_id?: string }; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(text);
      } catch {
        log?.warn?.('Received invalid JSON from LSPlatform');
        return;
      }

      const frame = msg as unknown as InboundFrame;

      if (frame.type === 'ping') {
        const ack = {
          type: 'ack',
          headers: { request_id: frame.headers?.request_id ?? '' },
          payload: { code: 0, message: 'ok', ...(frame.payload?.ts != null ? { ts: frame.payload.ts } : {}) },
        };
        ws.send(JSON.stringify(ack));
      } else if (frame.type === 'message') {
        handleInboundMessage(ctx, ws, frame);
      } else if (frame.type === 'mcp') {
        if (frame.payload.name === 'tool.result') {
          handleMcpResult(accountId, frame.headers.request_id, frame.payload.result);
        }
      } else if (frame.type === 'error') {
        log?.error?.(`Server error: ${frame.payload.code} ${frame.payload.message}`);
      }
    });

    ws.on('close', (code, reason) => {
      clearInterval(pingInterval);
      log?.info?.(`Disconnected from LSPlatform (code: ${code}, reason: ${reason})`);
      unregisterConnection(accountId);
      ctx.setStatus({
        accountId,
        connected: false,
        running: true,
        lastDisconnect: { at: Date.now() },
      });
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      log?.error?.(`WebSocket error: ${err.message}`);
      ctx.setStatus({
        accountId,
        connected: false,
        lastError: err.message,
      });
    });

    abortSignal.addEventListener('abort', () => {
      ws.close();
    }, { once: true });
  }

  async function scheduleReconnect() {
    if (abortSignal.aborted) return;
    const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
    reconnectAttempt++;
    log?.info?.(`Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
    try {
      await sleep(delay, abortSignal);
      connect();
    } catch {
      // aborted
    }
  }

  connect();
  return lifetimePromise;
}

function extractBody(frame: MessageFrame): string {
  const { payload } = frame;
  if (payload.message_type === 'text') {
    return payload.text.content;
  } else if (payload.message_type === 'mixed') {
    return payload.mixed.items
      .filter((i) => i.message_type === 'text')
      .map((i) => i.text?.content ?? '')
      .join('\n');
  }
  return '';
}

function handleInboundMessage(
  ctx: GatewayContext,
  ws: WebSocket,
  frame: MessageFrame,
): void {
  const { cfg, accountId, log } = ctx;
  const runtime = ctx.channelRuntime;

  if (!runtime) {
    log?.warn?.('channelRuntime not available, skipping message dispatch');
    return;
  }

  const { payload } = frame;
  const requestId = frame.headers.request_id;
  const streamId = `stream-${requestId}`;

  const route = runtime.routing.resolveAgentRoute({
    cfg,
    channel: CHANNEL_ID,
    accountId,
    peer: { kind: 'direct', id: payload.sender.id },
  });

  const msgCtx = runtime.reply.finalizeInboundContext({
    Body: extractBody(frame),
    From: payload.sender.id,
    To: accountId,
    SessionKey: route.sessionKey,
    AccountId: accountId,
    Channel: CHANNEL_ID,
    ChatType: 'direct',
    Provider: CHANNEL_ID,
    MessageSid: payload.message_id,
  });

  void runtime.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: msgCtx,
    cfg,
    dispatcherOptions: {
      deliver: async (deliverPayload) => {
        const text = deliverPayload.text ?? '';
        if (!text) return;
        const replyFrame: ReplyStreamFrame = {
          type: 'reply',
          headers: { request_id: requestId },
          payload: {
            reply_type: 'stream',
            stream: { stream_id: streamId, finished: false, content: text },
          },
        };
        ws.send(JSON.stringify(replyFrame));
      },
    },
  }).then(() => {
    // Send finished frame
    const finalFrame: ReplyStreamFrame = {
      type: 'reply',
      headers: { request_id: requestId },
      payload: {
        reply_type: 'stream',
        stream: { stream_id: streamId, finished: true, content: '' },
      },
    };
    ws.send(JSON.stringify(finalFrame));
  }).catch((err) => {
    log?.error?.(`Failed to dispatch reply: ${err}`);
  });
}

export const gatewayAdapter: GatewayAdapter = {
  async startAccount(ctx) {
    ctx.log?.info?.(`Starting gateway for account "${ctx.accountId}" (device: ${ctx.account.deviceId})`);
    await connectAndListen(ctx);
  },

  async stopAccount(ctx) {
    ctx.log?.info?.(`Stopping gateway for account "${ctx.accountId}" (device: ${ctx.account.deviceId})`);
    accountAbortControllers.get(ctx.accountId)?.abort();
    accountAbortControllers.delete(ctx.accountId);
    unregisterConnection(ctx.accountId);
  },
};
