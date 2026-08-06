import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { superAdminApi, type SaAgentItem } from '../../api/superadmin';
import { SuperAdminSelect } from './SuperAdminSelect';

type PublishStatusFilter = 'all' | 'published' | 'unpublished';

function toDateTime(value: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function statusBadge(status: SaAgentItem['status']): { label: string; className: string } {
  if (status === 'active') return { label: '启用', className: 'success' };
  return { label: '禁用', className: 'muted' };
}

function publishBadge(status: SaAgentItem['publishStatus']): { label: string; className: string } {
  if (status === 'published') return { label: '已发布', className: 'success' };
  return { label: '未发布', className: 'warning' };
}

function configModeLabel(mode: SaAgentItem['configMode']): string {
  if (mode === 'wrapped') return 'Wrapped';
  if (mode === 'proxy') return 'Proxy';
  return mode;
}

export const SuperAdminAgentList: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [publishStatus, setPublishStatus] = useState<PublishStatusFilter>('all');
  const [list, setList] = useState<SaAgentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / size), 1), [size, total]);

  const loadAgents = useCallback(async (params: {
    targetPage: number;
    keyword: string;
    publishStatus: PublishStatusFilter;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await superAdminApi.agents({
        keyword: params.keyword.trim() || undefined,
        publishStatus: params.publishStatus === 'all' ? undefined : params.publishStatus,
        page: params.targetPage,
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
  }, [size]);

  useEffect(() => {
    void loadAgents({ targetPage: 0, keyword: '', publishStatus: 'all' });
  }, [loadAgents]);

  const handleSearch = () => {
    void loadAgents({ targetPage: 0, keyword, publishStatus });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="sa-agents-card sa-main-list-panel">
      {/* 搜索栏 */}
      <div className="sa-agents-search-bar">
        <input
          className="sa-agents-search-input"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索 Agent 名称、企业或工作区..."
        />
        <SuperAdminSelect
          value={publishStatus}
          onChange={setPublishStatus}
          ariaLabel="Agent 发布状态"
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'published', label: '已发布' },
            { value: 'unpublished', label: '未发布' },
          ]}
        />
        <button className="sa-agents-btn sa-agents-btn-primary" onClick={handleSearch}>
          搜索
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="sa-agents-alert error">{error}</div>
      )}

      {/* 加载态 */}
      {loading && (
        <div className="sa-agents-loading">
          <span>加载中...</span>
        </div>
      )}

      {/* 空态 */}
      {!loading && list.length === 0 && !error && (
        <div className="sa-agents-empty">
          <div className="sa-agents-empty-icon">📋</div>
          <div>暂无智能体数据</div>
        </div>
      )}

      {/* 表格 */}
      {!loading && list.length > 0 && (
        <>
          <div className="sa-agents-table-wrap sa-main-list-viewport">
            <table className="sa-table sa-agents-table">
              <thead>
                <tr>
                  <th>Agent 名称</th>
                  <th>企业</th>
                  <th>工作区</th>
                  <th>配置模式</th>
                  <th>发布状态</th>
                  <th>运行状态</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => {
                  const pub = publishBadge(item.publishStatus);
                  const st = statusBadge(item.status);
                  return (
                    <tr key={`${item.tenantId}:${item.agentId}`}>
                      <td style={{ fontWeight: 500 }}>{item.name || '-'}</td>
                      <td>{item.companyName || item.tenantId}</td>
                      <td>{item.workspaceName || item.tenantId}</td>
                      <td>
                        <span className={`sa-agents-badge info`}>{configModeLabel(item.configMode)}</span>
                      </td>
                      <td>
                        <span className={`sa-agents-badge ${pub.className}`}>{pub.label}</span>
                      </td>
                      <td>
                        <span className={`sa-agents-badge ${st.className}`}>{st.label}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toDateTime(item.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="sa-agents-pagination sa-main-list-footer">
            <span>共 {total} 条，第 {page + 1} / {totalPages} 页</span>
            <div className="sa-agents-pagination-btns">
              <button
                className="sa-agents-page-btn"
                disabled={page <= 0}
                onClick={() => void loadAgents({ targetPage: page - 1, keyword, publishStatus })}
              >
                上一页
              </button>
              <button
                className="sa-agents-page-btn"
                disabled={page + 1 >= totalPages}
                onClick={() => void loadAgents({ targetPage: page + 1, keyword, publishStatus })}
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SuperAdminAgentList;
