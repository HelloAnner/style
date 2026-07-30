import React, { memo, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  accountAssetFixture,
  accountQuotaFixture,
  accountSpacesFixture,
  accountUserFixture,
  adminMockData,
} from './mock-data';
import type {
  WufanAccountAdminDemoProps,
  WufanAccountAdminTheme,
  WufanAccountSettingsProps,
  WufanAdminPlatformProps,
  WufanAdminTab,
  WufanAssetItem,
  WufanSettingsTab,
} from './types';

type IconName =
  | 'api'
  | 'assets'
  | 'back'
  | 'card'
  | 'chart'
  | 'close'
  | 'gear'
  | 'moon'
  | 'plus'
  | 'spaces'
  | 'sun'
  | 'user';

function Icon({ name, size = 18 }: { name: IconName; size?: number }): React.ReactElement {
  const path = {
    api: <><path d="M12 2v6M9 2v6M15 2v6" /><path d="M6 8h12v4a6 6 0 0 1-12 0Z" /><path d="M12 18v4" /></>,
    assets: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
    chart: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
    close: <path d="M6 6 18 18M18 6 6 18" />,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2.2-.7-.8-1.9 1.1-2.1-2.1-2.1-2.1 1.1-1.9-.8L10.5 2h-3l-.7 2.2-1.9.8-2.1-1.1L.7 6l1.1 2.1-.8 1.9L0 10.5v3l2.2.7.8 1.9-1.1 2.1L4 20.3l2.1-1.1 1.9.8.7 2.2h3l.7-2.2 1.9-.8 2.1 1.1 2.1-2.1-1.1-2.1.8-1.9Z" transform="translate(2 -1) scale(.84)" /></>,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    spaces: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
    user: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></>,
  }[name];
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

const SETTINGS_TITLES: Record<WufanSettingsTab, string> = {
  profile: '个人信息',
  spaces: '加入的空间',
  assets: '资产',
  'my-api': '接入 API',
  usage: '用量',
  subscription: '订阅',
  'space-mgmt': '空间管理',
};

const ACCOUNT_TABS: Array<{ id: WufanSettingsTab; label: string; icon: IconName }> = [
  { id: 'profile', label: '个人信息', icon: 'user' },
  { id: 'spaces', label: '加入的空间', icon: 'spaces' },
];

const SPACE_TABS: Array<{ id: WufanSettingsTab; label: string; icon: IconName }> = [
  { id: 'assets', label: '资产', icon: 'assets' },
  { id: 'my-api', label: '接入 API', icon: 'api' },
  { id: 'usage', label: '用量', icon: 'chart' },
  { id: 'subscription', label: '订阅', icon: 'card' },
  { id: 'space-mgmt', label: '空间管理', icon: 'gear' },
];

const ADMIN_TABS: Array<{ id: WufanAdminTab; label: string }> = [
  { id: 'messages', label: '消息日志' },
  { id: 'token_usage', label: 'Token用量' },
  { id: 'performance', label: '性能监控' },
  { id: 'feedback', label: '反馈闭环' },
  { id: 'mcp_clients', label: 'MCP接入' },
  { id: 'troubleshoot', label: '问题排查' },
  { id: 'tools', label: '工具统计' },
  { id: 'user_activity', label: '用户活跃' },
  { id: 'realtime', label: '实时监控' },
  { id: 'system', label: '系统' },
  { id: 'showcase', label: '案例管理' },
];

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="wufan-settings-section-label">{children}</div>;
}

