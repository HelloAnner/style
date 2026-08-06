import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  superAdminApi,
  type SaAgentToolPolicyItem,
  type SaAgentToolPolicyResponse,
} from '../../api/superadmin';
import { SuperAdminSelect } from './SuperAdminSelect';

const BUILTIN_AGENT_OPTIONS = [
  { value: 'business_insight', label: '客户洞察' },
  { value: 'risk_insight', label: '风险管理' },
  { value: 'opinion_insight', label: '舆情监控' },
];

function toolLabel(tool: SaAgentToolPolicyItem): string {
  return tool.displayName || tool.name;
}

function toolCategoryKey(tool: SaAgentToolPolicyItem): string {
  return tool.category || '';
}

function toolCategoryLabel(tool: SaAgentToolPolicyItem): string {
  return tool.category || '未分类';
}

export const SuperAdminAgentToolPolicy: React.FC = () => {
  const [businessId, setBusinessId] = useState(BUILTIN_AGENT_OPTIONS[0].value);
  const [toolPolicy, setToolPolicy] = useState<SaAgentToolPolicyResponse | null>(null);
  const [enabledTools, setEnabledTools] = useState<Set<string>>(() => new Set());
  const [toolKeyword, setToolKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用 ref 保留最新值供 debounced save 使用
  const enabledToolsRef = useRef(enabledTools);
  enabledToolsRef.current = enabledTools;
  const businessIdRef = useRef(businessId);
  businessIdRef.current = businessId;
  const toolPolicyRef = useRef(toolPolicy);
  toolPolicyRef.current = toolPolicy;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const currentAgentLabel = BUILTIN_AGENT_OPTIONS.find((o) => o.value === businessId)?.label || businessId;

  const sortedTools = useMemo(() => {
    if (!toolPolicy) return [];
    return [...toolPolicy.tools].sort((a, b) => {
      const cat = toolCategoryLabel(a).localeCompare(toolCategoryLabel(b), 'zh-CN');
      if (cat !== 0) return cat;
      const lbl = toolLabel(a).localeCompare(toolLabel(b), 'zh-CN');
      return lbl !== 0 ? lbl : a.name.localeCompare(b.name);
    });
  }, [toolPolicy]);

  const filteredTools = useMemo(() => {
    const kw = toolKeyword.trim().toLowerCase();
    if (!kw) return sortedTools;
    return sortedTools.filter((t) =>
      [t.name, t.displayName, t.description, t.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(kw)
    );
  }, [sortedTools, toolKeyword]);

  const groupedTools = useMemo(() => {
    const groups: Array<{ key: string; label: string; tools: SaAgentToolPolicyItem[] }> = [];
    const map = new Map<string, { key: string; label: string; tools: SaAgentToolPolicyItem[] }>();
    filteredTools.forEach((tool) => {
      const key = toolCategoryKey(tool);
      let g = map.get(key);
      if (!g) {
        g = { key, label: toolCategoryLabel(tool), tools: [] };
        map.set(key, g);
        groups.push(g);
      }
      g.tools.push(tool);
    });
    return groups;
  }, [filteredTools]);

  const categoryStats = useMemo(() => {
    const stats = new Map<string, { total: number; enabled: number }>();
    sortedTools.forEach((tool) => {
      const key = toolCategoryKey(tool);
      const cur = stats.get(key) || { total: 0, enabled: 0 };
      cur.total += 1;
      if (enabledTools.has(tool.name)) cur.enabled += 1;
      stats.set(key, cur);
    });
    return stats;
  }, [enabledTools, sortedTools]);

  const loadPolicy = useCallback(async (bid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminApi.agentToolPolicy(bid);
      setToolPolicy(res);
      setEnabledTools(new Set(res.assets));
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取工具策略失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolicy(businessId);
  }, [loadPolicy, businessId]);

  // 自动保存：debounce 500ms
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (savingRef.current) return;
      const bid = businessIdRef.current;
      const tp = toolPolicyRef.current;
      const et = enabledToolsRef.current;
      const assets = tp
        ? tp.tools.map((t) => t.name).filter((n) => et.has(n))
        : Array.from(et);
      savingRef.current = true;
      setSaving(true);
      try {
        const res = await superAdminApi.updateAgentToolPolicy(bid, { assets });
        setToolPolicy(res);
        setEnabledTools(new Set(res.assets));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '自动保存失败');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    }, 500);
  }, []);

  const toggleTool = useCallback((toolName: string) => {
    setEnabledTools((cur) => {
      const next = new Set(cur);
      if (next.has(toolName)) next.delete(toolName);
      else next.add(toolName);
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const setCategory = useCallback((categoryKey: string, enabled: boolean) => {
    if (!toolPolicy) return;
    const names = toolPolicy.tools
      .filter((t) => toolCategoryKey(t) === categoryKey)
      .map((t) => t.name);
    setEnabledTools((cur) => {
      const next = new Set(cur);
      names.forEach((n) => (enabled ? next.add(n) : next.delete(n)));
      return next;
    });
    scheduleSave();
  }, [toolPolicy, scheduleSave]);

  return (
    <div
      className="sa-agents-card"
      data-testid="superadmin-agent-tool-policy"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
    >
      {/* 头部 */}
      <div className="sa-agents-card-header" data-testid="superadmin-agent-tool-policy-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="sa-agents-section-title">工具白名单</span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 12px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
          }}>
            {currentAgentLabel}
          </span>
          {saving && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>保存中...</span>
          )}
        </div>
        <div className="sa-agents-toolbar" data-testid="superadmin-agent-tool-policy-toolbar">
          <SuperAdminSelect
            value={businessId}
            onChange={(nextBusinessId) => {
              if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
              setBusinessId(nextBusinessId);
            }}
            ariaLabel="内置智能体"
            options={BUILTIN_AGENT_OPTIONS}
          />
          <button className="sa-agents-btn" disabled={loading} onClick={() => void loadPolicy(businessId)}>
            刷新
          </button>
        </div>
      </div>

      {/* 统计摘要 */}
      {toolPolicy && (
        <div className="sa-agents-stats-row" data-testid="superadmin-agent-tool-policy-stats">
          <div className="sa-agents-stat">
            <span className="sa-agents-stat-label">策略模式</span>
            <span className="sa-agents-stat-value">{toolPolicy.policyType === 'enabled' ? '白名单' : toolPolicy.policyType}</span>
          </div>
          <div className="sa-agents-stat">
            <span className="sa-agents-stat-label">已启用工具</span>
            <span className="sa-agents-stat-value">{enabledTools.size} / {toolPolicy.tools.length}</span>
          </div>
          <div className="sa-agents-stat">
            <span className="sa-agents-stat-label">业务 ID</span>
            <span className="sa-agents-stat-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{toolPolicy.agentBusinessId}</span>
          </div>
        </div>
      )}

      {/* 消息 */}
      {error && <div className="sa-agents-alert error">{error}</div>}

      {/* 工具搜索 */}
      {toolPolicy && (
        <div className="sa-agents-tool-search" data-testid="superadmin-agent-tool-policy-search">
          <input
            className="sa-agents-search-input"
            value={toolKeyword}
            onChange={(e) => setToolKeyword(e.target.value)}
            placeholder="搜索工具名称、分类或描述..."
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            显示 {filteredTools.length} 个
          </span>
        </div>
      )}

      {/* 工具列表 — flex:1 自动撑满剩余高度 */}
      {toolPolicy && (
        <div
          className="sa-agents-tool-list"
          data-testid="superadmin-agent-tool-policy-list"
          style={{ flex: 1, overflow: 'auto', minHeight: 0 }}
        >
          {groupedTools.map((group) => {
            const stats = categoryStats.get(group.key);
            return (
              <div
                key={group.key}
                className="sa-agents-tool-category-group"
                data-testid={`superadmin-agent-tool-policy-category-${group.key || 'uncategorized'}`}
              >
                <div className="sa-agents-category-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="sa-agents-category-name">{group.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      已启用 {stats?.enabled ?? 0} / {stats?.total ?? group.tools.length}
                    </span>
                  </div>
                  <div className="sa-agents-category-actions">
                    <button onClick={() => setCategory(group.key, true)}>全开</button>
                    <button onClick={() => setCategory(group.key, false)}>全关</button>
                  </div>
                </div>
                {group.tools.map((tool) => {
                  const on = enabledTools.has(tool.name);
                  return (
                    <div key={tool.name} className="sa-agents-tool-row">
                      <button
                        className={`sa-agents-toggle ${on ? 'on' : 'off'}`}
                        onClick={() => toggleTool(tool.name)}
                        role="switch"
                        aria-checked={on}
                      >
                        <span className="sa-agents-toggle-knob" />
                      </button>
                      <div>
                        <div className="sa-agents-tool-name">{toolLabel(tool)}</div>
                        <div className="sa-agents-tool-id">{tool.name}</div>
                      </div>
                      <div className="sa-agents-tool-category">{tool.category || '-'}</div>
                      <div className="sa-agents-tool-desc">{tool.description || '-'}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {filteredTools.length === 0 && (
            <div className="sa-agents-empty">
              <div>未匹配到工具</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuperAdminAgentToolPolicy;
