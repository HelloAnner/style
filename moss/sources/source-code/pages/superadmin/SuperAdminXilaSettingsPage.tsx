import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  superAdminApi,
  type SaXilaTenantBindingItem,
  type SaXilaFallbackPoolItem,
} from '../../api/superadmin';
import { SuperAdminConfigShell } from './SuperAdminConfigShell';
import { SuperAdminSelect } from './SuperAdminSelect';
import { SuperAdminEmptyState } from './SuperAdminEmptyState';


function toDateTime(value?: string | null): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

function resolveCredentialSourceLabel(item: SaXilaTenantBindingItem): string {
  if (item.credentialSource === 'TENANT') {
    return '租户凭证';
  }
  if (item.credentialSource === 'GLOBAL_FALLBACK') {
    return '全局兜底';
  }
  return '未配置';
}

function resolveRefreshStatusLabel(item: SaXilaTenantBindingItem): string {
  if (item.refreshStatus === 'active') {
    return '生效';
  }
  if (item.refreshStatus === 'refreshing') {
    return '刷新中';
  }
  if (item.refreshStatus === 'failed') {
    return '失败';
  }
  return '待处理';
}

/**
 * 超管析拉配置页（主前端承接第十一批）。
 *
 * 业务职责：
 * - 管理析拉平台管理员账号与全局兜底手机号；
 * - 管理租户 token 绑定列表并支持手动刷新。
 */
