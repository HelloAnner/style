import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { SuperAdminSelect } from './SuperAdminSelect';
import {
  superAdminApi,
  type SaMessageFeedbackChoice,
  type SaMessageFeedbackListItem,
} from '../../api/superadmin';

type ChoiceFilter = 'all' | SaMessageFeedbackChoice;


function toDateTime(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function toIsoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

function formatChoice(choice: string): string {
  const labels: Record<string, string> = {
    solved: '已解决',
    partial: '部分解决',
    unsolved: '未解决',
    thumbs_up: '点赞',
    thumbs_down: '点踩',
  };
  return labels[choice] || choice;
}

const REASON_LABEL_MAP: Record<string, string> = {
  not_direct: '不够直接',
  off_topic: '答非所问',
  confusing: '不知所云',
  miscommunication: '鸡同鸭讲',
  stupid: '愚蠢至极',
};

function parseReasons(reasons?: string | null): string {
  if (!reasons) return '-';
  try {
    const arr = JSON.parse(reasons);
    if (Array.isArray(arr)) return arr.map((r: string) => REASON_LABEL_MAP[r] || r).join(', ') || '-';
    return reasons;
  } catch {
    return reasons;
  }
}

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

export const SuperAdminFeedbackPage: React.FC = () => {
  const [tenantKeyword, setTenantKeyword] = useState('');
  const [userKeyword, setUserKeyword] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [jobId, setJobId] = useState('');
  const [choice, setChoice] = useState<ChoiceFilter>('all');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [list, setList] = useState<SaMessageFeedbackListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / size), 1), [size, total]);

  const loadList = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await superAdminApi.messageFeedbacks({
        tenantKeyword: tenantKeyword.trim() || undefined,
        userKeyword: userKeyword.trim() || undefined,
        conversationId: conversationId.trim() || undefined,
        jobId: jobId.trim() || undefined,
        choice,
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
  }, [tenantKeyword, userKeyword, conversationId, jobId, choice, startAt, endAt, size]);

  useEffect(() => {
    void loadList(0);
  }, [loadList]);

  return (
    <SuperAdminLayout testId="superadmin-feedback-page">
      <main className="fi-superadmin-content fi-superadmin-list-page" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="superadmin-feedback-content">
        <div data-testid="superadmin-feedback-header">
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>用户反馈</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            跨工作区查看用户对 AI 回复的评价反馈。
          </div>
        </div>

        <div className="sa-filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-testid="superadmin-feedback-filters">
          <input
            value={tenantKeyword}
            onChange={(event) => setTenantKeyword(event.target.value)}
            placeholder="工作区名称 / ID"
            style={{ ...controlStyle, minWidth: 180 }}
          />
          <input
            value={userKeyword}
            onChange={(event) => setUserKeyword(event.target.value)}
            placeholder="用户昵称 / ID"
            style={{ ...controlStyle, minWidth: 180 }}
          />
          <input
            value={conversationId}
            onChange={(event) => setConversationId(event.target.value)}
            placeholder="会话 ID"
            style={{ ...controlStyle, minWidth: 200 }}
          />
          <input
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            placeholder="Job ID"
            style={{ ...controlStyle, minWidth: 200 }}
          />
          <SuperAdminSelect value={choice} onChange={setChoice} ariaLabel="用户评价" options={[
            { value: 'all', label: '全部评价' },
            { value: 'solved', label: '已解决' },
            { value: 'partial', label: '部分解决' },
            { value: 'unsolved', label: '未解决' },
            { value: 'thumbs_up', label: '点赞' },
            { value: 'thumbs_down', label: '点踩' },
          ]} />
          <span style={{ display: 'inline-flex', gap: 10 }}>
            <input value={startAt} onChange={(event) => setStartAt(event.target.value)} type="datetime-local" style={controlStyle} />
            <input value={endAt} onChange={(event) => setEndAt(event.target.value)} type="datetime-local" style={controlStyle} />
          </span>
          <button
            type="button"
            onClick={() => void loadList(0)}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}
          >
            搜索
          </button>
        </div>

        {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}
        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--danger-border-soft)', background: 'var(--danger-bg-soft)', color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div className="sa-main-list-viewport" style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, background: 'var(--bg-tertiary)' }} data-testid="superadmin-feedback-table">
          <table className="sa-table" style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['时间', '工作区', '用户', '评价', '原因', '评论', '会话 ID', 'Job ID', 'SigNoz 跳转'].map((title) => (
                  <th key={title} style={thStyle}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id}>
                  <td style={cellStyle}>{toDateTime(item.createdAt)}</td>
                  <td style={cellStyle}>
                    <div>{item.tenantName || '-'}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{item.tenantId}</div>
                  </td>
                  <td style={cellStyle}>
                    <div>{item.userName || '-'}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{item.userPhone || item.userId}</div>
                  </td>
                  <td style={cellStyle}>{formatChoice(item.choice)}</td>
                  <td style={{ ...cellStyle, maxWidth: 180 }}>{parseReasons(item.reasons)}</td>
                  <td style={{ ...cellStyle, maxWidth: 200 }}>
                    {item.comment ? (
                      <div style={{ wordBreak: 'break-word' }}>{item.comment}</div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, maxWidth: 160 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item.conversationId}</div>
                  </td>
                  <td style={{ ...cellStyle, maxWidth: 160 }}>
                    {item.jobId ? (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item.jobId}</div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {item.jobQueryUrl ? (
                        <a href={item.jobQueryUrl} target="_blank" rel="noreferrer" title="在 SigNoz 中按 Job ID 查看日志"
                          style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                            padding: '4px 8px', borderRadius: 6, lineHeight: 1.3,
                            fontSize: 11, fontWeight: 500, textDecoration: 'none',
                            color: 'var(--text-primary)', background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}>
                          <span>按 Job</span><span>查看</span>
                        </a>
                      ) : null}
                      {item.conversationQueryUrl ? (
                        <a href={item.conversationQueryUrl} target="_blank" rel="noreferrer" title="在 SigNoz 中按会话 ID 查看日志"
                          style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                            padding: '4px 8px', borderRadius: 6, lineHeight: 1.3,
                            fontSize: 11, fontWeight: 500, textDecoration: 'none',
                            color: 'var(--text-primary)', background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}>
                          <span>按会话</span><span>查看</span>
                        </a>
                      ) : null}
                      {item.traceQueryUrl ? (
                        <a href={item.traceQueryUrl} target="_blank" rel="noreferrer" title="在 SigNoz 中按 Trace ID 查看链路日志"
                          style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                            padding: '4px 8px', borderRadius: 6, lineHeight: 1.3,
                            fontSize: 11, fontWeight: 500, textDecoration: 'none',
                            color: 'var(--text-primary)', background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}>
                          <span>按 Trace</span><span>查看</span>
                        </a>
                      ) : null}
                      {!item.jobQueryUrl && !item.conversationQueryUrl && !item.traceQueryUrl ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>无可用的 SigNoz 链接</span>
                      ) : null}
                    </div>
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
              onClick={() => void loadList(page - 1)}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: page <= 0 ? 'not-allowed' : 'pointer', opacity: page <= 0 ? 0.5 : 1 }}
            >
              上一页
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => void loadList(page + 1)}
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

export default SuperAdminFeedbackPage;
