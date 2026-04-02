import WebSocket from 'ws';
import type { ChannelPlugin } from 'openclaw/plugin-sdk/core';

import { getWsUrl } from '@/api/client';
import type { WsInbound, WsOutbound } from '@/api/types';
import { CHANNEL_ID } from '@/constants';
import { registerConnection, unregisterConnection, handleToolResult } from '@/connection';
import type { XiaolingAccount } from '@/types';

type GatewayAdapter = NonNullable<ChannelPlugin<XiaolingAccount>['gateway']>;
type GatewayContext = Parameters<NonNullable<GatewayAdapter['startAccount']>>[0];

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

function connectAndListen(ctx: GatewayContext): void {
  const { account, accountId, abortSignal, log } = ctx;

  if (!account.apiToken) {
    log?.error?.('No apiToken configured, cannot connect');
    return;
  }

  const url = getWsUrl(account.apiToken);
  let reconnectAttempt = 0;

  function connect() {
    if (abortSignal.aborted) return;

    log?.info?.(`Connecting to LSPlatform: ${url}`);
    const ws = new WebSocket(url);

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
    });

    ws.on('message', (raw) => {
      let msg: WsInbound;
      try {
        msg = JSON.parse(String(raw)) as WsInbound;
      } catch {
        log?.warn?.('Received invalid JSON from LSPlatform');
        return;
      }

      if (msg.type === 'message') {
        handleInboundMessage(ctx, ws, msg);
      } else if (msg.type === 'tool_result') {
        handleToolResult(accountId, msg.requestId, msg.data);
      }
    });

    ws.on('close', () => {
      log?.info?.('Disconnected from LSPlatform');
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
}

function handleInboundMessage(
  ctx: GatewayContext,
  ws: WebSocket,
  msg: Extract<WsInbound, { type: 'message' }>,
): void {
  const { cfg, accountId, log } = ctx;
  const runtime = ctx.channelRuntime;

  if (!runtime) {
    log?.warn?.('channelRuntime not available, skipping message dispatch');
    return;
  }

  const route = runtime.routing.resolveAgentRoute({
    cfg,
    channel: CHANNEL_ID,
    accountId,
    peer: { kind: 'direct', id: msg.senderId },
  });

  const msgCtx = runtime.reply.finalizeInboundContext({
    Body: msg.text,
    From: msg.senderId,
    To: accountId,
    SessionKey: route.sessionKey,
    AccountId: accountId,
    Channel: CHANNEL_ID,
    ChatType: 'direct',
    Provider: CHANNEL_ID,
    MessageSid: msg.messageId,
  });

  void runtime.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: msgCtx,
    cfg,
    dispatcherOptions: {
      deliver: async (payload) => {
        const text = payload.text ?? '';
        if (!text) return;
        const outbound: WsOutbound = {
          type: 'reply',
          messageId: msg.messageId,
          text,
        };
        ws.send(JSON.stringify(outbound));
      },
    },
  }).catch((err) => {
    log?.error?.(`Failed to dispatch reply: ${err}`);
  });
}

export const gatewayAdapter: GatewayAdapter = {
  async startAccount(ctx) {
    connectAndListen(ctx);
  },

  async stopAccount(ctx) {
    unregisterConnection(ctx.accountId);
  },
};
