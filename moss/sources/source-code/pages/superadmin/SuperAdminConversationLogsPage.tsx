import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { SuperAdminLayout } from './SuperAdminLayout';
import {
  superAdminApi,
  type SaConversationLogDetail,
  type SaConversationLogListItem,
  type SaConversationLogStatus,
  type SaConversationLogType,
} from '../../api/superadmin';
import { downloadFile } from '../../lib/media';
import { formatExecutionDuration } from '../../utils/formatExecutionDuration';
import { SuperAdminSelect } from './SuperAdminSelect';
import { useDialogFocus } from './useDialogFocus';

type StatusFilter = 'all' | SaConversationLogStatus;
type TypeFilter = 'all' | SaConversationLogType;
type ExternalSourceFilter = 'all' | 'web' | 'aliyun' | 'feishu' | 'dingtalk' | 'wework' | 'external_channel';
type UsageCreditCappedFilter = 'all' | 'capped';

function initialTypeFilter(value: string | null): TypeFilter {
  return value === 'user' || value === 'automation' || value === 'mcp' || value === 'bot' ? value : 'all';
}

function initialExternalSourceFilter(value: string | null): ExternalSourceFilter {
  return value === 'web'
    || value === 'aliyun'
    || value === 'feishu'
    || value === 'dingtalk'
    || value === 'wework'
    || value === 'external_channel'
    ? value
    : 'all';
}

function initialStatusFilter(value: string | null): StatusFilter {
  return value === 'success' || value === 'failed' || value === 'cancelled' || value === 'timeout' || value === 'running' ? value : 'all';
}

function initialTextFilter(value: string | null): string {
  return value?.trim() ?? '';
}

function toDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

function toIsoDateTime(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return new Date(value).toISOString();
}

function formatType(type: SaConversationLogType): string {
  if (type === 'automation') return '自动化';
  if (type === 'mcp') return 'MCP';
  if (type === 'bot') return '机器人';
  return '消息';
}

function formatSource(source?: string | null): string {
  const labels: Record<string, string> = {
    web: 'Web',
    aliyun: '阿里云市场',
    feishu: '飞书',
    dingtalk: '钉钉',
    wework: '企业微信',
    external_channel: '外部渠道',
    automation: '自动化',
    mcp: 'MCP',
  };
  return source ? labels[source.toLowerCase()] || source : '-';
}

function formatStatus(status: SaConversationLogStatus): string {
  const labels: Record<SaConversationLogStatus, string> = {
    success: '成功',
    failed: '失败',
    cancelled: '已取消',
    timeout: '超时',
    running: '运行中',
  };
  return labels[status];
}

function formatDuration(value?: number | null): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (value < 1000) {
    return `${value} ms`;
  }
  return `${(value / 1000).toFixed(1)} s`;
}

function formatUsageCredits(log: Pick<SaConversationLogListItem, 'usageCredits' | 'originalUsageCredit' | 'usageCreditCap' | 'usageCreditCapped'>): string {
  if (log.usageCredits == null) {
    return '-';
  }
  if (log.usageCreditCapped && log.originalUsageCredit != null) {
    const cap = log.usageCreditCap == null ? '' : `，上限 ${log.usageCreditCap}`;
    return `${log.usageCredits} / 原始 ${log.originalUsageCredit}${cap}`;
  }
  return String(log.usageCredits);
}

function formatToolStatus(status?: string | null): string {
  const normalized = status?.trim().toLowerCase();
  if (normalized === 'completed') return '完成';
  if (normalized === 'failed') return '失败';
  if (normalized === 'in_progress') return '执行中';
  if (normalized === 'cancelled') return '已取消';
  return normalized || '-';
}

const controlStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
};

/**
 * 超管对话记录页。
 */
