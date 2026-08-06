import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { SuperAdminLayout } from './SuperAdminLayout';
import {
  superAdminApi,
  type SaOpenApiBindingItem,
  type SaOpenApiCallLogItem,
  type SaOpenApiClientDetailResponse,
  type SaOpenApiClientItem,
  type SaOpenApiEndpointItem,
  type SaOpenApiSecretItem,
} from '../../api/superadmin';
import { toast } from '../../utils/toast';
import { SuperAdminSelect } from './SuperAdminSelect';

SyntaxHighlighter.registerLanguage('python', python);

type MainTab = 'clients' | 'endpoints' | 'logs';
type ClientStatusFilter = 'all' | 'ACTIVE' | 'DISABLED';
type DrawerTab = 'overview' | 'tokens' | 'bindings' | 'guide';

type ClientDraft = {
  name: string;
  description: string;
};

const PAGE_SIZE = 20;
const LOG_PAGE_SIZE = 20;

const emptyDraft: ClientDraft = {
  name: '',
  description: '',
};

function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8118';
  }
  return window.location.origin;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
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

function toLogStatusLabel(status: SaOpenApiCallLogItem['status']): string {
  return status === 'SUCCESS' ? '成功' : '失败';
}

function formatDuration(value?: number | null): string {
  if (value === undefined || value === null) {
    return '-';
  }
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(2)} s`;
}

function endpointBindingIds(bindings: SaOpenApiBindingItem[]): Set<string> {
  return new Set(bindings.filter((binding) => binding.enabled).map((binding) => binding.endpointId));
}

function endpointRateLimitDrafts(bindings: SaOpenApiBindingItem[]): Record<string, string> {
  return Object.fromEntries(
    bindings
      .filter((binding) => binding.rateLimitPerMinute != null)
      .map((binding) => [binding.endpointId, String(binding.rateLimitPerMinute)]),
  );
}

function buildPythonExample(endpoint: SaOpenApiEndpointItem, token: string): string {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint.path}`;
  const escapedToken = token.replace(/'/g, "\\'");
  const lines: string[] = [
    'import requests',
    '',
    `BASE_URL = '${baseUrl}'`,
    `TOKEN = '${escapedToken}'`,
    '',
    "headers = {",
    "    'Authorization': f'Bearer {TOKEN}',",
    "    'Content-Type': 'application/json'",
    '}',
    '',
    `# ${endpoint.name}`,
  ];

  const method = endpoint.method.toUpperCase();
  if (method === 'GET') {
    lines.push("params = {");
    lines.push("    # 'key': 'value',");
    lines.push('}');
    lines.push('');
    lines.push('response = requests.get(');
    lines.push(`    '${url}',`);
    lines.push('    headers=headers,');
    lines.push('    params=params');
    lines.push(')');
  } else if (method === 'POST') {
    lines.push('payload = {');
    if (endpoint.code === 'passport_user_mapping_query') {
      lines.push("    'uid': 'PASSPORT_UID',");
    } else {
      lines.push("    # 'key': 'value',");
    }
    lines.push('}');
    lines.push('');
    lines.push('response = requests.post(');
    lines.push(`    '${url}',`);
    lines.push('    headers=headers,');
    lines.push('    json=payload');
    lines.push(')');
  } else {
    lines.push(`response = requests.${method.toLowerCase()}('${url}', headers=headers)`);
  }

  lines.push('');
  lines.push('print(response.status_code)');
  lines.push('print(response.json())');
  return lines.join('\n');
}

