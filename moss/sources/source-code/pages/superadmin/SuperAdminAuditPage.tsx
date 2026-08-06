import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { superAdminApi, type SaAuditEventItem } from '../../api/superadmin';
import { SuperAdminSelect } from './SuperAdminSelect';
import { useDialogFocus } from './useDialogFocus';

type EventTypeFilter =
  | 'all'
  | 'sa_user_status_updated'
  | 'sa_tenant_status_updated'
  | 'sa_billing_action_submitted'
  | 'sa_sms_channel_config_updated'
  | 'sa_email_channel_config_updated'
  | 'sa_verification_config_updated'
  | 'sa_sms_test_sent'
  | 'sa_email_test_sent'
  | 'sa_xila_config_updated'
  | 'sa_aliyun_marketplace_config_updated'
  | 'sa_feishu_integration_config_updated'
  | 'sa_mcp_client_deleted'
  | 'sa_conversation_file_downloaded'
  | 'sa_prompt_config_draft_saved'
  | 'sa_prompt_config_applied'
  | 'sa_prompt_config_draft_discarded'
  | 'sa_prompt_config_restored_default'
  | 'sa_prompt_config_runtime_updated'
  | 'sa_llm_config_changed';

type ResultFilter = 'all' | 'SUCCESS' | 'FAILED';