export const SuperAdminConversationLogsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [tenantId, setTenantId] = useState(() => initialTextFilter(searchParams.get('tenantId')));
  const [workspaceKeyword, setWorkspaceKeyword] = useState(() => initialTextFilter(searchParams.get('workspaceKeyword')));
  const [userKeyword, setUserKeyword] = useState('');
  const [agentName, setAgentName] = useState(() => initialTextFilter(searchParams.get('agentName')));
  const [jobId, setJobId] = useState('');
  const [traceId, setTraceId] = useState(() => initialTextFilter(searchParams.get('traceId')));
  const [status, setStatus] = useState<StatusFilter>(() => initialStatusFilter(searchParams.get('status')));
  const [type, setType] = useState<TypeFilter>(() => initialTypeFilter(searchParams.get('type')));
  const [externalSource, setExternalSource] = useState<ExternalSourceFilter>(() => initialExternalSourceFilter(searchParams.get('externalSource')));
  const [usageCreditCapped, setUsageCreditCapped] = useState<UsageCreditCappedFilter>('all');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [list, setList] = useState<SaConversationLogListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<SaConversationLogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deepLinkJobId = initialTextFilter(searchParams.get('jobId'));
  const closeDetail = useCallback(() => setDetail(null), []);
  const detailDialogRef = useDialogFocus<HTMLDivElement>(Boolean(detail), closeDetail);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / size), 1), [size, total]);

  const loadLogs = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await superAdminApi.conversationLogs({
        tenantId: tenantId.trim() || undefined,
        workspaceKeyword: workspaceKeyword.trim() || undefined,
        userKeyword: userKeyword.trim() || undefined,
        agentName: agentName.trim() || undefined,
        jobId: jobId.trim() || undefined,
        traceId: traceId.trim() || undefined,
        status: status === 'all' ? undefined : status,
        type: type === 'all' ? undefined : type,
        externalSource: externalSource === 'all' ? undefined : externalSource,
        usageCreditCapped: usageCreditCapped === 'all' ? undefined : usageCreditCapped === 'capped',
        startAt: toIsoDateTime(startAt),
        endAt: toIsoDateTime(endAt),
        page: targetPage,
        size,
      });
      setList(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [agentName, endAt, externalSource, jobId, size, startAt, status, tenantId, traceId, type, usageCreditCapped, userKeyword, workspaceKeyword]);

  useEffect(() => {
    void loadLogs(0);
  }, [loadLogs]);

  const openDetail = useCallback(async (jobId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      setDetail(await superAdminApi.conversationLogDetail(jobId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '详情加载失败，请稍后重试');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (deepLinkJobId) {
      void openDetail(deepLinkJobId);
    }
  }, [deepLinkJobId, openDetail]);

  return (
    <SuperAdminLayout testId="superadmin-conversation-logs-page">
      <main className="fi-superadmin-content fi-superadmin-list-page" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="superadmin-conversation-logs-content">
        <div data-testid="superadmin-conversation-logs-header">
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>对话记录</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            跨工作区查看用户对话与自动化执行记录。
          </div>
        </div>
        {detail && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="superadmin-conversation-detail-title"
            ref={detailDialogRef}
            tabIndex={-1}
            style={{ position: 'fixed', inset: 0, background: 'var(--modal-backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
          >
            <div style={{ width: 'min(980px, 100%)', maxHeight: '86vh', overflow: 'auto', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div id="superadmin-conversation-detail-title" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>对话详情</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>{detail.jobId}</div>
                </div>
                <button
                  type="button"
                  onClick={closeDetail}
                  style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  关闭
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
                {[
                  ['工作区', `${detail.workspaceName || '-'} / ${detail.tenantId}`],
                  ['用户', `${detail.userName || '-'} / ${detail.userPhoneMasked || detail.userId}`],
                  ['Agent', detail.agentName || '-'],
                  ['类型', formatType(detail.type)],
                  ['输入来源', formatSource(detail.externalSource || detail.inputSource)],
                  ['用户名', detail.userName || '-'],
                  ['状态', formatStatus(detail.outputStatus)],
                  ['耗时', formatExecutionDuration(detail.executionDurationMs, detail.outputStatus === 'running')],
                  ['消耗积分', formatUsageCredits(detail)],
                  ['Pipeline', detail.pipelineId || '-'],
                  ['触发类型', detail.triggerType || '-'],
                ].map(([label, value]) => (
                  <div key={label} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, background: 'var(--bg-primary)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                <TextPanel title="输入内容" content={detail.inputContent} />
                <TextPanel title="输出内容" content={detail.outputContent} />
              </div>
              <SessionFilesPanel jobId={detail.jobId} />
              <ToolChainPanel detail={detail} />
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                Trace ID：{detail.traceId || '-'}　Record ID：{detail.recordId || '-'}
              </div>
            </div>
          </div>
        )}

        <div className="sa-filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-testid="superadmin-conversation-logs-filters">
          <input
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder="租户 ID"
            style={{ ...controlStyle, minWidth: 160 }}
          />
          <input
            value={workspaceKeyword}
            onChange={(event) => setWorkspaceKeyword(event.target.value)}
            placeholder="工作区名称 / ID"
            style={{ ...controlStyle, minWidth: 180 }}
          />
          <input
            value={userKeyword}
            onChange={(event) => setUserKeyword(event.target.value)}
            placeholder="用户昵称 / ID / 手机号"
            style={{ ...controlStyle, minWidth: 200 }}
          />
          <input
            value={agentName}
            onChange={(event) => setAgentName(event.target.value)}
            placeholder="Agent 名称"
            style={{ ...controlStyle, minWidth: 160 }}
          />
          <input
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            placeholder="Job ID"
            style={{ ...controlStyle, minWidth: 180 }}
          />
          <input
            value={traceId}
            onChange={(event) => setTraceId(event.target.value)}
            placeholder="Trace ID"
            style={{ ...controlStyle, minWidth: 180 }}
          />
          <SuperAdminSelect value={type} onChange={setType} ariaLabel="会话类型" options={[
            { value: 'all', label: '全部类型' },
            { value: 'user', label: '消息' },
            { value: 'automation', label: '自动化' },
            { value: 'mcp', label: 'MCP' },
            { value: 'bot', label: '机器人' },
          ]} />
          <SuperAdminSelect value={externalSource} onChange={setExternalSource} ariaLabel="会话来源" options={[
            { value: 'all', label: '全部来源' },
            { value: 'web', label: 'Web' },
            { value: 'aliyun', label: '阿里云市场' },
            { value: 'feishu', label: '飞书' },
            { value: 'dingtalk', label: '钉钉' },
            { value: 'wework', label: '企业微信' },
            { value: 'external_channel', label: '外部渠道' },
          ]} />
          <SuperAdminSelect value={status} onChange={setStatus} ariaLabel="会话状态" options={[
            { value: 'all', label: '全部状态' },
            { value: 'success', label: '成功' },
            { value: 'failed', label: '失败' },
            { value: 'cancelled', label: '已取消' },
            { value: 'timeout', label: '超时' },
            { value: 'running', label: '运行中' },
          ]} />
          <SuperAdminSelect value={usageCreditCapped} onChange={setUsageCreditCapped} ariaLabel="飞书阈值" options={[
            { value: 'all', label: '飞书阈值' },
            { value: 'capped', label: '超过阈值' },
          ]} />
          <input value={startAt} onChange={(event) => setStartAt(event.target.value)} type="datetime-local" style={controlStyle} />
          <input value={endAt} onChange={(event) => setEndAt(event.target.value)} type="datetime-local" style={controlStyle} />
          <button
            type="button"
            onClick={() => void loadLogs(0)}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}
          >
            搜索
          </button>
        </div>

        {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}
        {detailLoading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>详情加载中...</div>}
        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--danger-border-soft)', background: 'var(--danger-bg-soft)', color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div className="sa-main-list-viewport" style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, background: 'var(--bg-tertiary)' }} data-testid="superadmin-conversation-logs-table">
          <table className="sa-table sa-conversation-table" style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 158 }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 58 }} />
            </colgroup>
            <thead>
              <tr>
                {['时间', '对话内容', '工作区 / Agent', '用户', '状态', '消耗 / 耗时', '详情'].map((title, index, headers) => (
                  <th key={title} className={index === headers.length - 1 ? 'sa-table-cell-center' : undefined}>
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.jobId} style={item.outputStatus === 'failed' || item.outputStatus === 'timeout' ? { background: 'var(--danger-bg-soft)' } : undefined}>
                  <td className="sa-table-cell-nowrap">{toDateTime(item.taskAt)}</td>
                  <td className="sa-table-cell-top">
                    <div style={{ ...conversationPrimaryTextStyle, color: item.inputSummary ? 'var(--text-primary)' : 'var(--text-muted)' }} title={item.inputSummary || undefined}>
                      {item.inputSummary || '无输入摘要'}
                    </div>
                    <div style={conversationSecondaryTextStyle}>
                      {formatType(item.type)} · {formatSource(item.externalSource || item.inputSource)}
                    </div>
                  </td>
                  <td className="sa-table-cell-top">
                    <div style={conversationPrimaryTextStyle} title={item.workspaceName || undefined}>{item.workspaceName || '-'}</div>
                    <div style={conversationSecondaryTextStyle} title={`${item.agentName || '-'} / ${item.tenantId}`}>
                      Agent · {item.agentName || '-'}
                    </div>
                  </td>
                  <td className="sa-table-cell-top">
                    <div style={conversationPrimaryTextStyle}>{item.userName || '-'}</div>
                    <div style={conversationSecondaryMonoStyle} title={item.userPhoneMasked || item.userId}>
                      {item.userPhoneMasked || item.userId}
                    </div>
                  </td>
                  <td>
                    <ConversationStatusPill status={item.outputStatus} />
                  </td>
                  <td>
                    <div style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatUsageCredits(item)}</div>
                    <div style={{ ...conversationSecondaryTextStyle, fontVariantNumeric: 'tabular-nums' }}>
                      {formatExecutionDuration(item.executionDurationMs, item.outputStatus === 'running')}
                    </div>
                  </td>
                  <td className="sa-table-cell-center">
                    <button
                      type="button"
                      aria-label={`查看对话详情：${item.inputSummary || item.jobId}`}
                      title="查看详情"
                      onClick={() => void openDetail(item.jobId)}
                      style={conversationDetailButtonStyle}
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={7} className="sa-table-empty">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sa-main-list-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          <span>共 {total} 条，第 {page + 1} / {totalPages} 页</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={page <= 0 || loading}
              onClick={() => void loadLogs(page - 1)}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: page <= 0 ? 'not-allowed' : 'pointer', opacity: page <= 0 ? 0.5 : 1 }}
            >
              上一页
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => void loadLogs(page + 1)}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: page + 1 >= totalPages ? 'not-allowed' : 'pointer', opacity: page + 1 >= totalPages ? 0.5 : 1 }}
            >
              下一页
            </button>
          </div>
        </div>
      </main>
    </SuperAdminLayout>
  );
};

