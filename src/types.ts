export interface XiaolingAccount {
  accountId?: string | null;
  apiToken?: string | null;
  enabled?: boolean;
}

export interface XiaolingChannelConfig {
  enabled?: boolean;
  apiToken?: string;
  defaultAccount?: string;
  accounts?: Record<string, { apiToken?: string; enabled?: boolean }>;
}
