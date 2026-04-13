import http from 'ky';

import { API_BASE, WS_BASE } from '@/constants';

export interface ApiEnvelope<T> {
  code: string;
  message: string;
  data: T;
}

export interface WsFrame<T extends string, P> {
  type: T;
  headers: {
    request_id: string;
  };
  payload: P;
}

export type InboundFrame =
  AckFrame |
  TextMessageFrame |
  ImageMessageFrame |
  FileMessageFrame |
  MixedMessageFrame |
  EventFrame |
  McpToolResultFrame |
  ErrorFrame;

export type OutboundFrame =
  PingFrame |
  ReplyFrame |
  McpToolCallFrame;

export type PingFrame = WsFrame<'ping', {
  ts: number;
}>;

export type AckFrame = WsFrame<'ack', {
  code: number;
  message: string;
}>;

export type MessageFrame<T extends string, P> = WsFrame<'message', {
  message_id: string;
  conversation_id: string;
  sender: { id: string };
  timestamp: number;
  message_type: T;
} & P>;

export type TextMessageFrame = MessageFrame<'text', {
  text: {
    content: string;
  };
}>;

export type ImageMessageFrame = MessageFrame<'image', {
  image: {
    url: string;
    decrypt_key?: string;
    mime_type: string;
  };
}>;

export type FileMessageFrame = MessageFrame<'file', {
  file: {
    url: string;
    decrypt_key?: string;
    file_name: string;
    mime_type: string;
    size: number;
  };
}>;

export type MixedMessageFrame = MessageFrame<'mixed', {
  mixed: {
    items: (
      Pick<TextMessageFrame['payload'], 'message_type' | 'text'> |
      Pick<ImageMessageFrame['payload'], 'message_type' | 'image'> |
      Pick<FileMessageFrame['payload'], 'message_type' | 'file'>
    )[];
  };
}>;

export type EventFrame = WsFrame<'event', {
  event_id: string;
  conversation_id?: string;
  session_id?: string;
  timestamp: number;
  event_type: string;
  actor: { id: string };
}>;

export type ReplyFrame = WsFrame<'reply', {
  message_id: string;
  reply_type: 'stream';
  stream: {
    stream_id: string;
    finished: boolean;
    content: string;
    items?: {
      message_type: 'image';
      image: {
        base64: string;
        md5: string;
      };
    }[];
  };
} | {
  message_id: string;
  reply_type: 'image';
  image: {
    media_id: string;
  };
}>;

export type McpToolCallFrame = WsFrame<'mcp', {
  name: 'tool.call';
  arguments: Record<string, unknown>;
}>;

export type McpToolResultFrame = WsFrame<'mcp', {
  name: 'tool.result';
  result: unknown;
}>;

export type ErrorFrame = WsFrame<'error', {
  code: string;
  message: string;
}>;

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
