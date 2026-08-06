import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Copy, Download, Info, KeyRound, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { SuperAdminSelect } from './SuperAdminSelect';
import { platformApiPath } from '../../api/gateway';
import { FineDesignTooltip } from '../../components/common/FineDesignTooltip';
import {
  superAdminApi,
  type SaAgentItem,
  type SaMcpAvailableToolItem,
  type SaMcpBindingItem,
  type SaMcpCallLogDetailResponse,
  type SaMcpCallLogItem,
  type SaMcpClientDetailResponse,
  type SaMcpClientItem,
  type SaMcpSecretItem,
  type SaMcpToolPackageItem,
  type SaTenantItem,
} from '../../api/superadmin';
import { fetchMedia } from '../../lib/media';

type ClientStatusFilter = 'all' | 'ACTIVE' | 'DISABLED';
type ManageTab = 'tokens' | 'tools' | 'agents' | 'logs';
type AuditPayloadTab = 'request' | 'response';

type ClientDraft = {
  name: string;
  tenantId: string;
  description: string;
};

type DataPackageSection = {
  key: string;
  title: string;
  description: string;
  packageKeys: string[];
};

type TenantOption = {
  tenantId: string;
  workspaceName: string;
  enterpriseName: string;
  tenantStatus: 'active' | 'frozen';
  planType: 'trial' | 'official';
  planStatus: 'active' | 'exhausted' | 'expired';
};

const PAGE_SIZE = 20;
const CALL_LOG_PAGE_SIZE = 10;
const AUDIT_PAYLOAD_TABS: Array<{ key: AuditPayloadTab; label: string }> = [
  { key: 'request', label: '请求参数' },
  { key: 'response', label: '响应结果' },
];

const DATA_PACKAGE_SECTIONS: DataPackageSection[] = [
  {
    key: 'common',
    title: '常用数据能力',
    description: 'FDE 高频使用的企业检索、画像、动态和舆情能力。',
    packageKeys: ['enterprise_core', 'public_opinion'],
  },
  {
    key: 'company_extra',
    title: '企业补充能力',
    description: '围绕单个企业做关系、风险、资产和经营信息补充。',
    packageKeys: ['enterprise_relation', 'enterprise_risk', 'enterprise_ip', 'enterprise_finance'],
  },
  {
    key: 'policy_industry',
    title: '政策、产业与园区',
    description: '面向政企服务、招商、产业链和园区分析场景。',
    packageKeys: ['policy_project', 'industry_chain', 'park_insight'],
  },
  {
    key: 'restricted',
    title: '敏感或受限能力',
    description: '涉及付费、合规或高敏感数据，按客户合同单独开放。',
    packageKeys: ['judicial_risk', 'company_contact'],
  },
];

// navigator.clipboard 仅在安全上下文可用，正式环境走 HTTP 或权限受限时需要降级。
async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 继续走 textarea 降级方案。
    }
  }
  if (typeof document === 'undefined') {
    throw new Error('clipboard unavailable');
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = typeof document.execCommand === 'function' && document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error('copy failed');
  }
}