function toDateTime(value: string): string {
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

function formatOperator(item: SaAuditEventItem): string {
  return item.operatorName || item.operatorId || '-';
}

const targetTypeLabels: Record<string, string> = {
  user: '用户',
  tenant: '租户',
  billing: '计费',
  channel: '通道',
  xila: '析拉',
  job: '任务',
  mcp_client: 'MCP Client',
  prompt_config: 'Prompt 配置',
  prompt_config_runtime: 'Prompt 运行配置',
  llm_config: 'LLM 模型配置',
};

function formatTargetType(targetType: string): string {
  return targetTypeLabels[targetType.toLowerCase()] || targetType;
}

function formatEventType(eventType: string): string {
  const labels: Record<string, string> = {
    sa_user_status_updated: '用户状态变更',
    sa_tenant_status_updated: '租户状态变更',
    sa_billing_action_submitted: '计费动作提交',
    sa_sms_channel_config_updated: '短信通道配置更新',
    sa_email_channel_config_updated: '邮件通道配置更新',
    sa_verification_config_updated: '验证配置更新',
    sa_sms_test_sent: '短信测试发送',
    sa_email_test_sent: '邮件测试发送',
    sa_xila_config_updated: '析拉配置更新',
    sa_aliyun_marketplace_config_updated: '阿里云市场配置更新',
    sa_feishu_integration_config_updated: '飞书集成配置更新',
    sa_mcp_client_deleted: '删除 MCP 调用方',
    sa_conversation_file_downloaded: '下载对话文件',
    sa_prompt_config_draft_saved: '保存 Prompt 配置草稿',
    sa_prompt_config_applied: '应用 Prompt 配置',
    sa_prompt_config_draft_discarded: '丢弃 Prompt 配置草稿',
    sa_prompt_config_restored_default: '恢复内置 Prompt 配置',
    sa_prompt_config_runtime_updated: '更新 Prompt 运行配置',
    sa_llm_config_changed: 'LLM 模型配置变更',
  };
  return labels[eventType] || eventType;
}

function formatSummary(summary?: string | null): string {
  if (!summary) {
    return '暂无操作摘要';
  }
  const exactLabels: Record<string, string> = {
    'Delete superadmin MCP client': '删除超级管理员 MCP 调用方',
    'Download conversation session file': '下载会话文件',
    'Restore builtin prompt config': '恢复内置 Prompt 配置',
    'Update prompt config runtime switch': '更新 Prompt 配置运行开关',
    'Apply prompt config': '应用 Prompt 配置',
    'Save prompt config draft': '保存 Prompt 配置草稿',
    'Discard prompt config draft': '丢弃 Prompt 配置草稿',
  };
  return exactLabels[summary] || summary;
}

function formatResult(result: string): string {
  if (result === 'SUCCESS') {
    return '成功';
  }
  if (result === 'FAILED') {
    return '失败';
  }
  return result;
}

/**
 * 超管审计日志页（主前端承接第七批）。
 *
 * 业务职责：
 * - 支持按事件、结果、操作者、时间范围筛选；
 * - 支持分页浏览超管审计事件。
 */
export const SuperAdminAuditPage: React.FC = () => {
  const [eventType, setEventType] = useState<EventTypeFilter>('all');
  const [result, setResult] = useState<ResultFilter>('all');
  const [operatorKeyword, setOperatorKeyword] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [list, setList] = useState<SaAuditEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<SaAuditEventItem | null>(null);
  const closeAuditDetail = useCallback(() => setSelectedAudit(null), []);
  const auditDrawerRef = useDialogFocus<HTMLElement>(Boolean(selectedAudit), closeAuditDetail);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / size), 1), [size, total]);

  const loadAuditEvents = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await superAdminApi.auditEvents({
        eventType: eventType === 'all' ? undefined : eventType,
        result: result === 'all' ? undefined : result,
        operatorKeyword: operatorKeyword.trim() || undefined,
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
  }, [endAt, eventType, operatorKeyword, result, size, startAt]);

  useEffect(() => {
    void loadAuditEvents(0);
  }, [loadAuditEvents]);

  return (
    <SuperAdminLayout testId="superadmin-audit-page">
      <main className="fi-superadmin-content fi-superadmin-list-page" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="superadmin-audit-content">
        <div data-testid="superadmin-audit-header">
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>审计日志</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            查看超管核心写操作审计记录。
          </div>
        </div>

        <div className="sa-filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-testid="superadmin-audit-filters">
          <SuperAdminSelect
            value={eventType}
            onChange={setEventType}
            ariaLabel="审计事件"
            style={{ minWidth: 200 }}
            options={[
              { value: 'all', label: '全部事件' },
              { value: 'sa_user_status_updated', label: '用户状态变更' },
              { value: 'sa_tenant_status_updated', label: '租户状态变更' },
              { value: 'sa_billing_action_submitted', label: '计费动作提交' },
              { value: 'sa_sms_channel_config_updated', label: '短信通道配置更新' },
              { value: 'sa_email_channel_config_updated', label: '邮件通道配置更新' },
              { value: 'sa_verification_config_updated', label: '验证配置更新' },
              { value: 'sa_sms_test_sent', label: '短信测试发送' },
              { value: 'sa_email_test_sent', label: '邮件测试发送' },
              { value: 'sa_xila_config_updated', label: '析拉配置更新' },
              { value: 'sa_aliyun_marketplace_config_updated', label: '阿里云市场配置更新' },
              { value: 'sa_feishu_integration_config_updated', label: '飞书集成配置更新' },
              { value: 'sa_mcp_client_deleted', label: '删除 MCP 调用方' },
              { value: 'sa_conversation_file_downloaded', label: '下载对话文件' },
              { value: 'sa_prompt_config_draft_saved', label: '保存 Prompt 配置草稿' },
              { value: 'sa_prompt_config_applied', label: '应用 Prompt 配置' },
              { value: 'sa_prompt_config_draft_discarded', label: '丢弃 Prompt 配置草稿' },
              { value: 'sa_prompt_config_restored_default', label: '恢复内置 Prompt 配置' },
              { value: 'sa_prompt_config_runtime_updated', label: '更新 Prompt 运行配置' },
              { value: 'sa_llm_config_changed', label: 'LLM 模型配置变更' },
            ]}
          />
          <SuperAdminSelect
            value={result}
            onChange={setResult}
            ariaLabel="审计结果"
            style={{ minWidth: 120 }}
            options={[
              { value: 'all', label: '全部结果' },
              { value: 'SUCCESS', label: '成功' },
              { value: 'FAILED', label: '失败' },
            ]}
          />
          <input
            value={operatorKeyword}
            onChange={(event) => setOperatorKeyword(event.target.value)}
            placeholder="操作者关键词"
            style={{
              minWidth: 220,
              height: 36,
              borderRadius: 8,
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              padding: '0 10px',
              outline: 'none',
            }}
          />
          <input
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            aria-label="开始时间"
            style={{
              minWidth: 190,
              height: 36,
              borderRadius: 8,
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              padding: '0 10px',
              outline: 'none',
            }}
          />
          <input
            type="datetime-local"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            aria-label="结束时间"
            style={{
              minWidth: 190,
              height: 36,
              borderRadius: 8,
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              padding: '0 10px',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void loadAuditEvents(0)}
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            搜索
          </button>
        </div>

        {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}
        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--danger-border-soft)',
              background: 'var(--danger-bg-soft)',
              color: 'var(--danger)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div
          className="sa-main-list-viewport"
          data-testid="superadmin-audit-table"
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            background: 'var(--bg-tertiary)',
          }}
        >
          <table className="sa-table sa-audit-table" style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 158 }} />
              <col style={{ width: '34%' }} />
              <col style={{ width: 132 }} />
              <col />
              <col style={{ width: 84 }} />
              <col style={{ width: 58 }} />
            </colgroup>
            <thead>
              <tr>
                {['时间', '操作内容', '操作者', '操作对象', '结果', '详情'].map((title, index, headers) => (
                  <th key={title} className={index === headers.length - 1 ? 'sa-table-cell-center' : undefined}>
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id} style={item.result === 'FAILED' ? { background: 'var(--danger-bg-soft)' } : undefined}>
                  <td>
                    {toDateTime(item.createdAt)}
                  </td>
                  <td>
                    <div style={auditPrimaryTextStyle}>{formatEventType(item.eventType)}</div>
                    <div style={auditSecondaryTextStyle} title={formatSummary(item.summary)}>
                      {formatSummary(item.summary)}
                    </div>
                  </td>
                  <td>
                    {formatOperator(item)}
                  </td>
                  <td>
                    <div style={auditPrimaryTextStyle}>{formatTargetType(item.targetType)}</div>
                    <div style={auditSecondaryMonoStyle} title={item.targetId || undefined}>
                      {item.targetId || '-'}
                    </div>
                  </td>
                  <td>
                    <span className={`sa-table-status ${item.result === 'SUCCESS' ? 'is-success' : 'is-danger'}`}>
                      {formatResult(item.result)}
                    </span>
                  </td>
                  <td className="sa-table-cell-center">
                    <button
                      type="button"
                      aria-label={`查看审计详情：${formatEventType(item.eventType)}`}
                      title="查看详情"
                      style={auditDetailButtonStyle}
                      onClick={() => setSelectedAudit(item)}
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={6} className="sa-table-empty">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="sa-main-list-footer" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => void loadAuditEvents(page - 1)}
            style={{
              height: 32,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: page <= 0 ? 'not-allowed' : 'pointer',
              opacity: page <= 0 ? 0.6 : 1,
            }}
          >
            上一页
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            第 {page + 1} / {totalPages} 页
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => void loadAuditEvents(page + 1)}
            style={{
              height: 32,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: page + 1 >= totalPages ? 'not-allowed' : 'pointer',
              opacity: page + 1 >= totalPages ? 0.6 : 1,
            }}
          >
            下一页
          </button>
        </div>

        {selectedAudit && (
          <div
            data-testid="superadmin-audit-detail-mask"
            style={auditDrawerMaskStyle}
            onClick={closeAuditDetail}
          >
            <aside
              ref={auditDrawerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="superadmin-audit-detail-title"
              tabIndex={-1}
              data-testid="superadmin-audit-detail-drawer"
              style={auditDrawerStyle}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={auditDrawerHeaderStyle}>
                <div>
                  <div id="superadmin-audit-detail-title" style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>审计详情</div>
                  <div style={{ marginTop: 3, fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatEventType(selectedAudit.eventType)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="关闭审计详情"
                  style={auditDrawerCloseStyle}
                  onClick={closeAuditDetail}
                >
                  <X size={17} />
                </button>
              </div>
              <div style={auditDrawerContentStyle}>
                <AuditDetailItem label="操作时间" value={toDateTime(selectedAudit.createdAt)} />
                <AuditDetailItem label="操作结果" value={formatResult(selectedAudit.result)} />
                <AuditDetailItem label="操作者" value={formatOperator(selectedAudit)} />
                <AuditDetailItem label="操作对象" value={formatTargetType(selectedAudit.targetType)} />
                <AuditDetailItem label="目标 ID" value={selectedAudit.targetId || '-'} mono />
                <AuditDetailItem label="事件编码" value={selectedAudit.eventType} mono />
                <AuditDetailItem label="审计 ID" value={selectedAudit.id} mono />
                <AuditDetailItem label="操作摘要" value={formatSummary(selectedAudit.summary)} />
              </div>
            </aside>
          </div>
        )}
      </main>
    </SuperAdminLayout>
  );
};

const AuditDetailItem: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono = false }) => (
  <div style={auditDetailItemStyle}>
    <div style={auditDetailLabelStyle}>{label}</div>
    <div style={{ ...auditDetailValueStyle, ...(mono ? auditDetailMonoStyle : {}) }}>{value}</div>
  </div>
);