function ProfileContent({
  theme,
  user,
  onThemeChange,
  onLogout,
}: Pick<WufanAccountSettingsProps, 'theme' | 'user' | 'onThemeChange' | 'onLogout'>): React.ReactElement {
  return (
    <div className="wufan-settings-stack wufan-settings-stack--wide">
      <div>
        <div className="wufan-settings-field-row"><small>邮箱</small><strong>{user.email}</strong></div>
        <div className="wufan-settings-field-row"><small>姓名</small><strong>{user.name || '-'}</strong></div>
      </div>
      <div>
        <SectionLabel>外观</SectionLabel>
        <div className="wufan-settings-control-row">
          <span>主题</span>
          <div className="wufan-settings-segmented">
            <button type="button" data-active={theme === 'light'} onClick={() => onThemeChange?.('light')}>
              <Icon name="sun" size={14} />亮色
            </button>
            <button type="button" data-active={theme === 'dark'} onClick={() => onThemeChange?.('dark')}>
              <Icon name="moon" size={14} />暗色
            </button>
          </div>
        </div>
        <div className="wufan-settings-control-row">
          <span>语言</span>
          <div className="wufan-settings-segmented">
            <button type="button" data-active="true">中文</button>
            <button type="button" data-active="false">English</button>
          </div>
        </div>
      </div>
      <div>
        <SectionLabel>其他</SectionLabel>
        <button type="button" className="wufan-settings-secondary-button" onClick={onLogout}>退出登录</button>
      </div>
    </div>
  );
}

function SpacesContent({ spaces }: Pick<WufanAccountSettingsProps, 'spaces'>): React.ReactElement {
  return (
    <div className="wufan-settings-space-grid">
      {spaces.map((space) => (
        <article className="wufan-settings-space-card" key={space.id} data-current={space.current}>
          <div className="wufan-settings-space-card__head">
            <span className="wufan-settings-space-avatar">{space.name.slice(0, 1)}</span>
            <div><strong>{space.name}</strong><small>{space.isPersonal ? '个人空间' : '团队空间'}</small></div>
            {space.current ? <span className="wufan-settings-current">当前</span> : null}
          </div>
          <div className="wufan-settings-space-stats">
            <span><b>{space.memberCount}</b>成员</span>
            <span><b>{space.agentCount}</b>Agent</span>
            <span><b>{space.skillCount}</b>技能</span>
          </div>
          <span className="wufan-settings-role">{space.role === 'owner' ? 'Pro' : space.role === 'admin' ? '管理员' : '成员'}</span>
        </article>
      ))}
      <button type="button" className="wufan-settings-create-space">
        <span><Icon name="plus" /></span>
        <strong>创建团队空间</strong>
        <small>创建并管理你的团队协作空间</small>
      </button>
    </div>
  );
}

const ASSET_FILTERS: Array<{ id: WufanAssetItem['kind']; label: string }> = [
  { id: 'tool', label: '工具' },
  { id: 'skill', label: '技能' },
  { id: 'partner', label: '伙伴' },
  { id: 'automation', label: '自动化' },
  { id: 'widget', label: '卡片' },
];