function toDateTime(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function toStatusLabel(status: string): string {
  return status === 'ACTIVE' ? '启用' : '停用';
}

function toCallLogStatusLabel(status: SaMcpCallLogItem['status']): string {
  if (status === 'SUCCEEDED') {
    return '成功';
  }
  if (status === 'ACCEPTED') {
    return '已受理';
  }
  if (status === 'FAILED') {
    return '失败';
  }
  return '执行中';
}

function toCallLogStatusTone(status: SaMcpCallLogItem['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'SUCCEEDED') {
    return 'success';
  }
  if (status === 'ACCEPTED' || status === 'STARTED') {
    return 'warning';
  }
  return 'danger';
}

function formatDuration(value?: number | null): string {
  if (value === undefined || value === null) {
    return '-';
  }
  if (value < 1000) {
    return `${value} ms`;
  }
  return `${(value / 1000).toFixed(2)} s`;
}

function prettyJson(value?: string | null): string {
  if (!value) {
    return '-';
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function defaultDraft(): ClientDraft {
  return {
    name: '',
    tenantId: '',
    description: '',
  };
}

function flattenTenantOptions(items: SaTenantItem[]): TenantOption[] {
  return items.flatMap((enterprise) => (
    enterprise.workspaces.map((workspace) => ({
      tenantId: workspace.tenantId,
      workspaceName: workspace.workspaceName,
      enterpriseName: enterprise.enterpriseName,
      tenantStatus: workspace.tenantStatus,
      planType: workspace.planType,
      planStatus: workspace.planStatus,
    }))
  ));
}

function toTenantStatusLabel(status: TenantOption['tenantStatus']): string {
  return status === 'active' ? '正常' : '冻结';
}

function toPlanLabel(option: TenantOption): string {
  const planType = option.planType === 'official' ? '正式版' : '试用版';
  const planStatus = option.planStatus === 'active'
    ? '有效'
    : option.planStatus === 'exhausted'
      ? '额度耗尽'
      : '已过期';
  return `${planType} / ${planStatus}`;
}

function toRiskLevelLabel(riskLevel: SaMcpToolPackageItem['riskLevel']): string {
  if (riskLevel === 'high') {
    return '高风险';
  }
  if (riskLevel === 'medium') {
    return '中风险';
  }
  return '低风险';
}

function toBillingTierLabel(billingTier: SaMcpToolPackageItem['billingTier']): string {
  if (billingTier === 'premium') {
    return '高级';
  }
  if (billingTier === 'restricted') {
    return '受限';
  }
  if (billingTier === 'standard') {
    return '标准';
  }
  return '基础';
}

function bindingKey(binding: Pick<SaMcpBindingItem, 'toolName' | 'targetType' | 'targetRef'>): string {
  return `${binding.toolName}:${binding.targetType}:${binding.targetRef || ''}`;
}

function toolBindingKey(tool: SaMcpAvailableToolItem, targetRef?: string | null): string {
  return `${tool.toolName}:${tool.targetType}:${targetRef || ''}`;
}

export const SuperAdminMcpClientsPage: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<ClientStatusFilter>('all');
  const [clients, setClients] = useState<SaMcpClientItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState<ClientDraft>(defaultDraft);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  const [manageClientId, setManageClientId] = useState<string | null>(null);
  const [manageDetail, setManageDetail] = useState<SaMcpClientDetailResponse | null>(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTab>('tokens');
  const [agents, setAgents] = useState<SaAgentItem[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [tokenOnce, setTokenOnce] = useState<string | null>(null);
  const [tokenDraftOpen, setTokenDraftOpen] = useState(false);
  const [tokenNameDraft, setTokenNameDraft] = useState('');
  const [tokenDraftError, setTokenDraftError] = useState<string | null>(null);
  const [selectedBindingKeys, setSelectedBindingKeys] = useState<Set<string>>(() => new Set());
  const [bindingSaving, setBindingSaving] = useState(false);
  const [skillPackDownloading, setSkillPackDownloading] = useState(false);
  const [callLogs, setCallLogs] = useState<SaMcpCallLogItem[]>([]);
  const [callLogTotal, setCallLogTotal] = useState(0);
  const [callLogPage, setCallLogPage] = useState(0);
  const [callLogLoading, setCallLogLoading] = useState(false);
  const [callLogDetailLoading, setCallLogDetailLoading] = useState(false);
  const [callLogError, setCallLogError] = useState<string | null>(null);
  const [selectedCallLog, setSelectedCallLog] = useState<SaMcpCallLogDetailResponse | null>(null);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / PAGE_SIZE), 1), [total]);

  const loadClients = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await superAdminApi.mcpClients({
        keyword: keyword.trim() || undefined,
        status: status === 'all' ? undefined : status,
        page: targetPage,
        size: PAGE_SIZE,
      });
      setClients(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取 MCP Client 失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, status]);

  const loadAgents = useCallback(async (targetTenantId: string) => {
    if (!targetTenantId.trim()) {
      setAgents([]);
      return;
    }
    setAgentLoading(true);
    try {
      const response = await superAdminApi.agents({
        tenantId: targetTenantId.trim(),
        page: 0,
        size: 100,
      });
      setAgents(response.items);
    } catch {
      setAgents([]);
    } finally {
      setAgentLoading(false);
    }
  }, []);

  const loadCallLogs = useCallback(async (clientId: string, targetPage: number) => {
    setCallLogLoading(true);
    setCallLogError(null);
    try {
      const response = await superAdminApi.mcpCallLogs(clientId, {
        page: targetPage,
        size: CALL_LOG_PAGE_SIZE,
      });
      setCallLogs(response.items);
      setCallLogTotal(response.total);
      setCallLogPage(response.page);
      setSelectedCallLog(null);
    } catch (err) {
      setCallLogs([]);
      setCallLogTotal(0);
      setCallLogError(err instanceof Error ? err.message : '读取调用日志失败');
    } finally {
      setCallLogLoading(false);
    }
  }, []);

  const loadManageDetail = useCallback(async (clientId: string) => {
    setManageLoading(true);

    try {
      const response = await superAdminApi.mcpClientDetail(clientId);
      setManageDetail(response);
      setSelectedBindingKeys(new Set(response.bindings.filter((binding) => binding.enabled).map(bindingKey)));
      await loadAgents(response.client.tenantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '读取 Client 管理信息失败');
    } finally {
      setManageLoading(false);
    }
  }, [loadAgents]);

  useEffect(() => {
    void loadClients(0);
  }, []);

  const openManageModal = async (client: SaMcpClientItem) => {
    setManageClientId(client.id);
    setManageDetail(null);
    setManageTab('tokens');
    setTokenOnce(null);
    setAgents([]);
    setCallLogs([]);
    setCallLogTotal(0);
    setCallLogPage(0);
    setCallLogError(null);
    setSelectedCallLog(null);
    await loadManageDetail(client.id);
  };

  const closeManageModal = () => {
    setManageClientId(null);
    setManageDetail(null);
    setTokenOnce(null);
    setTokenDraftOpen(false);
    setTokenNameDraft('');
    setTokenDraftError(null);

    setAgents([]);
    setCallLogs([]);
    setCallLogTotal(0);
    setCallLogPage(0);
    setCallLogError(null);
    setSelectedCallLog(null);
  };

  const changeManageTab = (tab: ManageTab) => {
    setManageTab(tab);

    setCallLogError(null);
    if (tab === 'logs' && manageClientId) {
      void loadCallLogs(manageClientId, 0);
    }
  };

  const downloadSkillPack = async () => {
    setSkillPackDownloading(true);
    setError(null);
    try {
      const response = await fetchMedia(platformApiPath('/sa/mcp/skill-pack'));
      if (!response.ok) {
        throw new Error(`下载 Moss MCP Skill 失败（HTTP ${response.status}）`);
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      try {
        link.href = blobUrl;
        link.download = 'moss-mcp-skill.zip';
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(blobUrl);
      }
      toast.success('MCP Skill Pack 已开始下载，可选安装到外部 Agent 复用分析方法');
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载 Moss MCP Skill 失败');
    } finally {
      setSkillPackDownloading(false);
    }
  };

  const openCallLogDetail = async (log: SaMcpCallLogItem) => {
    if (!manageClientId) {
      return;
    }
    setCallLogDetailLoading(true);
    setCallLogError(null);
    try {
      const response = await superAdminApi.mcpCallLogDetail(manageClientId, log.id);
      setSelectedCallLog(response);
    } catch (err) {
      setCallLogError(err instanceof Error ? err.message : '读取调用详情失败');
    } finally {
      setCallLogDetailLoading(false);
    }
  };

  const submitCreate = async () => {
    setDraftError(null);
    if (!draft.name.trim() || !draft.tenantId.trim()) {
      setDraftError('Client 名称和租户必填，请先检索并选择租户');
      return;
    }
    setCreateSaving(true);
    try {
      const response = await superAdminApi.createMcpClient({
        name: draft.name.trim(),
        tenantId: draft.tenantId.trim(),
        description: draft.description.trim() || undefined,
      });
      setDraftOpen(false);
      setDraft(defaultDraft());
      await loadClients(0);
      setManageClientId(response.client.id);
      setManageDetail(response);
      setSelectedBindingKeys(new Set(response.bindings.filter((binding) => binding.enabled).map(bindingKey)));
      await loadAgents(response.client.tenantId);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : '创建 MCP Client 失败');
    } finally {
      setCreateSaving(false);
    }
  };

  const toggleClientStatus = async (client: SaMcpClientItem) => {
    const nextStatus = client.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      const response = await superAdminApi.updateMcpClient(client.id, { status: nextStatus });
      if (manageClientId === client.id) {
        setManageDetail(response);
      }
      await loadClients(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '状态更新失败');
    }
  };

  const deleteClient = async (client: SaMcpClientItem) => {
    if (!window.confirm(`确定删除 MCP Client「${client.name}」吗？删除后该 Client 的 Token 和授权绑定将立即失效，调用日志会保留。`)) {
      return;
    }
    try {
      await superAdminApi.deleteMcpClient(client.id);
      if (manageClientId === client.id) {
        setManageClientId(null);
        setManageDetail(null);
      }
      toast.success('MCP Client 已删除');
      const nextPage = clients.length <= 1 && page > 0 ? page - 1 : page;
      await loadClients(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除 MCP Client 失败');
    }
  };

  const openTokenDraft = () => {

    setTokenNameDraft('');
    setTokenDraftError(null);
    setTokenDraftOpen(true);
  };

  const generateToken = async () => {
    if (!manageDetail) {
      return;
    }
    const tokenName = tokenNameDraft.trim();
    if (!tokenName) {
      setTokenDraftError('Token 名称不能为空');
      return;
    }
    const response = await superAdminApi.generateMcpSecret(manageDetail.client.id, { name: tokenName });
    setTokenDraftOpen(false);
    setTokenNameDraft('');
    setTokenDraftError(null);
    setTokenOnce(response.token);
    await loadManageDetail(manageDetail.client.id);
    await loadClients(page);
  };

  const deleteSecret = async (secret: SaMcpSecretItem) => {
    if (!manageDetail) {
      return;
    }
    if (!window.confirm(`确定删除 Token「${secret.name}」吗？删除后该 Token 将立即不可用。`)) {
      return;
    }

    try {
      const response = await superAdminApi.deleteMcpSecret(manageDetail.client.id, secret.id);
      setManageDetail(response);
      toast.success('Token 已删除');
      await loadClients(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除 Token 失败');
    }
  };

  const toggleBinding = (key: string) => {

    setSelectedBindingKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleToolPackage = (packageKey: string, tools: SaMcpAvailableToolItem[]) => {

    setSelectedBindingKeys((current) => {
      const next = new Set(current);
      const packageToolKeys = tools
        .filter((tool) => tool.connected && tool.packageKey === packageKey)
        .map((tool) => toolBindingKey(tool));
      const allSelected = packageToolKeys.length > 0 && packageToolKeys.every((key) => next.has(key));
      packageToolKeys.forEach((key) => {
        if (allSelected) {
          next.delete(key);
        } else {
          next.add(key);
        }
      });
      return next;
    });
  };

  const saveBindings = async () => {
    if (!manageDetail) {
      return;
    }
    setBindingSaving(true);

    const bindings: Array<{ toolName: string; targetType: 'AGENT' | 'DATA'; targetRef?: string | null; enabled: boolean }> = [];
    manageDetail.availableTools.forEach((tool) => {
      if (tool.targetType === 'AGENT') {
        agents.forEach((agent) => {
          const key = toolBindingKey(tool, agent.agentId);
          if (selectedBindingKeys.has(key)) {
            bindings.push({ toolName: tool.toolName, targetType: tool.targetType, targetRef: agent.agentId, enabled: true });
          }
        });
      } else {
        const key = toolBindingKey(tool);
        if (selectedBindingKeys.has(key)) {
          bindings.push({ toolName: tool.toolName, targetType: tool.targetType, targetRef: null, enabled: true });
        }
      }
    });
    try {
      const response = await superAdminApi.updateMcpBindings(manageDetail.client.id, { bindings });
      setManageDetail(response);
      setSelectedBindingKeys(new Set(response.bindings.filter((binding) => binding.enabled).map(bindingKey)));
      toast.success(manageTab === 'agents' ? 'Agent 绑定已保存' : '工具授权已保存');
      await loadClients(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存绑定失败');
    } finally {
      setBindingSaving(false);
    }
  };

  const copyToken = async () => {
    if (!tokenOnce) {
      return;
    }
    try {
      await copyText(tokenOnce);
      toast.success('Token 已复制');
    } catch {
      toast.error('当前浏览器不支持自动复制，请手动选中 Token 复制');
    }
  };

  return (
    <SuperAdminLayout>
      <main className="fi-superadmin-content fi-superadmin-list-page" data-testid="superadmin-mcp-clients-page" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div data-testid="superadmin-mcp-clients-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: 'var(--text-primary)' }}>MCP管理</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              管理 MCP Client、Token 和工具授权。
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <FineDesignTooltip
              placement="bottom"
              align="end"
              offset={8}
              tooltipId="mcp-skill-pack-download-tip"
              content={(
                <span style={{ display: 'block', maxWidth: 220, whiteSpace: 'normal', lineHeight: '18px' }}>
                  可选安装到外部 Agent，复用企业分析方法；不安装也可直接调用 MCP 工具。
                </span>
              )}
            >
              <button
                type="button"
                aria-label="下载 Moss MCP Skill"
                onClick={() => void downloadSkillPack()}
                disabled={skillPackDownloading}
                style={{ ...secondaryButtonStyle, opacity: skillPackDownloading ? 0.65 : 1, cursor: skillPackDownloading ? 'not-allowed' : 'pointer' }}
              >
                <Download size={14} />
                {skillPackDownloading ? '下载中...' : '下载 Moss MCP Skill'}
              </button>
            </FineDesignTooltip>
            <button
              type="button"
              onClick={() => {
                setDraft(defaultDraft());
                setDraftError(null);
                setDraftOpen(true);
              }}
              style={primaryButtonStyle}
            >
              <Plus size={14} />
              新建 MCP Client
            </button>
          </div>
        </div>

        <div className="sa-filter-bar" data-testid="superadmin-mcp-clients-filters" style={toolbarStyle}>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索 Client 名称 / 企业 / 工作区"
            style={{ ...inputStyle, minWidth: 360, fontSize: 13 }}
          />
          <SuperAdminSelect value={status} onChange={setStatus} ariaLabel="Client 状态" style={{ width: 150 }} options={[
            { value: 'all', label: '全部状态' },
            { value: 'ACTIVE', label: '启用' },
            { value: 'DISABLED', label: '停用' },
          ]} />
          <button type="button" onClick={() => void loadClients(0)} style={{ ...secondaryButtonStyle, minHeight: 36, padding: '0 12px', fontSize: 13 }}>
            <RefreshCw size={14} />
            查询
          </button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <section className="sa-main-list-panel" data-testid="superadmin-mcp-clients-list-section" style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>MCP Client 列表</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loading ? '加载中' : `${total} 条`}</span>
          </div>

          <div className="sa-main-list-viewport" data-testid="superadmin-mcp-clients-table">
            <table className="sa-table" style={{ ...tableStyle, minWidth: 1240 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>企业 / 工作区</th>
                  <th style={thStyle}>状态</th>
                  <th style={thStyle}>数据工具</th>
                  <th style={thStyle}>Agent 绑定</th>
                  <th style={thStyle}>Token</th>
                  <th style={thStyle}>最近调用</th>
                  <th style={thStyle}>创建时间</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{client.name}</div>
                      <div
                        style={{ ...mutedTextStyle, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={client.id}
                      >
                        {client.id}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div>{client.companyName || '-'}</div>
                      <div
                        style={{ ...mutedTextStyle, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={`${client.workspaceName} / ${client.tenantId}`}
                      >
                        {client.workspaceName} / {client.tenantId}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <StatusPill tone={client.status === 'ACTIVE' ? 'success' : 'neutral'}>{toStatusLabel(client.status)}</StatusPill>
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{client.enabledToolCount}</td>
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{client.agentBindingCount}</td>
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{client.activeSecretCount}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{toDateTime(client.lastUsedAt)}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{toDateTime(client.createdAt)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => void openManageModal(client)} style={listManageButtonStyle}>管理</button>
                        <button
                          type="button"
                          onClick={() => void toggleClientStatus(client)}
                          style={client.status === 'ACTIVE' ? listDangerButtonStyle : listSuccessButtonStyle}
                        >
                          {client.status === 'ACTIVE' ? '停用' : '启用'}
                        </button>
                        <button
                          type="button"
                          aria-label={`删除 MCP Client ${client.name}`}
                          title="删除 MCP Client"
                          onClick={() => void deleteClient(client)}
                          style={listDeleteButtonStyle}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 32 }} colSpan={9}>
                      暂无 MCP Client
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="sa-main-list-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" disabled={page <= 0} onClick={() => void loadClients(page - 1)} style={smallButtonStyle}>上一页</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>{page + 1} / {totalPages}</span>
            <button type="button" disabled={page + 1 >= totalPages} onClick={() => void loadClients(page + 1)} style={smallButtonStyle}>下一页</button>
          </div>
        </section>

        {draftOpen && (
          <CreateMcpClientModal
            draft={draft}
            error={draftError}
            saving={createSaving}
            onChange={setDraft}
            onClose={() => setDraftOpen(false)}
            onSubmit={() => void submitCreate()}
          />
        )}

        {manageClientId && (
          <ManageMcpClientModal
            detail={manageDetail}
            loading={manageLoading}
            activeTab={manageTab}
            agents={agents}
            agentLoading={agentLoading}
            tokenOnce={tokenOnce}
            tokenDraftOpen={tokenDraftOpen}
            tokenNameDraft={tokenNameDraft}
            tokenDraftError={tokenDraftError}
            selectedBindingKeys={selectedBindingKeys}
            bindingSaving={bindingSaving}
            callLogs={callLogs}
            callLogTotal={callLogTotal}
            callLogPage={callLogPage}
            callLogLoading={callLogLoading}
            callLogDetailLoading={callLogDetailLoading}
            callLogError={callLogError}
            selectedCallLog={selectedCallLog}
            onTabChange={changeManageTab}
            onClose={closeManageModal}
            onRefresh={() => {
              if (manageTab === 'logs') {
                void loadCallLogs(manageClientId, callLogPage);
              } else {
                void loadManageDetail(manageClientId);
              }
            }}
            onOpenTokenDraft={openTokenDraft}
            onTokenNameChange={(value) => {
              setTokenNameDraft(value);
              setTokenDraftError(null);
            }}
            onCancelTokenDraft={() => {
              setTokenDraftOpen(false);
              setTokenNameDraft('');
              setTokenDraftError(null);
            }}
            onGenerateToken={() => void generateToken()}
            onCopyToken={() => void copyToken()}
            onDeleteSecret={(secret) => void deleteSecret(secret)}
            onToggleBinding={toggleBinding}
            onToggleToolPackage={toggleToolPackage}
            onSaveBindings={() => void saveBindings()}
            onLoadCallLogs={(targetPage) => void loadCallLogs(manageClientId, targetPage)}
            onOpenCallLogDetail={(log) => void openCallLogDetail(log)}
          />
        )}
      </main>
    </SuperAdminLayout>
  );
};

const CreateMcpClientModal: React.FC<{
  draft: ClientDraft;
  error: string | null;
  saving: boolean;
  onChange: (draft: ClientDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}> = ({ draft, error, saving, onChange, onClose, onSubmit }) => {
  const [selectedTenant, setSelectedTenant] = useState<TenantOption | null>(null);

  return (
    <div data-testid="superadmin-mcp-clients-create-modal" style={modalMaskStyle} onClick={onClose}>
      <div data-testid="superadmin-mcp-clients-create-modal-panel" style={createModalStyle} onClick={(event) => event.stopPropagation()}>
        <ModalHeader title="新建 MCP Client" onClose={onClose} />

        {error && <div style={errorStyle}>{error}</div>}

        <Field label="归属租户 *" help="通过企业名、工作区名或租户 ID 检索选择租户。">
          <TenantSearchPicker
            selectedTenant={selectedTenant}
            onSelect={(tenant) => {
              setSelectedTenant(tenant);
              onChange({ ...draft, tenantId: tenant.tenantId });
            }}
            onClear={() => {
              setSelectedTenant(null);
              onChange({ ...draft, tenantId: '' });
            }}
          />
        </Field>

        <Field label="Client 名称 *">
          <input
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="例如：Acme-Prod-MCP"
            style={formInputStyle}
          />
        </Field>

        <Field label="备注">
          <textarea
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            placeholder="可选，记录 FDE、客户场景或联调用途"
            style={formTextareaStyle}
          />
        </Field>

        <div style={modalFooterStyle}>
          <button type="button" onClick={onClose} style={modalSecondaryButtonStyle}>取消</button>
          <button type="button" onClick={onSubmit} disabled={saving} style={{ ...modalPrimaryButtonStyle, opacity: saving ? 0.65 : 1 }}>
            {saving ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ManageMcpClientModal: React.FC<{
  detail: SaMcpClientDetailResponse | null;
  loading: boolean;
  activeTab: ManageTab;
  agents: SaAgentItem[];
  agentLoading: boolean;
  tokenOnce: string | null;
  tokenDraftOpen: boolean;
  tokenNameDraft: string;
  tokenDraftError: string | null;
  selectedBindingKeys: Set<string>;
  bindingSaving: boolean;
  callLogs: SaMcpCallLogItem[];
  callLogTotal: number;
  callLogPage: number;
  callLogLoading: boolean;
  callLogDetailLoading: boolean;
  callLogError: string | null;
  selectedCallLog: SaMcpCallLogDetailResponse | null;
  onTabChange: (tab: ManageTab) => void;
  onClose: () => void;
  onRefresh: () => void;
  onOpenTokenDraft: () => void;
  onTokenNameChange: (value: string) => void;
  onCancelTokenDraft: () => void;
  onGenerateToken: () => void;
  onCopyToken: () => void;
  onDeleteSecret: (secret: SaMcpSecretItem) => void;
  onToggleBinding: (key: string) => void;
  onToggleToolPackage: (packageKey: string, tools: SaMcpAvailableToolItem[]) => void;
  onSaveBindings: () => void;
  onLoadCallLogs: (page: number) => void;
  onOpenCallLogDetail: (log: SaMcpCallLogItem) => void;
}> = ({
  detail,
  loading,
  activeTab,
  agents,
  agentLoading,
  tokenOnce,
  tokenDraftOpen,
  tokenNameDraft,
  tokenDraftError,
  selectedBindingKeys,
  bindingSaving,
  callLogs,
  callLogTotal,
  callLogPage,
  callLogLoading,
  callLogDetailLoading,
  callLogError,
  selectedCallLog,
  onTabChange,
  onClose,
  onRefresh,
  onOpenTokenDraft,
  onTokenNameChange,
  onCancelTokenDraft,
  onGenerateToken,
  onCopyToken,
  onDeleteSecret,
  onToggleBinding,
  onToggleToolPackage,
  onSaveBindings,
  onLoadCallLogs,
  onOpenCallLogDetail,
}) => {
  const dataTools = detail?.availableTools.filter((tool) => tool.targetType === 'DATA' && tool.packageKey !== 'agent_runtime') || [];
  const agentTools = detail?.availableTools.filter((tool) => tool.targetType === 'AGENT') || [];
  const dataPackages = detail?.toolPackages.filter((toolPackage) => toolPackage.packageKey !== 'agent_runtime') || [];
  const activeSecrets = detail?.secrets.length || 0;
  const canSaveBindings = activeTab === 'tools' || activeTab === 'agents';

  return (
    <div data-testid="superadmin-mcp-clients-manage-modal" style={modalMaskStyle} onClick={onClose}>
      <div data-testid="superadmin-mcp-clients-manage-modal-panel" style={manageModalStyle} onClick={(event) => event.stopPropagation()}>
        <ModalHeader title="MCP Client 管理" onClose={onClose} />

        {loading && <div style={noticeStyle}>加载中...</div>}
        {detail && (
          <>
            <div style={summaryStyle}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{detail.client.name}</div>
                <div style={mutedTextStyle}>
                  {detail.client.companyName || '-'} / {detail.client.workspaceName} / {detail.client.tenantId}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusPill tone={detail.client.status === 'ACTIVE' ? 'success' : 'neutral'}>{toStatusLabel(detail.client.status)}</StatusPill>
                <span style={mutedTextStyle}>Token：{activeSecrets}</span>
              </div>
            </div>

            <div style={tabBarStyle}>
              <TabButton active={activeTab === 'tokens'} onClick={() => onTabChange('tokens')}>Token 管理</TabButton>
              <TabButton active={activeTab === 'tools'} onClick={() => onTabChange('tools')}>工具授权</TabButton>
              <TabButton active={activeTab === 'agents'} onClick={() => onTabChange('agents')}>Agent 绑定</TabButton>
              <TabButton active={activeTab === 'logs'} onClick={() => onTabChange('logs')}>审计日志</TabButton>
              <button type="button" onClick={onRefresh} style={{ ...smallButtonStyle, marginLeft: 'auto' }}>
                <RefreshCw size={13} />
                刷新
              </button>
            </div>

            <div style={manageBodyStyle}>
              {activeTab === 'tokens' && (
                <TokensPanel
                  secrets={detail.secrets}
                  tokenOnce={tokenOnce}
                  tokenDraftOpen={tokenDraftOpen}
                  tokenNameDraft={tokenNameDraft}
                  tokenDraftError={tokenDraftError}
                  onOpenTokenDraft={onOpenTokenDraft}
                  onTokenNameChange={onTokenNameChange}
                  onCancelTokenDraft={onCancelTokenDraft}
                  onGenerate={onGenerateToken}
                  onCopy={onCopyToken}
                  onDelete={onDeleteSecret}
                />
              )}

              {activeTab === 'tools' && (
                <ToolsPanel
                  tools={dataTools}
                  packages={dataPackages}
                  selectedBindingKeys={selectedBindingKeys}
                  onToggle={onToggleBinding}
                  onTogglePackage={onToggleToolPackage}
                />
              )}

              {activeTab === 'agents' && (
                <AgentBindingPanel
                  tools={agentTools}
                  agents={agents}
                  agentLoading={agentLoading}
                  selectedBindingKeys={selectedBindingKeys}
                  onToggle={onToggleBinding}
                />
              )}

              {activeTab === 'logs' && (
                <CallLogsPanel
                  logs={callLogs}
                  total={callLogTotal}
                  page={callLogPage}
                  loading={callLogLoading}
                  detailLoading={callLogDetailLoading}
                  error={callLogError}
                  selectedLog={selectedCallLog}
                  onLoadPage={onLoadCallLogs}
                  onOpenDetail={onOpenCallLogDetail}
                />
              )}
            </div>

            {canSaveBindings && (
              <div style={manageFooterStyle}>
                <button
                  type="button"
                  onClick={onSaveBindings}
                  disabled={bindingSaving}
                  style={{ ...primaryButtonStyle, opacity: bindingSaving ? 0.65 : 1, cursor: bindingSaving ? 'not-allowed' : 'pointer' }}
                >
                  <Save size={14} />
                  {bindingSaving ? '保存中...' : activeTab === 'tools' ? '保存授权' : '保存绑定'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const TokensPanel: React.FC<{
  secrets: SaMcpSecretItem[];
  tokenOnce: string | null;
  tokenDraftOpen: boolean;
  tokenNameDraft: string;
  tokenDraftError: string | null;
  onOpenTokenDraft: () => void;
  onTokenNameChange: (value: string) => void;
  onCancelTokenDraft: () => void;
  onGenerate: () => void;
  onCopy: () => void;
  onDelete: (secret: SaMcpSecretItem) => void;
}> = ({
  secrets,
  tokenOnce,
  tokenDraftOpen,
  tokenNameDraft,
  tokenDraftError,
  onOpenTokenDraft,
  onTokenNameChange,
  onCancelTokenDraft,
  onGenerate,
  onCopy,
  onDelete,
}) => (
  <div data-testid="superadmin-mcp-clients-tokens-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <div style={modalSectionTitleStyle}>Token 列表</div>
      <button type="button" onClick={onOpenTokenDraft} style={primaryButtonStyle}>
        <KeyRound size={14} />
        生成 Token
      </button>
    </div>

    {tokenDraftOpen && (
      <div style={tokenDraftStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={tokenNameDraft}
              onChange={(event) => onTokenNameChange(event.target.value)}
              placeholder="Token 名称，如：生产环境"
              style={tokenNameInputStyle}
            />
            {tokenDraftError && <div style={tokenDraftErrorStyle}>{tokenDraftError}</div>}
          </div>
          <button type="button" onClick={onCancelTokenDraft} style={tokenDraftSecondaryButtonStyle}>取消</button>
          <button type="button" onClick={onGenerate} style={tokenDraftPrimaryButtonStyle}>生成</button>
        </div>
      )}

    {tokenOnce && (
      <div style={tokenBoxStyle}>
        <code style={{ wordBreak: 'break-all' }}>{tokenOnce}</code>
        <button type="button" onClick={onCopy} style={smallButtonStyle}>
          <Copy size={13} />
          复制
        </button>
      </div>
    )}

    <table data-testid="superadmin-mcp-clients-tokens-table" style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Token 名称</th>
          <th style={thStyle}>前缀</th>
          <th style={thStyle}>最近使用</th>
          <th style={thStyle}>创建时间</th>
          <th style={thStyle}>操作</th>
        </tr>
      </thead>
      <tbody>
        {secrets.map((secret) => (
          <tr key={secret.id}>
            <td style={tdStyle}>{secret.name}</td>
            <td style={tdStyle}>{secret.secretPrefix || '-'}</td>
            <td style={tdStyle}>{toDateTime(secret.lastUsedAt)}</td>
            <td style={tdStyle}>{toDateTime(secret.createdAt)}</td>
            <td style={tdStyle}>
              <div style={rowActionGroupStyle}>
                <button type="button" onClick={() => onDelete(secret)} style={smallDangerButtonStyle}>
                  <Trash2 size={13} />
                  删除
                </button>
              </div>
            </td>
          </tr>
        ))}
        {secrets.length === 0 && (
          <tr>
            <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={5}>暂无 Token</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const ToolsPanel: React.FC<{
  tools: SaMcpAvailableToolItem[];
  packages: SaMcpToolPackageItem[];
  selectedBindingKeys: Set<string>;
  onToggle: (key: string) => void;
  onTogglePackage: (packageKey: string, tools: SaMcpAvailableToolItem[]) => void;
}> = ({ tools, packages, selectedBindingKeys, onToggle, onTogglePackage }) => {
  const [expandedPackageKeys, setExpandedPackageKeys] = useState<Set<string>>(() => new Set(['enterprise_core']));
  const [infoPackageKey, setInfoPackageKey] = useState<string | null>(null);
  const sections = useMemo(() => {
    const packageByKey = new Map(packages.map((toolPackage) => [toolPackage.packageKey, toolPackage]));
    const configuredKeys = new Set(DATA_PACKAGE_SECTIONS.flatMap((section) => section.packageKeys));
    const configuredSections = DATA_PACKAGE_SECTIONS
      .map((section) => ({
        ...section,
        packages: section.packageKeys
          .map((packageKey) => packageByKey.get(packageKey))
          .filter((toolPackage): toolPackage is SaMcpToolPackageItem => Boolean(toolPackage)),
      }))
      .filter((section) => section.packages.length > 0);
    const otherPackages = packages.filter((toolPackage) => !configuredKeys.has(toolPackage.packageKey));
    if (otherPackages.length === 0) {
      return configuredSections;
    }
    return [
      ...configuredSections,
      {
        key: 'other',
        title: '其他能力',
        description: '尚未纳入固定分区的新能力组。',
        packageKeys: otherPackages.map((toolPackage) => toolPackage.packageKey),
        packages: otherPackages,
      },
    ];
  }, [packages]);

  const toggleExpanded = (packageKey: string) => {
    setExpandedPackageKeys((current) => {
      const next = new Set(current);
      if (next.has(packageKey)) {
        next.delete(packageKey);
      } else {
        next.add(packageKey);
      }
      return next;
    });
  };

  const packageStats = (packageList: SaMcpToolPackageItem[]) => {
    const sectionTools = packageList.flatMap((toolPackage) => tools.filter((tool) => tool.packageKey === toolPackage.packageKey));
    const connectedTools = sectionTools.filter((tool) => tool.connected);
    const selectedCount = connectedTools.filter((tool) => selectedBindingKeys.has(toolBindingKey(tool))).length;
    return { selectedCount, connectedCount: connectedTools.length };
  };

  return (
    <div data-testid="superadmin-mcp-clients-call-logs-panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={modalSectionTitleStyle}>数据能力授权</div>
        <div style={mutedTextStyle}>按能力组批量开放数据能力；可展开查看实际授权工具。</div>
      </div>

      {sections.map((section) => {
        const stats = packageStats(section.packages);
        return (
          <div key={section.key} style={toolSectionStyle}>
            <div style={toolSectionHeaderStyle}>
              <div>
                <div style={toolSectionTitleStyle}>{section.title}</div>
                <div style={toolSectionDescriptionStyle}>{section.description}</div>
              </div>
              <div style={toolSectionCountStyle}>{stats.selectedCount}/{stats.connectedCount} 已授权</div>
            </div>

            <div style={toolSectionPackagesStyle}>
              {section.packages.map((toolPackage) => {
                const packageTools = tools.filter((tool) => tool.packageKey === toolPackage.packageKey);
                const connectedTools = packageTools.filter((tool) => tool.connected);
                const selectedCount = connectedTools.filter((tool) => selectedBindingKeys.has(toolBindingKey(tool))).length;
                const allSelected = connectedTools.length > 0 && selectedCount === connectedTools.length;
                const expanded = expandedPackageKeys.has(toolPackage.packageKey);
                const infoOpen = infoPackageKey === toolPackage.packageKey;

                return (
                  <div key={toolPackage.packageKey} style={toolPackageCardStyle}>
                    <div style={toolPackageHeaderStyle}>
                      <div style={toolPackageCheckboxCellStyle}>
                        <input
                          type="checkbox"
                          disabled={connectedTools.length === 0}
                          checked={allSelected}
                          onChange={() => onTogglePackage(toolPackage.packageKey, tools)}
                          style={checkboxInputStyle}
                          aria-label={`授权${toolPackage.title}`}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={toolPackageTitleRowStyle}>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(toolPackage.packageKey)}
                            style={flatIconButtonStyle}
                            aria-label={expanded ? '收起能力组' : '展开能力组'}
                          >
                            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                          <span style={toolPackageTitleStyle}>{toolPackage.title}</span>
                          <button
                            type="button"
                            onClick={() => setInfoPackageKey(infoOpen ? null : toolPackage.packageKey)}
                            style={infoButtonStyle}
                            title="查看能力组说明"
                            aria-label={`查看${toolPackage.title}说明`}
                          >
                            <Info size={14} />
                          </button>
                          <MetaBadge tone={toolPackage.riskLevel === 'high' ? 'danger' : toolPackage.riskLevel === 'medium' ? 'warning' : 'neutral'}>
                            {toRiskLevelLabel(toolPackage.riskLevel)}
                          </MetaBadge>
                          <MetaBadge tone={toolPackage.billingTier === 'restricted' ? 'danger' : 'neutral'}>
                            {toBillingTierLabel(toolPackage.billingTier)}
                          </MetaBadge>
                        </div>
                        <div style={toolPackageSummaryStyle}>{toolPackage.summary}</div>
                      </div>
                      <div style={toolPackageCountStyle}>
                        {selectedCount}/{connectedTools.length} 已授权
                      </div>
                    </div>

                    {infoOpen && (
                      <div style={toolPackageInfoStyle}>
                        <InfoLine label="适用场景" value={toolPackage.scenarios.length > 0 ? toolPackage.scenarios.join('、') : '-'} />
                        <InfoLine label="输入" value={toolPackage.inputHint || '-'} />
                        <InfoLine label="输出" value={toolPackage.outputHint || '-'} />
                        {toolPackage.caution && <InfoLine label="注意" value={toolPackage.caution} />}
                      </div>
                    )}

                    {expanded && (
                      <div style={abilityGroupToolsStyle}>
                        <table style={compactTableStyle}>
                          <thead>
                            <tr>
                              <th style={compactCheckThStyle}>授权</th>
                              <th style={toolColumnThStyle}>工具</th>
                              <th style={compactThStyle}>说明</th>
                            </tr>
                          </thead>
                          <tbody>
                            {packageTools.map((tool) => {
                              const key = toolBindingKey(tool);
                              return (
                                <tr key={tool.toolName}>
                                  <td style={compactCheckTdStyle}>
                                    <input
                                      type="checkbox"
                                      disabled={!tool.connected}
                                      checked={tool.connected && selectedBindingKeys.has(key)}
                                      onChange={() => onToggle(key)}
                                    />
                                  </td>
                                  <td style={compactTdStyle}>
                                    <div style={toolNameStyle}>{tool.displayName}</div>
                                    <div style={toolKeyStyle}>{tool.toolName}</div>
                                  </td>
                                  <td style={compactTdStyle}>
                                    <span style={toolDescStyle}>{tool.description}</span>
                                  </td>
                                </tr>
                              );
                            })}
                            {packageTools.length === 0 && (
                              <tr>
                                <td style={{ ...compactTdStyle, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={3}>
                                  暂无工具定义
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {sections.length === 0 && <div style={emptyStyle}>暂无数据能力组</div>}
    </div>
  );
};

const AgentBindingPanel: React.FC<{
  tools: SaMcpAvailableToolItem[];
  agents: SaAgentItem[];
  agentLoading: boolean;
  selectedBindingKeys: Set<string>;
  onToggle: (key: string) => void;
}> = ({ tools, agents, agentLoading, selectedBindingKeys, onToggle }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div>
      <div style={modalSectionTitleStyle}>Agent 绑定</div>
      <div style={mutedTextStyle}>{agentLoading ? 'Agent 加载中...' : `可选 Agent：${agents.length}`}</div>
    </div>
    {tools.map((tool) => (
      <div key={tool.toolName} style={subPanelStyle}>
        <div style={agentToolHeaderStyle}>
          <div style={agentToolSummaryStyle}>
            <div style={toolNameStyle}>{tool.displayName}</div>
            <div style={agentToolDescriptionStyle}>{tool.description}</div>
          </div>
        </div>
        <table style={compactTableStyle}>
          <thead>
            <tr>
              <th style={compactCheckThStyle}>授权</th>
              <th style={compactThStyle}>Agent</th>
              <th style={compactThStyle}>工作区</th>
              <th style={compactThStyle}>状态</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const key = toolBindingKey(tool, agent.agentId);
              return (
                <tr key={agent.agentId}>
                  <td style={compactCheckTdStyle}>
                    <input
                      type="checkbox"
                      disabled={!tool.connected}
                      checked={tool.connected && selectedBindingKeys.has(key)}
                      onChange={() => onToggle(key)}
                    />
                  </td>
                  <td style={compactTdStyle}>
                    <div style={toolNameStyle}>{agent.name}</div>
                    <div style={toolKeyStyle}>{agent.agentId}</div>
                  </td>
                  <td style={compactTdStyle}>{agent.workspaceName || '-'}</td>
                  <td style={compactTdStyle}>
                    <StatusPill tone={agent.status === 'active' ? 'success' : 'neutral'}>{agent.status === 'active' ? '启用' : '停用'}</StatusPill>
                  </td>
                </tr>
              );
            })}
            {agents.length === 0 && (
              <tr>
                <td style={{ ...compactTdStyle, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={4}>
                  当前租户暂无可选 Agent
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    ))}
    {tools.length === 0 && <div style={emptyStyle}>暂无 Agent 绑定工具</div>}
  </div>
);

const CallLogsPanel: React.FC<{
  logs: SaMcpCallLogItem[];
  total: number;
  page: number;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  selectedLog: SaMcpCallLogDetailResponse | null;
  onLoadPage: (page: number) => void;
  onOpenDetail: (log: SaMcpCallLogItem) => void;
}> = ({
  logs,
  total,
  page,
  loading,
  detailLoading,
  error,
  selectedLog,
  onLoadPage,
  onOpenDetail,
}) => {
  const totalPages = Math.max(Math.ceil(total / CALL_LOG_PAGE_SIZE), 1);
  const [payloadTab, setPayloadTab] = useState<AuditPayloadTab>('request');
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  useEffect(() => {
    setPayloadTab('request');
    setCopyNotice(null);
  }, [selectedLog?.item.id]);

  const activePayload = selectedLog ? {
    request: selectedLog.requestPayload,
    response: selectedLog.responsePayload,
  }[payloadTab] : null;

  const copyPayload = async () => {
    if (!activePayload) {
      return;
    }
    try {
      await copyText(prettyJson(activePayload));
      setCopyNotice('已复制当前内容');
    } catch {
      setCopyNotice('复制失败，请手动选中内容复制');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={modalSectionTitleStyle}>调用审计</div>
        <div style={mutedTextStyle}>{loading ? '日志加载中...' : `共 ${total} 条工具调用记录`}</div>
      </div>

      {error && <div style={compactErrorStyle}>{error}</div>}

      <table data-testid="superadmin-mcp-clients-call-logs-table" style={compactTableStyle}>
        <thead>
          <tr>
            <th style={compactThStyle}>调用时间</th>
            <th style={auditToolThStyle}>工具</th>
            <th style={compactThStyle}>状态</th>
            <th style={compactThStyle}>耗时</th>
            <th style={compactThStyle}>Job</th>
            <th style={compactThStyle}>错误</th>
            <th style={compactThStyle}>操作</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td style={compactTdStyle}>
                <div>{toDateTime(log.createdAt)}</div>
                <div style={toolKeyStyle}>Trace: {log.traceId}</div>
              </td>
              <td style={compactTdStyle}>
                <div style={toolNameStyle}>{log.toolName || log.method}</div>
                <div style={toolKeyStyle}>{log.method}</div>
              </td>
              <td style={compactTdStyle}>
                <MetaBadge tone={toCallLogStatusTone(log.status)}>{toCallLogStatusLabel(log.status)}</MetaBadge>
              </td>
              <td style={compactTdStyle}>{formatDuration(log.durationMs)}</td>
              <td style={compactTdStyle}>{log.jobId || '-'}</td>
              <td style={compactTdStyle}>
                {log.errorCode ? (
                  <div>
                    <div style={{ color: 'var(--danger)', fontWeight: 500 }}>{log.errorCode}</div>
                    <div style={auditErrorMessageStyle}>{log.errorMessage || '-'}</div>
                  </div>
                ) : '-'}
              </td>
              <td style={compactTdStyle}>
                <button type="button" onClick={() => onOpenDetail(log)} style={smallPrimaryButtonStyle}>
                  详情
                </button>
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td style={{ ...compactTdStyle, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>
                暂无调用审计记录
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" disabled={page <= 0 || loading} onClick={() => onLoadPage(page - 1)} style={smallButtonStyle}>上一页</button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>{page + 1} / {totalPages}</span>
        <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => onLoadPage(page + 1)} style={smallButtonStyle}>下一页</button>
      </div>

      <div style={auditDetailPanelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={modalSectionTitleStyle}>调用详情</div>
          {detailLoading && <span style={mutedTextStyle}>详情加载中...</span>}
        </div>
        {selectedLog ? (
          <div style={auditDetailContentStyle}>
            <div style={auditDetailMetaGridStyle}>
              <AuditMetaItem label="Trace" value={selectedLog.item.traceId} />
              <AuditMetaItem label="工具" value={selectedLog.item.toolName || selectedLog.item.method} />
              <AuditMetaItem label="请求 ID" value={selectedLog.item.requestId || '-'} />
              <AuditMetaItem label="状态" value={toCallLogStatusLabel(selectedLog.item.status)} />
              <AuditMetaItem label="耗时" value={formatDuration(selectedLog.item.durationMs)} />
              <AuditMetaItem label="Job" value={selectedLog.item.jobId || '-'} />
              <AuditMetaItem label="外部用户" value={selectedLog.item.externalUserRef || '-'} />
              <AuditMetaItem label="外部会话" value={selectedLog.item.externalSessionRef || '-'} />
            </div>

            <div style={auditPayloadPanelStyle}>
              <div style={auditPayloadToolbarStyle}>
                <div style={auditPayloadTabsStyle}>
                  {AUDIT_PAYLOAD_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setPayloadTab(tab.key);
                        setCopyNotice(null);
                      }}
                      style={auditPayloadTabButtonStyle(payloadTab === tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {copyNotice && <span style={auditCopyNoticeStyle}>{copyNotice}</span>}
                  <button type="button" onClick={() => void copyPayload()} disabled={!activePayload} style={!activePayload ? smallDisabledButtonStyle : smallButtonStyle}>
                    <Copy size={13} />
                    复制
                  </button>
                </div>
              </div>
              <pre style={auditPayloadPreStyle}>{prettyJson(activePayload)}</pre>
            </div>
          </div>
        ) : (
          <div style={emptyStyle}>选择一条调用记录查看请求和响应详情</div>
        )}
      </div>
    </div>
  );
};

const AuditMetaItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={auditMetaItemStyle}>
    <div style={auditMetaLabelStyle}>{label}</div>
    <div style={auditMetaValueStyle}>{value}</div>
  </div>
);

const TenantSearchPicker: React.FC<{
  selectedTenant: TenantOption | null;
  onSelect: (tenant: TenantOption) => void;
  onClear: () => void;
}> = ({ selectedTenant, onSelect, onClear }) => {
  const [keyword, setKeyword] = useState('');
  const [options, setOptions] = useState<TenantOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  useEffect(() => {
    const handle = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handle);
    }
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const searchTenants = useCallback((value: string) => {
    setKeyword(value);
    setError(null);
    if (selectedTenant && value !== `${selectedTenant.enterpriseName} / ${selectedTenant.workspaceName}`) {
      onClear();
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setOptions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await superAdminApi.tenants({ keyword: trimmed, page: 0, size: 10 });
        setOptions(flattenTenantOptions(response.items));
        setOpen(true);
      } catch (err) {
        setOptions([]);
        setOpen(false);
        setError(err instanceof Error ? err.message : '租户检索失败');
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [onClear, selectedTenant]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 11, top: 10, color: 'var(--text-muted)' }} />
        <input
          value={keyword}
          onChange={(event) => searchTenants(event.target.value)}
          onFocus={() => {
            if (options.length > 0) {
              setOpen(true);
            }
          }}
          placeholder="输入企业名、工作区名或租户 ID 检索（至少 2 个字符）"
          style={{ ...formInputStyle, paddingLeft: 34, paddingRight: loading ? 72 : 10 }}
        />
        {loading && (
          <div style={{ position: 'absolute', right: 11, top: 9, fontSize: 12, color: 'var(--text-muted)' }}>
            搜索中...
          </div>
        )}
      </div>
      {open && (
        <div style={tenantDropdownStyle}>
          {options.map((option) => (
            <button
              key={option.tenantId}
              type="button"
              onClick={() => {
                onSelect(option);
                setKeyword(`${option.enterpriseName} / ${option.workspaceName}`);
                setOpen(false);
              }}
              style={tenantOptionStyle}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {option.enterpriseName} / {option.workspaceName}
                </span>
                <span style={{ fontSize: 11, color: option.tenantStatus === 'active' ? 'var(--success)' : 'var(--danger)' }}>
                  {toTenantStatusLabel(option.tenantStatus)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {option.tenantId} · {toPlanLabel(option)}
              </div>
            </button>
          ))}
          {options.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
              未找到匹配租户
            </div>
          )}
        </div>
      )}
      {selectedTenant && (
        <div style={selectedTenantStyle}>
          <div style={selectedTenantMainStyle}>{selectedTenant.enterpriseName} / {selectedTenant.workspaceName}</div>
          <div style={selectedTenantMetaStyle}>
            {selectedTenant.tenantId} · {toTenantStatusLabel(selectedTenant.tenantStatus)} · {toPlanLabel(selectedTenant)}
          </div>
        </div>
      )}
      {error && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
    </div>
  );
};

const ModalHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
    <button type="button" onClick={onClose} style={iconButtonStyle}>
      <X size={16} />
    </button>
  </div>
);

const Field: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({ label, help, children }) => (
  <div style={formFieldStyle}>
    <div style={formLabelStyle}>{label}</div>
    {help && <div style={formHelpStyle}>{help}</div>}
    {children}
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      border: 'none',
      borderBottom: active ? '2px solid var(--btn-primary-bg)' : '2px solid transparent',
      background: 'transparent',
      color: active ? 'var(--btn-primary-bg)' : 'var(--text-muted)',
      padding: '10px 4px',
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

const StatusPill: React.FC<{ tone: 'success' | 'neutral'; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 999,
      padding: '2px 8px',
      fontSize: 12,
      color: tone === 'success' ? 'var(--success)' : 'var(--text-muted)',
      background: tone === 'success' ? 'var(--success-bg-soft)' : 'var(--bg-secondary)',
      border: tone === 'success' ? '1px solid var(--success-border-soft)' : '1px solid var(--border-subtle)',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

const MetaBadge: React.FC<{ tone: 'success' | 'warning' | 'danger' | 'neutral'; children: React.ReactNode }> = ({ tone, children }) => {
  const toneStyle = {
    success: {
      color: 'var(--success)',
      background: 'var(--success-bg-soft)',
      border: '1px solid var(--success-border-soft)',
    },
    warning: {
      color: 'var(--warning)',
      background: 'var(--warning-bg-soft)',
      border: '1px solid var(--warning-border-soft)',
    },
    danger: {
      color: 'var(--danger)',
      background: 'var(--danger-bg-soft)',
      border: '1px solid var(--danger-border-soft)',
    },
    neutral: {
      color: 'var(--text-muted)',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-subtle)',
    },
  }[tone];

  return (
    <span style={{ ...metaBadgeStyle, ...toneStyle }}>
      {children}
    </span>
  );
};

const InfoLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={infoLineStyle}>
    <span style={infoLineLabelStyle}>{label}</span>
    <span style={infoLineValueStyle}>{value}</span>
  </div>
);

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 14,
  background: 'var(--bg-secondary)',
  overflow: 'hidden',
};

const panelHeaderStyle: React.CSSProperties = {
  minHeight: 48,
  padding: '0 18px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  color: 'var(--text-primary)',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  height: 36,
  minWidth: 180,
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
};

const formInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
  minWidth: 0,
  fontSize: 13,
};

const formTextareaStyle: React.CSSProperties = {
  ...formInputStyle,
  height: 76,
  resize: 'vertical',
  padding: '8px 10px',
  lineHeight: 1.5,
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 30,
  borderRadius: 6,
  border: '1px solid var(--btn-primary-bg)',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  padding: '0 9px',
  display: 'inline-flex',
  gap: 5,
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontSize: 12,
  fontWeight: 500,
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 30,
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  padding: '0 9px',
  display: 'inline-flex',
  gap: 5,
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontSize: 12,
  fontWeight: 500,
};

const smallButtonStyle: React.CSSProperties = {
  minHeight: 24,
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  padding: '0 7px',
  display: 'inline-flex',
  gap: 3,
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontSize: 12,
};

const smallPrimaryButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  color: 'var(--info)',
  background: 'var(--info-bg-soft)',
  border: '1px solid var(--info-border-soft)',
  fontWeight: 500,
};

const smallSuccessButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  color: 'var(--success)',
  background: 'var(--success-bg-soft)',
  border: '1px solid var(--success-border-soft)',
  fontWeight: 500,
};

const smallDangerButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  color: 'var(--danger)',
  background: 'var(--danger-bg-soft)',
  border: '1px solid var(--danger-border-soft)',
  fontWeight: 500,
};

const listManageButtonStyle: React.CSSProperties = {
  height: 32,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--btn-mono-bg)',
  background: 'var(--btn-mono-bg)',
  color: 'var(--btn-mono-text)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  cursor: 'pointer',
};

const listDangerButtonStyle: React.CSSProperties = {
  ...smallDangerButtonStyle,
  minHeight: 32,
  padding: '0 12px',
};

const listSuccessButtonStyle: React.CSSProperties = {
  ...smallSuccessButtonStyle,
  minHeight: 32,
  padding: '0 12px',
};

const listDeleteButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  padding: 0,
  borderRadius: 8,
  border: '1px solid var(--danger-border-soft)',
  background: 'transparent',
  color: 'var(--danger)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const smallDisabledButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  color: 'var(--text-disabled)',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-subtle)',
  cursor: 'not-allowed',
};

const rowActionGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
};

const iconButtonStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const flatIconButtonStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
};

const infoButtonStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  color: 'var(--text-primary)',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 6px',
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--text-muted)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '9px 6px',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'middle',
};

const mutedTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const errorStyle: React.CSSProperties = {
  color: 'var(--danger)',
  background: 'var(--danger-bg-soft)',
  border: '1px solid var(--danger-border-soft)',
  borderRadius: 8,
  padding: 10,
  fontSize: 13,
};

const noticeStyle: React.CSSProperties = {
  color: 'var(--success)',
  background: 'var(--success-bg-soft)',
  border: '1px solid var(--success-border-soft)',
  borderRadius: 8,
  padding: 10,
  fontSize: 13,
};

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 13,
  padding: 16,
  textAlign: 'center',
};

// 半透明黑色遮罩在浅色和暗色主题下都用于表达模态层级。
const modalMaskStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--modal-backdrop)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  width: 'min(520px, calc(100vw - 32px))',
  boxSizing: 'border-box',
  maxHeight: '90vh',
  overflow: 'auto',
  borderRadius: 12,
  background: 'var(--bg-primary)',
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const createModalStyle: React.CSSProperties = {
  ...modalStyle,
  width: 'min(540px, calc(100vw - 32px))',
  padding: 24,
  gap: 14,
};

const manageModalStyle: React.CSSProperties = {
  width: 'min(960px, calc(100vw - 32px))',
  boxSizing: 'border-box',
  height: 'min(720px, 88vh)',
  maxHeight: '88vh',
  borderRadius: 12,
  background: 'var(--bg-primary)',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  overflow: 'hidden',
};

const manageBodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  paddingRight: 2,
};

const manageFooterStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border-subtle)',
  paddingTop: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexShrink: 0,
};

const compactErrorStyle: React.CSSProperties = {
  color: 'var(--danger)',
  background: 'var(--danger-bg-soft)',
  border: '1px solid var(--danger-border-soft)',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 12,
  lineHeight: 1.4,
};

const modalFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 2,
};

const modalPrimaryButtonStyle: React.CSSProperties = {
  minHeight: 32,
  borderRadius: 8,
  border: '1px solid var(--btn-primary-bg)',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  padding: '0 14px',
  display: 'inline-flex',
  gap: 5,
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontSize: 13,
  fontWeight: 500,
};

const modalSecondaryButtonStyle: React.CSSProperties = {
  ...modalPrimaryButtonStyle,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
};

const formFieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const formLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
  lineHeight: 1.35,
};

const formHelpStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  lineHeight: 1.45,
  marginTop: -2,
};

const summaryStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--bg-tertiary)',
  padding: 10,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 18,
  borderBottom: '1px solid var(--border-subtle)',
  alignItems: 'center',
};

const modalSectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const tokenBoxStyle: React.CSSProperties = {
  border: '1px solid var(--warning-border-soft)',
  background: 'var(--warning-bg-soft)',
  color: 'var(--text-primary)',
  borderRadius: 8,
  padding: 10,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  alignItems: 'center',
};

const tokenDraftStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
  borderRadius: 8,
  padding: 8,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
};

const tokenNameInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
  minWidth: 0,
  height: 30,
  borderRadius: 6,
  padding: '0 9px',
  fontSize: 12,
  lineHeight: 1.3,
};

const tokenDraftErrorStyle: React.CSSProperties = {
  marginTop: 5,
  fontSize: 11,
  lineHeight: 1.35,
  color: 'var(--danger)',
};

const tokenDraftSecondaryButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  minHeight: 30,
  padding: '0 8px',
  fontSize: 12,
};

const tokenDraftPrimaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  minHeight: 30,
  padding: '0 8px',
  fontSize: 12,
};

const subPanelStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--bg-tertiary)',
  padding: 9,
};

const toolSectionStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--bg-secondary)',
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const toolSectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
};

const toolSectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const toolSectionDescriptionStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: 'var(--text-muted)',
  lineHeight: 1.4,
};

const toolSectionCountStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: 12,
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  paddingTop: 1,
};

const toolSectionPackagesStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const toolPackageCardStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--bg-tertiary)',
  overflow: 'hidden',
};

const toolPackageHeaderStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  padding: 10,
};

const toolPackageCheckboxCellStyle: React.CSSProperties = {
  width: 18,
  height: 24,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const checkboxInputStyle: React.CSSProperties = {
  margin: 0,
};

const toolPackageTitleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
};

const toolPackageTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const toolPackageSummaryStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: 'var(--text-muted)',
  lineHeight: 1.45,
};

const toolPackageCountStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: 12,
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  paddingTop: 3,
};

const toolPackageInfoStyle: React.CSSProperties = {
  margin: '0 10px 10px 40px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--bg-secondary)',
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const abilityGroupToolsStyle: React.CSSProperties = {
  margin: '0 10px 10px 40px',
  paddingLeft: 10,
  borderLeft: '1px solid var(--border-subtle)',
};

const metaBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '1px 6px',
  fontSize: 11,
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
};

const infoLineStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '64px 1fr',
  gap: 8,
  fontSize: 12,
  lineHeight: 1.45,
};

const infoLineLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
};

const infoLineValueStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  minWidth: 0,
};

const compactTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  color: 'var(--text-primary)',
};

const compactThStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '7px 6px',
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--text-muted)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const compactCheckThStyle: React.CSSProperties = {
  ...compactThStyle,
  width: 48,
  minWidth: 48,
  maxWidth: 48,
  textAlign: 'center',
};

const toolColumnThStyle: React.CSSProperties = {
  ...compactThStyle,
  width: 220,
  minWidth: 200,
};

const auditToolThStyle: React.CSSProperties = {
  ...compactThStyle,
  width: 220,
  minWidth: 200,
};

const compactTdStyle: React.CSSProperties = {
  padding: '7px 6px',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'middle',
};

const compactCheckTdStyle: React.CSSProperties = {
  ...compactTdStyle,
  width: 48,
  minWidth: 48,
  maxWidth: 48,
  textAlign: 'center',
};

const toolNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};

const toolKeyStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  color: 'var(--text-muted)',
  wordBreak: 'break-all',
};

const toolDescStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  lineHeight: 1.5,
};

const agentToolHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 8,
};

const agentToolSummaryStyle: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
};

const agentToolDescriptionStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: 'var(--text-muted)',
  lineHeight: 1.5,
  wordBreak: 'break-word',
};

