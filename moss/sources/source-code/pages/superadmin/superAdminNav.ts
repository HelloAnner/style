import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  Building2,
  Cpu,
  HeartPulse,
  LayoutDashboard,
  MessageSquareHeart,
  MessageSquareShare,
  MessagesSquare,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Webhook,
} from 'lucide-react';

export type SuperAdminNavGroupKey =
  | 'overview'
  | 'organization'
  | 'agents'
  | 'integrations'
  | 'operations'
  | 'system';

export type SuperAdminNavItem = {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  group: SuperAdminNavGroupKey;
  activePaths?: string[];
};

export type SuperAdminNavGroup = {
  key: SuperAdminNavGroupKey;
  label: string;
};

export const SUPER_ADMIN_DEFAULT_PATH = '/superadmin/dashboard';

export const SUPER_ADMIN_NAV_GROUPS: SuperAdminNavGroup[] = [
  { key: 'overview', label: '总览' },
  { key: 'organization', label: '组织与权限' },
  { key: 'system', label: '系统管理' },
  { key: 'agents', label: '智能体治理' },
  { key: 'integrations', label: '能力与集成' },
  { key: 'operations', label: '运营管理' },
];

export const SUPER_ADMIN_NAV_ITEMS: SuperAdminNavItem[] = [
  { key: 'dashboard', label: '数据总览', path: SUPER_ADMIN_DEFAULT_PATH, icon: LayoutDashboard, group: 'overview' },
  {
    key: 'analytics',
    label: '埋点分析',
    path: '/superadmin/analytics',
    icon: BarChart3,
    group: 'operations',
    activePaths: ['/superadmin/analytics'],
  },
  { key: 'users', label: '用户管理', path: '/superadmin/users', icon: Users, group: 'organization' },
  { key: 'tenants', label: '租户管理', path: '/superadmin/tenants', icon: Building2, group: 'organization' },
  { key: 'audit', label: '审计日志', path: '/superadmin/audit', icon: ShieldCheck, group: 'organization' },
  { key: 'ops', label: '运维中心', path: '/superadmin/ops', icon: HeartPulse, group: 'system' },
  {
    key: 'system-config',
    label: '配置中心',
    path: '/superadmin/channel-settings',
    icon: Settings,
    group: 'system',
    activePaths: [
      '/superadmin/channel-settings',
      '/superadmin/third-party-integrations',
      '/superadmin/xila-settings',
      '/superadmin/platform-config',
      '/superadmin/config/dashboard',
      '/superadmin/prompt-configs',
      '/superadmin/subagent-config',
    ],
  },
  { key: 'agents', label: '主智能体管理', path: '/superadmin/agents', icon: Bot, group: 'agents' },
  { key: 'subagents', label: '子智能体管理', path: '/superadmin/subagents', icon: Cpu, group: 'agents' },
  { key: 'mcp-clients', label: 'MCP管理', path: '/superadmin/mcp-clients', icon: Plug, group: 'integrations' },
  { key: 'open-api', label: '开放接口管理', path: '/superadmin/open-api', icon: Webhook, group: 'integrations' },
  { key: 'external-channels', label: '机器人集成', path: '/superadmin/external-channels', icon: MessageSquareShare, group: 'integrations' },
  { key: 'conversation-logs', label: '对话记录', path: '/superadmin/conversation-logs', icon: MessagesSquare, group: 'operations' },
  { key: 'feedback', label: '用户反馈', path: '/superadmin/feedback', icon: MessageSquareHeart, group: 'operations' },
  { key: 'showcase', label: '案例管理', path: '/superadmin/showcase', icon: Sparkles, group: 'operations' },
];

export function isSuperAdminNavItemActive(currentPath: string, item: SuperAdminNavItem): boolean {
  const paths = item.activePaths ?? [item.path];
  return paths.some((path) => currentPath === path || currentPath.startsWith(`${path}/`));
}
