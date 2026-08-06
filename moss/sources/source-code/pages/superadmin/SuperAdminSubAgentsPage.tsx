/**
 * 超管「子智能体管理」页（PRD §10）。
 *
 * 业务职责：
 * - 列表 + 关键字/状态/可见性筛选；
 * - 创建 / 编辑（含工具/技能白名单 inherit、可见性、tenant_ids、bound_to）；
 * - 启用 / 禁用、删除；
 * - 一键回退到上一版本；
 * - 在线测试（task + 可选 context，输出四层结构化结果）；
 * - 执行日志快速预览。
 *
 * 数据来源：Platform Java `/api/v1/sa/subagents/*`（saSubagentsApi）。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { SuperAdminLayout } from './SuperAdminLayout';
import { SuperAdminSelect } from './SuperAdminSelect';
import {
  saSubagentsApi,
  type RegistryToolItem,
  type RegistrySkillItem,
  type SaSubagentDetailResponse,
  type SaSubagentDraftPayload,
  type SaSubagentLogItem,
  type SaSubagentPublishPayload,
  type SaSubagentRegistryItem,
  type SaSubagentStatus,
  type SaSubagentTestResponse,
  type SaSubagentUpsertPayload,
  type SaSubagentVersion,
  type SaSubagentVisibility,
  type SaSubagentWhitelist,
} from '../../api/saSubagents';
import {
  superAdminApi,
  type SaAgentItem,
  type SaTenantItem,
} from '../../api/superadmin';

// ── 导航（与其它 SuperAdmin 页保持一致，加入「子智能体」一项）──


// ── 辅助：白名单解码 ──

function decodeWhitelist(value: SaSubagentWhitelist | string[] | string | null | undefined): SaSubagentWhitelist {
  if (value === undefined || value === null) return [];
  if (value === 'inherit') return 'inherit';
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value === 'inherit' ? 'inherit' : value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function decodeIdList(value: string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

// ── 租户工作区扁平结构 ──

interface TenantOption {
  tenantId: string;
  workspaceName: string;
  enterpriseName: string;
}

function flattenTenantOptions(items: SaTenantItem[]): TenantOption[] {
  const result: TenantOption[] = [];
  for (const ent of items) {
    for (const ws of ent.workspaces) {
      result.push({
        tenantId: ws.tenantId,
        workspaceName: ws.workspaceName,
        enterpriseName: ent.enterpriseName,
      });
    }
  }
  return result;
}

// ── 主智能体扁平结构 ──

interface AgentOption {
  name: string;
  enterpriseName: string;
  workspaceName: string;
}

function flattenAgentOptions(items: SaAgentItem[]): AgentOption[] {
  const seen = new Set<string>();
  const result: AgentOption[] = [];
  for (const a of items) {
    if (seen.has(a.name)) continue;
    seen.add(a.name);
    result.push({
      name: a.name,
      enterpriseName: a.companyName || '',
      workspaceName: a.workspaceName,
    });
  }
  return result;
}

// ── 表单初始态 ──

interface SubAgentDraft extends SaSubagentUpsertPayload {
  tools_whitelist: SaSubagentWhitelist;
  skills_whitelist: SaSubagentWhitelist;
  bound_to: string[];
  tenant_ids: string[];
}

const EMPTY_DRAFT: SubAgentDraft = {
  name: '',
  display_name: '',
  description: '',
  system_prompt: '',
  tools_whitelist: 'inherit',
  skills_whitelist: 'inherit',
  max_iterations: 30,
  visibility: 'global',
  bound_to: [],
  tenant_ids: [],
  status: 'enabled',
};

function toDraft(item: SaSubagentRegistryItem): SubAgentDraft {
  return {
    name: item.name,
    display_name: item.display_name,
    description: item.description,
    system_prompt: item.system_prompt,
    tools_whitelist: decodeWhitelist(item.tools_whitelist),
    skills_whitelist: decodeWhitelist(item.skills_whitelist),
    max_iterations: item.max_iterations ?? 30,
    visibility: item.visibility,
    bound_to: decodeIdList(item.bound_to),
    tenant_ids: decodeIdList(item.tenant_ids),
    status: item.status,
  };
}

/** 把后端 draft.payload(可能字段缺失)合并到 fallback 上,补全成完整 form draft。 */
function draftPayloadToFormDraft(
  payload: SaSubagentDraftPayload,
  fallback: SaSubagentRegistryItem,
): SubAgentDraft {
  return {
    name: payload.name ?? fallback.name,
    display_name: payload.display_name ?? fallback.display_name,
    description: payload.description ?? fallback.description,
    system_prompt: payload.system_prompt ?? fallback.system_prompt,
    tools_whitelist: decodeWhitelist(payload.tools_whitelist ?? fallback.tools_whitelist),
    skills_whitelist: decodeWhitelist(payload.skills_whitelist ?? fallback.skills_whitelist),
    max_iterations: payload.max_iterations ?? fallback.max_iterations ?? 30,
    visibility: payload.visibility ?? fallback.visibility,
    bound_to: decodeIdList(payload.bound_to ?? fallback.bound_to),
    tenant_ids: decodeIdList(payload.tenant_ids ?? fallback.tenant_ids),
    status: payload.status ?? fallback.status,
  };
}

// ── Toast 通知 ──



// ── 字段长度上限（与后端 SubagentRegistryService.MAX_*_LENGTH 保持一致）──

const NAME_MAX = 64;
const DISPLAY_NAME_MAX = 128;
const DESCRIPTION_MAX = 2000;
const SYSTEM_PROMPT_MAX = 20000;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type SortKey = 'name' | 'display_name' | 'visibility' | 'version' | 'status' | 'updated_at' | 'created_at';

export function formatSubagentStatusLabel(status: string | null | undefined): string {
  const normalized = (status || '').trim().toLowerCase();
  if (!normalized) return '未知';
  const labels: Record<string, string> = {
    completed: '完成',
    succeeded: '完成',
    success: '成功',
    failed: '失败',
    error: '失败',
    running: '运行中',
    in_progress: '运行中',
    pending: '等待中',
    queued: '排队中',
    timeout: '超时',
    timed_out: '超时',
    cancelled: '已取消',
    canceled: '已取消',
    degraded: '降级',
    retrying: '重试中',
  };
  return labels[normalized] ?? status ?? '未知';
}

export function formatSubagentAgentKindLabel(kind: string | null | undefined): string {
  const normalized = (kind || 'subagent').trim().toLowerCase();
  const labels: Record<string, string> = {
    subagent: '子智能体',
    main: '主智能体',
    temp: '临时智能体',
    derived: '派生分身',
    auto: '自动路由',
  };
  return labels[normalized] ?? (kind || '子智能体');
}

export function formatSubagentScopeLabel(scope: string | null | undefined): string {
  const normalized = (scope || '').trim();
  if (!normalized || normalized.toLowerCase() === 'global') return '全局';
  return normalized;
}

export function formatSubagentTokenLabel(tokens: number): string {
  return `${tokens.toLocaleString()} 个令牌`;
}

export function formatSubagentRetryLabel(retryCount: number): string {
  return `重试 ${retryCount} 次`;
}

// ── 主组件 ──

