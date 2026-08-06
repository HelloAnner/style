import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareText, RefreshCw, Search } from 'lucide-react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { SuperAdminSelect } from './SuperAdminSelect';
import {
  superAdminApi,
  type SaExternalChannelIntegrationItem,
  type SaExternalChannelProvider,
} from '../../api/superadmin';

type ProviderFilter = 'all' | 'feishu' | 'dingtalk' | 'wework';
type ActiveFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 20;

const cellStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'top',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-subtle)',
};

const controlStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
};

function toDateTime(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function providerLabel(provider?: SaExternalChannelProvider | null): string {
  const labels: Record<string, string> = {
    feishu: '飞书',
    dingtalk: '钉钉',
    wework: '企业微信',
  };
  return labels[provider || ''] ?? (provider || '-');
}

function connectionModeLabel(mode?: string | null): string {
  const labels: Record<string, string> = {
    stream: '长连接',
    websocket: 'WebSocket',
    webhook: 'HTTP 回调',
    sdk: 'SDK',
  };
  return labels[mode || ''] ?? (mode || '-');
}

function runtimeStateLabel(state?: string | null): string {
  const labels: Record<string, string> = {
    running: '已连接',
    starting: '连接中',
    reconnecting: '重连中',
    failed: '连接失败',
    standby: '待接管',
    stopped: '未连接',
    missing_credentials: '未配置',
    inactive: '已停用',
    not_managed: '未托管',
    unknown: '未知',
  };
  return labels[state || ''] ?? (state || '未知');
}

function runtimeTone(state?: string | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (state === 'running') {
    return 'success';
  }
  if (state === 'failed' || state === 'missing_credentials') {
    return 'danger';
  }
  if (state === 'starting' || state === 'reconnecting' || state === 'stopped' || state === 'standby') {
    return 'warning';
  }
  return 'neutral';
}

function badgeStyle(tone: 'success' | 'warning' | 'danger' | 'neutral'): React.CSSProperties {
  const toneMap = {
    success: ['var(--success-bg-soft)', 'var(--success-border-soft)', 'var(--success)'],
    warning: ['var(--warning-bg-soft)', 'var(--warning-border-soft)', 'var(--warning)'],
    danger: ['var(--danger-bg-soft)', 'var(--danger-border-soft)', 'var(--danger)'],
    neutral: ['var(--bg-secondary)', 'var(--border-subtle)', 'var(--text-muted)'],
  } as const;
  const [background, border, color] = toneMap[tone];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 24,
    padding: '2px 8px',
    borderRadius: 8,
    border: `1px solid ${border}`,
    background,
    color,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}

function latestStatusText(item: SaExternalChannelIntegrationItem): string {
  if (!item.latestEventAt) {
    return '暂无消息';
  }
  const statusParts = [item.latestStatus, item.latestBindingStatus, item.latestReplyStatus]
    .filter(Boolean)
    .join(' / ');
  return statusParts || '已接收消息';
}

function conversationLogsPath(item: SaExternalChannelIntegrationItem): string {
  const params = new URLSearchParams();
  params.set('type', 'bot');
  if (item.provider) {
    params.set('externalSource', item.provider);
  }
  if (item.tenantId) {
    params.set('tenantId', item.tenantId);
  }
  if (item.agentName) {
    params.set('agentName', item.agentName);
  }
  return `/superadmin/conversation-logs?${params.toString()}`;
}

/**
 * 超管机器人集成速查页。
 */
export const SuperAdminExternalChannelsPage: React.FC = () => {
  const [workspaceKeyword, setWorkspaceKeyword] = useState('');
  const [agentKeyword, setAgentKeyword] = useState('');
  const [channelKeyword, setChannelKeyword] = useState('');
  const [provider, setProvider] = useState<ProviderFilter>('all');
  const [active, setActive] = useState<ActiveFilter>('all');
  const [list, setList] = useState<SaExternalChannelIntegrationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / PAGE_SIZE), 1), [total]);

  const loadIntegrations = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await superAdminApi.externalChannelIntegrations({
        workspaceKeyword: workspaceKeyword.trim() || undefined,
        agentKeyword: agentKeyword.trim() || undefined,
        channelKeyword: channelKeyword.trim() || undefined,
        provider: provider === 'all' ? undefined : provider,
        active: active === 'all' ? undefined : active === 'active',
        page: targetPage,
        size: PAGE_SIZE,
      });
      setList(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [active, agentKeyword, channelKeyword, provider, workspaceKeyword]);

  useEffect(() => {
    void loadIntegrations(0);
  }, [loadIntegrations]);

  return (
    <SuperAdminLayout testId="superadmin-external-channels-page">
      <main className="fi-superadmin-content fi-superadmin-list-page" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="superadmin-external-channels-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }} data-testid="superadmin-external-channels-header">
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>机器人集成</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              跨工作区查看飞书、钉钉和企业微信机器人接入状态。
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadIntegrations(page)}
            disabled={loading}
            title="刷新"
            style={{ height: 36, width: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: loading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="sa-filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-testid="superadmin-external-channels-filters">
          <input
            value={workspaceKeyword}
            onChange={(event) => setWorkspaceKeyword(event.target.value)}
            placeholder="工作区名称 / ID"
            style={{ ...controlStyle, minWidth: 180 }}
          />
          <input
            value={agentKeyword}
            onChange={(event) => setAgentKeyword(event.target.value)}
            placeholder="Agent 名称 / ID"
            style={{ ...controlStyle, minWidth: 180 }}
          />
          <input
            value={channelKeyword}
            onChange={(event) => setChannelKeyword(event.target.value)}
            placeholder="渠道名称 / ID"
            style={{ ...controlStyle, minWidth: 180 }}
          />
          <SuperAdminSelect value={provider} onChange={setProvider} ariaLabel="渠道类型" options={[
            { value: 'all', label: '全部渠道' },
            { value: 'feishu', label: '飞书' },
            { value: 'dingtalk', label: '钉钉' },
            { value: 'wework', label: '企业微信' },
          ]} />
          <SuperAdminSelect value={active} onChange={setActive} ariaLabel="启停状态" options={[
            { value: 'all', label: '全部启停' },
            { value: 'active', label: '已启用' },
            { value: 'inactive', label: '已停用' },
          ]} />
          <button
            type="button"
            onClick={() => void loadIntegrations(0)}
            disabled={loading}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Search size={15} />
            搜索
          </button>
        </div>

        {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}
        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--danger-border-soft)', background: 'var(--danger-bg-soft)', color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div className="sa-main-list-viewport" style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, background: 'var(--bg-tertiary)' }} data-testid="superadmin-external-channels-table">
          <table className="sa-table" style={{ width: '100%', minWidth: 1280, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['更新时间', '工作区', 'Agent', '渠道', '启停', '运行态', '最近消息', '操作'].map((title) => (
                  <th key={title} style={thStyle}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.channelId}>
                  <td style={cellStyle}>
                    <div>{toDateTime(item.updatedAt || item.createdAt)}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{item.channelId}</div>
                  </td>
                  <td style={cellStyle}>
                    <div>{item.workspaceName || '-'}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{item.tenantId}</div>
                  </td>
                  <td style={cellStyle}>
                    <div>{item.agentName || '-'}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{item.agentId}</div>
                  </td>
                  <td style={cellStyle}>
                    <div>{item.channelName || '-'}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                      {providerLabel(item.provider)} / {connectionModeLabel(item.connectionMode || item.runtimeMode)}
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <span style={badgeStyle(item.active ? 'success' : 'neutral')}>{item.active ? '已启用' : '已停用'}</span>
                  </td>
                  <td style={cellStyle}>
                    <span style={badgeStyle(runtimeTone(item.runtimeState))}>{runtimeStateLabel(item.runtimeState)}</span>
                    {(item.runtimeReason || item.runtimeLastError) && (
                      <div style={{ marginTop: 6, color: 'var(--text-muted)', maxWidth: 260, wordBreak: 'break-word' }}>
                        {item.runtimeLastError || item.runtimeReason}
                      </div>
                    )}
                    {item.runtimeManaged === false && (
                      <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>非长连接托管</div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <div>{toDateTime(item.latestEventAt)}</div>
                    <div style={{ marginTop: 4, color: item.latestEventAt ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {latestStatusText(item)}
                    </div>
                    {item.latestSessionId && (
                      <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>Session：{item.latestSessionId}</div>
                    )}
                    {item.latestJobId && (
                      <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>Job：{item.latestJobId}</div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <Link
                      to={conversationLogsPath(item)}
                      style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '6px 10px', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                    >
                      <MessageSquareText size={14} />
                      查看对话
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && list.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>暂无数据</div>
          )}
        </div>

        <div className="sa-main-list-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          <span>共 {total} 条，第 {page + 1} / {totalPages} 页</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={page <= 0 || loading}
              onClick={() => void loadIntegrations(page - 1)}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: page <= 0 || loading ? 'not-allowed' : 'pointer', opacity: page <= 0 || loading ? 0.5 : 1 }}
            >
              上一页
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => void loadIntegrations(page + 1)}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: page + 1 >= totalPages || loading ? 'not-allowed' : 'pointer', opacity: page + 1 >= totalPages || loading ? 0.5 : 1 }}
            >
              下一页
            </button>
          </div>
        </div>
      </main>
    </SuperAdminLayout>
  );
};

export default SuperAdminExternalChannelsPage;
