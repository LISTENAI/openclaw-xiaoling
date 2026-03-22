/**
 * LSPlatform WebSocket protocol message types.
 *
 * The exact schema is defined by the cloud (LSPlatform) team.
 * These types serve as documented stubs — fill in the real fields
 * once the protocol spec is finalised.
 */

// ---------------------------------------------------------------------------
// Inbound: LSPlatform → OpenClaw
// ---------------------------------------------------------------------------

/** LSPlatform → OpenClaw: complete text message (user query) */
export type LSPlatformInboundTextMessage = {
  type: "text";
  /** Unique request identifier used to correlate streaming replies. */
  requestId: string;
  /** Sender identifier on the LSPlatform side (user id, device id, etc.). */
  from: string;
  /** Message body text. */
  body: string;
  /** Unix timestamp (ms) of the original message. */
  timestamp: number;
};

/** LSPlatform → OpenClaw: image message */
export type LSPlatformInboundImageMessage = {
  type: "image";
  requestId: string;
  from: string;
  /** URL to fetch the image from. */
  url: string;
  mimeType?: string;
  timestamp: number;
};

/** LSPlatform → OpenClaw: result of a photo-capture request */
export type LSPlatformInboundPhotoResponseMessage = {
  type: "photo_response";
  requestId: string;
  /** URL of the captured photo. */
  url: string;
  mimeType?: string;
};

/** Keep-alive ping from LSPlatform */
export type LSPlatformPingMessage = {
  type: "ping";
};

export type LSPlatformInboundMessage =
  | LSPlatformInboundTextMessage
  | LSPlatformInboundImageMessage
  | LSPlatformInboundPhotoResponseMessage
  | LSPlatformPingMessage;

// ---------------------------------------------------------------------------
// Outbound: OpenClaw → LSPlatform
// ---------------------------------------------------------------------------

/** OpenClaw → LSPlatform: a streaming text chunk (for real-time TTS) */
export type LSPlatformOutboundTextChunkMessage = {
  type: "text_chunk";
  requestId: string;
  chunk: string;
};

/** OpenClaw → LSPlatform: signals the end of a streaming text reply */
export type LSPlatformOutboundTextDoneMessage = {
  type: "text_done";
  requestId: string;
};

/** OpenClaw → LSPlatform: request the associated device to capture a photo */
export type LSPlatformOutboundPhotoRequestMessage = {
  type: "photo_request";
  requestId: string;
};

/** Keep-alive pong from OpenClaw */
export type LSPlatformPongMessage = {
  type: "pong";
};

export type LSPlatformOutboundMessage =
  | LSPlatformOutboundTextChunkMessage
  | LSPlatformOutboundTextDoneMessage
  | LSPlatformOutboundPhotoRequestMessage
  | LSPlatformPongMessage;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a raw JSON string into a typed inbound message, or null on error. */
export function parseLSPlatformMessage(raw: string): LSPlatformInboundMessage | null {
  // TODO: validate against the real protocol schema once available
  try {
    const msg = JSON.parse(raw) as unknown;
    if (typeof msg !== "object" || msg === null || !("type" in msg)) {
      return null;
    }
    return msg as LSPlatformInboundMessage;
  } catch {
    return null;
  }
}

/** Serialize an outbound message to a JSON string. */
export function serializeLSPlatformMessage(msg: LSPlatformOutboundMessage): string {
  return JSON.stringify(msg);
}