export const SuperAdminSubAgentsPage: React.FC = () => {

  // 列表状态
  const [items, setItems] = useState<SaSubagentRegistryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SaSubagentStatus>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | SaSubagentVisibility>('all');
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 编辑器状态
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [draft, setDraft] = useState<SubAgentDraft>(EMPTY_DRAFT);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);

  // 生效配置只读查看
  const [viewingName, setViewingName] = useState<string | null>(null);

  // 详情抽屉（测试 / 版本 / 日志）
  const [activeName, setActiveName] = useState<string | null>(null);
  const [versions, setVersions] = useState<SaSubagentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [testTask, setTestTask] = useState('');
  const [testContext, setTestContext] = useState('');
  const [testCallerAgentName, setTestCallerAgentName] = useState('');
  const [testTenantId, setTestTenantId] = useState('');
  const [testProfile, setTestProfile] = useState<'draft' | 'published'>('draft');
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<SaSubagentTestResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SaSubagentLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // 确认弹框
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  }>({ open: false, title: '', description: '', onConfirm: async () => {} });
  const [confirmBusy, setConfirmBusy] = useState(false);

  // 租户缓存（用于列表展示 tenant_id → 名称）
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const tenantNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tenantOptions) {
      m.set(t.tenantId, `${t.enterpriseName} / ${t.workspaceName}`);
    }
    return m;
  }, [tenantOptions]);

  // 主智能体列表（用于「绑定主智能体」多选）
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);

  // 内置工具/技能注册表（用于白名单下拉选择）
  const [registryTools, setRegistryTools] = useState<RegistryToolItem[]>([]);
  const [registrySkills, setRegistrySkills] = useState<RegistrySkillItem[]>([]);

  // 行操作 loading
  const [busyActions, setBusyActions] = useState<Set<string>>(new Set());

  const totalPages = useMemo(() => Math.max(Math.ceil(total / size), 1), [total, size]);
  const enabledCount = useMemo(() => items.filter((item) => item.status === 'enabled').length, [items]);
  const draftCount = useMemo(
    () => items.filter((item) => item.version === 0 || item.has_unpublished_changes === true).length,
    [items],
  );
  const publishedCount = useMemo(() => items.filter((item) => item.version >= 1).length, [items]);

  const sortedItems = useMemo(() => {
    const arr = [...items];
    const dirMul = sortDir === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '');
          break;
        case 'display_name':
          cmp = (a.display_name || '').localeCompare(b.display_name || '');
          break;
        case 'visibility':
          cmp = (a.visibility || '').localeCompare(b.visibility || '');
          break;
        case 'version':
          cmp = (a.version ?? 0) - (b.version ?? 0);
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
        case 'updated_at':
          cmp = (a.updated_at || '').localeCompare(b.updated_at || '');
          break;
        case 'created_at':
          cmp = (a.created_at || '').localeCompare(b.created_at || '');
          break;
      }
      return cmp * dirMul;
    });
    return arr;
  }, [items, sortBy, sortDir]);

  const handleSort = useCallback((key: SortKey, defaultDir: 'asc' | 'desc' = 'desc') => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        return prev;
      }
      setSortDir(defaultDir);
      return key;
    });
  }, []);

  const markBusy = useCallback((name: string, busy: boolean) => {
    setBusyActions(prev => {
      const next = new Set(prev);
      busy ? next.add(name) : next.delete(name);
      return next;
    });
  }, []);

  const loadList = useCallback(async (params: {
    targetPage: number;
    targetSize?: number;
    keyword?: string;
    status?: 'all' | SaSubagentStatus;
    visibility?: 'all' | SaSubagentVisibility;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await saSubagentsApi.list({
        keyword: params.keyword?.trim() || undefined,
        status: params.status && params.status !== 'all' ? params.status : undefined,
        visibility: params.visibility && params.visibility !== 'all' ? params.visibility : undefined,
        page: params.targetPage,
        size: params.targetSize ?? size,
      });
      setItems(resp.content);
      setTotal(resp.totalElements);
      setPage(resp.number);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [size]);

  const doSearch = useCallback(() => {
    void loadList({ targetPage: 0, keyword, status: statusFilter, visibility: visibilityFilter });
  }, [loadList, keyword, statusFilter, visibilityFilter]);

  const changePageSize = useCallback((nextSize: number) => {
    setSize(nextSize);
    void loadList({ targetPage: 0, targetSize: nextSize, keyword, status: statusFilter, visibility: visibilityFilter });
  }, [loadList, keyword, statusFilter, visibilityFilter]);

  useEffect(() => {
    void loadList({ targetPage: 0, keyword: '', status: 'all', visibility: 'all' });
    superAdminApi.tenants({ size: 200 })
      .then(resp => setTenantOptions(flattenTenantOptions(resp.items)))
      .catch(() => {});
    superAdminApi.agents({ size: 200 })
      .then(resp => setAgentOptions(flattenAgentOptions(resp.items)))
      .catch(() => {});
    saSubagentsApi.listRegistryTools()
      .then(setRegistryTools)
      .catch(() => {});
    saSubagentsApi.listRegistrySkills()
      .then(setRegistrySkills)
      .catch(() => {});
    // 仅首挂载触发；后续筛选/分页通过 doSearch / changePageSize / loadList 单独控制
  }, []);

  // 筛选器变化时回到第 1 页
  useEffect(() => {
    void loadList({ targetPage: 0, keyword, status: statusFilter, visibility: visibilityFilter });
  }, [statusFilter, visibilityFilter]);

  // ── 行操作 ──

  const openCreate = () => {
    setEditorMode('create');
    setDraft(EMPTY_DRAFT);
    setEditingName(null);
    setEditorOpen(true);
  };

  const openEdit = async (item: SaSubagentRegistryItem) => {
    setEditorMode('edit');
    setEditingName(item.name);
    // 立即用列表行(等价 published)的内容打开,然后再异步拉草稿替换 —— 避免空窗
    setDraft(toDraft(item));
    setEditorOpen(true);
    try {
      const detail = await saSubagentsApi.get(item.name);
      if (detail.draft) {
        setDraft(draftPayloadToFormDraft(detail.draft, item));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载草稿失败');
    }
  };

  const saveDraft = async () => {
    setEditorBusy(true);
    try {
      const payload: SaSubagentUpsertPayload = {
        ...draft,
        bound_to: draft.visibility === 'scoped' && draft.bound_to.length > 0 ? draft.bound_to : undefined,
        tenant_ids: draft.visibility === 'scoped' && draft.tenant_ids.length > 0 ? draft.tenant_ids : undefined,
      };
      const detail = editorMode === 'edit' && editingName
        ? await saSubagentsApi.update(editingName, payload)
        : await saSubagentsApi.create(payload);
      const label = detail.draft?.display_name || detail.draft?.name || detail.published?.name || draft.name;
      toast.success(editorMode === 'edit' ? `已保存草稿：${label}` : `已创建草稿：${label}（需正式发布后才会生效）`);
      setEditorOpen(false);
      await loadList({ targetPage: page, keyword, status: statusFilter, visibility: visibilityFilter });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setEditorBusy(false);
    }
  };

  const toggleStatus = async (item: SaSubagentRegistryItem) => {
    const nextStatus: SaSubagentStatus = item.status === 'enabled' ? 'disabled' : 'enabled';
    markBusy(item.name + ':status', true);
    try {
      await saSubagentsApi.setStatus(item.name, nextStatus);
      toast.success(`${item.display_name || item.name} 已${nextStatus === 'enabled' ? '启用' : '禁用'}`);
      await loadList({ targetPage: page, keyword, status: statusFilter, visibility: visibilityFilter });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '切换状态失败');
    } finally {
      markBusy(item.name + ':status', false);
    }
  };

  const removeItem = (item: SaSubagentRegistryItem) => {
    setConfirmState({
      open: true,
      title: '删除子智能体',
      description: `确定删除「${item.display_name || item.name}」？历史快照会一并清理，操作不可恢复。`,
      danger: true,
      onConfirm: async () => {
        await saSubagentsApi.remove(item.name);
        if (activeName === item.name) {
          setActiveName(null);
          setVersions([]);
          setLogs([]);
          setTestResult(null);
        }
        toast.success(`已删除：${item.display_name || item.name}`);
        await loadList({ targetPage: page, keyword, status: statusFilter, visibility: visibilityFilter });
      },
    });
  };

  // ── 发布(正式发布) ──
  const [publishState, setPublishState] = useState<{
    open: boolean;
    item: SaSubagentRegistryItem | null;
    detail: SaSubagentDetailResponse | null;
    busy: boolean;
  }>({ open: false, item: null, detail: null, busy: false });

  const openPublish = async (item: SaSubagentRegistryItem) => {
    markBusy(item.name + ':publish', true);
    try {
      let detail = await saSubagentsApi.get(item.name);
      // 兼容后端尚未升级到新契约的情况:返回的可能是扁平的 SubagentRegistryResponse
      // 我们把它包装成 SubagentDetailResponse 的形态,让弹窗能渲染。
      const looksLikeLegacy = detail
        && typeof detail === 'object'
        && !('published' in detail)
        && (detail as unknown as SaSubagentRegistryItem).id !== undefined;
      if (looksLikeLegacy) {
        console.warn('[openPublish] backend returned legacy shape (SubagentRegistryResponse), wrapping for compatibility — restart Spring Boot to pick up draft/publish endpoints.');
        const legacy = detail as unknown as SaSubagentRegistryItem;
        detail = {
          published: legacy,
          draft: null,
          // 视作未知,让用户看到弹窗
          has_unpublished_changes: true,
          last_published_at: legacy.updated_at,
          last_published_by: legacy.updated_by,
          draft_updated_at: null,
          draft_updated_by: null,
        };
      }
      if (detail.published && detail.has_unpublished_changes === false) {
        toast.info('当前草稿与已发布版本一致,无需重新发布');
        return;
      }
      setPublishState({ open: true, item, detail, busy: false });
    } catch (err) {
      console.error('[openPublish] failed to load detail', err);
      const msg = err instanceof Error ? err.message : '加载详情失败';
      toast.error(`加载详情失败:${msg}`);
    } finally {
      markBusy(item.name + ':publish', false);
    }
  };

  const submitPublish = async (payload: SaSubagentPublishPayload) => {
    if (!publishState.item) return;
    setPublishState(s => ({ ...s, busy: true }));
    try {
      const detail = await saSubagentsApi.publish(publishState.item.name, payload);
      // 兼容旧 shape:不带 published 字段时直接读 detail.version / display_name
      const ver = detail.published?.version
        ?? (detail as unknown as SaSubagentRegistryItem).version;
      const name = detail.published?.display_name
        ?? (detail as unknown as SaSubagentRegistryItem).display_name
        ?? publishState.item.name;
      toast.success(`已发布:${name} → v${ver}`);
      setPublishState({ open: false, item: null, detail: null, busy: false });
      await loadList({ targetPage: page, keyword, status: statusFilter, visibility: visibilityFilter });
    } catch (err) {
      console.error('[submitPublish] publish failed', err);
      const msg = err instanceof Error ? err.message : '发布失败';
      // 404 通常意味着后端没有重启加载 /publish 端点
      const hint = msg.includes('404') || msg.toLowerCase().includes('not found')
        ? '(后端可能没有重启,请先重启 Spring Boot 加载新接口)'
        : '';
      toast.error(`发布失败:${msg} ${hint}`);
      setPublishState(s => ({ ...s, busy: false }));
    }
  };

  const discardDraftItem = (item: SaSubagentRegistryItem) => {
    setConfirmState({
      open: true,
      title: '弃稿',
      description: `确定丢弃「${item.display_name || item.name}」当前未发布的草稿改动,把草稿重置为线上 v${item.version} 的内容?`,
      onConfirm: async () => {
        await saSubagentsApi.discardDraft(item.name);
        toast.success('已丢弃草稿改动');
        await loadList({ targetPage: page, keyword, status: statusFilter, visibility: visibilityFilter });
      },
    });
  };

  const rollbackItem = async (item: SaSubagentRegistryItem) => {
    if (item.version < 2) {
      toast.error('当前只有一个发布版本,无法回退');
      return;
    }
    markBusy(item.name + ':rollback', true);
    let restoreFromVersion: number | null = null;
    let restoreFromTime: string | null = null;
    try {
      const list = await saSubagentsApi.listVersions(item.name);
      // history desc 顺序: list[0] = 当前 published(v=N), list[1] = 上一版(v=N-1)
      const previous = list.find(v => v.version === item.version - 1)
        ?? list.find(v => v.version < item.version);
      if (!previous) {
        toast.error('找不到上一个发布版本的历史快照');
        return;
      }
      restoreFromVersion = previous.version;
      restoreFromTime = previous.created_at;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载历史版本失败');
      return;
    } finally {
      markBusy(item.name + ':rollback', false);
    }
    const restoreFromLabel = `v${restoreFromVersion}（${fmtDateTime(restoreFromTime)}）`;
    setConfirmState({
      open: true,
      title: '回退到上一个发布版本',
      description:
        `当前已发布 v${item.version} → 即将回退到 ${restoreFromLabel}。\n\n`
        + `回退后线上立即变回 v${restoreFromVersion} 的内容,版本号从 v${item.version} 直接降回 v${restoreFromVersion}(不递增)。\n`
        + `v${item.version} 的历史快照会被清理;若之后再次正式发布,会从 v${item.version} 开始重新写一份新快照。\n`
        + `你的草稿不受影响,可继续修复后重新发布。`,
      onConfirm: async () => {
        const detail = await saSubagentsApi.rollback(item.name);
        const newVer = detail.published?.version;
        toast.success(`已回退到 v${newVer}（原 v${item.version} 已清理）`);
        await loadList({ targetPage: page, keyword, status: statusFilter, visibility: visibilityFilter });
        if (activeName === item.name) {
          await refreshVersions(item.name);
        }
      },
    });
  };

  const handleConfirm = async () => {
    setConfirmBusy(true);
    try {
      await confirmState.onConfirm();
      setConfirmState(prev => ({ ...prev, open: false }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setConfirmBusy(false);
    }
  };

  // ── 详情抽屉 ──

  const refreshVersions = useCallback(async (name: string) => {
    setVersionsLoading(true);
    try {
      const list = await saSubagentsApi.listVersions(name);
      setVersions(list);
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const refreshLogs = useCallback(async (name: string) => {
    setLogsLoading(true);
    try {
      const resp = await saSubagentsApi.listLogs(name, 0, 20);
      setLogs(resp.content);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const openDrawer = (item: SaSubagentRegistryItem) => {
    setActiveName(item.name);
    setTestTask('');
    setTestContext('');
    setTestCallerAgentName('');
    setTestTenantId('');
    setTestResult(null);
    setTestError(null);
    void refreshVersions(item.name);
    void refreshLogs(item.name);
  };

  const closeDrawer = () => {
    setActiveName(null);
    setVersions([]);
    setLogs([]);
    setTestResult(null);
    setTestError(null);
  };

  const runTest = async () => {
    if (!activeName || !testTask.trim()) return;
    setTestBusy(true);
    setTestError(null);
    setTestResult(null);
    try {
      const resp = await saSubagentsApi.runTest(activeName, {
        task: testTask.trim(),
        context: testContext.trim() || undefined,
        caller_agent_name: testCallerAgentName.trim() || undefined,
        tenant_id: testTenantId.trim() || undefined,
      }, testProfile);
      setTestResult(resp);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : '在线测试失败');
    } finally {
      setTestBusy(false);
    }
  };

  // ── 渲染 ──

  return (
    <SuperAdminLayout>
      <main className="fi-superadmin-content fi-superadmin-list-page" data-testid="superadmin-subagents-page" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div data-testid="superadmin-subagents-header" style={heroPanel}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>子智能体管理</div>
            <div style={{ fontSize: 12, lineHeight: '18px', color: 'var(--text-muted)', marginTop: 4, maxWidth: 760 }}>
              管理平台子智能体的注册与配置，包括可见范围、工具继承、版本回退和在线测试。
            </div>
          </div>
          <button type="button" onClick={openCreate} style={btnPrimary}>
            新建子智能体
          </button>
        </div>

        <div data-testid="superadmin-subagents-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {[
            { label: '注册总数', value: total, hint: '当前筛选结果', accent: 'var(--text-muted)' },
            { label: '已启用', value: enabledCount, hint: '本页启用配置', accent: 'var(--success)' },
            { label: '草稿', value: draftCount, hint: '本页存在未发布改动', accent: 'var(--warning)' },
            { label: '已发布', value: publishedCount, hint: '本页至少发布过一次', accent: 'var(--info)' },
          ].map((card) => (
            <article
              key={card.label}
              style={{ ...metricCard, position: 'relative', overflow: 'hidden', paddingLeft: 19 }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: card.accent,
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: card.accent,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card.label}</span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 24,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {card.value.toLocaleString()}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>{card.hint}</div>
            </article>
          ))}
        </div>

        {/* 工具条 */}
        <div
          className="sa-filter-bar"
          data-testid="superadmin-subagents-filters"
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: 12,
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 280 }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              <circle cx={11} cy={11} r={7} />
              <line x1={21} y1={21} x2={16.65} y2={16.65} />
            </svg>
            <input
              value={keyword}
              onChange={(e) => {
                const next = e.target.value;
                setKeyword(next);
                // 清空搜索框 → 立即重置回「全部」,不需要再点搜索按钮
                if (next === '' && keyword !== '') {
                  void loadList({
                    targetPage: 0,
                    keyword: '',
                    status: statusFilter,
                    visibility: visibilityFilter,
                  });
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
              placeholder="搜索名称 / 展示名 / 描述(清空自动重置)"
              style={{
                width: '100%',
                height: 36,
                borderRadius: 8,
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                padding: '0 12px 0 34px',
                outline: 'none',
                fontSize: 13,
              }}
            />
          </div>
          <SuperAdminSelect
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="子智能体状态"
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'enabled', label: '已启用' },
              { value: 'disabled', label: '已禁用' },
            ]}
          />
          <SuperAdminSelect
            value={visibilityFilter}
            onChange={setVisibilityFilter}
            ariaLabel="子智能体可见性"
            options={[
              { value: 'all', label: '全部可见性' },
              { value: 'global', label: '全局' },
              { value: 'scoped', label: '指定范围' },
            ]}
          />
          <button
            type="button"
            onClick={doSearch}
            style={{ ...btnSecondary, height: 36 }}
          >
            搜索
          </button>
        </div>

        {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>}
        {error && <div style={errorBox}>{error}</div>}

        {/* 列表 */}
        <div
          className="sa-main-list-viewport"
          data-testid="superadmin-subagents-table"
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            background: 'var(--bg-tertiary)',
          }}
        >
          <table className="sa-table" style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 156 }} />
              <col style={{ width: 220 }} />
            </colgroup>
            <thead>
              <tr>
                {([
                  { key: 'name', title: '名称 / 描述', sortKey: 'name' as SortKey, defaultDir: 'asc' as const },
                  { key: 'display', title: '展示名', sortKey: 'display_name' as SortKey, defaultDir: 'asc' as const },
                  { key: 'vis', title: '可见性', sortKey: 'visibility' as SortKey, defaultDir: 'asc' as const },
                  { key: 'ver', title: '版本与草稿', sortKey: 'version' as SortKey, defaultDir: 'desc' as const },
                  { key: 'status', title: '状态', sortKey: 'status' as SortKey, defaultDir: 'asc' as const },
                  { key: 'updated', title: '上次编辑时间', sortKey: 'updated_at' as SortKey, defaultDir: 'desc' as const },
                  { key: 'actions', title: '操作' },
                ] as Array<{ key: string; title: string; sortKey?: SortKey; defaultDir?: 'asc' | 'desc' }>).map((col) => {
                  const isActive = col.sortKey === sortBy;
                  const isSortable = col.sortKey != null;
                  return (
                    <th key={col.key} style={{ ...thStyle, userSelect: 'none' }}>
                      {isSortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.sortKey!, col.defaultDir ?? 'desc')}
                          title={isActive
                            ? `按${col.title} ${sortDir === 'desc' ? '降序' : '升序'}，点击切换`
                            : `按${col.title}排序`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: isActive ? 'var(--text-primary)' : 'inherit',
                            fontFamily: 'inherit',
                            fontSize: 'inherit',
                            fontWeight: 'inherit',
                          }}
                        >
                          {col.title}
                          <SortIcon active={isActive} dir={sortDir} />
                        </button>
                      ) : (
                        col.title
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr
                  key={item.name}
                  style={{ background: activeName === item.name ? 'var(--hover-bg)' : undefined }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        marginTop: 4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}
                      title={item.description || ''}
                    >
                      {item.description || '—'}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.display_name || '-'}
                  </td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(item.visibility === 'global' ? 'info' : 'warning')}>
                      {item.visibility === 'global' ? '全局' : '指定范围'}
                    </span>
                    {item.visibility === 'scoped' && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                        {decodeIdList(item.tenant_ids).length > 0
                          ? decodeIdList(item.tenant_ids).slice(0, 2).map(tid => (
                              <span key={tid} style={miniTag} title={tenantNameMap.get(tid) || tid}>
                                {tenantNameMap.get(tid) || tid}
                              </span>
                            ))
                          : <span style={{ fontStyle: 'italic' }}>所有租户</span>}
                        {decodeIdList(item.tenant_ids).length > 2 && (
                          <span style={miniTag}>+{decodeIdList(item.tenant_ids).length - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, lineHeight: 1.4 }}>
                      {item.version >= 1 ? (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>生效中</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            v{item.version}
                          </span>
                        </div>
                      ) : (
                        <span style={badgeStyle('muted')}>未发布</span>
                      )}
                      {item.has_unpublished_changes === true ? (
                        <div
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, color: 'var(--warning)', fontWeight: 500,
                          }}
                          title="有未发布的草稿改动,点「正式发布」推到线上"
                        >
                          <span style={{
                            width: 6, height: 6, borderRadius: 999,
                            background: 'var(--warning)', flexShrink: 0,
                          }} />
                          草稿待发布
                        </div>
                      ) : item.has_unpublished_changes === false && item.version >= 1 ? (
                        <div
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, color: 'var(--text-muted)',
                          }}
                          title="当前草稿与已发布版本完全一致"
                        >
                          <span style={{
                            width: 6, height: 6, borderRadius: 999,
                            background: 'var(--text-muted)', opacity: 0.5, flexShrink: 0,
                          }} />
                          草稿已同步
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {item.version >= 1 ? (() => {
                      const busy = busyActions.has(item.name + ':status');
                      const isEnabled = item.status === 'enabled';
                      return (
                        <button
                          type="button"
                          onClick={() => void toggleStatus(item)}
                          disabled={busy}
                          title={busy ? '处理中…' : isEnabled ? '点击禁用' : '点击启用'}
                          style={{
                            ...badgeStyle(isEnabled ? 'success' : 'muted'),
                            fontFamily: 'inherit',
                            cursor: busy ? 'wait' : 'pointer',
                            opacity: busy ? 0.6 : 1,
                            transition: 'filter 0.12s ease, border-color 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (busy) return;
                            const btn = e.currentTarget as HTMLButtonElement;
                            btn.style.filter = 'brightness(1.05)';
                            btn.style.borderColor = isEnabled ? 'var(--success)' : 'var(--text-muted)';
                          }}
                          onMouseLeave={(e) => {
                            const btn = e.currentTarget as HTMLButtonElement;
                            btn.style.filter = 'none';
                            btn.style.borderColor = isEnabled
                              ? 'var(--success-border-soft)'
                              : 'var(--border-subtle)';
                          }}
                        >
                          {busy ? '处理中…' : isEnabled ? '已启用' : '已禁用'}
                        </button>
                      );
                    })() : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>
                    {item.version >= 1 ? fmtDateTime(item.updated_at) : '—'}
                  </td>
                  <td style={tdStyle}>
                    <RowActions
                      item={item}
                      busyActions={busyActions}
                      onEdit={() => void openEdit(item)}
                      onPublish={() => void openPublish(item)}
                      onTest={() => openDrawer(item)}
                      onToggleStatus={() => void toggleStatus(item)}
                      onRollback={() => void rollbackItem(item)}
                      onDiscardDraft={() => discardDraftItem(item)}
                      onRemove={() => removeItem(item)}
                      onViewPublished={() => setViewingName(item.name)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && items.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              暂无子智能体。点击右上角「新建子智能体」开始配置。
            </div>
          )}
        </div>

        <div
          className="sa-main-list-footer"
          data-testid="superadmin-subagents-pagination"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            margin: '0 -24px -24px',
            padding: '12px 24px',
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-subtle)',
            boxShadow: '0 -4px 12px -8px rgba(0, 0, 0, 0.18)',
            zIndex: 5,
          }}
        >
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => void loadList({ targetPage: page - 1, keyword, status: statusFilter, visibility: visibilityFilter })}
            style={{ ...btnSecondary, opacity: page <= 0 ? 0.6 : 1, cursor: page <= 0 ? 'not-allowed' : 'pointer' }}
          >
            上一页
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            第 {page + 1} / {totalPages} 页（共 {total} 项）
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => void loadList({ targetPage: page + 1, keyword, status: statusFilter, visibility: visibilityFilter })}
            style={{ ...btnSecondary, opacity: page + 1 >= totalPages ? 0.6 : 1, cursor: page + 1 >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            下一页
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>每页</span>
            <SuperAdminSelect
              value={size}
              onChange={changePageSize}
              ariaLabel="每页数量"
              size="mini"
              options={PAGE_SIZE_OPTIONS.map((value) => ({ value, label: `${value} 条` }))}
            />
          </div>
        </div>
      </main>

      {editorOpen && (
        <EditorDialog
          mode={editorMode}
          draft={draft}
          setDraft={setDraft}
          busy={editorBusy}
          tenantOptions={tenantOptions}
          agentOptions={agentOptions}
          registryTools={registryTools}
          registrySkills={registrySkills}
          onCancel={() => setEditorOpen(false)}
          onSubmit={() => void saveDraft()}
        />
      )}

      {activeName && (
        <DetailDrawer
          name={activeName}
          versions={versions}
          versionsLoading={versionsLoading}
          logs={logs}
          logsLoading={logsLoading}
          testTask={testTask}
          setTestTask={setTestTask}
          testContext={testContext}
          setTestContext={setTestContext}
          testCallerAgentName={testCallerAgentName}
          setTestCallerAgentName={setTestCallerAgentName}
          testTenantId={testTenantId}
          setTestTenantId={setTestTenantId}
          testProfile={testProfile}
          setTestProfile={setTestProfile}
          testBusy={testBusy}
          testResult={testResult}
          testError={testError}
          onRunTest={runTest}
          onClose={closeDrawer}
        />
      )}

      {confirmState.open && (
        <ConfirmDialog
          title={confirmState.title}
          description={confirmState.description}
          danger={confirmState.danger}
          busy={confirmBusy}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
        />
      )}

      {viewingName && (
        <PublishedViewerDialog
          name={viewingName}
          tenantNameMap={tenantNameMap}
          onClose={() => setViewingName(null)}
        />
      )}

      {publishState.open && publishState.item && publishState.detail && (
        <PublishDialog
          item={publishState.item}
          detail={publishState.detail}
          tenantOptions={tenantOptions}
          agentOptions={agentOptions}
          busy={publishState.busy}
          onCancel={() => setPublishState({ open: false, item: null, detail: null, busy: false })}
          onSubmit={submitPublish}
        />
      )}

      <style>{`
        @keyframes dialogPop {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </SuperAdminLayout>
  );
};

// ── 行操作:3 个常用按钮 + ⋯ 更多菜单 ──

interface RowActionsProps {
  item: SaSubagentRegistryItem;
  busyActions: Set<string>;
  onEdit: () => void;
  onPublish: () => void;
  onTest: () => void;
  onToggleStatus: () => void;
  onRollback: () => void;
  onDiscardDraft: () => void;
  onRemove: () => void;
  onViewPublished: () => void;
}

interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}

const MenuIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg
    width={15}
    height={15}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
    aria-hidden
  >
    {children}
  </svg>
);

const IconEnable = (
  <MenuIcon>
    <polyline points="20 6 9 17 4 12" />
  </MenuIcon>
);
const IconDisable = (
  <MenuIcon>
    <circle cx={12} cy={12} r={10} />
    <line x1={4.93} y1={4.93} x2={19.07} y2={19.07} />
  </MenuIcon>
);
const IconRollback = (
  <MenuIcon>
    <path d="M3 7v6h6" />
    <path d="M3 13a9 9 0 1 0 3-7" />
  </MenuIcon>
);
const IconDiscard = (
  <MenuIcon>
    <path d="M4 4l16 16" />
    <path d="M9 9v8a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1" />
    <path d="M5 6h8" />
    <path d="M10 3h4a1 1 0 0 1 1 1v2" />
  </MenuIcon>
);
const IconTrash = (
  <MenuIcon>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </MenuIcon>
);
const IconView = (
  <MenuIcon>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx={12} cy={12} r={3} />
  </MenuIcon>
);

const RowActions: React.FC<RowActionsProps> = ({
  item, busyActions,
  onEdit, onPublish, onToggleStatus, onRollback, onDiscardDraft, onRemove, onViewPublished,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const isFirstPublish = item.version < 1;
  // 注意:仅当后端**明确**返回 has_unpublished_changes=false 时才禁用按钮。
  // 字段缺失(undefined / null) → 视作「未知」,允许点击,由 openPublish 进一步判断 + 提示。
  const knownNoChanges = !isFirstPublish && item.has_unpublished_changes === false;
  const publishDisabled = busyActions.has(item.name + ':publish') || knownNoChanges;
  const publishLabel = busyActions.has(item.name + ':publish')
    ? '加载中'
    : isFirstPublish ? '首次发布' : '正式发布';
  const publishTitle = isFirstPublish
    ? '首次发布(创建 v1 并对外可见)'
    : knownNoChanges
      ? '无未发布改动'
      : '正式发布,版本号 +1';

  const menuItems: MenuItem[] = [
    {
      key: 'view-published',
      label: '查看生效配置',
      icon: IconView,
      onClick: () => { setMenuOpen(false); onViewPublished(); },
      disabled: isFirstPublish,
      title: isFirstPublish ? '尚未发布,没有生效版本' : '只读查看当前生效版本',
    },
    {
      key: 'toggle-status',
      label: busyActions.has(item.name + ':status')
        ? '处理中…'
        : item.status === 'enabled' ? '禁用' : '启用',
      icon: item.status === 'enabled' ? IconDisable : IconEnable,
      onClick: () => { setMenuOpen(false); onToggleStatus(); },
      disabled: isFirstPublish || busyActions.has(item.name + ':status'),
      title: isFirstPublish ? '请先发布' : '',
    },
    {
      key: 'rollback',
      label: busyActions.has(item.name + ':rollback') ? '加载中…' : '回退到上一版本',
      icon: IconRollback,
      onClick: () => { setMenuOpen(false); onRollback(); },
      disabled: item.version < 2 || busyActions.has(item.name + ':rollback'),
      title: item.version < 2 ? '没有可回退的历史版本' : '回退到上一次发布的版本',
    },
    {
      key: 'discard',
      label: '弃稿(恢复线上版本)',
      icon: IconDiscard,
      onClick: () => { setMenuOpen(false); onDiscardDraft(); },
      disabled: !item.has_unpublished_changes || isFirstPublish,
      title: !item.has_unpublished_changes ? '无未发布改动' : '丢弃草稿改动,重置为线上版本',
    },
    {
      key: 'remove',
      label: '删除',
      icon: IconTrash,
      onClick: () => { setMenuOpen(false); onRemove(); },
      danger: true,
    },
  ];

  return (
    <div
      ref={ref}
      style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', whiteSpace: 'nowrap', alignItems: 'center', position: 'relative' }}
    >
      <button type="button" onClick={onEdit} style={btnTiny}>编辑</button>
      <button
        type="button"
        disabled={publishDisabled}
        onClick={onPublish}
        style={{ ...btnTinyPrimary, opacity: publishDisabled ? 0.6 : 1 }}
        title={publishTitle}
      >
        {publishLabel}
      </button>
      {/* 在线测试入口暂时下线 */}
      <button
        type="button"
        onClick={() => setMenuOpen(o => !o)}
        style={{
          ...btnTiny,
          padding: '0 8px',
          background: menuOpen ? 'var(--hover-bg)' : btnTiny.background,
        }}
        title="更多操作"
        aria-label="更多操作"
      >
        ⋯
      </button>
      {menuOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 200,
            padding: 6,
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)',
            boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.22), 0 4px 10px -2px rgba(0, 0, 0, 0.08)',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {menuItems.map((it, idx) => (
            <React.Fragment key={it.key}>
              {it.danger && idx > 0 && (
                <div
                  aria-hidden
                  style={{ height: 1, background: 'var(--border-subtle)', margin: '4px -2px' }}
                />
              )}
              <button
                type="button"
                role="menuitem"
                onClick={it.onClick}
                disabled={it.disabled}
                title={it.title || ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  padding: '8px 10px',
                  border: 'none',
                  background: 'transparent',
                  color: it.danger ? 'var(--danger)' : 'var(--text-primary)',
                  fontSize: 13,
                  cursor: it.disabled ? 'not-allowed' : 'pointer',
                  opacity: it.disabled ? 0.45 : 1,
                  borderRadius: 6,
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!it.disabled) {
                    (e.currentTarget as HTMLButtonElement).style.background = it.danger
                      ? 'var(--danger-bg-soft)'
                      : 'var(--hover-bg)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    color: it.danger ? 'var(--danger)' : 'var(--text-muted)',
                  }}
                >
                  {it.icon}
                </span>
                <span style={{ flex: 1 }}>{it.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

// ── 确认弹框 ──

interface ConfirmDialogProps {
  title: string;
  description: string;
  danger?: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, description, danger, busy, onConfirm, onCancel }) => (
  <div
    data-testid="superadmin-subagents-confirm-dialog"
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
    }}
    onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
  >
    <div
      data-testid="superadmin-subagents-confirm-dialog-panel"
      style={{
        width: 'min(420px, 90vw)', background: 'var(--bg-elevated)', borderRadius: 16,
        border: '1px solid var(--border-subtle)', padding: '28px 24px 20px',
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: danger ? 'var(--danger-bg-soft)' : 'var(--warning-bg-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {danger ? '⚠' : '↩'}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{description}</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btnSecondary}>取消</button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          style={{
            ...btnPrimary,
            background: danger ? 'var(--danger)' : 'var(--btn-primary-bg)',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? '处理中...' : '确认'}
        </button>
      </div>
    </div>
  </div>
);

// ── 生效配置只读查看 ──

interface PublishedViewerDialogProps {
  name: string;
  tenantNameMap: Map<string, string>;
  onClose: () => void;
}

const PublishedViewerDialog: React.FC<PublishedViewerDialogProps> = ({ name, tenantNameMap, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SaSubagentDetailResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    saSubagentsApi.get(name)
      .then((d) => { if (!cancelled) { setDetail(d); setLoading(false); } })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [name]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const pub = detail?.published ?? null;

  return (
    <div
      data-testid="superadmin-subagents-published-viewer"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '4vh 4vw',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-testid="superadmin-subagents-published-viewer-panel"
        style={{
          width: '95vw',
          maxWidth: 760,
          maxHeight: '92vh',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.24)',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              查看生效配置
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}>{name}</span>
              {pub && <span>· v{pub.version}</span>}
              <span style={{
                padding: '1px 7px', borderRadius: 999,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
              }}>只读</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={btnSecondary}>关闭</button>
        </div>

        <div style={{ overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>加载中…</div>}
          {error && (
            <div style={{
              padding: 10, borderRadius: 8,
              background: 'var(--danger-bg-soft)', border: '1px solid var(--danger-border-soft)',
              color: 'var(--danger)', fontSize: 13,
            }}>{error}</div>
          )}
          {!loading && !error && !pub && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              该子智能体尚未正式发布,没有可查看的生效版本。
            </div>
          )}
          {pub && (
            <>
              <ViewerRow label="技术名称" value={pub.name} mono />
              <ViewerRow label="展示名" value={pub.display_name} />
              <ViewerRow label="描述" value={pub.description} multiline />
              <ViewerRow label="System Prompt" value={pub.system_prompt} multiline mono />
              <ViewerRow label="工具白名单" value={formatViewerWhitelist(pub.tools_whitelist)} />
              <ViewerRow label="技能白名单" value={formatViewerWhitelist(pub.skills_whitelist)} />
              <ViewerRow label="最大迭代次数" value={String(pub.max_iterations ?? '—')} />
              <ViewerRow label="可见性" value={pub.visibility === 'global' ? '全局' : '指定范围'} />
              {pub.visibility === 'scoped' && (
                <>
                  <ViewerRow label="绑定主智能体" value={(pub.bound_to ?? []).join(', ') || '—'} />
                  <ViewerRow
                    label="可见租户"
                    value={(pub.tenant_ids ?? [])
                      .map((tid) => tenantNameMap.get(tid) || tid)
                      .join(', ') || '—'}
                  />
                </>
              )}
              <ViewerRow label="状态" value={pub.status === 'enabled' ? '已启用' : '已禁用'} />
              <ViewerRow label="版本" value={`v${pub.version}`} />
              <ViewerRow
                label="上次发布"
                value={`${fmtDateTime(detail?.last_published_at ?? pub.updated_at)}${detail?.last_published_by ? ' · ' + detail.last_published_by : ''}`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function formatViewerWhitelist(w: SaSubagentWhitelist | null): string {
  if (w === null) return '—';
  if (w === 'inherit') return '继承主智能体配置';
  if (Array.isArray(w)) return w.length === 0 ? '空（无允许项）' : w.join(', ');
  return '—';
}

const ViewerRow: React.FC<{
  label: string;
  value: string;
  multiline?: boolean;
  mono?: boolean;
}> = ({ label, value, multiline, mono }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <div style={{
      fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
      letterSpacing: 0.4, textTransform: 'uppercase',
    }}>{label}</div>
    {multiline ? (
      <div style={{
        padding: '10px 12px', borderRadius: 8,
        border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        fontSize: mono ? 12 : 13,
        fontFamily: mono
          ? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
          : 'inherit',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 240, overflow: 'auto', lineHeight: 1.55,
      }}>
        {value || '—'}
      </div>
    ) : (
      <div style={{
        padding: '7px 10px', borderRadius: 6,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
        fontSize: 13,
        fontFamily: mono
          ? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
          : 'inherit',
        wordBreak: 'break-word',
      }}>
        {value || '—'}
      </div>
    )}
  </div>
);

// ── 详情抽屉（在线测试 / 版本历史 / 调用记录）──

interface DetailDrawerProps {
  name: string;
  versions: SaSubagentVersion[];
  versionsLoading: boolean;
  logs: SaSubagentLogItem[];
  logsLoading: boolean;
  testTask: string;
  setTestTask: (v: string) => void;
  testContext: string;
  setTestContext: (v: string) => void;
  testCallerAgentName: string;
  setTestCallerAgentName: (v: string) => void;
  testTenantId: string;
  setTestTenantId: (v: string) => void;
  testProfile: 'draft' | 'published';
  setTestProfile: (v: 'draft' | 'published') => void;
  testBusy: boolean;
  testResult: SaSubagentTestResponse | null;
  testError: string | null;
  onRunTest: () => void;
  onClose: () => void;
}

const DetailDrawer: React.FC<DetailDrawerProps> = ({
  name, versions, versionsLoading, logs, logsLoading,
  testTask, setTestTask, testContext, setTestContext,
  testCallerAgentName, setTestCallerAgentName, testTenantId, setTestTenantId,
  testProfile, setTestProfile,
  testBusy, testResult, testError,
  onRunTest, onClose,
}) => {
  const [tab, setTab] = useState<'test' | 'history'>('test');
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2.5vh 2.5vw',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '95vw',
          maxWidth: 960,
          height: '95vh',
          maxHeight: 900,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
          animation: 'dialogPop 0.18s ease-out',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-tertiary)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>在线测试 · 子智能体</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </div>
          </div>
          <button type="button" onClick={onClose} style={btnSecondary}>关闭</button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          {([
            { key: 'test', label: '在线测试' },
            { key: 'history', label: '版本与调用记录' },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${tab === t.key ? 'var(--btn-primary-bg)' : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tab === 'test' && (
            <>
              <section style={sectionBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={sectionTitle}>配置来源</div>
                  <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: 2 }}>
                    {(['draft', 'published'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTestProfile(p)}
                        style={{
                          ...segmentBtn,
                          background: testProfile === p ? 'var(--bg-elevated)' : 'transparent',
                          color: testProfile === p ? 'var(--text-primary)' : 'var(--text-muted)',
                          fontWeight: testProfile === p ? 600 : 400,
                        }}
                      >
                        {p === 'draft' ? '用草稿配置测' : '用已发布配置测'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {testProfile === 'draft'
                    ? '草稿与发布版相同时等价于「用已发布配置测」;若有差异,本期 Kernel 暂不支持 inline 草稿测试,请切到「用已发布配置测」或先发布。'
                    : '使用当前线上的发布版本配置进行测试。'}
                </div>
              </section>
              <section style={sectionBox}>
                <div style={sectionTitle}>任务</div>
                <textarea
                  value={testTask}
                  onChange={(e) => setTestTask(e.target.value)}
                  placeholder="任务（必填）"
                  rows={3}
                  style={textareaStyle}
                />
                <textarea
                  value={testContext}
                  onChange={(e) => setTestContext(e.target.value)}
                  placeholder="背景上下文（可选）"
                  rows={2}
                  style={textareaStyle}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    value={testCallerAgentName}
                    onChange={(e) => setTestCallerAgentName(e.target.value)}
                    placeholder="模拟主智能体（可选）"
                    style={inputStyle}
                  />
                  <input
                    value={testTenantId}
                    onChange={(e) => setTestTenantId(e.target.value)}
                    placeholder="模拟租户 ID（可选）"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" disabled={testBusy || !testTask.trim()} onClick={onRunTest} style={btnPrimary}>
                    {testBusy ? '执行中...' : '运行测试'}
                  </button>
                </div>
                {testError && <div style={errorBox}>{testError}</div>}
              </section>

              {testResult && (
                <section style={sectionBox}>
                  <div style={sectionTitle}>测试结果</div>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.7 }}>
                    <div>
                      <strong>状态：</strong>
                      {formatSubagentStatusLabel(testResult.success ? 'completed' : 'failed')}
                      {testResult.degraded ? ` · ${formatSubagentStatusLabel('degraded')}` : ''}
                    </div>
                    <div style={{ marginTop: 4 }}><strong>核心结论：</strong>{testResult.core_conclusion || '—'}</div>
                    <div style={{ marginTop: 4 }}><strong>执行概要：</strong>{testResult.execution_summary || '—'}</div>
                    {Array.isArray(testResult.artifacts) && testResult.artifacts.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <strong>产出文件：</strong>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {testResult.artifacts.map((a, i) => <li key={i}>{a.path}{a.size_bytes ? `（${a.size_bytes}B）` : ''}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {tab === 'history' && (
            <>
              <section style={sectionBox}>
                <div style={sectionTitle}>版本历史</div>
                {versionsLoading ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>加载中...</div>
                ) : versions.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无历史快照</div>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12 }}>
                    {versions.slice(0, 10).map((v) => (
                      <li key={v.history_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <strong>v{v.version}</strong> · {fmtDateTime(v.created_at)} · {v.created_by || '系统'}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section style={sectionBox}>
                <div style={sectionTitle}>最近调用</div>
                {logsLoading ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>加载中...</div>
                ) : logs.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无调用记录</div>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12 }}>
                    {logs.map((log) => (
                      <li key={log.task_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div>
                          {fmtDateTime(log.created_at)} · {formatSubagentStatusLabel(log.status)}
                          {log.duration_seconds != null ? ` · ${log.duration_seconds}s` : ''}
                          {log.registry_version != null ? ` · v${log.registry_version}` : ''}
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                          {formatSubagentAgentKindLabel(log.agent_kind)} · {formatSubagentScopeLabel(log.tenant_id)}
                          {log.tokens_used != null ? ` · ${formatSubagentTokenLabel(log.tokens_used)}` : ''}
                          {log.retry_count ? ` · ${formatSubagentRetryLabel(log.retry_count)}` : ''}
                        </div>
                        {log.identity_snapshot && (
                          <>
                            <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                              运行身份 {log.identity_snapshot.effective_name || log.identity_snapshot.display_name || log.identity_snapshot.ref_name || '未记录'}
                              {' · '}
                              运行时工具 {formatViewerWhitelist(log.identity_snapshot.tools_whitelist ?? [])}
                              {' · '}
                              运行时技能 {formatViewerWhitelist(log.identity_snapshot.skills_whitelist ?? [])}
                            </div>
                            {log.identity_snapshot.system_prompt && (
                              <details style={{ marginTop: 4 }}>
                                <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>
                                  运行时提示词快照
                                </summary>
                                <pre
                                  style={{
                                    margin: '6px 0 0',
                                    maxHeight: 180,
                                    overflow: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    padding: 10,
                                    borderRadius: 6,
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    fontSize: 11,
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {log.identity_snapshot.system_prompt}
                                </pre>
                              </details>
                            )}
                          </>
                        )}
                        {log.result_summary && <div style={{ marginTop: 4, color: 'var(--text-primary)' }}>{log.result_summary}</div>}
                        {log.error_snapshot?.message && (
                          <div style={{ marginTop: 4, color: 'var(--danger)' }}>
                            {log.error_snapshot.type ? `${log.error_snapshot.type} · ` : ''}
                            {log.error_snapshot.message}
                          </div>
                        )}
                        {log.error_snapshot?.user_facing_message && log.error_snapshot.user_facing_message !== log.error_snapshot.message && (
                          <div style={{ marginTop: 2, color: 'var(--text-muted)' }}>
                            对用户提示：{log.error_snapshot.user_facing_message}
                          </div>
                        )}
                        {log.retry_reason && <div style={{ marginTop: 2, color: 'var(--danger)' }}>{log.retry_reason}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── 白名单通用选项类型 ──

interface WhitelistOption {
  name: string;
  label: string;
  description: string;
  group: string;
}

// ── 工具/技能分类中文映射 ──

const CATEGORY_LABELS: Record<string, string> = {
  file: '文件操作',
  search: '搜索查询',
  terminal: '终端命令',
  task: '任务规划',
  memory: '记忆管理',
  browser: '浏览器',
  code: '代码执行',
  computer: '桌面控制',
  market_insight: '市场洞察',
  other: '其他工具',
  基本工具: '基本工具',
  通用技能: '通用技能',
  专用技能: '专用技能',
};

function getCategoryLabel(group: string): string {
  return CATEGORY_LABELS[group] || group;
}

// ── 白名单字段（inherit 切换 + 搜索多选下拉）──

interface WhitelistFieldProps {
  value: SaSubagentWhitelist;
  onChange: (v: SaSubagentWhitelist) => void;
  options: WhitelistOption[];
  placeholder?: string;
}

const WhitelistField: React.FC<WhitelistFieldProps> = ({ value, onChange, options, placeholder }) => {
  const isInherit = value === 'inherit';
  const selected = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o =>
      o.name.toLowerCase().includes(q)
      || o.label.toLowerCase().includes(q)
      || o.description.toLowerCase().includes(q)
    );
  }, [options, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, WhitelistOption[]>();
    for (const item of filtered) {
      const g = item.group || 'other';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(item);
    }
    return groups;
  }, [filtered]);

  const toggle = (name: string) => {
    onChange(
      selectedSet.has(name)
        ? selected.filter(x => x !== name)
        : [...selected, name]
    );
  };

  const removeItem = (name: string) => {
    onChange(selected.filter(x => x !== name));
  };

  const optionNameMap = useMemo(() => {
    const m = new Map<string, WhitelistOption>();
    for (const o of options) m.set(o.name, o);
    return m;
  }, [options]);

  return (
    // stopPropagation 阻止 <label>(Field 容器) 把点击转发给第一个 labelable 后代
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', padding: 2, width: 'fit-content' }}>
        <button
          type="button"
          onClick={() => onChange('inherit')}
          style={{
            ...segmentBtn,
            background: isInherit ? 'var(--bg-elevated)' : 'transparent',
            color: isInherit ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: isInherit ? 600 : 400,
          }}
        >
          继承主智能体
        </button>
        <button
          type="button"
          onClick={() => { if (isInherit) onChange([]); }}
          style={{
            ...segmentBtn,
            background: !isInherit ? 'var(--bg-elevated)' : 'transparent',
            color: !isInherit ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: !isInherit ? 600 : 400,
          }}
        >
          自定义白名单
        </button>
      </div>
      {isInherit ? (
        <div style={{
          fontSize: 12, color: 'var(--text-muted)',
          padding: '8px 10px', background: 'var(--bg-secondary)',
          borderRadius: 8, border: '1px dashed var(--border-subtle)',
        }}>
          跟随主智能体的工具/技能配置，无需单独维护
        </div>
      ) : (
        <div>
          {/* 已选标签 + 展开/收起按钮 */}
          <div
            style={{
              ...inputStyle,
              height: 'auto',
              minHeight: 38,
              maxHeight: open ? undefined : 96,
              overflowY: open ? undefined : 'auto',
              padding: '6px 8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              alignItems: 'center',
              borderBottomLeftRadius: open ? 0 : 8,
              borderBottomRightRadius: open ? 0 : 8,
              borderBottom: open ? 'none' : undefined,
            }}
          >
            {selected.length === 0 && !open && (
              <span
                onClick={() => setOpen(true)}
                style={{ color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', flex: 1 }}
              >
                点击选择...
              </span>
            )}
            {selected.map(name => {
              const opt = optionNameMap.get(name);
              return (
                <span key={name} style={selectedTag} title={opt ? `${opt.label}: ${opt.description}` : name}>
                  {opt ? opt.label : name}
                  <span
                    onClick={() => removeItem(name)}
                    style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.6 }}
                  >
                    ×
                  </span>
                </span>
              );
            })}
            <button
              type="button"
              onClick={() => { setOpen(!open); setSearch(''); }}
              style={{
                marginLeft: 'auto', flexShrink: 0,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--btn-primary-bg)', fontWeight: 500,
                padding: '2px 4px',
              }}
            >
              {open ? '收起' : `选择${selected.length > 0 ? `（已选 ${selected.length}）` : ''}`}
            </button>
          </div>

          {/* 内联展开面板 */}
          {open && (
            <div style={{
              border: '1px solid var(--input-border)',
              borderTop: '1px dashed var(--border-subtle)',
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              background: 'var(--bg-elevated)',
              padding: 8,
            }}>
              {/* 搜索 */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder || '搜索名称或描述...'}
                autoFocus
                style={{ ...inputStyle, width: '100%', marginBottom: 6 }}
              />

              {/* 统计 */}
              <div style={{
                fontSize: 11, color: 'var(--text-muted)',
                padding: '2px 4px 6px',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>
                  共 {options.length} 项
                  {search.trim() ? `，匹配 ${filtered.length} 项` : ''}
                </span>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, color: 'var(--danger)', padding: 0,
                    }}
                  >
                    清空已选 {selected.length} 项
                  </button>
                )}
              </div>

              {/* 分组列表 */}
              <div style={{ maxHeight: 280, overflow: 'auto', borderRadius: 6 }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    无匹配结果
                  </div>
                ) : (
                  Array.from(grouped.entries()).map(([group, items]) => (
                    <div key={group}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        padding: '8px 4px 4px', position: 'sticky', top: 0,
                        background: 'var(--bg-elevated)', zIndex: 1,
                      }}>
                        {getCategoryLabel(group)}
                        <span style={{ fontWeight: 400, marginLeft: 4 }}>({items.length})</span>
                      </div>
                      {items.map(opt => {
                        const checked = selectedSet.has(opt.name);
                        return (
                          <label
                            key={opt.name}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 8,
                              padding: '5px 4px', borderRadius: 6, cursor: 'pointer',
                              fontSize: 12,
                              background: checked ? 'var(--hover-bg)' : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(opt.name)}
                              style={{ accentColor: 'var(--btn-primary-bg)', marginTop: 2, flexShrink: 0 }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontWeight: 500, color: 'var(--text-primary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {opt.label}
                                {opt.label !== opt.name && (
                                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4, fontSize: 11 }}>
                                    {opt.name}
                                  </span>
                                )}
                              </div>
                              {opt.description && (
                                <div style={{
                                  fontSize: 11, color: 'var(--text-muted)', marginTop: 1,
                                  lineHeight: 1.4,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {opt.description}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── 租户多选器 ──

interface TenantMultiSelectProps {
  options: TenantOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

const TenantMultiSelect: React.FC<TenantMultiSelectProps> = ({ options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o =>
      o.workspaceName.toLowerCase().includes(q)
      || o.enterpriseName.toLowerCase().includes(q)
      || o.tenantId.toLowerCase().includes(q)
    );
  }, [options, search]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const selectedNames = selected.map(id => {
    const opt = options.find(o => o.tenantId === id);
    return opt ? `${opt.enterpriseName} / ${opt.workspaceName}` : id;
  });

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          ...inputStyle,
          height: 'auto',
          minHeight: 38,
          padding: '6px 8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        {selectedNames.length === 0 ? (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>点击选择租户工作区...</span>
        ) : (
          selectedNames.map((name, i) => (
            <span key={selected[i]} style={selectedTag}>
              {name}
              <span
                onClick={(e) => { e.stopPropagation(); toggle(selected[i]); }}
                style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.6 }}
              >
                ×
              </span>
            </span>
          ))
        )}
      </div>
      {open && (
        <div style={dropdownPanel}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索租户..."
            autoFocus
            style={{ ...inputStyle, width: '100%', marginBottom: 6 }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 8, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                无匹配结果
              </div>
            ) : (
              filtered.map(opt => {
                const checked = selected.includes(opt.tenantId);
                return (
                  <label
                    key={opt.tenantId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
                      borderRadius: 6, cursor: 'pointer', fontSize: 12,
                      background: checked ? 'var(--hover-bg)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.tenantId)}
                      style={{ accentColor: 'var(--btn-primary-bg)' }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {opt.enterpriseName} / {opt.workspaceName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {opt.tenantId}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>已选 {selected.length} 个</span>
              <button type="button" onClick={() => onChange([])} style={{ ...btnTiny, fontSize: 11 }}>清空</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── 主智能体多选器 ──

interface AgentMultiSelectProps {
  options: AgentOption[];
  selected: string[];
  onChange: (names: string[]) => void;
}

const AgentMultiSelect: React.FC<AgentMultiSelectProps> = ({ options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o =>
      o.name.toLowerCase().includes(q)
      || o.workspaceName.toLowerCase().includes(q)
      || (o.enterpriseName || '').toLowerCase().includes(q)
    );
  }, [options, search]);

  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter(x => x !== name) : [...selected, name]);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          ...inputStyle, height: 'auto', minHeight: 38,
          padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 4,
          alignItems: 'center', cursor: 'pointer',
        }}
      >
        {selected.length === 0 ? (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>留空表示绑定所有主智能体</span>
        ) : (
          selected.map(name => {
            const opt = options.find(o => o.name === name);
            return (
              <span key={name} style={selectedTag} title={opt ? `${opt.enterpriseName} / ${opt.workspaceName}` : name}>
                {name}
                <span
                  onClick={(e) => { e.stopPropagation(); toggle(name); }}
                  style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.6 }}
                >
                  ×
                </span>
              </span>
            );
          })
        )}
      </div>
      {open && (
        <div style={dropdownPanel}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索主智能体..."
            autoFocus
            style={{ ...inputStyle, width: '100%', marginBottom: 6 }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 8, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                无匹配结果
              </div>
            ) : (
              filtered.map(opt => {
                const checked = selected.includes(opt.name);
                return (
                  <label
                    key={opt.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
                      borderRadius: 6, cursor: 'pointer', fontSize: 12,
                      background: checked ? 'var(--hover-bg)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.name)}
                      style={{ accentColor: 'var(--btn-primary-bg)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{opt.name}</div>
                      {(opt.enterpriseName || opt.workspaceName) && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {[opt.enterpriseName, opt.workspaceName].filter(Boolean).join(' / ')}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>已选 {selected.length} 个</span>
              <button type="button" onClick={() => onChange([])} style={{ ...btnTiny, fontSize: 11 }}>清空</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── 编辑对话框（双栏大尺寸：左 40% 配置 + 右 60% 系统提示词）──

interface EditorDialogProps {
  mode: 'create' | 'edit';
  draft: SubAgentDraft;
  setDraft: React.Dispatch<React.SetStateAction<SubAgentDraft>>;
  busy: boolean;
  tenantOptions: TenantOption[];
  agentOptions: AgentOption[];
  registryTools: RegistryToolItem[];
  registrySkills: RegistrySkillItem[];
  onCancel: () => void;
  onSubmit: () => void;
}

const EditorDialog: React.FC<EditorDialogProps> = ({
  mode, draft, setDraft, busy, tenantOptions, agentOptions,
  registryTools, registrySkills, onCancel, onSubmit,
}) => {
  const toolOptions = useMemo<WhitelistOption[]>(() =>
    registryTools.map(t => ({
      name: t.name,
      label: t.display_name || t.name,
      description: t.description,
      group: t.category || '基本工具',
    })),
  [registryTools]);

  const skillOptions = useMemo<WhitelistOption[]>(() =>
    registrySkills.map(s => ({
      name: s.id || s.name,
      label: s.name,
      description: s.description,
      group: s.kind === 'dedicated' ? '专用技能' : '通用技能',
    })),
  [registrySkills]);
  return (
    <div
      data-testid="superadmin-subagents-editor-dialog"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        padding: '2.5vh 2.5vw',
      }}
    >
      <div
        data-testid="superadmin-subagents-editor-dialog-panel"
        style={{
          width: '95vw',
          height: '95vh',
          maxWidth: 1480,
          background: 'var(--bg-elevated)',
          borderRadius: 14,
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-tertiary)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {mode === 'create' ? '新建' : '编辑'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {mode === 'create' ? '新建子智能体' : `${draft.name}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={onCancel} disabled={busy} style={btnSecondary}>取消</button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy}
              style={btnPrimary}
              title="只保存草稿,不会立即生效;线上仍是已发布版本。点列表行的「正式发布」按钮才会真正发布。"
            >
              {busy ? '保存中...' : '保存草稿'}
            </button>
          </div>
        </div>

        {/* 双栏 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 40%) 1fr', flex: 1, minHeight: 0 }}>
          {/* 左栏：基础信息 + 配置 */}
          <div
            style={{
              padding: 20,
              overflow: 'auto',
              borderRight: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <SectionLabel>基础信息</SectionLabel>
            <Field label={`名称（小写英文+短横线，最多 ${NAME_MAX} 字符）`} counter={`${draft.name.length} / ${NAME_MAX}`}>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                style={inputStyle}
                placeholder="deep-researcher"
                maxLength={NAME_MAX}
              />
              {mode === 'edit' && (
                <span style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4, lineHeight: 1.5 }}>
                  修改名称会影响通过旧名引用此子智能体的调用方与正在执行中的任务；历史版本与旧调用记录保留旧名作为审计轨迹。
                </span>
              )}
            </Field>
            <Field label={`展示名称（最多 ${DISPLAY_NAME_MAX} 字符）`} counter={`${draft.display_name.length} / ${DISPLAY_NAME_MAX}`}>
              <input
                value={draft.display_name}
                onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
                style={inputStyle}
                placeholder="深度研究专家"
                maxLength={DISPLAY_NAME_MAX}
              />
            </Field>
            <Field
              label={`描述（给 LLM 看，用于匹配场景，最多 ${DESCRIPTION_MAX} 字符）`}
              counter={`${draft.description.length} / ${DESCRIPTION_MAX}`}
            >
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                rows={8}
                style={{ ...textareaStyle, minHeight: 160, resize: 'vertical' }}
                placeholder="擅长深度调研与材料梳理；支持多段说明，写清楚适用场景、输入输出预期、触发词等"
                maxLength={DESCRIPTION_MAX}
              />
            </Field>

            <SectionLabel>运行配置</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="最大迭代次数（1-60）">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={draft.max_iterations}
                  onChange={(e) => setDraft((d) => ({ ...d, max_iterations: Number(e.target.value) || 1 }))}
                  style={inputStyle}
                />
              </Field>
              <Field label="状态">
                <SuperAdminSelect
                  value={draft.status || 'enabled'}
                  onChange={(status) => setDraft((d) => ({ ...d, status }))}
                  ariaLabel="子智能体状态"
                  style={{ width: '100%' }}
                  options={[
                    { value: 'enabled', label: '启用' },
                    { value: 'disabled', label: '禁用' },
                  ]}
                />
              </Field>
            </div>
            <Field label="工具白名单">
              <WhitelistField
                value={draft.tools_whitelist}
                onChange={(v) => setDraft((d) => ({ ...d, tools_whitelist: v }))}
                options={toolOptions}
                placeholder="搜索工具名称或描述..."
              />
            </Field>
            <Field label="技能白名单">
              <WhitelistField
                value={draft.skills_whitelist}
                onChange={(v) => setDraft((d) => ({ ...d, skills_whitelist: v }))}
                options={skillOptions}
                placeholder="搜索技能名称或描述..."
              />
            </Field>

            <SectionLabel>可见范围</SectionLabel>
            <Field label="可见范围">
              <SuperAdminSelect
                value={draft.visibility}
                onChange={(visibility) => setDraft((d) => ({ ...d, visibility }))}
                ariaLabel="子智能体可见范围"
                style={{ width: '100%' }}
                options={[
                  { value: 'global', label: '全局（所有租户与主智能体可用）' },
                  { value: 'scoped', label: '指定范围（仅指定租户/主智能体可用）' },
                ]}
              />
            </Field>
            {draft.visibility === 'scoped' && (
              <>
                <Field label="绑定租户工作区（多选）">
                  <TenantMultiSelect
                    options={tenantOptions}
                    selected={draft.tenant_ids}
                    onChange={(ids) => setDraft((d) => ({ ...d, tenant_ids: ids }))}
                  />
                </Field>
                <Field label="绑定主智能体（多选，留空表示所有）">
                  <AgentMultiSelect
                    options={agentOptions}
                    selected={draft.bound_to}
                    onChange={(names) => setDraft((d) => ({ ...d, bound_to: names }))}
                  />
                </Field>
              </>
            )}
          </div>

          {/* 右栏：系统提示词大编辑器 */}
          <div
            style={{
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
              gap: 8,
              background: 'var(--bg-tertiary)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <SectionLabel>系统提示词</SectionLabel>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  支持 Markdown · 注入到 LLM 系统消息 · 最多 {SYSTEM_PROMPT_MAX.toLocaleString()} 字符
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: draft.system_prompt.length >= SYSTEM_PROMPT_MAX
                    ? 'var(--danger)'
                    : draft.system_prompt.length > SYSTEM_PROMPT_MAX * 0.9
                      ? 'var(--warning)'
                      : 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {draft.system_prompt.length.toLocaleString()} / {SYSTEM_PROMPT_MAX.toLocaleString()}
              </div>
            </div>
            <textarea
              value={draft.system_prompt}
              onChange={(e) => setDraft((d) => ({ ...d, system_prompt: e.target.value }))}
              placeholder={'例如：\n你是一位深度研究专家。\n\n## 工作方式\n- ...'}
              maxLength={SYSTEM_PROMPT_MAX}
              style={{
                ...textareaStyle,
                flex: 1,
                minHeight: 0,
                resize: 'none',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 13,
                lineHeight: 1.7,
                padding: 14,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; counter?: string; children: React.ReactNode }> = ({ label, counter, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span>{label}</span>
      {counter && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {counter}
        </span>
      )}
    </span>
    {children}
  </label>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}
  >
    {children}
  </div>
);

// ── 发布确认弹窗 ──

interface PublishDialogProps {
  item: SaSubagentRegistryItem;
  detail: SaSubagentDetailResponse;
  tenantOptions: TenantOption[];
  agentOptions: AgentOption[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (payload: SaSubagentPublishPayload) => Promise<void> | void;
}

interface DiffEntry {
  label: string;
  before: string;
  after: string;
}

function summarizeWhitelist(value: SaSubagentWhitelist | string[] | string | null | undefined): string {
  const decoded = decodeWhitelist(value);
  if (decoded === 'inherit') return '继承主智能体';
  if (decoded.length === 0) return '空';
  return `${decoded.length} 项`;
}

function summarizeIdList(value: string[] | null | undefined): string {
  const list = decodeIdList(value);
  return list.length === 0 ? '空' : `${list.length} 项`;
}

function computeDiff(
  published: SaSubagentRegistryItem | null,
  draft: SaSubagentDraftPayload | null | undefined,
): DiffEntry[] {
  const out: DiffEntry[] = [];
  if (!draft) return out;
  const pairs: Array<[string, string | number | null | undefined, string | number | null | undefined]> = [
    ['名称', published?.name, draft.name],
    ['展示名', published?.display_name, draft.display_name],
    ['描述', published?.description, draft.description],
    [
      '系统提示词字符数',
      published?.system_prompt?.length ?? 0,
      (draft.system_prompt ?? '').length,
    ],
    ['最大迭代', published?.max_iterations, draft.max_iterations],
    ['可见性', published?.visibility, draft.visibility],
    ['绑定主智能体', summarizeIdList(published?.bound_to), summarizeIdList(draft.bound_to)],
    ['绑定租户', summarizeIdList(published?.tenant_ids), summarizeIdList(draft.tenant_ids)],
    ['状态', published?.status, draft.status],
    ['工具白名单', summarizeWhitelist(published?.tools_whitelist), summarizeWhitelist(draft.tools_whitelist)],
    ['技能白名单', summarizeWhitelist(published?.skills_whitelist), summarizeWhitelist(draft.skills_whitelist)],
  ];
  for (const [label, b, a] of pairs) {
    const before = b === undefined || b === null ? '—' : String(b);
    const after = a === undefined || a === null ? '—' : String(a);
    if (before !== after) {
      out.push({ label, before, after });
    }
  }
  return out;
}

const PublishDialog: React.FC<PublishDialogProps> = ({
  item, detail, tenantOptions, agentOptions, busy, onCancel, onSubmit,
}) => {
  const isFirstPublish = !detail.published;
  const currentVersion = item.version;
  const newVersion = currentVersion < 1 ? 1 : currentVersion + 1;
  const draft = detail.draft;

  // 范围覆盖(预填草稿值,默认不回写草稿)
  const [visibility, setVisibility] = useState<SaSubagentVisibility>(
    draft?.visibility ?? item.visibility ?? 'global');
  const [tenantIds, setTenantIds] = useState<string[]>(
    decodeIdList(draft?.tenant_ids ?? item.tenant_ids));
  const [boundTo, setBoundTo] = useState<string[]>(
    decodeIdList(draft?.bound_to ?? item.bound_to));
  const [statusAfter, setStatusAfter] = useState<SaSubagentStatus>(
    draft?.status ?? item.status ?? 'enabled');
  const [syncToDraft, setSyncToDraft] = useState(false);

  const diff = useMemo(() => computeDiff(detail.published, draft), [detail.published, draft]);

  const submit = () => {
    const payload: SaSubagentPublishPayload = {
      visibility,
      bound_to: visibility === 'scoped' && boundTo.length > 0 ? boundTo : undefined,
      tenant_ids: visibility === 'scoped' && tenantIds.length > 0 ? tenantIds : undefined,
      status: statusAfter,
      sync_to_draft: syncToDraft,
    };
    void onSubmit(payload);
  };

  return (
    <div
      data-testid="superadmin-subagents-publish-dialog"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150,
        padding: '2.5vh 2.5vw',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div
        data-testid="superadmin-subagents-publish-dialog-panel"
        style={{
          width: 'min(720px, 95vw)',
          maxHeight: '90vh',
          background: 'var(--bg-elevated)',
          borderRadius: 14,
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-tertiary)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {isFirstPublish ? '首次发布' : '正式发布'} · {item.display_name || item.name}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
            {isFirstPublish
              ? `首次发布到 v${newVersion}`
              : `当前 v${currentVersion} → 即将发布 v${newVersion}`}
          </div>
        </div>

        <div style={{ overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isFirstPublish && (
            <section style={sectionBox}>
              <div style={sectionTitle}>本次变更</div>
              {diff.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>无业务字段差异</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }}>
                  {diff.map((d) => (
                    <li key={d.label}>
                      <strong>{d.label}:</strong>{' '}
                      <span style={{ color: 'var(--text-muted)' }}>{d.before}</span>
                      {' → '}
                      <span style={{ color: 'var(--text-primary)' }}>{d.after}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section style={sectionBox}>
            <div style={sectionTitle}>发布范围(本次可临时调整)</div>
            <Field label="可见性">
              <SuperAdminSelect
                value={visibility}
                onChange={setVisibility}
                ariaLabel="发布可见性"
                style={{ width: '100%' }}
                options={[
                  { value: 'global', label: '全局（所有租户与主智能体可用）' },
                  { value: 'scoped', label: '指定范围（仅指定租户/主智能体可用）' },
                ]}
              />
            </Field>
            {visibility === 'scoped' && (
              <>
                <Field label="绑定租户工作区">
                  <TenantMultiSelect
                    options={tenantOptions}
                    selected={tenantIds}
                    onChange={setTenantIds}
                  />
                </Field>
                <Field label="绑定主智能体(留空 = 所有)">
                  <AgentMultiSelect
                    options={agentOptions}
                    selected={boundTo}
                    onChange={setBoundTo}
                  />
                </Field>
              </>
            )}
            <Field label="发布后状态">
              <SuperAdminSelect
                value={statusAfter}
                onChange={setStatusAfter}
                ariaLabel="发布后状态"
                style={{ width: '100%' }}
                options={[
                  { value: 'enabled', label: '立即启用' },
                  { value: 'disabled', label: '保持禁用' },
                ]}
              />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={syncToDraft}
                onChange={(e) => setSyncToDraft(e.target.checked)}
                style={{ accentColor: 'var(--btn-primary-bg)' }}
              />
              同时把本次调整同步到草稿(默认不勾,本次调整仅作用于本次发布)
            </label>
          </section>
        </div>

        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center',
          background: 'var(--bg-tertiary)',
        }}>
          <button type="button" onClick={onCancel} disabled={busy} style={btnSecondary}>取消</button>
          <button type="button" onClick={submit} disabled={busy} style={btnPrimary}>
            {busy ? '发布中...' : `确认发布 v${newVersion}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── styles ──

const heroPanel: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  padding: 18,
  borderRadius: 12,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
};

const metricCard: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 10,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
};

const inputStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
  fontSize: 13,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: 10,
  outline: 'none',
  fontSize: 13,
  resize: 'vertical',
  lineHeight: 1.6,
};

const btnPrimary: React.CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  fontSize: 13,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  fontSize: 13,
  cursor: 'pointer',
};

const btnTiny: React.CSSProperties = {
  height: 26,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: 12,
  cursor: 'pointer',
};

const btnTinyPrimary: React.CSSProperties = {
  ...btnTiny,
  borderColor: 'var(--info-border-soft)',
  background: 'var(--info-bg-soft)',
  color: 'var(--info)',
  fontWeight: 600,
};

const segmentBtn: React.CSSProperties = {
  height: 26,
  padding: '0 10px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-subtle)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'top',
};

const sectionBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  background: 'var(--bg-secondary)',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const errorBox: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--danger-border-soft)',
  background: 'var(--danger-bg-soft)',
  color: 'var(--danger)',
  fontSize: 13,
};

const miniTag: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  borderRadius: 4,
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-subtle)',
  fontSize: 10,
  marginRight: 3,
  marginBottom: 2,
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  verticalAlign: 'bottom',
};

const selectedTag: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 6px',
  borderRadius: 6,
  background: 'var(--info-bg-soft)',
  border: '1px solid var(--info-border-soft)',
  color: 'var(--info)',
  fontSize: 11,
  fontWeight: 500,
};

const dropdownPanel: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 4,
  padding: 8,
  borderRadius: 10,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-elevated)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  zIndex: 10,
};

const SortIcon: React.FC<{ active: boolean; dir: 'asc' | 'desc' }> = ({ active, dir }) => {
  const upActive = active && dir === 'asc';
  const downActive = active && dir === 'desc';
  return (
    <svg width={9} height={12} viewBox="0 0 9 12" style={{ flexShrink: 0 }} aria-hidden>
      <path
        d="M4.5 1 L7.5 4.5 L1.5 4.5 Z"
        fill={upActive ? 'var(--text-primary)' : 'var(--text-muted)'}
        opacity={upActive ? 1 : active ? 0.25 : 0.45}
      />
      <path
        d="M4.5 11 L1.5 7.5 L7.5 7.5 Z"
        fill={downActive ? 'var(--text-primary)' : 'var(--text-muted)'}
        opacity={downActive ? 1 : active ? 0.25 : 0.45}
      />
    </svg>
  );
};

function badgeStyle(kind: 'info' | 'warning' | 'success' | 'muted'): React.CSSProperties {
  const map: Record<typeof kind, { bg: string; fg: string; border: string }> = {
    info:    { bg: 'var(--info-bg-soft)',    fg: 'var(--info)',    border: 'var(--info-border-soft)' },
    warning: { bg: 'var(--warning-bg-soft)', fg: 'var(--warning)', border: 'var(--warning-border-soft)' },
    success: { bg: 'var(--success-bg-soft)', fg: 'var(--success)', border: 'var(--success-border-soft)' },
    muted:   { bg: 'var(--bg-tertiary)',     fg: 'var(--text-muted)', border: 'var(--border-subtle)' },
  };
  const c = map[kind];
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    border: `1px solid ${c.border}`,
    background: c.bg,
    color: c.fg,
    fontSize: 11,
    fontWeight: 600,
  };
}

export default SuperAdminSubAgentsPage;
