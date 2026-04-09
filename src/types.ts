import type { ChannelPlugin } from 'openclaw/plugin-sdk/core';

export interface XiaolingAccount {
  accountId?: string | null;
  apiToken?: string | null;
  productId?: string | null;
  deviceId?: string | null;
  enabled?: boolean;
}

export interface XiaolingChannelConfig {
  enabled?: boolean;
  defaultAccount?: string;
  accounts?: Record<string, XiaolingAccount>;
}

type GatewayAdapter = NonNullable<ChannelPlugin<XiaolingAccount>['gateway']>;
export type GatewayContext = Parameters<NonNullable<GatewayAdapter['startAccount']>>[0];
