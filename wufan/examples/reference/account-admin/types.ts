import type React from 'react';

export type WufanAccountAdminTheme = 'light' | 'dark';

export type WufanSettingsTab =
  | 'profile'
  | 'spaces'
  | 'assets'
  | 'my-api'
  | 'usage'
  | 'subscription'
  | 'space-mgmt';

export type WufanAdminTab =
  | 'messages'
  | 'token_usage'
  | 'performance'
  | 'feedback'
  | 'mcp_clients'
  | 'troubleshoot'
  | 'tools'
  | 'user_activity'
  | 'realtime'
  | 'system'
  | 'showcase';

export interface WufanAccountUser {
  id: string;
  name: string;
  email: string;
  source?: 'password' | 'cas';
}

export interface WufanSpace {
  id: string;
  name: string;
  plan: 'free' | 'developer' | 'pro' | 'enterprise';
  role: 'owner' | 'admin' | 'member';
  isPersonal?: boolean;
  current?: boolean;
  memberCount: number;
  agentCount: number;
  skillCount: number;
}

export interface WufanQuotaItem {
  id: string;
  label: string;
  used: number;
  limit: number | null;
  byok?: boolean;
  group: 'chat' | 'tools';
}

export interface WufanAssetItem {
  id: string;
  name: string;
  kind: 'tool' | 'skill' | 'partner' | 'automation' | 'widget';
  description: string;
  status?: string;
}

export interface WufanTokenUsageRow {
  id: string;
  user: string;
  agent: string;
  model: string;
  source: '平台' | '团队';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  createdAt: string;
}

export interface WufanFeedbackAdminRow {
  id: string;
  sentiment: 'positive' | 'negative';
  user: string;
  agent: string;
  sessionTitle: string;
  messagePreview: string;
  categories: string[];
  content: string;
  createdAt: string;
}

export interface WufanAdminMockData {
  tokenRows: WufanTokenUsageRow[];
  feedbackRows: WufanFeedbackAdminRow[];
}

export interface WufanAccountSettingsProps {
  isOpen: boolean;
  theme: WufanAccountAdminTheme;
  user: WufanAccountUser;
  currentSpace: WufanSpace;
  spaces: WufanSpace[];
  quotas: WufanQuotaItem[];
  assets: WufanAssetItem[];
  initialTab?: WufanSettingsTab;
  showAdminEntry?: boolean;
  onClose: () => void;
  onThemeChange?: (theme: WufanAccountAdminTheme) => void;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
}

export interface WufanAdminPlatformProps {
  theme: WufanAccountAdminTheme;
  data: WufanAdminMockData;
  initialTab?: WufanAdminTab;
  onClose: () => void;
}

export interface WufanAccountAdminDemoProps {
  theme?: WufanAccountAdminTheme;
  initialView?: 'app' | 'settings' | 'admin';
  initialSettingsTab?: WufanSettingsTab;
  initialAdminTab?: WufanAdminTab;
  renderSidebarSlot?: React.ReactNode;
}