const auditErrorMessageStyle: React.CSSProperties = {
  marginTop: 2,
  maxWidth: 220,
  color: 'var(--text-muted)',
  fontSize: 11,
  lineHeight: 1.35,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const auditDetailPanelStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--bg-tertiary)',
  padding: 10,
};

const auditDetailContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const auditDetailMetaGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
};

const auditMetaItemStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  borderRadius: 8,
  padding: '7px 9px',
  minWidth: 0,
};

const auditMetaLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  lineHeight: 1.35,
};

const auditMetaValueStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: 'var(--text-primary)',
  lineHeight: 1.35,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const auditPayloadPanelStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  background: 'var(--bg-secondary)',
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const auditPayloadToolbarStyle: React.CSSProperties = {
  minHeight: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
};

const auditPayloadTabsStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  padding: 2,
  borderRadius: 7,
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-subtle)',
};

const auditPayloadTabButtonStyle = (active: boolean): React.CSSProperties => ({
  minHeight: 24,
  borderRadius: 5,
  border: 'none',
  background: active ? 'var(--btn-primary-bg)' : 'transparent',
  color: active ? 'var(--btn-primary-text)' : 'var(--text-muted)',
  padding: '0 8px',
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

const auditCopyNoticeStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--success)',
  whiteSpace: 'nowrap',
};

const auditPayloadPreStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  height: 220,
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  overflow: 'auto',
  color: 'var(--text-primary)',
  background: 'var(--bg-primary)',
  fontSize: 12,
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const tenantDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 4,
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  // 半透明黑色阴影在浅色和暗色主题下都用于表达浮层高度。
  boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
  maxHeight: 260,
  overflowY: 'auto',
  zIndex: 1001,
};

const selectedTenantStyle: React.CSSProperties = {
  marginTop: 8,
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
  padding: '8px 10px',
};

const selectedTenantMainStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
  lineHeight: 1.4,
};

const selectedTenantMetaStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: 'var(--text-muted)',
  lineHeight: 1.4,
};

const tenantOptionStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '10px 14px',
  border: 'none',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'transparent',
  cursor: 'pointer',
};

export default SuperAdminMcpClientsPage;
