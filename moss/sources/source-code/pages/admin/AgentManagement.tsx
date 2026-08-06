/**
 * 管理后台「智能体管理」子页面。
 *
 * 业务含义：
 * - 展示租户下所有 Agent 卡片；
 * - 点击卡片进入管理后台内的 Agent 编辑页，不跳转工作台上下文。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAgentContextStore } from '../../stores/agentContextStore';
import type { Agent } from '../../types/platform';
import { getAgentDisplayName } from '../../types/platform';
import { SidebarAgentIcon } from '../../components/Sidebar/SidebarAgentIcon';
import { AdminMetaTag } from '../../components/common/AdminMetaTag';
import { AdminStatusTag } from '../../components/common/AdminStatusTag';
import AdminAgentEditor from './agents/AdminAgentEditor';

// ── Agent 卡片 ──

function formatDate(value: string | null | undefined): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('zh-CN');
}

function getAgentSourceLabel(agent: Agent): string {
  if (agent.source === 'builtin') return '平台内置';
  if (agent.source === 'tenant') return '租户自建';
  return '来源未知';
}

function AgentCard({ agent, onOpen }: { agent: Agent; onOpen: (agent: Agent) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <style>
        {`
          .admin-refined-agent-card:hover {
            box-shadow: 0 0 2px rgba(9,30,64,0.02), 0 4px 8px rgba(9,30,64,0.06), 0 4px 24px 6px rgba(9,30,64,0.04) !important;
          }
        `}
      </style>
      <div
        className="admin-refined-agent-card"
        onClick={() => onOpen(agent)}
        onMouseOver={() => setHovered(true)}
        onFocus={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onBlur={() => setHovered(false)}
        style={{
          height: 297,
          border: '1px solid #e6e9ef',
          borderRadius: 8,
          background: 'var(--bg-secondary, #fff)',
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: hovered
            ? '0 0 2px rgba(9,30,64,0.02), 0 4px 8px rgba(9,30,64,0.06), 0 4px 24px 6px rgba(9,30,64,0.04)'
            : 'none',
          transition: 'box-shadow 0.18s ease',
        }}
      >
      <div style={{ padding: '20px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--bg-secondary, #fff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 1px rgba(9,30,64,0.02), 0 4px 4px rgba(9,30,64,0.06), 0 4px 12px rgba(9,30,64,0.04)',
            }}
          >
            <SidebarAgentIcon agent={agent} size={24} />
          </div>
          <AdminStatusTag tone="success">已发布</AdminStatusTag>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 14, lineHeight: '22px', fontWeight: 600, color: 'rgba(9,30,64,0.9)', whiteSpace: 'nowrap' }}>
            {getAgentDisplayName(agent)}
          </div>
          <AdminMetaTag>{getAgentSourceLabel(agent)}</AdminMetaTag>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8, fontSize: 12, lineHeight: '20px', color: 'rgba(9,30,64,0.47)' }}>
          {agent.businessId && <div>{agent.businessId}</div>}
          <div>最近编辑： {formatDate(agent.updated_at)}</div>
        </div>

        <div style={{ fontSize: 13, lineHeight: '22px', color: 'rgba(9,30,64,0.9)' }}>
          {agent.description || '暂无描述'}
        </div>
      </div>

      <div
        style={{
          height: 50,
          background: '#f0f2f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0b0b0b',
          fontSize: 14,
          lineHeight: '22px',
        }}
      >
        <span style={{ fontSize: 18, lineHeight: '18px', marginRight: 8 }}>→</span>
        进入编辑
      </div>
      </div>
    </>
  );
}

// ── 主组件 ──

/**
 * 智能体管理页（管理后台子页面，?tab=agents）。
 *
 * 在管理后台内部维护两种视图：
 * - 列表视图：卡片化浏览所有智能体
 * - 编辑视图：在后台内直接编辑系统提示词与能力配置
 */
interface AgentManagementProps {
  onEditorDirtyChange?: (dirty: boolean) => void;
  requestEditorLeave?: (action: () => void) => void;
}

const AgentManagement: React.FC<AgentManagementProps> = ({ onEditorDirtyChange, requestEditorLeave }) => {
  const { agents, agentsLoading, agentsError, fetchAgents, updateAgent } = useAgentContextStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const editingId = searchParams.get('agentId');
  const editingAgent = useMemo(() => agents.find((item) => item.id === editingId) || null, [agents, editingId]);
  const showSearchInput = false;

  useEffect(() => {
    if (!editingAgent) onEditorDirtyChange?.(false);
  }, [editingAgent, onEditorDirtyChange]);

  useEffect(() => {
    if (agents.length === 0 && !agentsLoading) {
      fetchAgents();
    }
  }, []);

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter((agent) =>
      `${getAgentDisplayName(agent)} ${agent.name} ${agent.description || ''}`.toLowerCase().includes(q),
    );
  }, [agents, search]);

  const openEditor = (agent: Agent) => {
    const next = new URLSearchParams(searchParams);
    next.set('agentId', agent.id);
    setSearchParams(next, { replace: true });
  };

  const closeEditor = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('agentId');
    const close = () => setSearchParams(next, { replace: true });
    if (requestEditorLeave) requestEditorLeave(close);
    else close();
  };

  if (editingAgent) {
    return (
      <AdminAgentEditor
        agent={editingAgent}
        onBack={closeEditor}
        onSaved={updateAgent}
        onDirtyChange={onEditorDirtyChange}
      />
    );
  }

  return (
    <div style={{ padding: '28px 32px 24px' }} data-testid="agent-management-page">
      <div style={{ marginBottom: '20px' }} data-testid="agent-management-header">
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 4px',
          }}
        >
          智能体管理
        </h2>
      </div>
      {showSearchInput && (
        <div style={{ marginBottom: '22px', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '312px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '9px 12px' }} data-testid="agent-management-search">
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索名称/描述"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--text-primary)' }}
          />
        </div>
      )}

      {agentsLoading && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          加载中...
        </div>
      )}

      {agentsError && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'var(--danger-bg-soft)',
            border: '1px solid var(--danger-border-soft)',
            color: 'var(--danger)',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          加载失败：{agentsError}
        </div>
      )}

      {!agentsLoading && !agentsError && filteredAgents.length === 0 && (
        <div
          style={{
            padding: '48px 32px',
            textAlign: 'center',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{agents.length === 0 ? '暂无智能体' : '没有匹配的智能体'}</div>
        </div>
      )}

      {filteredAgents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }} data-testid="agent-management-grid">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onOpen={openEditor} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentManagement;