const auditPrimaryTextStyle: React.CSSProperties = {
  overflow: 'hidden',
  color: 'var(--text-primary)',
  fontWeight: 600,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const auditSecondaryTextStyle: React.CSSProperties = {
  marginTop: 3,
  overflow: 'hidden',
  color: 'var(--text-muted)',
  fontSize: 12,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const auditSecondaryMonoStyle: React.CSSProperties = {
  ...auditSecondaryTextStyle,
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

const auditDetailButtonStyle: React.CSSProperties = {
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

const auditDrawerMaskStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1100,
  background: 'var(--modal-backdrop)',
};

const auditDrawerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 'min(460px, 100%)',
  height: '100%',
  background: 'var(--bg-primary)',
  borderLeft: '1px solid var(--border-subtle)',
  boxShadow: 'var(--shadow-lg)',
  display: 'flex',
  flexDirection: 'column',
};

const auditDrawerHeaderStyle: React.CSSProperties = {
  minHeight: 68,
  padding: '0 20px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexShrink: 0,
};

const auditDrawerCloseStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  padding: 0,
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const auditDrawerContentStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const auditDetailItemStyle: React.CSSProperties = {
  padding: 14,
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--bg-secondary)',
};

const auditDetailLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 12,
};

const auditDetailValueStyle: React.CSSProperties = {
  marginTop: 6,
  color: 'var(--text-primary)',
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
};

const auditDetailMonoStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  fontSize: 12,
};

export default SuperAdminAuditPage;
