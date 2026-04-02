import type { ExchangeCodeResponse } from './types.js';

export async function exchangeCode(code: string): Promise<ExchangeCodeResponse> {
  // TODO: Replace with real LSPlatform API call
  void code;
  return {
    apiToken: `mock-token-${Date.now()}`,
    userId: 'mock-user-001',
  };
}

export function getWsUrl(apiToken: string): string {
  // TODO: Replace with real LSPlatform WebSocket endpoint
  return `ws://localhost:18790/ws?token=${encodeURIComponent(apiToken)}`;
}