export const SuperAdminXilaSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [virtualMobilePrefix, setVirtualMobilePrefix] = useState('');
  const [fallbackPoolMobilePrefix, setFallbackPoolMobilePrefix] = useState('');
  const [xilaEnvironment, setXilaEnvironment] = useState<'dev' | 'prod'>('dev');
  const [passwordConfigured, setPasswordConfigured] = useState(false);

  // 号池状态
  const [pool, setPool] = useState<SaXilaFallbackPoolItem[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMobile, setAddMobile] = useState('');
  const [addRemark, setAddRemark] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false);
  const [rebuildSaving, setRebuildSaving] = useState(false);

  const [bindingKeyword, setBindingKeyword] = useState('');
  const [bindingAppliedKeyword, setBindingAppliedKeyword] = useState('');
  const [bindings, setBindings] = useState<SaXilaTenantBindingItem[]>([]);
  const [bindingTotal, setBindingTotal] = useState(0);
  const [bindingPage, setBindingPage] = useState(0);
  const [bindingLoading, setBindingLoading] = useState(false);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const [refreshingTenantId, setRefreshingTenantId] = useState<string | null>(null);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const bindingSize = 20;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminApi.xilaConfig();
      setMobile(data.platformAdminMobile ?? '');
      setPassword('');
      setVirtualMobilePrefix(data.virtualMobilePrefix ?? '');
      setFallbackPoolMobilePrefix(data.fallbackPoolMobilePrefix ?? '');
      setXilaEnvironment(data.environment === 'prod' ? 'prod' : 'dev');
      setPasswordConfigured(data.platformAdminPasswordConfigured);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    setPoolError(null);
    try {
      const data = await superAdminApi.listXilaFallbackPool();
      setPool(data);
    } catch (err) {
      setPoolError(err instanceof Error ? err.message : '加载号池失败');
    } finally {
      setPoolLoading(false);
    }
  }, []);

  const rebuildPool = useCallback(async () => {
    setRebuildSaving(true);
    setPoolError(null);
    try {
      const data = await superAdminApi.rebuildXilaFallbackPool();
      setPool(data);
      setShowRebuildConfirm(false);
    } catch (err) {
      setPoolError(err instanceof Error ? err.message : '重建号池失败');
    } finally {
      setRebuildSaving(false);
    }
  }, []);

  const loadBindings = useCallback(async (params: { targetPage: number; keyword: string }) => {
    setBindingLoading(true);
    setBindingError(null);
    try {
      const data = await superAdminApi.xilaTenantBindings({
        keyword: params.keyword.trim() || undefined,
        page: params.targetPage,
        size: bindingSize,
      });
      setBindings(data.items);
      setBindingTotal(data.total);
      setBindingPage(data.page);
      setBindingAppliedKeyword(params.keyword.trim());
    } catch (err) {
      setBindingError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setBindingLoading(false);
    }
  }, []);

  const refreshBinding = useCallback(async (tenantId: string) => {
    setRefreshingTenantId(tenantId);
    setBindingError(null);
    try {
      await superAdminApi.refreshXilaTenantBinding(tenantId);
      await loadBindings({ targetPage: bindingPage, keyword: bindingKeyword });
    } catch (err) {
      setBindingError(err instanceof Error ? err.message : '刷新失败，请稍后重试');
    } finally {
      setRefreshingTenantId(null);
    }
  }, [bindingKeyword, bindingPage, loadBindings]);

  useEffect(() => {
    // 页面加载时同步拉取配置、号池、绑定列表，确保号池下标列有数据可比对
    void Promise.all([loadConfig(), loadPool(), loadBindings({ targetPage: 0, keyword: '' })]);
  }, [loadConfig, loadPool, loadBindings]);

  const ready = useMemo(
    () => Boolean(
      mobile.trim()
      && (passwordConfigured || password.trim()),
    ),
    [mobile, password, passwordConfigured],
  );

  const bindingTotalPages = useMemo(
    () => Math.max(Math.ceil(bindingTotal / bindingSize), 1),
    [bindingTotal],
  );

  const showMatchedUserColumns = Boolean(bindingAppliedKeyword);

  const forceGlobalRefresh = async () => {
    setGlobalRefreshing(true);
    setError(null);
    try {
      await superAdminApi.forceGlobalRefresh();
      toast.success('已触发全局缓存刷新，所有节点将在秒级内生效');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '刷新失败，请稍后重试');
    } finally {
      setGlobalRefreshing(false);
    }
  };

  const saveConfig = async () => {
    const trimmedMobile = mobile.trim();
    const trimmedPassword = password.trim();

    if (!trimmedMobile) {
      setError('请输入平台管理员手机号');
      return;
    }
    if (!passwordConfigured && !trimmedPassword) {
      setError('请设置平台管理员密码');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await superAdminApi.updateXilaConfig({
        platformAdminMobile: trimmedMobile,
        platformAdminPassword: trimmedPassword || undefined,
        virtualMobilePrefix: virtualMobilePrefix.trim() || undefined,
        fallbackPoolMobilePrefix: fallbackPoolMobilePrefix.trim() || undefined,
        environment: xilaEnvironment,
      });
      setMobile(res.platformAdminMobile ?? '');
      setPassword('');
      setVirtualMobilePrefix(res.virtualMobilePrefix ?? '');
      setFallbackPoolMobilePrefix(res.fallbackPoolMobilePrefix ?? '');
      setXilaEnvironment(res.environment === 'prod' ? 'prod' : 'dev');
      setPasswordConfigured(res.platformAdminPasswordConfigured);
      toast.success('析拉配置已保存');
      await loadBindings({ targetPage: 0, keyword: bindingKeyword });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SuperAdminConfigShell activeKey="xila" testId="superadmin-xila-settings-page">
      <>
        {loading && <div className="fi-config-loading">加载中...</div>}
        {error && <div className="fi-config-alert error">{error}</div>}

        <article className="fi-config-card" data-testid="superadmin-xila-account-config">
          <section className="fi-config-section">
            <div className="fi-config-section-header">
              <div>
                <div className="fi-config-section-title">平台账号配置</div>
                <div className="fi-config-section-desc">维护析拉平台管理员账号与全局兜底号</div>
              </div>
              <span className={`fi-config-status ${ready ? 'ready' : 'draft'}`}>
                {ready ? '配置完整' : '配置不完整'}
              </span>
            </div>

            <div className="fi-config-grid two">
              <label className="fi-config-field">
                <span className="fi-config-label">平台管理员手机号</span>
                <input
                  className="fi-config-input"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  disabled={loading || saving}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">平台管理员密码</span>
                <input
                  className="fi-config-input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={passwordConfigured ? '已配置，留空表示不变更' : '请输入平台管理员密码'}
                  disabled={loading || saving}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">虚拟号前缀</span>
                <input
                  className="fi-config-input"
                  value={virtualMobilePrefix}
                  onChange={(event) => setVirtualMobilePrefix(event.target.value)}
                  placeholder="如 1700（默认）"
                  disabled={loading || saving}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">兜底号池前缀</span>
                <input
                  className="fi-config-input"
                  value={fallbackPoolMobilePrefix}
                  onChange={(event) => setFallbackPoolMobilePrefix(event.target.value)}
                  placeholder="如 1790（默认）"
                  disabled={loading || saving}
                />
              </label>
              <label className="fi-config-field">
                <span className="fi-config-label">Xila env</span>
                <SuperAdminSelect
                  value={xilaEnvironment}
                  onChange={setXilaEnvironment}
                  disabled={loading || saving}
                  ariaLabel="Xila 环境"
                  style={{ width: '100%' }}
                  options={[
                    { value: 'dev', label: 'dev' },
                    { value: 'prod', label: 'prod' },
                  ]}
                />
              </label>
            </div>

            <div className="fi-config-section-desc">
              {passwordConfigured ? '密码已配置，可留空不修改。' : '首次保存必须提供平台管理员密码。'}
            </div>

            <div className="fi-config-inline-row">
              <button
                className="fi-config-button primary"
                type="button"
                disabled={saving || loading}
                onClick={() => void saveConfig()}
              >
                {saving ? '保存中...' : '保存析拉配置'}
              </button>
              <button
                className="fi-config-button"
                type="button"
                disabled={globalRefreshing || loading}
                onClick={() => void forceGlobalRefresh()}
                title="强制清除所有节点的 Xila token 缓存，配置变更后立即生效"
              >
                {globalRefreshing ? '刷新中...' : '刷新全局缓存'}
              </button>
            </div>
          </section>
        </article>

        {/* ===== 全局兜底号池管理 ===== */}
        <section
          data-testid="superadmin-xila-fallback-pool"
          className="fi-config-card-compact"
        >
          <div className="fi-config-card-header">
            <div>
              <div className="fi-config-card-title">全局兜底号池</div>
              <div className="fi-config-card-subtitle">
                管理析拉全局兜底账号，系统按 sort_order 轮流分配给无绑定租户
              </div>
            </div>
            <div className="fi-config-card-actions">
              <button
                type="button"
                className="fi-config-button compact"
                onClick={() => { setAddMobile(''); setAddRemark(''); setShowAddModal(true); }}
              >
                新增
              </button>
              <button
                type="button"
                className="fi-config-button compact"
                onClick={() => { setBatchText(''); setShowBatchModal(true); }}
              >
                批量导入
              </button>
              <button
                type="button"
                className="fi-config-button compact danger"
                onClick={() => setShowRebuildConfirm(true)}
                title="清空当前号池并按配置的兜底号池前缀重新 bootstrap 11 个默认号"
              >
                清空并重建
              </button>
            </div>
          </div>

          {poolLoading && <div className="fi-config-loading">加载中...</div>}
          {poolError && <div className="fi-config-alert error">{poolError}</div>}

          <div data-testid="superadmin-xila-fallback-pool-table" className="fi-config-table-wrap">
            <table className="fi-config-table compact zebra" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  {[
                    { label: '手机号', align: 'left' },
                    { label: '启用', align: 'center' },
                    { label: '排序', align: 'numeric' },
                    { label: '备注', align: 'left' },
                    { label: '创建时间', align: 'left' },
                    { label: '操作', align: 'center' },
                  ].map((col) => (
                    <th key={col.label} className={col.align}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pool.map((item) => (
                  <tr key={item.id}>
                    <td>{item.mobile}</td>
                    <td className="center">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await superAdminApi.updateXilaFallbackPoolEntry(item.id, { enabled: !item.enabled });
                            await loadPool();
                          } catch (err) {
                            setPoolError(err instanceof Error ? err.message : '操作失败');
                          }
                        }}
                        className={`fi-config-badge${item.enabled ? ' success' : ' neutral'}`}
                      >
                        {item.enabled ? '启用' : '禁用'}
                      </button>
                    </td>
                    <td className="numeric">{item.sortOrder}</td>
                    <td className="fi-config-muted">{item.remark || '-'}</td>
                    <td className="fi-config-muted">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                    <td className="center">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="fi-config-text-danger"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!poolLoading && pool.length === 0 && (
              <SuperAdminEmptyState
                title="号池为空"
                description="当前没有兜底号码，可点击上方「新增」按钮逐个添加，或使用「批量导入」"
              />
            )}
          </div>

          {/* 新增号码 Modal */}
          {showAddModal && (
            <div data-testid="superadmin-xila-add-modal" className="fi-config-modal-backdrop">
              <div data-testid="superadmin-xila-add-modal-panel" className="fi-config-modal-panel">
                <div className="fi-config-modal-title">新增号码</div>
                <label className="fi-config-field">
                  <span className="fi-config-label">手机号（11 位数字）</span>
                  <input
                    className="fi-config-input"
                    value={addMobile}
                    onChange={(e) => setAddMobile(e.target.value)}
                  />
                </label>
                <label className="fi-config-field">
                  <span className="fi-config-label">备注（选填）</span>
                  <input
                    className="fi-config-input"
                    value={addRemark}
                    onChange={(e) => setAddRemark(e.target.value)}
                  />
                </label>
                <div className="fi-config-modal-actions">
                  <button
                    type="button"
                    className="fi-config-button primary"
                    disabled={addSaving}
                    onClick={async () => {
                      setAddSaving(true);
                      try {
                        await superAdminApi.createXilaFallbackPoolEntry({ mobile: addMobile.trim(), enabled: true, remark: addRemark.trim() || undefined });
                        setShowAddModal(false);
                        await loadPool();
                      } catch (err) {
                        setPoolError(err instanceof Error ? err.message : '新增失败');
                      } finally {
                        setAddSaving(false);
                      }
                    }}
                  >
                    {addSaving ? '保存中...' : '确认新增'}
                  </button>
                  <button
                    type="button"
                    className="fi-config-button"
                    onClick={() => setShowAddModal(false)}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 批量导入 Modal */}
          {showBatchModal && (
            <div data-testid="superadmin-xila-batch-import-modal" className="fi-config-modal-backdrop">
              <div data-testid="superadmin-xila-batch-import-modal-panel" className="fi-config-modal-panel wide">
                <div className="fi-config-modal-title">批量导入手机号</div>
                <div className="fi-config-section-desc">每行一个手机号，重复或格式错误的会自动跳过</div>
                <textarea
                  className="fi-config-textarea"
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  rows={8}
                />
                <div className="fi-config-modal-actions">
                  <button
                    type="button"
                    className="fi-config-button primary"
                    disabled={batchSaving}
                    onClick={async () => {
                      setBatchSaving(true);
                      try {
                        const mobiles = batchText.split('\n').map((s) => s.trim()).filter(Boolean);
                        await superAdminApi.batchImportXilaFallbackPool({ mobiles });
                        setShowBatchModal(false);
                        await loadPool();
                      } catch (err) {
                        setPoolError(err instanceof Error ? err.message : '批量导入失败');
                      } finally {
                        setBatchSaving(false);
                      }
                    }}
                  >
                    {batchSaving ? '导入中...' : '确认导入'}
                  </button>
                  <button
                    type="button"
                    className="fi-config-button"
                    onClick={() => setShowBatchModal(false)}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 清空并重建号池确认 Modal */}
          {showRebuildConfirm && (
            <div data-testid="superadmin-xila-rebuild-modal" className="fi-config-modal-backdrop">
              <div data-testid="superadmin-xila-rebuild-modal-panel" className="fi-config-modal-panel wide">
                <div className="fi-config-modal-title">清空并重建号池</div>
                <div className="fi-config-modal-body">
                  此操作会 <strong className="fi-config-text-danger">清空当前所有兜底号</strong>，并按最新的"兜底号池前缀"配置重新创建 11 个默认号。正在使用这些号的租户在下次 token 请求时会通过按需 provision 迁移到自己的虚拟号账号。
                  <br /><br />
                  确定继续？
                </div>
                <div className="fi-config-modal-actions">
                  <button
                    type="button"
                    className="fi-config-button compact"
                    disabled={rebuildSaving}
                    onClick={() => setShowRebuildConfirm(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="fi-config-button compact danger"
                    disabled={rebuildSaving}
                    onClick={() => void rebuildPool()}
                  >
                    {rebuildSaving ? '重建中...' : '确认重建'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 删除二次确认 Modal */}
          {deleteConfirmId && (
            <div data-testid="superadmin-xila-delete-modal" className="fi-config-modal-backdrop">
              <div data-testid="superadmin-xila-delete-modal-panel" className="fi-config-modal-panel">
                <div className="fi-config-modal-title">确认删除</div>
                <div className="fi-config-modal-body">删除后不可恢复，正在使用此号的租户将受影响，确认删除？</div>
                <div className="fi-config-modal-actions">
                  <button
                    type="button"
                    className="fi-config-button danger"
                    onClick={async () => {
                      try {
                        await superAdminApi.deleteXilaFallbackPoolEntry(deleteConfirmId);
                        setDeleteConfirmId(null);
                        await loadPool();
                      } catch (err) {
                        setPoolError(err instanceof Error ? err.message : '删除失败');
                        setDeleteConfirmId(null);
                      }
                    }}
                  >
                    确认删除
                  </button>
                  <button
                    type="button"
                    className="fi-config-button"
                    onClick={() => setDeleteConfirmId(null)}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section
          data-testid="superadmin-xila-bindings"
          className="fi-config-card-compact"
        >
          <div>
            <div className="fi-config-card-title">租户绑定列表</div>
            <div className="fi-config-card-subtitle">
              支持按关键词查询并手动刷新租户绑定状态
            </div>
          </div>

          <div data-testid="superadmin-xila-bindings-filters" className="fi-config-search-row">
            <input
              value={bindingKeyword}
              onChange={(event) => setBindingKeyword(event.target.value)}
              placeholder="输入工作区/租户关键词"
              className="fi-config-search-input"
            />
            <button
              type="button"
              className="fi-config-button compact"
              onClick={() => void loadBindings({ targetPage: 0, keyword: bindingKeyword })}
            >
              搜索
            </button>
          </div>

          {bindingLoading && <div className="fi-config-loading">加载中...</div>}
          {bindingError && <div className="fi-config-alert error">{bindingError}</div>}

          <div
            data-testid="superadmin-xila-bindings-table"
            className="fi-config-table-wrap"
          >
            <table className="fi-config-table compact zebra" style={{ minWidth: showMatchedUserColumns ? 1360 : 1080 }}>
              <thead>
                <tr>
                  {[
                    { label: '工作区', align: 'left' },
                    { label: '租户ID', align: 'left' },
                    ...(showMatchedUserColumns ? [
                      { label: '匹配用户', align: 'left' },
                      { label: '匹配关系', align: 'left' },
                    ] : []),
                    { label: '析拉手机号', align: 'left' },
                    { label: '号池下标', align: 'numeric' },
                    { label: '凭证来源', align: 'left' },
                    { label: '状态', align: 'left' },
                    { label: '错误信息', align: 'left' },
                    { label: '更新时间', align: 'left' },
                    { label: '操作', align: 'center' },
                  ].map((col) => (
                    <th key={col.label} className={col.align}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bindings.map((item) => {
                  const isRefreshing = refreshingTenantId === item.tenantId;
                  return (
                    <tr key={item.tenantId}>
                      <td>{item.workspaceName}</td>
                      <td>{item.tenantId}</td>
                      {showMatchedUserColumns && (
                        <>
                          <td>{item.matchedUserIdentity || '-'}</td>
                          <td>{item.matchedUserRelation || '-'}</td>
                        </>
                      )}
                      <td>{item.xilaMobile || '-'}</td>
                      <td className="numeric fi-config-muted">
                        {/* 号池下标：仅对 GLOBAL_FALLBACK 凭证来源展示。
                            pool.mobile 为明文全号，直接与 xilaMobile 精确匹配，取对应 sortOrder 展示。 */}
                        {item.credentialSource === 'GLOBAL_FALLBACK' && item.xilaMobile
                          ? (() => {
                              const poolEntry = pool.find((p) => p.mobile === item.xilaMobile);
                              return poolEntry != null ? String(poolEntry.sortOrder) : '-';
                            })()
                          : '-'}
                      </td>
                      <td>{resolveCredentialSourceLabel(item)}</td>
                      <td>{resolveRefreshStatusLabel(item)}</td>
                      <td>
                        {/* 错误信息截断 40 字符，hover 显示完整内容 */}
                        {(() => {
                          const msg = item.lastErrorMessage || item.lastErrorCode || null;
                          if (!msg) return '-';
                          const truncated = msg.length > 40 ? `${msg.slice(0, 40)}…` : msg;
                          return (
                            <span
                              className={msg.length > 40 ? 'truncate' : undefined}
                              title={msg.length > 40 ? msg : undefined}
                              style={{ cursor: msg.length > 40 ? 'help' : 'default' }}
                            >
                              {truncated}
                            </span>
                          );
                        })()}
                      </td>
                      <td>{toDateTime(item.updatedAt)}</td>
                      <td className="center">
                        <button
                          type="button"
                          className="fi-config-text-danger"
                          disabled={isRefreshing}
                          onClick={() => void refreshBinding(item.tenantId)}
                        >
                          {isRefreshing ? '刷新中...' : '刷新'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!bindingLoading && bindings.length === 0 && (
              <SuperAdminEmptyState
                tone="search"
                title="未找到绑定记录"
                description="当前没有租户绑定数据，可尝试调整搜索关键词或稍后再试。"
              />
            )}
          </div>

          <div className="fi-config-pagination">
            <button
              type="button"
              className="fi-config-button compact"
              disabled={bindingPage <= 0}
              onClick={() => void loadBindings({ targetPage: bindingPage - 1, keyword: bindingKeyword })}
            >
              上一页
            </button>
            <span className="fi-config-page-info">
              第 {bindingPage + 1} / {bindingTotalPages} 页
            </span>
            <button
              type="button"
              className="fi-config-button compact"
              disabled={bindingPage + 1 >= bindingTotalPages}
              onClick={() => void loadBindings({ targetPage: bindingPage + 1, keyword: bindingKeyword })}
            >
              下一页
            </button>
          </div>
        </section>
      </>
    </SuperAdminConfigShell>
  );
};

export default SuperAdminXilaSettingsPage;
