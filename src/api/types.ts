export interface ExchangeCodeResponse {
  apiToken: string;
  userId: string;
}

export type WsInbound =
  | { type: 'message'; messageId: string; senderId: string; text: string }
  | { type: 'tool_result'; requestId: string; data: unknown };

export type WsOutbound =
  | { type: 'reply'; messageId: string; text: string }
  | { type: 'tool_request'; requestId: string; tool: string; params: Record<string, unknown> };