function AssetsContent({ assets }: Pick<WufanAccountSettingsProps, 'assets'>): React.ReactElement {
  const [kind, setKind] = useState<WufanAssetItem['kind']>('tool');
  const visible = assets.filter((item) => item.kind === kind);
  return (
    <div className="wufan-settings-stack">
      <div className="wufan-settings-subtabs">
        {ASSET_FILTERS.map((item) => (
          <button type="button" key={item.id} data-active={kind === item.id} onClick={() => setKind(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="wufan-settings-asset-list">
        {visible.map((item) => (
          <article key={item.id}>
            <span className="wufan-settings-asset-icon"><Icon name={kind === 'tool' ? 'gear' : kind === 'skill' ? 'assets' : 'spaces'} size={16} /></span>
            <div><strong>{item.name}</strong><small>{item.description}</small></div>
            <em>{item.status}</em>
          </article>
        ))}
      </div>
    </div>
  );
}

function ApiContent(): React.ReactElement {
  const providers = [
    ['大模型', '智谱 AI', '接入后可在 Agent 模型选择器中使用，不消耗官方配额'],
    ['生成图片', '火山引擎', '接入后，生图工具不受每日配额限制'],
    ['生成视频', '火山引擎', '接入后，视频工具不受每日配额限制'],
    ['网络搜索', 'Tavily', '接入后，搜索工具不受每日配额限制'],
  ];
  return (
    <div className="wufan-settings-stack">
      <p className="wufan-settings-intro">接入自己的 API Key，对话资源不受每日配额限制。大模型接入后会在 Agent 模型选择器中出现为“个人接入”选项。</p>
      {providers.map(([title, provider, description], index) => (
        <article className="wufan-settings-api-card" key={title}>
          <div><strong>{title}</strong><small>{description}</small></div>
          <span>{provider}</span>
          <button type="button">{index === 0 ? '已连接' : '接入'}</button>
        </article>
      ))}
    </div>
  );
}

function UsageContent({ quotas }: Pick<WufanAccountSettingsProps, 'quotas'>): React.ReactElement {
  return (
    <div className="wufan-settings-stack">
      <div><strong className="wufan-settings-content-title">今日用量</strong><p className="wufan-settings-hint">每日 00:00 (UTC+8) 重置</p></div>
      {(['chat', 'tools'] as const).map((group) => (
        <div key={group}>
          <SectionLabel>{group === 'chat' ? '对话' : '工具'}</SectionLabel>
          {quotas.filter((quota) => quota.group === group).map((quota) => {
            const percent = quota.limit ? Math.min(100, (quota.used / quota.limit) * 100) : 100;
            return (
              <div className="wufan-settings-quota" key={quota.id}>
                <div><span>{quota.label}</span><small>{quota.limit ? `${quota.used} / ${quota.limit}` : '无限制（已接入 API）'}</small></div>
                <div className="wufan-settings-quota__track"><i style={{ width: `${percent}%` }} /></div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SubscriptionContent({
  showAdminEntry,
  onOpenAdmin,
}: Pick<WufanAccountSettingsProps, 'showAdminEntry' | 'onOpenAdmin'>): React.ReactElement {
  const features = ['无限 Agent', '所有模型无限对话', '所有工具无限调用', '支持接入自有 API', '优先体验新功能'];
  return (
    <div className="wufan-settings-stack wufan-settings-stack--subscription">
      <div>
        <SectionLabel>当前计划</SectionLabel>
        <div className="wufan-settings-plan-card"><strong>开发者版</strong><small>所有功能与配额无限制</small></div>
      </div>
      <div><strong className="wufan-settings-price">∞</strong><p className="wufan-settings-hint">开发者专享，全部功能无限制</p></div>
      <div>
        <SectionLabel>包含功能</SectionLabel>
        <ul className="wufan-settings-features">{features.map((feature) => <li key={feature}>✓ <span>{feature}</span></li>)}</ul>
      </div>
      {showAdminEntry && onOpenAdmin ? (
        <button type="button" className="wufan-settings-admin-entry" onClick={onOpenAdmin}>运营平台</button>
      ) : null}
    </div>
  );
}

function SpaceManagementContent({ currentSpace }: Pick<WufanAccountSettingsProps, 'currentSpace'>): React.ReactElement {
  return (
    <div className="wufan-settings-stack">
      <div>
        <SectionLabel>空间信息</SectionLabel>
        <div className="wufan-settings-field-row"><small>空间名称</small><strong>{currentSpace.name}</strong></div>
        <div className="wufan-settings-field-row"><small>类型</small><strong>{currentSpace.isPersonal ? '个人空间' : '团队空间'}</strong></div>
        <div className="wufan-settings-field-row"><small>计划</small><strong>{currentSpace.plan === 'developer' ? '开发者版' : currentSpace.plan}</strong></div>
      </div>
      <div>
        <SectionLabel>邀请成员</SectionLabel>
        <div className="wufan-settings-invite"><input aria-label="邀请邮箱" placeholder="输入邮箱地址" /><button type="button">邀请</button></div>
      </div>
      <div>
        <SectionLabel>成员列表</SectionLabel>
        <div className="wufan-settings-member"><span className="wufan-settings-space-avatar">午</span><div><strong>午饭示例</strong><small>demo@example.com</small></div><em>所有者</em></div>
      </div>
      <div className="wufan-settings-danger"><SectionLabel>危险操作</SectionLabel><strong>删除此空间</strong><small>删除后所有成员将被移出，操作不可撤销</small><button type="button">删除空间</button></div>
    </div>
  );
}

function SettingsContent(props: WufanAccountSettingsProps & { tab: WufanSettingsTab }): React.ReactElement {
  switch (props.tab) {
    case 'profile': return <ProfileContent {...props} />;
    case 'spaces': return <SpacesContent spaces={props.spaces} />;
    case 'assets': return <AssetsContent assets={props.assets} />;
    case 'my-api': return <ApiContent />;
    case 'usage': return <UsageContent quotas={props.quotas} />;
    case 'subscription': return <SubscriptionContent {...props} />;
    case 'space-mgmt': return <SpaceManagementContent currentSpace={props.currentSpace} />;
  }
}

export const WufanAccountSettings = memo(function WufanAccountSettings(
  props: WufanAccountSettingsProps,
): React.ReactElement | null {
  const { isOpen, theme, initialTab = 'profile', onClose, currentSpace } = props;
  const [tab, setTab] = useState<WufanSettingsTab>(initialTab);

  useEffect(() => {
    if (isOpen) setTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const nav = (item: { id: WufanSettingsTab; label: string; icon: IconName }) => (
    <button type="button" key={item.id} data-active={tab === item.id} onClick={() => setTab(item.id)}>
      <Icon name={item.icon} />{item.label}
    </button>
  );

  const modal = (
    <div className="wufan-account-admin" data-theme={theme}>
      <div className="wufan-settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="wufan-settings-modal" role="dialog" aria-modal="true" aria-label="设置">
          <aside className="wufan-settings-nav">
            <h2>设置</h2>
            <SectionLabel>我的账户</SectionLabel>
            <nav>{ACCOUNT_TABS.map(nav)}</nav>
            <SectionLabel>当前空间</SectionLabel>
            <div className="wufan-settings-current-space">{currentSpace.name}</div>
            <nav>{SPACE_TABS.map(nav)}</nav>
          </aside>
          <main className="wufan-settings-main">
            <header><h3>{SETTINGS_TITLES[tab]}</h3><button type="button" aria-label="关闭设置" onClick={onClose}><Icon name="close" /></button></header>
            <div className="wufan-settings-content"><SettingsContent {...props} tab={tab} /></div>
          </main>
        </section>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
});

function StatCards({ tab }: { tab: WufanAdminTab }): React.ReactElement {
  const cards = tab === 'performance'
    ? [['P50 响应', '2.4s'], ['P95 响应', '11.8s'], ['首字延迟', '684ms'], ['缓存命中', '41.2%']]
    : tab === 'user_activity'
      ? [['新增用户', '38'], ['活跃用户', '126'], ['查询次数', '1,842'], ['总 Token', '9.4M']]
      : tab === 'realtime'
        ? [['在线用户', '24'], ['运行任务', '7'], ['近 5 分钟会话', '63'], ['健康服务', '12 / 12']]
        : [['执行总量', '2,846'], ['完成率', '96.8%'], ['工具调用', '8,421'], ['平均 Token', '18,640']];
  return <div className="wufan-admin-stat-grid">{cards.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>;
}

function TokenUsageView({ data }: Pick<WufanAdminPlatformProps, 'data'>): React.ReactElement {
  const total = data.tokenRows.reduce((sum, item) => sum + item.totalTokens, 0);
  return (
    <div className="wufan-admin-stack">
      <div className="wufan-admin-toolbar">
        <input aria-label="搜索用户" placeholder="搜索用户邮箱" />
        <select aria-label="模型"><option>全部模型</option><option>claude-sonnet-4-5</option><option>glm-5</option></select>
        <select aria-label="来源"><option>全部来源</option><option>平台</option><option>团队</option></select>
        <button type="button">导出</button>
      </div>
      <div className="wufan-admin-summary">
        <article><small>Token 总量</small><strong>{total.toLocaleString()}</strong></article>
        <article><small>Prompt Token</small><strong>{data.tokenRows.reduce((sum, item) => sum + item.promptTokens, 0).toLocaleString()}</strong></article>
        <article><small>Completion Token</small><strong>{data.tokenRows.reduce((sum, item) => sum + item.completionTokens, 0).toLocaleString()}</strong></article>
      </div>
      <div className="wufan-admin-table-wrap">
        <table><thead><tr><th>用户</th><th>Agent</th><th>模型</th><th>来源</th><th>Prompt</th><th>Completion</th><th>总量</th><th>时间</th></tr></thead>
          <tbody>{data.tokenRows.map((row) => <tr key={row.id}><td>{row.user}</td><td>{row.agent}</td><td>{row.model}</td><td><span className="wufan-admin-badge">{row.source}</span></td><td>{row.promptTokens.toLocaleString()}</td><td>{row.completionTokens.toLocaleString()}</td><td><strong>{row.totalTokens.toLocaleString()}</strong></td><td>{row.createdAt}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function FeedbackView({ data }: Pick<WufanAdminPlatformProps, 'data'>): React.ReactElement {
  const positive = data.feedbackRows.filter((item) => item.sentiment === 'positive').length;
  const negative = data.feedbackRows.length - positive;
  return (
    <div className="wufan-admin-stack">
      <div className="wufan-admin-summary">
        <article><small>反馈总数</small><strong>{data.feedbackRows.length}</strong></article>
        <article><small>点赞</small><strong>{positive}</strong></article>
        <article><small>点踩</small><strong>{negative}</strong></article>
      </div>
      <div className="wufan-admin-toolbar">
        <input aria-label="搜索反馈用户" placeholder="用户邮箱" />
        <select aria-label="反馈倾向"><option>全部反馈</option><option>点赞</option><option>点踩</option></select>
        <button type="button">查询</button>
      </div>
      <div className="wufan-admin-table-wrap">
        <table><thead><tr><th>倾向</th><th>用户 / Agent</th><th>会话</th><th>消息与原因</th><th>反馈内容</th><th>时间</th></tr></thead>
          <tbody>{data.feedbackRows.map((row) => <tr key={row.id}>
            <td><span className="wufan-admin-sentiment" data-sentiment={row.sentiment}>{row.sentiment === 'positive' ? '点赞' : '点踩'}</span></td>
            <td>{row.user}<small>{row.agent}</small></td><td>{row.sessionTitle}</td>
            <td><span className="wufan-admin-preview">{row.messagePreview}</span><div className="wufan-admin-categories">{row.categories.map((item) => <em key={item}>{item}</em>)}</div></td>
            <td>{row.content || '—'}</td><td>{row.createdAt}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function GenericAdminView({ tab }: { tab: WufanAdminTab }): React.ReactElement {
  const meta: Record<WufanAdminTab, { title: string; description: string; columns: string[] }> = {
    messages: { title: '消息日志', description: '按用户、会话、Agent、角色与关键词检索消息', columns: ['用户', '会话', 'Agent', '角色', '内容预览', '首字延迟', '时间'] },
    token_usage: { title: 'Token 用量', description: '', columns: [] },
    performance: { title: '性能监控', description: '观察执行耗时、首字延迟、Token 与模型分布', columns: [] },
    feedback: { title: '反馈闭环', description: '', columns: [] },
    mcp_clients: { title: 'MCP 接入', description: '管理 Client、Token、工具授权、Agent 绑定与审计日志', columns: ['Client', '团队', '状态', 'Token', '工具授权', '近 7 天调用'] },
    troubleshoot: { title: '问题排查', description: '按关键词、用户与时间定位异常执行', columns: ['类型', '用户', '会话', 'Agent', '匹配原因', '时间'] },
    tools: { title: '工具统计', description: '查看调用量、成功率、平均耗时与失败率', columns: ['工具', '调用量', '成功', '失败', '成功率', '平均耗时'] },
    user_activity: { title: '用户活跃', description: '查看新增、活跃、查询量和用户排名', columns: ['排名', '用户', '团队', '对话数', '平台 Token', '团队 Token', '占比'] },
    realtime: { title: '实时监控', description: '在线用户、运行任务和近期会话', columns: ['状态', '任务 / 会话', '用户', 'Agent', '持续时间'] },
    system: { title: '系统', description: 'Redis、PostgreSQL 与磁盘健康状态', columns: ['服务', '状态', '详情', '检查时间'] },
    showcase: { title: '案例管理', description: '维护案例集合、草稿、发布状态与排序', columns: ['案例', '状态', '所属集合', '点击量', '更新时间'] },
  };
  const item = meta[tab];
  return (
    <div className="wufan-admin-stack">
      <div className="wufan-admin-view-heading"><div><h2>{item.title}</h2><p>{item.description}</p></div><button type="button">{tab === 'mcp_clients' ? '+ 新建' : '刷新'}</button></div>
      {['performance', 'user_activity', 'realtime'].includes(tab) ? <StatCards tab={tab} /> : null}
      {tab === 'performance' ? <div className="wufan-admin-chart"><i /><i /><i /><i /><i /><i /><i /></div> : null}
      {item.columns.length ? <div className="wufan-admin-table-wrap"><table><thead><tr>{item.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{[0, 1, 2, 3].map((row) => <tr key={row}>{item.columns.map((column, index) => <td key={column}>{index === 0 ? `${item.title}示例 ${row + 1}` : index === item.columns.length - 1 ? '2026-07-30 10:32' : '—'}</td>)}</tr>)}</tbody></table></div> : null}
    </div>
  );
}

export const WufanAdminPlatform = memo(function WufanAdminPlatform({
  theme,
  data,
  initialTab = 'token_usage',
  onClose,
}: WufanAdminPlatformProps): React.ReactElement {
  const [tab, setTab] = useState<WufanAdminTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  return (
    <div className="wufan-account-admin" data-theme={theme}>
      <section className="wufan-admin-page" aria-label="运营平台">
        <header className="wufan-admin-header">
          <div><button type="button" onClick={onClose}><Icon name="back" size={16} />返回</button><strong>运营平台</strong></div>
          <nav>{ADMIN_TABS.map((item) => <button type="button" key={item.id} data-active={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
        </header>
        <main className="wufan-admin-main">
          {tab === 'token_usage' ? <TokenUsageView data={data} /> : tab === 'feedback' ? <FeedbackView data={data} /> : <GenericAdminView tab={tab} />}
        </main>
      </section>
    </div>
  );
});

export const WufanAccountAdminDemo = memo(function WufanAccountAdminDemo({
  theme: initialTheme = 'light',
  initialView = 'app',
  initialSettingsTab = 'profile',
  initialAdminTab = 'token_usage',
}: WufanAccountAdminDemoProps): React.ReactElement {
  const [theme, setTheme] = useState<WufanAccountAdminTheme>(initialTheme);
  const [view, setView] = useState<'app' | 'settings' | 'admin'>(initialView);
  const currentSpace = useMemo(() => accountSpacesFixture.find((item) => item.current) ?? accountSpacesFixture[0], []);
  if (view === 'admin') return <WufanAdminPlatform theme={theme} data={adminMockData} initialTab={initialAdminTab} onClose={() => setView('app')} />;
  return (
    <div className="wufan-account-admin" data-theme={theme}>
      <div className="wufan-account-demo-shell">
        <aside>
          <strong>悟帆AI</strong>
          <nav><button type="button">＋ 新任务</button><button type="button">自动化</button><button type="button">AI 员工</button><button type="button">价值中心</button></nav>
          <button type="button" className="wufan-account-user-entry" onClick={() => setView('settings')}>
            <span>午</span><div><strong>{accountUserFixture.name}</strong><small>个人空间</small></div>
          </button>
        </aside>
        <main><p>点击左下角用户信息进入账户设置</p><button type="button" onClick={() => setView('settings')}>打开设置</button></main>
      </div>
      <WufanAccountSettings
        isOpen={view === 'settings'}
        theme={theme}
        user={accountUserFixture}
        currentSpace={currentSpace}
        spaces={accountSpacesFixture}
        quotas={accountQuotaFixture}
        assets={accountAssetFixture}
        initialTab={initialSettingsTab}
        showAdminEntry
        onClose={() => setView('app')}
        onThemeChange={setTheme}
        onOpenAdmin={() => setView('admin')}
      />
    </div>
  );
});