export const SuperAdminOpenApiPage: React.FC = () => {
  const [tab, setTab] = useState<MainTab>('clients');
  const [endpoints, setEndpoints] = useState<SaOpenApiEndpointItem[]>([]);
  const [clients, setClients] = useState<SaOpenApiClientItem[]>([]);
  const [clientTotal, setClientTotal] = useState(0);
  const [clientPage, setClientPage] = useState(0);
  const [clientKeyword, setClientKeyword] = useState('');
  const [clientStatus, setClientStatus] = useState<ClientStatusFilter>('all');
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<ClientDraft>(emptyDraft);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const [manageDetail, setManageDetail] = useState<SaOpenApiClientDetailResponse | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');
  const [manageDraft, setManageDraft] = useState<ClientDraft>(emptyDraft);
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<Set<string>>(() => new Set());
  const [endpointRateLimits, setEndpointRateLimits] = useState<Record<string, string>>({});
  const [manageSaving, setManageSaving] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenExpiresAt, setTokenExpiresAt] = useState('');
  const [tokenOnce, setTokenOnce] = useState<string | null>(null);

  const [logs, setLogs] = useState<SaOpenApiCallLogItem[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [logStatus, setLogStatus] = useState<'all' | 'SUCCESS' | 'FAILED'>('all');
  const [logEndpointCode, setLogEndpointCode] = useState('');
  const [logClientId, setLogClientId] = useState('');
  const [logTraceId, setLogTraceId] = useState('');
  const [logRequestId, setLogRequestId] = useState('');
  const [logLoading, setLogLoading] = useState(false);

  const safeEndpoints = useMemo(() => (Array.isArray(endpoints) ? endpoints : []), [endpoints]);
  const endpointById = useMemo(
    () => new Map(safeEndpoints.map((endpoint) => [endpoint.id, endpoint])),
    [safeEndpoints],
  );

  const loadEndpoints = useCallback(async () => {
    const response = await superAdminApi.openApiEndpoints();
    setEndpoints(Array.isArray(response) ? response : []);
  }, []);

  const loadClients = useCallback(async (nextPage = clientPage) => {
    setLoading(true);
    try {
      const response = await superAdminApi.openApiClients({
        keyword: clientKeyword || undefined,
        status: clientStatus === 'all' ? undefined : clientStatus,
        page: nextPage,
        size: PAGE_SIZE,
      });
      setClients(response.items);
      setClientTotal(response.total);
      setClientPage(response.page ?? nextPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载开放接口调用方失败');
    } finally {
      setLoading(false);
    }
  }, [clientKeyword, clientPage, clientStatus]);

  const loadLogs = useCallback(async (nextPage = logPage) => {
    setLogLoading(true);
    try {
      const response = await superAdminApi.openApiCallLogs({
        clientId: logClientId || undefined,
        endpointCode: logEndpointCode || undefined,
        status: logStatus === 'all' ? undefined : logStatus,
        traceId: logTraceId || undefined,
        requestId: logRequestId || undefined,
        page: nextPage,
        size: LOG_PAGE_SIZE,
      });
      setLogs(response.items);
      setLogTotal(response.total);
      setLogPage(response.page ?? nextPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载开放接口调用日志失败');
    } finally {
      setLogLoading(false);
    }
  }, [logClientId, logEndpointCode, logPage, logRequestId, logStatus, logTraceId]);

  useEffect(() => {
    void loadEndpoints();
  }, [loadEndpoints]);

  useEffect(() => {
    void loadClients(0);
  }, [loadClients]);

  useEffect(() => {
    void loadLogs(0);
  }, [loadLogs]);

  const createClient = async () => {
    setDraftError(null);
    if (!draft.name.trim()) {
      setDraftError('调用方名称不能为空');
      return;
    }
    setSavingDraft(true);
    try {
      await superAdminApi.createOpenApiClient({
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
      });
      setCreateOpen(false);
      setDraft(emptyDraft);
      toast.success('调用方已创建');
      await loadClients(0);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : '创建调用方失败');
    } finally {
      setSavingDraft(false);
    }
  };

  const openManage = async (client: SaOpenApiClientItem, initialTab: DrawerTab = 'overview') => {
    const detail = await superAdminApi.openApiClientDetail(client.id);
    setManageDetail(detail);
    setDrawerTab(initialTab);
    setManageDraft({
      name: detail.client.name,
      description: detail.client.description || '',
    });
    setSelectedEndpointIds(endpointBindingIds(detail.bindings));
    setEndpointRateLimits(endpointRateLimitDrafts(detail.bindings));
    setTokenOnce(null);
    setTokenName('');
    setTokenExpiresAt('');
  };

  const saveClientProfile = async () => {
    if (!manageDetail) {
      return;
    }
    setManageSaving(true);
    try {
      const response = await superAdminApi.updateOpenApiClient(manageDetail.client.id, {
        name: manageDraft.name.trim(),
        description: manageDraft.description.trim(),
      });
      setManageDetail(response);
      toast.success('调用方信息已保存');
      await loadClients(clientPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存调用方信息失败');
    } finally {
      setManageSaving(false);
    }
  };

  const saveEndpointBindings = async () => {
    if (!manageDetail) {
      return;
    }
    const rateLimitPerMinuteByEndpointId: Record<string, number> = {};
    for (const endpointId of selectedEndpointIds) {
      const rawValue = endpointRateLimits[endpointId]?.trim();
      if (!rawValue) {
        continue;
      }
      const value = Number(rawValue);
      if (!Number.isInteger(value) || value < 1 || value > 10000) {
        toast.error('每分钟上限必须为 1 到 10000 的整数');
        return;
      }
      rateLimitPerMinuteByEndpointId[endpointId] = value;
    }
    setManageSaving(true);
    try {
      const response = await superAdminApi.updateOpenApiEndpointBindings(manageDetail.client.id, {
        endpointIds: Array.from(selectedEndpointIds),
        rateLimitPerMinuteByEndpointId,
      });
      setManageDetail(response);
      setSelectedEndpointIds(endpointBindingIds(response.bindings));
      setEndpointRateLimits(endpointRateLimitDrafts(response.bindings));
      toast.success('接口授权已保存');
      await loadClients(clientPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存接口授权失败');
    } finally {
      setManageSaving(false);
    }
  };

  const generateToken = async () => {
    if (!manageDetail) {
      return;
    }
    if (!tokenName.trim()) {
      toast.error('Token 名称不能为空');
      return;
    }
    setManageSaving(true);
    try {
      const response = await superAdminApi.generateOpenApiSecret(manageDetail.client.id, {
        name: tokenName.trim(),
        expiresAt: tokenExpiresAt.trim() || undefined,
      });
      const detail = await superAdminApi.openApiClientDetail(manageDetail.client.id);
      setManageDetail(detail);
      setTokenOnce(response.token);
      setTokenName('');
      setTokenExpiresAt('');
      toast.success('Token 已生成，明文仅本次可见');
      await loadClients(clientPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成 Token 失败');
    } finally {
      setManageSaving(false);
    }
  };

  const deleteToken = async (secretId: string) => {
    if (!manageDetail || !window.confirm('确定删除这个 Token？')) {
      return;
    }
    try {
      const response = await superAdminApi.deleteOpenApiSecret(manageDetail.client.id, secretId);
      setManageDetail(response);
      toast.success('Token 已删除');
      await loadClients(clientPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除 Token 失败');
    }
  };

  const toggleClientStatus = async (client: SaOpenApiClientItem) => {
    const nextStatus = client.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await superAdminApi.updateOpenApiClient(client.id, { status: nextStatus });
      toast.success(`调用方已${nextStatus === 'ACTIVE' ? '启用' : '停用'}`);
      await loadClients(clientPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const deleteClient = async (client: SaOpenApiClientItem) => {
    if (!window.confirm(`确定删除调用方 ${client.name}？`)) {
      return;
    }
    try {
      await superAdminApi.deleteOpenApiClient(client.id);
      toast.success('调用方已删除');
      await loadClients(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除调用方失败');
    }
  };

  const toggleEndpoint = (endpointId: string) => {
    setSelectedEndpointIds((prev) => {
      const next = new Set(prev);
      if (next.has(endpointId)) {
        next.delete(endpointId);
      } else {
        next.add(endpointId);
      }
      return next;
    });
  };

  const copyToken = async () => {
    if (!tokenOnce) {
      return;
    }
    try {
      await copyText(tokenOnce);
      toast.success('Token 已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const copyPythonExample = async (endpoint: SaOpenApiEndpointItem) => {
    const token = tokenOnce ?? 'YOUR_TOKEN_HERE';
    const code = buildPythonExample(endpoint, token);
    try {
      await copyText(code);
      toast.success('Python 示例已复制');
    } catch {
      toast.error('复制失败');
    }
  };

  return (
    <SuperAdminLayout>
      <main data-testid="superadmin-open-api-page" className="fi-superadmin-content">
        <div style={pageStyle}>
          <div style={headerStyle}>
            <div>
              <div style={titleStyle}>开放接口管理</div>
              <div style={subtitleStyle}>管理开放 REST 接口调用方、Bearer Token、接口授权和调用审计</div>
            </div>
            <button
              type="button"
              style={headerPrimaryButtonStyle}
              onClick={() => {
                setDraft(emptyDraft);
                setDraftError(null);
                setCreateOpen(true);
              }}
            >
              <Plus size={14} />
              新建调用方
            </button>
          </div>

          <div style={tabBarStyle}>
            <TabButton active={tab === 'clients'} onClick={() => setTab('clients')}>
              调用方
            </TabButton>
            <TabButton active={tab === 'endpoints'} onClick={() => setTab('endpoints')}>
              接口列表
            </TabButton>
            <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>
              调用日志
            </TabButton>
          </div>

          {tab === 'clients' && (
            <>
              <div style={toolbarStyle}>
                <div style={searchInputStyle}>
                  <Search size={16} color="var(--text-muted)" />
                  <input
                    value={clientKeyword}
                    onChange={(event) => setClientKeyword(event.target.value)}
                    placeholder="搜索调用方名称 / 描述"
                    style={searchFieldStyle}
                  />
                </div>
                <SuperAdminSelect
                  value={clientStatus}
                  onChange={setClientStatus}
                  ariaLabel="调用方状态"
                  triggerStyle={{ height: 40 }}
                  options={[
                    { value: 'all', label: '全部状态' },
                    { value: 'ACTIVE', label: '启用' },
                    { value: 'DISABLED', label: '停用' },
                  ]}
                />
                <button type="button" style={{ ...secondaryButtonStyle, height: 40 }} onClick={() => void loadClients(0)} disabled={loading}>
                  <RefreshCw size={14} />
                  查询
                </button>
              </div>

              {loading && (
                <div style={loadingStateStyle}>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={mutedTextStyle}>加载中…</span>
                </div>
              )}

              <section style={panelStyle}>
                <PanelHeader title="调用方列表" meta={loading ? '加载中' : `${clientTotal} 条`} />
                <div style={{ overflowX: 'auto' }}>
                  <table className="sa-table" style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>调用方</th>
                        <th style={thStyle}>状态</th>
                        <th style={thStyle}>授权接口</th>
                        <th style={thStyle}>Token</th>
                        <th style={thStyle}>最近调用</th>
                        <th style={thStyle}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((client) => (
                        <tr key={client.id}>
                          <td style={tdStyle}>
                            <div style={strongTextStyle}>{client.name}</div>
                            <div style={{ ...monoSmallStyle, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={client.id}>
                              {client.id}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <StatusPill tone={client.status === 'ACTIVE' ? 'success' : 'neutral'}>{toStatusLabel(client.status)}</StatusPill>
                          </td>
                          <td style={tdStyle}>{client.enabledEndpointCount}</td>
                          <td style={tdStyle}>{client.activeSecretCount}</td>
                          <td style={tdStyle}>{client.lastUsedAt ? toDateTime(client.lastUsedAt) : '-'}</td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                              <button type="button" style={smallPrimaryButtonStyle} onClick={() => void openManage(client)}>
                                <Settings size={13} />
                                管理
                              </button>
                              <button type="button" style={smallInfoButtonStyle} onClick={() => void openManage(client, 'guide')}>
                                <Code2 size={13} />
                                指南
                              </button>
                              <button
                                type="button"
                                style={client.status === 'ACTIVE' ? smallDangerButtonStyle : smallSuccessButtonStyle}
                                onClick={() => void toggleClientStatus(client)}
                              >
                                {client.status === 'ACTIVE' ? '停用' : '启用'}
                              </button>
                              <button
                                type="button"
                                aria-label={`删除调用方 ${client.name}`}
                                title="删除调用方"
                                style={smallDeleteButtonStyle}
                                onClick={() => void deleteClient(client)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!clients.length && (
                        <tr>
                          <td colSpan={6} style={{ ...tdStyle, padding: 40, textAlign: 'center' }}>
                            <div style={mutedTextStyle}>暂无调用方</div>
                            <button type="button" style={{ ...textButtonStyle, marginTop: 8 }} onClick={() => setCreateOpen(true)}>
                              新建一个调用方
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {clientTotal > PAGE_SIZE && (
                <Pagination
                  page={clientPage}
                  total={clientTotal}
                  size={PAGE_SIZE}
                  onPage={(next) => void loadClients(next)}
                />
              )}
            </>
          )}

          {tab === 'endpoints' && (
            <section style={panelStyle}>
              <PanelHeader title="内置开放接口" meta={`${endpoints.length} 个`} />
              <div style={{ overflowX: 'auto' }}>
                <table className="sa-table" style={tableStyle}>
                  <thead>
                    <tr>
                      <Th>接口</Th>
                      <Th>Code</Th>
                      <Th>方法</Th>
                      <Th>路径</Th>
                      <Th>状态</Th>
                      <Th>更新时间</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeEndpoints.map((endpoint) => (
                      <tr key={endpoint.id}>
                        <Td>
                          <div style={strongTextStyle}>{endpoint.name}</div>
                          <div style={mutedTextStyle}>{endpoint.description || '-'}</div>
                        </Td>
                        <Td><span style={monoSmallStyle}>{endpoint.code}</span></Td>
                        <Td><MethodPill>{endpoint.method}</MethodPill></Td>
                        <Td><span style={monoSmallStyle}>{endpoint.path}</span></Td>
                        <Td><StatusPill tone={endpoint.status === 'ACTIVE' ? 'success' : 'neutral'}>{toStatusLabel(endpoint.status)}</StatusPill></Td>
                        <Td>{toDateTime(endpoint.updatedAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'logs' && (
            <>
              <div style={toolbarStyle}>
                <SuperAdminSelect
                  value={logEndpointCode}
                  onChange={setLogEndpointCode}
                  ariaLabel="接口"
                  triggerStyle={{ height: 40 }}
                  options={[
                    { value: '', label: '全部接口' },
                    ...safeEndpoints.map((endpoint) => ({ value: endpoint.code, label: endpoint.name })),
                  ]}
                />
                <SuperAdminSelect
                  value={logStatus}
                  onChange={setLogStatus}
                  ariaLabel="调用结果"
                  triggerStyle={{ height: 40 }}
                  options={[
                    { value: 'all', label: '全部结果' },
                    { value: 'SUCCESS', label: '成功' },
                    { value: 'FAILED', label: '失败' },
                  ]}
                />
                <input
                  value={logClientId}
                  onChange={(event) => setLogClientId(event.target.value)}
                  placeholder="调用方 ID"
                  style={inputStyle}
                />
                <input
                  value={logTraceId}
                  onChange={(event) => setLogTraceId(event.target.value)}
                  placeholder="Trace ID"
                  style={inputStyle}
                />
                <input
                  value={logRequestId}
                  onChange={(event) => setLogRequestId(event.target.value)}
                  placeholder="Request ID"
                  style={inputStyle}
                />
                <button type="button" style={{ ...secondaryButtonStyle, height: 40 }} onClick={() => void loadLogs(0)}>
                  <RefreshCw size={14} />
                  查询
                </button>
              </div>
              <section style={panelStyle}>
                <PanelHeader title="调用日志" meta={logLoading ? '加载中' : `${logTotal} 条`} />
                <div style={{ overflowX: 'auto' }}>
                  <table className="sa-table" style={tableStyle}>
                    <thead>
                      <tr>
                        <Th>时间</Th>
                        <Th>调用方</Th>
                        <Th>接口</Th>
                        <Th>结果</Th>
                        <Th>HTTP</Th>
                        <Th>耗时</Th>
                        <Th>IP</Th>
                        <Th>参数</Th>
                        <Th>Trace</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <Td>{toDateTime(log.createdAt)}</Td>
                          <Td>
                            <div>{log.clientName || '-'}</div>
                            <div style={mutedTextStyle}>{log.clientId || '-'}</div>
                          </Td>
                          <Td>
                            <div>{log.endpointName || log.endpointCode}</div>
                            <div style={mutedTextStyle}>{log.method} {log.path}</div>
                          </Td>
                          <Td><StatusPill tone={log.status === 'SUCCESS' ? 'success' : 'danger'}>{toLogStatusLabel(log.status)}</StatusPill></Td>
                          <Td>{log.httpStatus || '-'}</Td>
                          <Td>{formatDuration(log.durationMs)}</Td>
                          <Td><span style={monoSmallStyle}>{log.requestIp || '-'}</span></Td>
                          <Td><span style={monoSmallStyle}>{log.queryParams || '-'}</span></Td>
                          <Td>
                            <div style={monoSmallStyle}>{log.traceId || '-'}</div>
                            {log.errorCode && <div style={dangerTextStyle}>{log.errorCode}: {log.errorMessage}</div>}
                          </Td>
                        </tr>
                      ))}
                      {!logs.length && (
                        <tr><Td colSpan={9}><span style={mutedTextStyle}>暂无调用日志</span></Td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination page={logPage} total={logTotal} size={LOG_PAGE_SIZE} onPage={(next) => void loadLogs(next)} />
              </section>
            </>
          )}
        </div>
      </main>

      {createOpen && (
        <ClientCreateModal
          draft={draft}
          error={draftError}
          saving={savingDraft}
          onClose={() => setCreateOpen(false)}
          onDraftChange={setDraft}
          onSave={() => void createClient()}
        />
      )}

      {manageDetail && (
        <ManageDrawer
          detail={manageDetail}
          drawerTab={drawerTab}
          onTabChange={setDrawerTab}
          draft={manageDraft}
          selectedEndpointIds={selectedEndpointIds}
          endpointRateLimits={endpointRateLimits}
          endpointById={endpointById}
          tokenName={tokenName}
          tokenExpiresAt={tokenExpiresAt}
          tokenOnce={tokenOnce}
          saving={manageSaving}
          onClose={() => setManageDetail(null)}
          onDraftChange={setManageDraft}
          onToggleEndpoint={toggleEndpoint}
          onRateLimitChange={(endpointId, value) => setEndpointRateLimits((current) => ({
            ...current,
            [endpointId]: value,
          }))}
          onSaveProfile={() => void saveClientProfile()}
          onSaveBindings={() => void saveEndpointBindings()}
          onTokenNameChange={setTokenName}
          onTokenExpiresAtChange={setTokenExpiresAt}
          onGenerateToken={() => void generateToken()}
          onCopyToken={() => void copyToken()}
          onDeleteToken={(secretId) => void deleteToken(secretId)}
          onCopyPythonExample={(endpoint) => void copyPythonExample(endpoint)}
        />
      )}
    </SuperAdminLayout>
  );
};

const ClientCreateModal: React.FC<{
  draft: ClientDraft;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onDraftChange: (draft: ClientDraft) => void;
  onSave: () => void;
}> = ({ draft, error, saving, onClose, onDraftChange, onSave }) => (
  <div style={modalMaskStyle} onClick={onClose}>
    <div style={smallModalStyle} onClick={(event) => event.stopPropagation()}>
      <ModalHeader title="新建调用方" onClose={onClose} />
      <FormGrid draft={draft} onDraftChange={onDraftChange} />
      {error && <div style={errorStyle}>{error}</div>}
      <div style={modalFooterStyle}>
        <button type="button" style={secondaryButtonStyle} onClick={onClose}>取消</button>
        <button type="button" style={primaryButtonStyle} onClick={onSave} disabled={saving}>
          <Save size={14} />
          保存
        </button>
      </div>
    </div>
  </div>
);

const ManageDrawer: React.FC<{
  detail: SaOpenApiClientDetailResponse;
  drawerTab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  draft: ClientDraft;
  selectedEndpointIds: Set<string>;
  endpointRateLimits: Record<string, string>;
  endpointById: Map<string, SaOpenApiEndpointItem>;
  tokenName: string;
  tokenExpiresAt: string;
  tokenOnce: string | null;
  saving: boolean;
  onClose: () => void;
  onDraftChange: (draft: ClientDraft) => void;
  onToggleEndpoint: (endpointId: string) => void;
  onRateLimitChange: (endpointId: string, value: string) => void;
  onSaveProfile: () => void;
  onSaveBindings: () => void;
  onTokenNameChange: (value: string) => void;
  onTokenExpiresAtChange: (value: string) => void;
  onGenerateToken: () => void;
  onCopyToken: () => void;
  onDeleteToken: (secretId: string) => void;
  onCopyPythonExample: (endpoint: SaOpenApiEndpointItem) => void;
}> = ({
  detail,
  drawerTab,
  onTabChange,
  draft,
  selectedEndpointIds,
  endpointRateLimits,
  endpointById,
  tokenName,
  tokenExpiresAt,
  tokenOnce,
  saving,
  onClose,
  onDraftChange,
  onToggleEndpoint,
  onRateLimitChange,
  onSaveProfile,
  onSaveBindings,
  onTokenNameChange,
  onTokenExpiresAtChange,
  onGenerateToken,
  onCopyToken,
  onDeleteToken,
  onCopyPythonExample,
}) => {
  const drawerEndpoints = useMemo(
    () => (Array.isArray(detail.endpoints) ? detail.endpoints : []),
    [detail.endpoints],
  );
  const enabledEndpoints = useMemo(
    () => drawerEndpoints.filter((endpoint) => selectedEndpointIds.has(endpoint.id)),
    [drawerEndpoints, selectedEndpointIds],
  );

  return (
    <div style={drawerMaskStyle} onClick={onClose}>
      <div style={drawerStyle} onClick={(event) => event.stopPropagation()}>
        <div style={drawerHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={drawerTitleStyle}>{detail.client.name}</div>
            <div style={drawerSubtitleStyle}>{detail.client.id}</div>
          </div>
          <button type="button" style={iconButtonStyle} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={drawerTabsStyle}>
          {[
            { key: 'overview', label: '概览' },
            { key: 'tokens', label: 'Token' },
            { key: 'bindings', label: '授权' },
            { key: 'guide', label: '接入指南' },
          ].map((t) => (
            <DrawerTabButton
              key={t.key}
              active={drawerTab === t.key}
              onClick={() => onTabChange(t.key as DrawerTab)}
            >
              {t.label}
            </DrawerTabButton>
          ))}
        </div>

        <div style={drawerContentStyle}>
          {drawerTab === 'overview' && (
            <div style={drawerSectionStackStyle}>
              <section style={drawerSectionStyle}>
                <SectionHeader title="基础信息" desc="维护调用方名称和接入备注" />
                <FormGrid draft={draft} onDraftChange={onDraftChange} />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" style={primaryButtonStyle} onClick={onSaveProfile} disabled={saving}>
                    <Save size={14} />
                    保存
                  </button>
                </div>
              </section>

              <section style={drawerSectionStyle}>
                <SectionHeader title="状态信息" desc="调用方的基本状态与统计" />
                <div style={overviewGridStyle}>
                  <OverviewItem label="状态" value={toStatusLabel(detail.client.status)} />
                  <OverviewItem label="授权接口" value={`${selectedEndpointIds.size}`} />
                  <OverviewItem label="Token 数量" value={`${detail.secrets.length}`} />
                  <OverviewItem label="最近调用" value={toDateTime(detail.client.lastUsedAt)} />
                  <OverviewItem label="创建时间" value={toDateTime(detail.client.createdAt)} />
                  <OverviewItem label="更新时间" value={toDateTime(detail.client.updatedAt)} />
                </div>
              </section>
            </div>
          )}

          {drawerTab === 'tokens' && (
            <div style={drawerSectionStackStyle}>
              <section style={drawerSectionStyle}>
                <SectionHeader title="生成 Token" desc="明文 Token 仅在生成后显示一次" />
                {tokenOnce && (
                  <div style={tokenOnceStyle}>
                    <span style={monoTextStyle}>{tokenOnce}</span>
                    <button type="button" style={smallPrimaryButtonStyle} onClick={onCopyToken}>
                      <Copy size={13} />
                      复制
                    </button>
                  </div>
                )}
                <div style={tokenCreateStyle}>
                  <input
                    value={tokenName}
                    onChange={(event) => onTokenNameChange(event.target.value)}
                    placeholder="Token 名称"
                    style={{ ...inputStyle, minWidth: 0 }}
                  />
                  <input
                    value={tokenExpiresAt}
                    onChange={(event) => onTokenExpiresAtChange(event.target.value)}
                    placeholder="过期时间 ISO，可为空"
                    style={{ ...inputStyle, minWidth: 0 }}
                  />
                  <button type="button" style={primaryButtonStyle} onClick={onGenerateToken} disabled={saving}>
                    <KeyRound size={14} />
                    生成
                  </button>
                </div>
              </section>

              <section style={drawerSectionStyle}>
                <SectionHeader title="已有 Token" desc="已生成的 Token 列表" />
                {detail.secrets.length === 0 ? (
                  <div style={emptyPanelStyle}>暂无 Token</div>
                ) : (
                  <div style={tokenListStyle}>
                    {detail.secrets.map((secret) => (
                      <SecretRow key={secret.id} secret={secret} onDelete={() => onDeleteToken(secret.id)} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {drawerTab === 'bindings' && (
            <section style={drawerSectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <SectionHeader title="接口授权" desc="勾选需要开放的接口并保存" />
                <button type="button" style={primaryButtonStyle} onClick={onSaveBindings} disabled={saving}>
                  <Save size={14} />
                  保存
                </button>
              </div>
              <div style={endpointListStyle}>
                {drawerEndpoints.map((endpoint) => (
                  <div
                    key={endpoint.id}
                    style={selectedEndpointIds.has(endpoint.id) ? endpointOptionActiveStyle : endpointOptionStyle}
                  >
                    <label style={endpointToggleStyle}>
                      <span style={checkboxStyle}>
                        {selectedEndpointIds.has(endpoint.id) && (
                          <Check size={12} color="var(--btn-primary-text)" />
                        )}
                      </span>
                      <input
                        type="checkbox"
                        checked={selectedEndpointIds.has(endpoint.id)}
                        onChange={() => onToggleEndpoint(endpoint.id)}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={endpointNameStyle}>{endpoint.name}</span>
                        <span style={endpointMetaStyle}>{endpoint.code} · {endpoint.method} {endpoint.path}</span>
                      </span>
                    </label>
                    <label style={rateLimitFieldStyle}>
                      <span style={rateLimitLabelStyle}>每分钟上限</span>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        step={1}
                        value={endpointRateLimits[endpoint.id] ?? ''}
                        onChange={(event) => onRateLimitChange(endpoint.id, event.target.value)}
                        placeholder="默认 60"
                        disabled={!selectedEndpointIds.has(endpoint.id)}
                        style={rateLimitInputStyle}
                      />
                    </label>
                  </div>
                ))}
                {detail.bindings
                  .filter((binding) => !endpointById.has(binding.endpointId))
                  .map((binding) => (
                    <div key={binding.id} style={endpointOptionStyle}>
                      <span style={mutedTextStyle}>未知接口：{binding.endpointId}</span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {drawerTab === 'guide' && (
            <div style={drawerSectionStackStyle}>
              <div style={infoBannerStyle}>
                <Code2 size={16} color="var(--info)" />
                <span style={infoBannerTextStyle}>
                  {tokenOnce
                    ? '示例代码已自动填充当前站点地址与刚生成的 Token'
                    : '示例代码已自动填充当前站点地址，请替换 Token 和请求参数'}
                </span>
              </div>

              {enabledEndpoints.length === 0 ? (
                <div style={emptyPanelStyle}>
                  暂无已授权接口，请先在「授权」标签页勾选接口
                </div>
              ) : (
                enabledEndpoints.map((endpoint) => (
                  <PythonExampleCard
                    key={endpoint.id}
                    endpoint={endpoint}
                    token={tokenOnce ?? 'YOUR_TOKEN_HERE'}
                    onCopy={() => onCopyPythonExample(endpoint)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SecretRow: React.FC<{ secret: SaOpenApiSecretItem; onDelete: () => void }> = ({ secret, onDelete }) => (
  <div style={tokenRowStyle}>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={strongTextStyle}>{secret.name}</div>
      <div style={mutedTextStyle}>过期：{toDateTime(secret.expiresAt)} · 前缀 {secret.secretPrefix || '-'}</div>
    </div>
    <div style={mutedTextStyle}>{toDateTime(secret.lastUsedAt)}</div>
    <button type="button" style={smallDangerButtonStyle} onClick={onDelete}>
      <Trash2 size={13} />
      删除
    </button>
  </div>
);

const PythonExampleCard: React.FC<{
  endpoint: SaOpenApiEndpointItem;
  token: string;
  onCopy: () => void;
}> = ({ endpoint, token, onCopy }) => {
  const code = useMemo(
    () => buildPythonExample(endpoint, token),
    [endpoint, token],
  );

  return (
    <section style={drawerSectionStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={drawerSectionTitleStyle}>{endpoint.name}</div>
          <div style={drawerSectionDescStyle}>{endpoint.code} · {endpoint.method} {endpoint.path}</div>
        </div>
        <button type="button" style={smallPrimaryButtonStyle} onClick={onCopy}>
          <Copy size={13} />
          复制示例
        </button>
      </div>
      <div style={codeBlockWrapperStyle}>
        <SyntaxHighlighter
          language="python"
          style={vscDarkPlus}
          customStyle={codeBlockStyle}
          showLineNumbers
          lineNumberStyle={{ color: '#71717A', minWidth: '2.5em' }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </section>
  );
};

const FormGrid: React.FC<{ draft: ClientDraft; onDraftChange: (draft: ClientDraft) => void }> = ({
  draft,
  onDraftChange,
}) => (
  <div style={formGridStyle}>
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>调用方名称</span>
      <input
        value={draft.name}
        onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
        placeholder="请输入调用方名称"
        style={inputStyle}
      />
    </label>
    <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
      <span style={fieldLabelStyle}>描述</span>
      <textarea
        value={draft.description}
        onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
        placeholder="可选，描述该调用方的使用场景"
        style={textareaStyle}
      />
    </label>
  </div>
);

const SectionHeader: React.FC<{ title: string; desc?: string }> = ({ title, desc }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={drawerSectionTitleStyle}>{title}</div>
    {desc && <div style={drawerSectionDescStyle}>{desc}</div>}
  </div>
);

const OverviewItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={overviewItemStyle}>
    <div style={overviewItemLabelStyle}>{label}</div>
    <div style={overviewItemValueStyle}>{value}</div>
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button type="button" onClick={onClick} style={active ? activeTabStyle : tabStyle}>
    {children}
  </button>
);

const DrawerTabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button type="button" onClick={onClick} style={active ? activeDrawerTabStyle : drawerTabStyle}>
    {children}
  </button>
);

const PanelHeader: React.FC<{ title: string; meta?: string }> = ({ title, meta }) => (
  <div style={panelHeaderStyle}>
    <span>{title}</span>
    {meta && <span style={mutedTextStyle}>{meta}</span>}
  </div>
);

const ModalHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div style={modalHeaderStyle}>
    <span>{title}</span>
    <button type="button" style={iconButtonStyle} onClick={onClose}>
      <X size={16} />
    </button>
  </div>
);

const Pagination: React.FC<{ page: number; total: number; size: number; onPage: (page: number) => void }> = ({
  page,
  total,
  size,
  onPage,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / size));
  return (
    <div style={paginationStyle}>
      <span>第 {page + 1} / {totalPages} 页</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={secondaryButtonStyle} disabled={page <= 0} onClick={() => onPage(page - 1)}>
          上一页
        </button>
        <button
          type="button"
          style={secondaryButtonStyle}
          disabled={page + 1 >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => <th style={thStyle}>{children}</th>;
const Td: React.FC<{ children: React.ReactNode; colSpan?: number }> = ({ children, colSpan }) => (
  <td colSpan={colSpan} style={tdStyle}>{children}</td>
);

const StatusPill: React.FC<{ tone: 'success' | 'danger' | 'neutral'; children: React.ReactNode }> = ({
  tone,
  children,
}) => (
  <span
    style={{
      ...pillStyle,
      ...(tone === 'success'
        ? { color: 'var(--success)', background: 'var(--success-bg-soft)' }
        : tone === 'danger'
          ? { color: 'var(--danger)', background: 'var(--danger-bg-soft)' }
          : { color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }),
    }}
  >
    {children}
  </span>
);

const MethodPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ ...pillStyle, color: 'var(--info)', background: 'var(--info-bg-soft)' }}>{children}</span>
);

const pageStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflowY: 'auto',
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  lineHeight: '28px',
  color: 'var(--text-primary)',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--text-muted)',
  marginTop: 4,
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  borderBottom: '1px solid var(--border-subtle)',
};

const tabStyle: React.CSSProperties = {
  height: 38,
  padding: '0 16px',
  border: 'none',
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 14,
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  color: 'var(--text-primary)',
  borderBottomColor: 'var(--btn-mono-bg)',
  fontWeight: 600,
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: 14,
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  background: 'var(--bg-secondary)',
};

const searchInputStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: 280,
  height: 40,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
};

const searchFieldStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
};

const inputStyle: React.CSSProperties = {
  height: 40,
  minWidth: 180,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  fontSize: 14,
};

const textareaStyle: React.CSSProperties = {
  minHeight: 80,
  padding: 12,
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  fontSize: 14,
  resize: 'vertical',
};

const primaryButtonStyle: React.CSSProperties = {
  height: 36,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid var(--btn-mono-bg)',
  background: 'var(--btn-mono-bg)',
  color: 'var(--btn-mono-text)',
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const headerPrimaryButtonStyle: React.CSSProperties = {
  minHeight: 30,
  padding: '0 9px',
  borderRadius: 6,
  border: '1px solid var(--btn-primary-bg)',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const infoButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  color: 'var(--info)',
  borderColor: 'var(--info-border-soft)',
  background: 'var(--info-bg-soft)',
};

const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  color: 'var(--danger)',
  borderColor: 'var(--danger-border-soft)',
  background: 'var(--danger-bg-soft)',
};

const successButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  color: 'var(--success)',
  borderColor: 'var(--success-border-soft)',
  background: 'var(--success-bg-soft)',
};

const smallPrimaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  height: 32,
  padding: '0 12px',
  fontSize: 12,
};

const smallDangerButtonStyle: React.CSSProperties = {
  ...dangerButtonStyle,
  height: 32,
  padding: '0 12px',
  fontSize: 12,
};

const smallSuccessButtonStyle: React.CSSProperties = {
  ...successButtonStyle,
  height: 32,
  padding: '0 12px',
  fontSize: 12,
};

const smallInfoButtonStyle: React.CSSProperties = {
  ...infoButtonStyle,
  height: 32,
  padding: '0 12px',
  fontSize: 12,
};

const smallDeleteButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  width: 32,
  height: 32,
  padding: 0,
  justifyContent: 'center',
  color: 'var(--danger)',
  borderColor: 'var(--danger-border-soft)',
  background: 'transparent',
};

const iconButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  cursor: 'pointer',
};

const textButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--btn-primary-bg)',
  fontSize: 13,
  cursor: 'pointer',
  textDecoration: 'underline',
};

const mutedTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
};

const strongTextStyle: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const monoSmallStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  fontSize: 12,
  color: 'var(--text-muted)',
};

const monoTextStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  fontSize: 13,
  color: 'var(--text-primary)',
  wordBreak: 'break-all',
};

const dangerTextStyle: React.CSSProperties = {
  marginTop: 4,
  color: 'var(--danger)',
  fontSize: 12,
};

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 24,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
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
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 980,
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'middle',
};

const paginationStyle: React.CSSProperties = {
  minHeight: 48,
  padding: '0 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderTop: '1px solid var(--border-subtle)',
  color: 'var(--text-muted)',
  fontSize: 13,
};

const modalMaskStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'var(--modal-backdrop)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

const smallModalStyle: React.CSSProperties = {
  width: 'min(460px, 100%)',
  maxHeight: '88vh',
  overflowY: 'auto',
  borderRadius: 16,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  boxShadow: 'var(--modal-shadow)',
};

const modalHeaderStyle: React.CSSProperties = {
  minHeight: 56,
  padding: '0 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const modalFooterStyle: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  borderTop: '1px solid var(--border-subtle)',
};

const formGridStyle: React.CSSProperties = {
  padding: 20,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 16,
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-primary)',
};

const errorStyle: React.CSSProperties = {
  margin: '0 20px 16px',
  padding: '10px 12px',
  borderRadius: 8,
  color: 'var(--danger)',
  background: 'var(--danger-bg-soft)',
  fontSize: 13,
};

const drawerMaskStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'var(--modal-backdrop)',
  display: 'flex',
  justifyContent: 'flex-end',
};

const drawerStyle: React.CSSProperties = {
  width: 'min(520px, 100vw)',
  height: '100vh',
  background: 'var(--bg-secondary)',
  borderLeft: '1px solid var(--border-subtle)',
  boxShadow: 'var(--modal-shadow)',
  display: 'flex',
  flexDirection: 'column',
  animation: 'slideInRight 200ms ease-out',
};

const drawerHeaderStyle: React.CSSProperties = {
  minHeight: 64,
  padding: '0 20px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  flexShrink: 0,
};

const drawerTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const drawerSubtitleStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  color: 'var(--text-muted)',
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const drawerTabsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: '0 20px',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
};

const drawerTabStyle: React.CSSProperties = {
  height: 42,
  padding: '0 14px',
  border: 'none',
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 14,
};

const activeDrawerTabStyle: React.CSSProperties = {
  ...drawerTabStyle,
  color: 'var(--text-primary)',
  borderBottomColor: 'var(--btn-mono-bg)',
  fontWeight: 600,
};

const drawerContentStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: 20,
};

const drawerSectionStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const drawerSectionStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 12,
  background: 'var(--bg-tertiary)',
  padding: 18,
};

const drawerSectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const drawerSectionDescStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  marginTop: 4,
};

const overviewGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
};

const overviewItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  borderRadius: 8,
  background: 'var(--bg-secondary)',
};

const overviewItemLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const overviewItemValueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const tokenOnceStyle: React.CSSProperties = {
  marginBottom: 14,
  padding: 12,
  borderRadius: 8,
  border: '1px solid var(--success-border-soft)',
  background: 'var(--success-bg-soft)',
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  justifyContent: 'space-between',
};

const tokenCreateStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'center',
};

const tokenListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const tokenRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  borderRadius: 8,
  background: 'var(--bg-secondary)',
};

const endpointListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const endpointOptionStyle: React.CSSProperties = {
  position: 'relative',
  minHeight: 56,
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 96px',
  alignItems: 'flex-start',
  gap: 12,
};

const endpointOptionActiveStyle: React.CSSProperties = {
  ...endpointOptionStyle,
  borderColor: 'var(--info-border-soft)',
  background: 'var(--info-bg-soft)',
};

const endpointToggleStyle: React.CSSProperties = {
  minWidth: 0,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  cursor: 'pointer',
};

const checkboxStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 4,
  background: 'var(--btn-mono-bg)',
  color: 'var(--btn-mono-text)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  marginTop: 2,
};

const endpointNameStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const endpointMetaStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 2,
  fontSize: 12,
  color: 'var(--text-muted)',
  wordBreak: 'break-all',
};

const rateLimitFieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const rateLimitLabelStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: '16px',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
};

const rateLimitInputStyle: React.CSSProperties = {
  width: 96,
  height: 30,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  fontSize: 12,
};

const infoBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 12,
  borderRadius: 8,
  background: 'var(--info-bg-soft)',
  border: '1px solid var(--info-border-soft)',
};

const infoBannerTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--info)',
};

const emptyPanelStyle: React.CSSProperties = {
  padding: 32,
  borderRadius: 8,
  border: '1px dashed var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-muted)',
  fontSize: 13,
  textAlign: 'center',
};

const codeBlockWrapperStyle: React.CSSProperties = {
  borderRadius: 8,
  overflow: 'hidden',
  marginTop: 14,
};

const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.6,
  background: '#0F172A',
};

const loadingStateStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: 24,
  color: 'var(--text-muted)',
};

export default SuperAdminOpenApiPage;
