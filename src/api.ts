import http from 'ky';

import { API_BASE, WS_BASE } from '@/constants';

export interface ApiEnvelope<T> {
  code: string;
  message: string;
  data: T;
}

// ── WebSocket v1 协议帧类型 ──

export interface WsHeaders {
  request_id: string;
}

// 下行帧 (OpenClaw → 网关)

export interface PingFrame {
  type: 'ping';
  headers: WsHeaders;
  payload: { ts: number };
}

export interface AckFrame {
  type: 'ack';
  headers: WsHeaders;
  payload: { code: number; message: string; ts?: number };
}

export interface ReplyStreamFrame {
  type: 'reply';
  headers: WsHeaders;
  payload: {
    reply_type: 'stream';
    stream: {
      stream_id: string;
      finished: boolean;
      content: string;
      items?: Array<{
        message_type: 'image';
        image: { base64: string; md5: string };
      }>;
    };
  };
}

export interface McpOutboundFrame {
  type: 'mcp';
  headers: WsHeaders;
  payload: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

// 上行帧 (网关 → OpenClaw)

export interface Sender {
  id: string;
}

interface MessagePayloadBase {
  message_id: string;
  conversation_id: string;
  session_id: string;
  sender: Sender;
  timestamp: number;
}

export interface TextMessagePayload extends MessagePayloadBase {
  message_type: 'text';
  text: { content: string };
}

export interface ImageMessagePayload extends MessagePayloadBase {
  message_type: 'image';
  image: { url: string; decrypt_key: string; mime_type?: string };
}

export interface MixedItem {
  message_type: string;
  text?: { content: string };
  image?: { url: string; decrypt_key: string };
}

export interface MixedMessagePayload extends MessagePayloadBase {
  message_type: 'mixed';
  mixed: { items: MixedItem[] };
}

export type MessagePayload =
  | TextMessagePayload
  | ImageMessagePayload
  | MixedMessagePayload;

export interface MessageFrame {
  type: 'message';
  headers: WsHeaders;
  payload: MessagePayload;
}

export interface EventFrame {
  type: 'event';
  headers: WsHeaders;
  payload: {
    event_id: string;
    conversation_id: string;
    session_id: string;
    timestamp: number;
    event_type: string;
    actor: { id: string };
  };
}

export interface McpInboundFrame {
  type: 'mcp';
  headers: WsHeaders;
  payload: {
    name: string;
    result?: unknown;
    [key: string]: unknown;
  };
}

export interface ErrorFrame {
  type: 'error';
  headers: WsHeaders;
  payload: { code: string; message: string };
}

export type InboundFrame =
  | AckFrame
  | ErrorFrame
  | MessageFrame
  | EventFrame
  | McpInboundFrame
  | PingFrame;

export async function authExchange<T = {
  api_token: string;
  binding_id: string;
  device_id: string;
  product_id: string;
}>(pairingCode: string): Promise<T> {
  const { data } = await http.post(`${API_BASE}/external/openclaw/auth/exchange`, {
    json: { pairing_code: pairingCode },
  }).json<ApiEnvelope<T>>();

  return data;
}

export function getWsUrl(apiToken: string): string {
  return `${WS_BASE}?api_token=${encodeURIComponent(apiToken)}`;
}
