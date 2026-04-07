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
