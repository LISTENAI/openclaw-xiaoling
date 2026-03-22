/**
 * Gateway adapter for the LSPlatform channel.
 *
 * Manages the persistent WebSocket connection to LSPlatform:
 *   - Authenticates with the stored apiToken.
 *   - Receives text / image / photo-response messages from LSPlatform.
 *   - Dispatches inbound text messages through the OpenClaw agent runtime.
 *   - Streams AI-generated text replies back to LSPlatform in real time.
 *   - Responds to photo-capture requests initiated by agent tools.
 *   - Reconnects automatically on unexpected disconnects.
 */

import WebSocket from "ws";
import type { ChannelGatewayAdapter, ChannelGatewayContext } from "openclaw/plugin-sdk";
import {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "openclaw/plugin-sdk";
import {
  parseLSPlatformMessage,
  serializeLSPlatformMessage,
  type LSPlatformInboundMessage,
  type LSPlatformInboundTextMessage,
  type LSPlatformInboundImageMessage,
  type LSPlatformInboundPhotoResponseMessage,
} from "../protocol.js";
import { LSPLATFORM_CHANNEL_ID, type LSPlatformAccount } from "./types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** How long to wait before reconnecting after an unexpected close (ms). */
const RECONNECT_DELAY_MS = 5_000;

/** WebSocket ping interval to keep NAT/firewall sessions alive (ms). */
const PING_INTERVAL_MS = 30_000;

/**
 * Open a single WebSocket session and run until `abortSignal` fires.
 * Resolves when the session ends (either via abort or remote close).
 */
async function runWebSocketSession(
  account: LSPlatformAccount,
  ctx: ChannelGatewayContext<LSPlatformAccount>,
  statusSink: (patch: Partial<import("openclaw/plugin-sdk").ChannelAccountSnapshot>) => void,
): Promise<void> {
  const { log, abortSignal, channelRuntime } = ctx;

  const wsUrl = `${account.wsUrl}?token=${encodeURIComponent(account.apiToken ?? "")}`;
  log?.info(`[lsplatform] Connecting to ${account.wsUrl}`);

  return new Promise<void>((resolve) => {
    // Cast to a minimal interface to avoid re-specifying the entire ws API.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = new WebSocket(wsUrl) as any as {
      readyState: number;
      send(data: string): void;
      ping(): void;
      close(): void;
      on(event: "open", listener: () => void): void;
      on(event: "close", listener: (code: number, reason: Buffer) => void): void;
      on(event: "error", listener: (err: Error) => void): void;
      on(event: "message", listener: (data: WebSocket.RawData) => void): void;
    };

    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      if (pingTimer !== undefined) clearInterval(pingTimer);
      try { ws.close(); } catch { /* ignore */ }
    };

    const onAbort = () => {
      log?.info("[lsplatform] Abort signal received — closing WebSocket");
      cleanup();
      resolve();
    };
    abortSignal?.addEventListener("abort", onAbort, { once: true });

    ws.on("open", () => {
      log?.info("[lsplatform] WebSocket connected");
      statusSink({ connected: true, running: true, lastConnectedAt: Date.now(), lastError: null });

      pingTimer = setInterval(() => {
        if (ws.readyState === 1 /* OPEN */) {
          // Use native WebSocket ping frames for keep-alive.
          ws.ping();
        }
      }, PING_INTERVAL_MS);
    });

    ws.on("error", (err: Error) => {
      log?.error(`[lsplatform] WebSocket error: ${err.message}`);
      statusSink({ lastError: err.message });
    });

    ws.on("close", (code: number, reason: Buffer) => {
      const reasonStr = reason.toString() || "(none)";
      log?.warn(`[lsplatform] WebSocket closed (code=${code} reason=${reasonStr})`);
      statusSink({ connected: false, lastDisconnect: { at: Date.now(), status: code, error: reasonStr } });
      abortSignal?.removeEventListener("abort", onAbort);
      cleanup();
      resolve();
    });

    ws.on("message", (data: WebSocket.RawData) => {
      const raw = data.toString();
      const msg = parseLSPlatformMessage(raw);

      if (msg === null) {
        log?.warn(`[lsplatform] Received unknown message: ${raw.slice(0, 200)}`);
        return;
      }

      statusSink({ lastMessageAt: Date.now(), lastEventAt: Date.now() });

      switch (msg.type) {
        case "ping":
          ws.send(serializeLSPlatformMessage({ type: "pong" }));
          break;

        case "text":
          handleInboundText(msg, ws, ctx, channelRuntime, statusSink, log).catch((err: unknown) => {
            log?.error(`[lsplatform] Error handling text message: ${String(err)}`);
          });
          break;

        case "image":
          handleInboundImage(msg, ctx, channelRuntime, log).catch((err: unknown) => {
            log?.error(`[lsplatform] Error handling image message: ${String(err)}`);
          });
          break;

        case "photo_response":
          handlePhotoResponse(msg, log);
          break;

        default: {
          // TypeScript exhaustive check — 'msg' must be 'never' if all types are handled.
          const _exhaustive: never = msg;
          log?.warn(`[lsplatform] Unhandled message type: ${(_exhaustive as LSPlatformInboundMessage & { type: string }).type}`);
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Inbound message handlers (stubs — filled in once protocol is finalised)
// ---------------------------------------------------------------------------

/** Minimal interface for a send-capable WebSocket connection. */
type WsSendable = { send(data: string): void };

type ChannelRuntime = ChannelGatewayContext<LSPlatformAccount>["channelRuntime"];
type StatusSink = (patch: Partial<import("openclaw/plugin-sdk").ChannelAccountSnapshot>) => void;
type LogSink = ChannelGatewayContext<LSPlatformAccount>["log"];

/**
 * Handle an inbound text message from LSPlatform.
 *
 * Dispatches the message body through the OpenClaw agent runtime so the AI
 * model can generate a reply. The reply is streamed back to LSPlatform as a
 * sequence of `text_chunk` messages followed by `text_done`.
 *
 * TODO: wire up `channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher`
 * once the routing / session key strategy for LSPlatform is decided.
 */
async function handleInboundText(
  msg: LSPlatformInboundTextMessage,
  ws: WsSendable,
  ctx: ChannelGatewayContext<LSPlatformAccount>,
  channelRuntime: ChannelRuntime,
  statusSink: StatusSink,
  log: LogSink,
): Promise<void> {
  log?.info(`[lsplatform] Received text from ${msg.from}: ${msg.body.slice(0, 80)}`);
  statusSink({ lastInboundAt: Date.now() });

  if (!channelRuntime) {
    log?.warn("[lsplatform] channelRuntime not available — cannot dispatch reply");
    return;
  }

  // TODO: implement full agent dispatch once protocol / routing is finalised.
  //
  // Suggested approach:
  //   1. Resolve the agent route via `channelRuntime.routing.resolveAgentRoute`.
  //   2. Build a MsgContext with Body, From, SessionKey, etc.
  //   3. Call `channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher` with
  //      a deliver callback that streams chunks back over the WebSocket:
  //
  //      deliver: async (payload) => {
  //        for (const chunk of payload.chunks) {
  //          ws.send(serializeLSPlatformMessage({ type: "text_chunk", requestId: msg.requestId, chunk }));
  //        }
  //        ws.send(serializeLSPlatformMessage({ type: "text_done", requestId: msg.requestId }));
  //      }

  void ws; // suppress unused-variable lint until implemented
  void ctx;
}

/**
 * Handle an inbound image message from LSPlatform.
 *
 * TODO: fetch the image bytes via `channelRuntime.media.fetchRemoteMedia`,
 * then forward to the agent as a media attachment alongside any text context.
 */
async function handleInboundImage(
  msg: LSPlatformInboundImageMessage,
  _ctx: ChannelGatewayContext<LSPlatformAccount>,
  channelRuntime: ChannelRuntime,
  log: LogSink,
): Promise<void> {
  log?.info(`[lsplatform] Received image from ${msg.from}: ${msg.url}`);

  if (!channelRuntime) {
    log?.warn("[lsplatform] channelRuntime not available — cannot process image");
    return;
  }

  // TODO: implement image dispatch once protocol / routing is finalised.
  //
  // Suggested approach:
  //   const buf = await channelRuntime.media.fetchRemoteMedia({ url: msg.url });
  //   const savedPath = await channelRuntime.media.saveMediaBuffer({ ... });
  //   // then dispatch with mediaUrl pointing at savedPath
}

/**
 * Handle a photo-response from LSPlatform (result of an earlier photo_request).
 *
 * TODO: resolve the pending photo request promise registered by the agent tool
 * and return the photo URL to the tool caller.
 */
function handlePhotoResponse(
  msg: LSPlatformInboundPhotoResponseMessage,
  log: LogSink,
): void {
  log?.info(`[lsplatform] Received photo response for request ${msg.requestId}: ${msg.url}`);

  // TODO: look up a pending Promise keyed by msg.requestId and resolve it
  // with msg.url so the `lsplatform_capture_photo` tool can return the URL.
}

// ---------------------------------------------------------------------------
// Gateway adapter export
// ---------------------------------------------------------------------------

export const lsplatformGatewayAdapter: ChannelGatewayAdapter<LSPlatformAccount> = {
  async startAccount(ctx: ChannelGatewayContext<LSPlatformAccount>): Promise<void> {
    const { account, log, abortSignal } = ctx;

    const statusSink = createAccountStatusSink({
      accountId: account.accountId,
      setStatus: ctx.setStatus,
    });

    if (!account.apiToken) {
      log?.warn(
        "[lsplatform] No apiToken configured — channel will not connect. " +
        "Run `npx -y @listenai/openclaw-lsplatform install` to pair.",
      );
      statusSink({ running: false, connected: false, lastError: "No apiToken configured" });
      return;
    }

    await runPassiveAccountLifecycle({
      abortSignal,
      start: async () => {
        // Connect and run until abort or unexpected close, then reconnect.
        while (!abortSignal?.aborted) {
          await runWebSocketSession(account, ctx, statusSink);

          if (abortSignal?.aborted) break;

          log?.info(`[lsplatform] Reconnecting in ${RECONNECT_DELAY_MS / 1000}s…`);
          statusSink({ connected: false, running: true });

          await new Promise<void>((res) => {
            const timer = setTimeout(res, RECONNECT_DELAY_MS);
            abortSignal?.addEventListener("abort", () => { clearTimeout(timer); res(); }, { once: true });
          });
        }

        log?.info("[lsplatform] Gateway stopped");
        statusSink({ running: false, connected: false });
        return undefined;
      },
      stop: async () => {
        // Abort is handled inside runWebSocketSession via the abortSignal.
      },
    });
  },

  async stopAccount(ctx: ChannelGatewayContext<LSPlatformAccount>): Promise<void> {
    // The abortSignal passed to startAccount drives shutdown.
    // Nothing extra needed here.
    ctx.log?.info("[lsplatform] stopAccount called");
  },
};

// ---------------------------------------------------------------------------
// Shared photo-request registry
// ---------------------------------------------------------------------------

/**
 * Pending photo-capture requests keyed by requestId.
 *
 * The `lsplatform_capture_photo` agent tool inserts a Promise resolver here;
 * `handlePhotoResponse` resolves it when the device responds.
 */
export const pendingPhotoRequests = new Map<string, (url: string) => void>();

/**
 * Register a pending photo request and return a Promise that resolves with
 * the photo URL when the device delivers the image.
 *
 * @param requestId - Unique identifier sent in the `photo_request` message.
 * @param timeoutMs - How long to wait before rejecting (default: 30 s).
 */
export function waitForPhotoResponse(requestId: string, timeoutMs = 30_000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingPhotoRequests.delete(requestId);
      reject(new Error(`Photo request ${requestId} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingPhotoRequests.set(requestId, (url: string) => {
      clearTimeout(timer);
      pendingPhotoRequests.delete(requestId);
      resolve(url);
    });
  });
}
