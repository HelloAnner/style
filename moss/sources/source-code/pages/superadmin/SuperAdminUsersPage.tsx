import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SuperAdminLayout } from './SuperAdminLayout';
import { superAdminApi, type SaUserItem } from '../../api/superadmin';
import { SuperAdminUserAgentAccessModal } from './SuperAdminUserAgentAccessModal';
import { SuperAdminSelect } from './SuperAdminSelect';

type UserStatusFilter = 'all' | 'active' | 'disabled';


function toDateTime(value: string): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

/**
 * 超管用户管理页（主前端承接首批）。
 *
 * 业务职责：
 * - 支持按手机号、邮箱、昵称与状态筛选用户；
 * - 支持用户启停操作与分页浏览。
 */
export const SuperAdminUsersPage: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<UserStatusFilter>('all');
  const [list, setList] = useState<SaUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentAccessUser, setAgentAccessUser] = useState<SaUserItem | null>(null);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / size), 1), [size, total]);

  const loadUsers = useCallback(async (params: {
    targetPage: number;
    keyword: string;
    status: UserStatusFilter;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await superAdminApi.users({
        keyword: params.keyword.trim() || undefined,
        status: params.status === 'all' ? undefined : params.status,
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
    void loadUsers({ targetPage: 0, keyword: '', status: 'all' });
  }, [loadUsers]);

  const handleToggleStatus = async (item: SaUserItem) => {
    const nextStatus = item.status === 'active' ? 'disabled' : 'active';
    const tip = nextStatus === 'disabled' ? '确认禁用该用户？' : '确认启用该用户？';
    if (!window.confirm(tip)) {
      return;
    }
    try {
      await superAdminApi.updateUserStatus(item.id, nextStatus);
      await loadUsers({ targetPage: page, keyword, status });
      toast.success(nextStatus === 'disabled' ? '用户已禁用' : '用户已启用');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '状态更新失败，请稍后重试');
    }
  };

  return (
    <SuperAdminLayout testId="superadmin-users-page">
      <main className="fi-superadmin-content fi-superadmin-list-page" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="superadmin-users-content">
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }} data-testid="superadmin-users-header">用户管理</div>

        <div className="sa-filter-bar" style={{ display: 'flex', gap: 10 }} data-testid="superadmin-users-filters">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="输入手机号、后四位、UserID、邮箱或昵称"
            style={{
              minWidth: 380,
              height: 36,
              borderRadius: 8,
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              padding: '0 10px',
              outline: 'none',
            }}
          />
          <SuperAdminSelect
            value={status}
            onChange={setStatus}
            ariaLabel="用户状态"
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'active', label: '启用' },
              { value: 'disabled', label: '禁用' },
            ]}
          />
          <button
            type="button"
            onClick={() => void loadUsers({ targetPage: 0, keyword, status })}
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
          data-testid="superadmin-users-table"
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            overflow: 'auto',
            background: 'var(--bg-tertiary)',
          }}
        >
          <table className="sa-table" style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['昵称', '手机号', '状态', '工作区数', '创建时间', '操作'].map((title) => (
                  <th key={title}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.nickname || '-'}
                  </td>
                  <td>
                    {item.phone || '-'}
                  </td>
                  <td>
                    {item.status === 'active' ? '启用' : '禁用'}
                  </td>
                  <td>
                    {item.workspaceCount}
                  </td>
                  <td>
                    {toDateTime(item.createdAt)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setAgentAccessUser(item)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--info)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        智能体
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(item)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {item.status === 'active' ? '禁用' : '启用'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && list.length === 0 && (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              暂无数据
            </div>
          )}
        </div>

        <div className="sa-main-list-footer" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => void loadUsers({ targetPage: page - 1, keyword, status })}
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
            onClick={() => void loadUsers({ targetPage: page + 1, keyword, status })}
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
      </main>
      {agentAccessUser && (
        <SuperAdminUserAgentAccessModal
          user={agentAccessUser}
          onClose={() => setAgentAccessUser(null)}
        />
      )}
    </SuperAdminLayout>
  );
};

export default SuperAdminUsersPage;