const ConversationStatusPill: React.FC<{ status: SaConversationLogStatus }> = ({ status }) => {
  const toneStyle: React.CSSProperties = status === 'success'
    ? { color: 'var(--success)', background: 'var(--success-bg-soft)' }
    : status === 'running'
      ? { color: 'var(--info)', background: 'var(--info-bg-soft)' }
      : status === 'timeout' || status === 'cancelled'
        ? { color: 'var(--warning)', background: 'var(--warning-bg-soft)' }
        : { color: 'var(--danger)', background: 'var(--danger-bg-soft)' };

  return (
    <span style={{ ...conversationStatusStyle, ...toneStyle }}>
      {formatStatus(status)}
    </span>
  );
};

const conversationPrimaryTextStyle: React.CSSProperties = {
  overflow: 'hidden',
  color: 'var(--text-primary)',
  fontWeight: 600,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const conversationSecondaryTextStyle: React.CSSProperties = {
  marginTop: 3,
  overflow: 'hidden',
  color: 'var(--text-muted)',
  fontSize: 12,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const conversationSecondaryMonoStyle: React.CSSProperties = {
  ...conversationSecondaryTextStyle,
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

const conversationStatusStyle: React.CSSProperties = {
  minWidth: 48,
  height: 24,
  padding: '0 9px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const conversationDetailButtonStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  padding: 0,
  border: '1px solid var(--border-subtle)',
  borderRadius: 7,
  background: 'var(--bg-secondary)',
  color: 'var(--text-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const SessionFilesPanel: React.FC<{ jobId: string }> = ({ jobId }) => {
  const maxVisibleFiles = 200;
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void superAdminApi.conversationLogFiles(jobId)
      .then(response => {
        if (cancelled) return;
        setFiles(response);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '文件列表加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const handleDownload = (path: string) => {
    const filename = path.split('/').pop() || 'download';
    void downloadFile(superAdminApi.conversationLogFileDownloadPath(jobId, path), filename);
  };

  return (
    <div style={{ marginTop: 16, border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>文件目录</div>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          加载中...
        </div>
      ) : error ? (
        <div style={{ padding: 12, fontSize: 13, color: 'var(--danger)' }}>{error}</div>
      ) : files.length === 0 ? (
        <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>暂无文件目录</div>
      ) : (
        <div>
          {files.slice(0, maxVisibleFiles).map((path, index) => (
            <div
              key={path}
              style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '8px 12px', borderBottom: index < Math.min(files.length, maxVisibleFiles) - 1 || files.length > maxVisibleFiles ? '1px solid var(--border-subtle)' : 'none' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{path}</div>
              </div>
              <button
                type="button"
                aria-label={`下载 ${path}`}
                title="下载"
                onClick={() => handleDownload(path)}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, flexShrink: 0, border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <Download size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
          {files.length > maxVisibleFiles && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              文件超过 200 个，当前仅展示前 200 个。
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ToolChainPanel: React.FC<{ detail: SaConversationLogDetail }> = ({ detail }) => (
  <div style={{ marginTop: 16, border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg-primary)', overflow: 'hidden' }}>
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
      执行链
    </div>
    {(detail.toolChain ?? []).length === 0 ? (
      <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>暂无执行链记录</div>
    ) : (
      <div>
        {detail.toolChain.map((step, index) => (
          <div key={`${step.toolName}-${index}`} style={{ display: 'flex', gap: 12, padding: '10px 12px', borderBottom: index < detail.toolChain.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <span style={{ width: 48, color: 'var(--text-muted)', fontSize: 12 }}>
              {step.iteration ? `#${step.iteration}` : index + 1}
            </span>
            <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{step.toolName || '未知步骤'}</span>
            <span style={{ width: 56, color: 'var(--text-muted)', fontSize: 12 }}>{formatToolStatus(step.status)}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDuration(step.durationMs)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const TextPanel: React.FC<{ title: string; content: string }> = ({ title, content }) => (
  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg-primary)', overflow: 'hidden' }}>
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
      {title}
    </div>
    <pre style={{ margin: 0, padding: 12, minHeight: 180, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
      {content || '-'}
    </pre>
  </div>
);

export default SuperAdminConversationLogsPage;
