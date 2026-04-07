import http from 'ky';

import { API_BASE, WS_BASE } from '@/constants';

export interface ApiEnvelope<T> {
  code: string;
  message: string;
  data: T;
}

export type WsInbound =
  | { type: 'message'; messageId: string; senderId: string; text: string }
  | { type: 'tool_result'; requestId: string; data: unknown };

export type WsOutbound =
  | { type: 'reply'; messageId: string; text: string }
  | { type: 'tool_request'; requestId: string; tool: string; params: Record<string, unknown> };

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
