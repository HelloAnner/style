import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SuperAdminLayout } from './SuperAdminLayout';
import {
  saShowcaseApi,
  type ShowcaseAdminItem,
  type ShowcaseAgentOption,
  type ShowcaseCreateRequest,
  type ShowcaseUpdateRequest,
} from '../../api/showcase';
import { Select } from '../../components/common/Select';


// ─── 编辑弹窗 ─────────────────────────────────────────────────────────────

interface FormData {
  shareUrl: string;
  title: string;
  description: string;
  agentId: string;
  status: string;
  coverImageKey: string | null;
}

const EMPTY_FORM: FormData = {
  shareUrl: '',
  title: '',
  description: '',
  agentId: '',
  status: 'published',
  coverImageKey: null,
};

function EditModal({
  item,
  agents,
  onClose,
  onSaved,
}: {
  item: ShowcaseAdminItem | null;
  agents: ShowcaseAgentOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = item !== null;
  const [form, setForm] = useState<FormData>(() =>
    item
      ? {
          shareUrl: item.shareUrl,
          title: item.title,
          description: item.description || '',
          agentId: item.agentId,
          status: item.status,
          coverImageKey: item.coverImageKey,
        }
      : { ...EMPTY_FORM, agentId: agents[0]?.id || '' },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlWarn, setUrlWarn] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);

  const tryAutoFillTitle = useCallback(async (url: string) => {
    const m = url.match(/\/share\/([A-Za-z0-9]{8,})/);
    if (!m) return;
    setFetchingTitle(true);
    try {
      const res = await fetch(`/api/v1/share/${m[1]}`);
      if (!res.ok) return;
      const data = await res.json();
      const title = data.title || data.session_title;
      if (title) {
        setForm((prev) => prev.title ? prev : { ...prev, title });
      }
    } catch {
      // ignore — title auto-fill is best-effort
    } finally {
      setFetchingTitle(false);
    }
  }, []);

  const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('仅支持 JPG、PNG、WebP 格式');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setCoverPreview(dataUrl);
      const result = await saShowcaseApi.uploadCover(dataUrl);
      setForm((prev) => ({ ...prev, coverImageKey: result.key }));
      toast.success('封面图已上传');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传封面图失败');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleRemoveCover = useCallback(() => {
    setCoverPreview(null);
    setForm((prev) => ({ ...prev, coverImageKey: null }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.shareUrl.trim()) {
      setError('分享链接不能为空');
      return;
    }
    if (!form.title.trim()) {
      setError('标题不能为空');
      return;
    }
    if (!form.agentId) {
      setError('请选择所属 Agent');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && item) {
        const data: ShowcaseUpdateRequest = {
          shareUrl: form.shareUrl,
          title: form.title,
          description: form.description || undefined,
          agentId: form.agentId,
          status: form.status,
          coverImageKey: form.coverImageKey,
        };
        await saShowcaseApi.update(item.id, data);
      } else {
        const data: ShowcaseCreateRequest = {
          shareUrl: form.shareUrl,
          title: form.title,
          description: form.description || undefined,
          agentId: form.agentId,
          status: form.status,
          coverImageKey: form.coverImageKey || undefined,
        };
        await saShowcaseApi.create(data);
      }
      toast.success(isEdit ? '案例已更新' : '案例已创建');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, item, onSaved]);

  return (
    <div
      data-testid="superadmin-showcase-edit-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--modal-backdrop)',
      }}
      onClick={onClose}
    >
      <div
        className="sa-showcase-modal-panel"
        data-testid="superadmin-showcase-edit-modal-panel"
        style={{
          background: 'var(--bg-primary)',
          borderRadius: 12,
          padding: 24,
          width: 520,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          {isEdit ? '编辑案例' : '添加案例'}
        </div>

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--warning-bg-soft)', color: 'var(--warning)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>分享链接 *</div>
          <input
            type="text"
            value={form.shareUrl}
            onChange={(e) => {
              const v = e.target.value;
              setForm((prev) => ({ ...prev, shareUrl: v }));
              setUrlWarn(v.trim().length > 0 && !v.includes('/share/'));
              if (v.includes('/share/') && !form.title) {
                void tryAutoFillTitle(v);
              }
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (pasted.includes('/share/') && !form.title) {
                void tryAutoFillTitle(pasted);
              }
            }}
            placeholder="粘贴公开分享外链，如 https://moss.ai/share/xxx"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>请确保该链接已设置为「公开分享」，否则访客无法查看</div>
          {urlWarn && (
            <div style={{ fontSize: 11, color: '#B85C00', background: '#FFF3E0', padding: '6px 11px', borderRadius: 7 }}>
              ⚠ 该链接看起来不像分享外链，请确认后再发布
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            展示标题 *
            {fetchingTitle && <span style={{ fontWeight: 400, marginLeft: 8 }}>自动获取中...</span>}
          </div>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={fetchingTitle ? '正在从分享链接获取标题...' : '案例在卡片上显示的标题'}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>简短描述</div>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="一两句话说明这个案例解决了什么问题（最多 60 字）"
            maxLength={60}
            style={{ ...inputStyle, height: 70, resize: 'vertical', padding: '8px 10px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>封面图</div>
          {coverPreview || form.coverImageKey ? (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: '#1a1a1a' }}>
              <img
                src={coverPreview || `/api/v1/showcase/covers/${(form.coverImageKey || '').replace('showcase/covers/', '')}`}
                alt="封面预览"
                style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                <label style={{ padding: '5px 11px', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  更换
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverUpload} style={{ display: 'none' }} />
                </label>
                <button type="button" onClick={handleRemoveCover} style={{ padding: '5px 11px', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  删除
                </button>
              </div>
            </div>
          ) : (
            <label
              style={{
                border: '1.5px dashed var(--border-subtle)', borderRadius: 10,
                padding: '26px 16px', textAlign: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer',
                color: 'var(--text-muted)', background: 'var(--bg-tertiary)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px', opacity: 0.7 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{uploading ? '上传中...' : '点击上传案例封面图'}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>建议 16:9 比例，最小宽 600px，最大 1MB · JPG / PNG / WebP</div>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverUpload} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>所属智能体 *</div>
            <Select
              value={form.agentId}
              onChange={(v) => setForm((prev) => ({ ...prev, agentId: v }))}
              placeholder="请选择"
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>发布状态 *</div>
            <Select
              value={form.status}
              onChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
              options={[
                { value: 'published', label: '已发布' },
                { value: 'draft', label: '草稿' },
              ]}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>取消</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving} style={primaryBtnStyle}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────

export const SuperAdminShowcasePage: React.FC = () => {
  const SA_PAGE_SIZE = 20;
  const [items, setItems] = useState<ShowcaseAdminItem[]>([]);
  const [agents, setAgents] = useState<ShowcaseAgentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<ShowcaseAdminItem | null | undefined>(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null);

  const agentMap = useMemo(() => {
    const m = new Map<string, ShowcaseAgentOption>();
    agents.forEach((a) => m.set(a.id, a));
    return m;
  }, [agents]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, agentsRes] = await Promise.all([saShowcaseApi.list(), saShowcaseApi.listAgents()]);
      setItems(itemsRes);
      setAgents(agentsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await saShowcaseApi.delete(id);
      setDeleteConfirmId(null);
      toast.success('案例已删除');
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  }, [loadData]);

  const handleReorder = useCallback(async (id: string, direction: 'up' | 'down') => {
    try {
      await saShowcaseApi.reorder(id, direction);
      toast.success('排序已更新');
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '排序失败');
    }
  }, [loadData]);

  const handleToggleStatus = useCallback(async (item: ShowcaseAdminItem) => {
    try {
      const newStatus = item.status === 'published' ? 'draft' : 'published';
      await saShowcaseApi.update(item.id, { status: newStatus });
      toast.success(newStatus === 'published' ? '案例已发布' : '案例已下架');
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '状态切换失败');
    }
  }, [loadData]);

  const filteredItems = useMemo(() => {
    if (!filterAgentId) return items;
    return items.filter((i) => i.agentId === filterAgentId);
  }, [items, filterAgentId]);

  const agentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((i) => {
      counts.set(i.agentId, (counts.get(i.agentId) || 0) + 1);
    });
    return counts;
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / SA_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * SA_PAGE_SIZE;
    return filteredItems.slice(start, start + SA_PAGE_SIZE);
  }, [filteredItems, safeCurrentPage]);

  const pagedGrouped = useMemo(() => {
    const groups: { agentId: string; agentName: string; items: ShowcaseAdminItem[] }[] = [];
    const map = new Map<string, ShowcaseAdminItem[]>();
    pagedItems.forEach((item) => {
      let arr = map.get(item.agentId);
      if (!arr) {
        arr = [];
        map.set(item.agentId, arr);
        groups.push({ agentId: item.agentId, agentName: item.agentName || agentMap.get(item.agentId)?.name || '未知', items: arr });
      }
      arr.push(item);
    });
    return groups;
  }, [pagedItems, agentMap]);

  const totalCount = filteredItems.length;
  const publishedCount = filteredItems.filter((i) => i.status === 'published').length;
  const draftCount = totalCount - publishedCount;
  const totalClicks = filteredItems.reduce((s, i) => s + (i.clickCount || 0), 0);

  return (
    <SuperAdminLayout>
{/* 主内容 */}
      <main className="fi-superadmin-content" data-testid="superadmin-showcase-page" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
        <div data-testid="superadmin-showcase-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>案例管理</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>管理案例的展示内容，添加、编辑、排序案例。</div>
          </div>
          <button type="button" onClick={() => setEditItem(null)} style={primaryBtnStyle}>+ 添加案例</button>
        </div>

        {/* 统计卡片 */}
        {!loading && items.length > 0 && (
          <div data-testid="superadmin-showcase-stats" style={{ display: 'flex', gap: 14 }}>
            <div style={statCardStyle}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{totalCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>全部案例</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success, #2e7d32)', lineHeight: 1 }}>{publishedCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>已发布</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1 }}>{draftCount}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>草稿</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--btn-primary-bg)', lineHeight: 1 }}>{totalClicks.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>总点击量</div>
            </div>
          </div>
        )}

        {/* 智能体筛选 */}
        {agents.length > 1 && (
          <div data-testid="superadmin-showcase-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => { setFilterAgentId(null); setCurrentPage(1); }}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: '1px solid ' + (!filterAgentId ? 'var(--btn-primary-bg)' : 'var(--border-subtle)'),
                background: !filterAgentId ? 'var(--btn-primary-bg)' : 'transparent',
                color: !filterAgentId ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              全部 ({items.length})
            </button>
            {agents.map((a) => {
              const active = filterAgentId === a.id;
              const count = agentCounts.get(a.id) || 0;
              if (count === 0) return null;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setFilterAgentId(a.id); setCurrentPage(1); }}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    border: '1px solid ' + (active ? 'var(--btn-primary-bg)' : 'var(--border-subtle)'),
                    background: active ? 'var(--btn-primary-bg)' : 'transparent',
                    color: active ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {a.name} ({count})
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--warning-bg-soft)', color: 'var(--warning)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>加载中...</div>}

        {!loading && items.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 40, textAlign: 'center' }}>暂无案例，点击「添加案例」开始</div>
        )}

        {!loading && items.length > 0 && filteredItems.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 40, textAlign: 'center' }}>该智能体下暂无案例</div>
        )}

        {pagedGrouped.map((group) => (
          <div key={group.agentId} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', padding: '8px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {group.agentName}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{group.items.length} 个案例</span>
            </div>
            <div
              className="sa-showcase-table-wrap"
              data-testid={`superadmin-showcase-group-${group.agentId}`}
              style={{
                border: '1px solid var(--border-subtle)', borderRadius: 8,
                background: 'var(--bg-tertiary)',
              }}
            >
              <table className="sa-table sa-showcase-table" data-testid={`superadmin-showcase-table-${group.agentId}`}>
                <colgroup>
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <th style={thStyle}>案例标题</th>
                    <th style={thStyle}>分享链接</th>
                    <th style={thStyle}>点击量</th>
                    <th style={thStyle}>状态</th>
                    <th style={thStyle}>排序</th>
                    <th style={thStyle}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.length === 0 && (
                    <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>暂无案例</td></tr>
                  )}
                  {group.items.map((item, idx) => {
                    const clicks = item.clickCount || 0;
                    return (
                      <tr key={item.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {item.coverImageKey ? (
                              <img
                                src={`/api/v1/showcase/covers/${(item.coverImageKey).replace('showcase/covers/', '')}`}
                                alt=""
                                style={{ width: 56, height: 36, borderRadius: 5, objectFit: 'cover', border: '1px solid var(--border-subtle)', flexShrink: 0 }}
                              />
                            ) : (
                              <div style={{ width: 56, height: 36, borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>无图</div>
                            )}
                            <span style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <a
                            href={item.shareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={item.shareUrl}
                            style={{ color: 'var(--btn-primary-bg)', fontSize: 12, textDecoration: 'none', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                          >
                            {item.shareUrl}
                          </a>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: clicks > 0 ? 600 : 400, color: clicks === 0 ? 'var(--text-muted)' : clicks >= 100 ? 'var(--btn-primary-bg)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {clicks.toLocaleString()}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                              background: item.status === 'published' ? 'rgba(45,138,78,0.12)' : 'var(--bg-secondary)',
                              color: item.status === 'published' ? '#2d8a4e' : 'var(--text-muted)',
                            }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                            {item.status === 'published' ? '已发布' : '草稿'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button type="button" onClick={() => void handleReorder(item.id, 'up')} disabled={idx === 0} style={smallBtnStyle}>↑</button>
                            <button type="button" onClick={() => void handleReorder(item.id, 'down')} disabled={idx === group.items.length - 1} style={smallBtnStyle}>↓</button>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" onClick={() => setEditItem(item)} style={smallBtnStyle}>编辑</button>
                            <button
                              type="button"
                              onClick={() => void handleToggleStatus(item)}
                              style={{ ...smallBtnStyle, color: item.status === 'published' ? 'var(--warning)' : '#2d8a4e', borderColor: item.status === 'published' ? 'rgba(192,57,43,0.2)' : 'rgba(45,138,78,0.2)' }}
                            >
                              {item.status === 'published' ? '下架' : '发布'}
                            </button>
                            <button type="button" onClick={() => setDeleteConfirmId(item.id)} style={{ ...smallBtnStyle, color: 'var(--warning)', borderColor: 'rgba(192,57,43,0.2)' }}>删除</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* 分页 */}
        {totalPages > 1 && (
          <div data-testid="superadmin-showcase-pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--text-muted)' }}>
            <span>共 {totalCount} 条，第 {safeCurrentPage}/{totalPages} 页</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{ ...smallBtnStyle, padding: '4px 12px', opacity: safeCurrentPage <= 1 ? 0.4 : 1 }}
              >
                上一页
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  style={{
                    ...smallBtnStyle,
                    padding: '4px 10px', minWidth: 32,
                    background: p === safeCurrentPage ? 'var(--btn-primary-bg)' : undefined,
                    color: p === safeCurrentPage ? '#fff' : undefined,
                    borderColor: p === safeCurrentPage ? 'var(--btn-primary-bg)' : undefined,
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{ ...smallBtnStyle, padding: '4px 12px', opacity: safeCurrentPage >= totalPages ? 0.4 : 1 }}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 编辑弹窗 */}
      {editItem !== undefined && (
        <EditModal
          item={editItem}
          agents={agents}
          onClose={() => setEditItem(undefined)}
          onSaved={() => { setEditItem(undefined); void loadData(); }}
        />
      )}

      {/* 删除确认 */}
      {deleteConfirmId && (
        <div
          data-testid="superadmin-showcase-delete-modal"
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--modal-backdrop)' }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            data-testid="superadmin-showcase-delete-modal-panel"
            style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 24, width: 360, display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>确认删除</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>确定删除这个案例吗？删除后不可恢复。</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setDeleteConfirmId(null)} style={secondaryBtnStyle}>取消</button>
              <button
                type="button"
                onClick={() => void handleDelete(deleteConfirmId)}
                style={{ ...primaryBtnStyle, background: 'var(--warning)', borderColor: 'var(--warning)' }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
};

export default SuperAdminShowcasePage;

// ─── 样式常量 ─────────────────────────────────────────────────────────────

const statCardStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  borderRadius: 12,
  padding: '18px 24px',
  border: '1px solid var(--border-subtle)',
};

const inputStyle: React.CSSProperties = {
  height: 36, borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px', fontSize: 13,
  width: '100%',
};

const primaryBtnStyle: React.CSSProperties = {
  height: 34, padding: '0 16px', borderRadius: 8,
  border: '1px solid var(--btn-primary-bg)',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  fontSize: 13, cursor: 'pointer', fontWeight: 500,
};

const secondaryBtnStyle: React.CSSProperties = {
  height: 34, padding: '0 16px', borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: 13, cursor: 'pointer',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '2px 8px', borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 12, cursor: 'pointer', marginLeft: 4,
};

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left',
  color: 'var(--text-muted)', fontWeight: 500, fontSize: 12,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', color: 'var(--text-primary)',
};
