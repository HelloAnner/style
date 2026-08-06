import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from '../../utils/toast';
import {
  getAutomationDashboard, getPipeline, listPipelines, listPipelineRuns, updatePipeline, testPipeline, deletePipeline, publishAsTemplate,
  type AutomationDashboard, type AutomationPipeline, type AutomationRun,
} from '../../api/automations';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useUiStore } from '../../stores/uiStore';
import { AdminMetaTag } from '../common/AdminMetaTag';
import { AdminStatusTag } from '../common/AdminStatusTag';
import { PipelineCreator } from './PipelineCreator';
import { getAgentDisplayName } from '../../types/platform';
import drawerStyles from '../Workspace/WorkspaceDrawer.module.css';
import automationIcon from '../../assets/icons/sidebar/automation.svg';
import closeIcon from '../../assets/icons/file-panel/close.svg';

import { triggerToHuman } from './automationSchedule';

function cleanSummary(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/\[\[TASK[_\s]*COMPLETE\]\]/gi, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\n{3,}/g, '\n')
    .trim();
}

function normalizeRunResultFilePath(raw: string): string | null {
  const trimmed = raw.trim().replace(/[),.;!?]+$/g, '');
  if (!trimmed) return null;

  const userFileMatch = trimmed.match(/\/users\/[^/]+\/files\/(.+)$/);
  if (userFileMatch) {
    return userFileMatch[1];
  }

  const relativeUserFileMatch = trimmed.match(/^users\/[^/]+\/files\/(.+)$/);
  if (relativeUserFileMatch) {
    return relativeUserFileMatch[1];
  }

  if (trimmed.startsWith('files/')) {
    return trimmed.slice(6);
  }

  return null;
}

function collectRunResultFilePaths(value: unknown, seen = new Set<string>()): string[] {
  if (typeof value === 'string') {
    const matches = value.match(/(?:\/users\/[^/\s]+\/files\/[^\s)\]"'`]+|users\/[^/\s]+\/files\/[^\s)\]"'`]+|files\/[^\s)\]"'`]+)/g) ?? [];
    for (const match of matches) {
      const normalized = normalizeRunResultFilePath(match);
      if (normalized) {
        seen.add(normalized);
      }
    }
    return Array.from(seen);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectRunResultFilePaths(item, seen);
    }
    return Array.from(seen);
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectRunResultFilePaths(item, seen);
    }
    return Array.from(seen);
  }

  return Array.from(seen);
}

function getRunResultFiles(run: AutomationRun): string[] {
  const files = new Set<string>();
  collectRunResultFilePaths(run.result_summary ?? '', files);
  collectRunResultFilePaths(run.payload, files);
  return Array.from(files);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function parseTimeValue(value: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^-?\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const date = new Date(numeric);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  const utcStr = trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed) ? trimmed : `${trimmed}Z`;
  const date = new Date(utcStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value: string | null): string {
  if (!value) return '';
  const d = parseTimeValue(value);
  if (!d) return value;
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isTerminalRunStatus(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'failed' || status === 'timeout' || status === 'cancelled';
}

const BoltIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const BackIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15,18 9,12 15,6"/>
  </svg>
);

// Run history bar — 圆角竖条替代圆点，超过上限时摘要聚合
const RunHistoryBar: React.FC<{ pipeline: AutomationPipeline }> = ({ pipeline }) => {
  const count = pipeline.trigger_count || 0;
  const lastStatus = pipeline.last_run_status;
  if (count === 0) return null;

  const MAX_BARS = 8;
  const shown = Math.min(count, MAX_BARS);
  const overflow = count - shown;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, height: 22 }}>
      {overflow > 0 && (
        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginRight: 2, fontVariantNumeric: 'tabular-nums' }}>
          +{overflow}
        </span>
      )}
      {Array.from({ length: shown }, (_, i) => {
        const isLast = i === shown - 1;
        const isFailed = isLast && (lastStatus === 'failed' || lastStatus === 'error');
        return (
          <div
            key={i}
            style={{
              width: 3, height: isLast ? 16 : 10 + Math.random() * 4,
              borderRadius: 2,
              background: isFailed ? '#ef4444' : 'var(--text-primary)',
              opacity: isLast ? 1 : 0.15 + (i / shown) * 0.35,
              transition: 'height 0.3s',
            }}
          />
        );
      })}
    </div>
  );
};

interface AutomationPanelProps {
  onClose: () => void;
  onLoadSession?: (sessionId: string) => void;
  onInjectInput?: (text: string) => void;
}

export const AutomationPanel: React.FC<AutomationPanelProps> = ({ onClose, onLoadSession, onInjectInput }) => {
  const currentAgentId = useAgentContextStore((s) => s.currentAgentId);
  const openFile = usePreviewStore((s) => s.openFile);
  const automationFocusPipelineId = useUiStore((s) => s.automationFocusPipelineId);
  const consumeAutomationFocusPipelineId = useUiStore((s) => s.consumeAutomationFocusPipelineId);
  const [dashboard, setDashboard] = useState<AutomationDashboard | null>(null);
  const [pipelines, setPipelines] = useState<AutomationPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<AutomationPipeline | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [vars, setVars] = useState<Record<string, unknown>>({});
  const [varsDirty, setVarsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  // creatorOpen: true 时打开 PipelineCreator 弹窗（新建或编辑）
  // creatorEditPipeline: null = 新建态，非 null = 编辑态
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [creatorEditPipeline, setCreatorEditPipeline] = useState<AutomationPipeline | null>(null);
  const [taskDesignExpanded, setTaskDesignExpanded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([getAutomationDashboard(), listPipelines()]);
      setDashboard(d);
      setPipelines(p);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('asset-changed', handler);
    return () => window.removeEventListener('asset-changed', handler);
  }, [loadData]);

  // 分组逻辑
  const { activePipes, recentPipes, archivedPipes } = useMemo(() => {
    const RECENT_DAYS = 7;
    const now = Date.now();
    const active: AutomationPipeline[] = [];
    const recent: AutomationPipeline[] = [];
    const archived: AutomationPipeline[] = [];

    for (const p of pipelines) {
      if (p.is_active) {
        active.push(p);
      } else {
        const isOnce = (p.trigger_config as any)?.once === true;
        const lastRun = p.last_triggered_at;
        const lastRunDate = parseTimeValue(lastRun);
        const recentEnough = lastRunDate ? (now - lastRunDate.getTime()) < RECENT_DAYS * 86400_000 : false;
        if (isOnce && recentEnough) {
          recent.push(p);
        } else {
          archived.push(p);
        }
      }
    }
    return { activePipes: active, recentPipes: recent, archivedPipes: archived };
  }, [pipelines]);

  const selectPipeline = useCallback(async (pipe: AutomationPipeline) => {
    let detailPipeline = pipe;
    try {
      detailPipeline = await getPipeline(pipe.id);
    } catch (e) {
      console.error(e);
    }
    setSelectedPipeline(detailPipeline);
    const merged: Record<string, unknown> = {};
    if (detailPipeline.variables_schema) {
      for (const [k, v] of Object.entries(detailPipeline.variables_schema)) {
        merged[k] = (detailPipeline.variable_overrides as Record<string, unknown>)?.[k] ?? (v as any)?.default ?? '';
      }
    }
    setVars(merged);
    setVarsDirty(false);
    setRunsLoading(true);
    try {
      const r = await listPipelineRuns(detailPipeline.id, 20);
      setRuns(r);
    } catch { setRuns([]); }
    setRunsLoading(false);
  }, []);

  useEffect(() => {
    if (!automationFocusPipelineId || loading) return;

    const matched = pipelines.find(pipe => pipe.id === automationFocusPipelineId);
    if (matched) {
      void selectPipeline(matched).finally(() => consumeAutomationFocusPipelineId(automationFocusPipelineId));
      return;
    }

    void getPipeline(automationFocusPipelineId)
      .then(pipe => selectPipeline(pipe))
      .catch((e) => {
        console.error(e);
      })
      .finally(() => consumeAutomationFocusPipelineId(automationFocusPipelineId));
  }, [
    automationFocusPipelineId,
    consumeAutomationFocusPipelineId,
    loading,
    pipelines,
    selectPipeline,
  ]);

  const handleSaveVars = useCallback(async () => {
    if (!selectedPipeline) return;
    setSaving(true);
    try {
      await updatePipeline(selectedPipeline.id, { variable_overrides: vars });
      setVarsDirty(false);
      setSelectedPipeline(prev => prev ? { ...prev, variable_overrides: vars } : prev);
    } catch (e) { console.error(e); }
    setSaving(false);
  }, [selectedPipeline, vars]);

  const handleToggle = useCallback(async (pipe: AutomationPipeline) => {
    try {
      await updatePipeline(pipe.id, { is_active: !pipe.is_active });
      loadData();
      if (selectedPipeline?.id === pipe.id) {
        setSelectedPipeline(prev => prev ? { ...prev, is_active: !prev.is_active } : prev);
      }
    } catch (e) { console.error(e); }
  }, [loadData, selectedPipeline]);

  const handleTest = useCallback(async () => {
    if (!selectedPipeline) return;
    setTesting(true);
    try {
      const previousLatestRunId = runs[0]?.id ?? null;
      const result = await testPipeline(selectedPipeline.id);
      if (result.status === 'SKIPPED') {
        toast.info('当前任务已有执行进行中，本次手动执行已跳过');
        await selectPipeline(selectedPipeline);
        return;
      }
      if (result.http_status === 409) {
        toast.info('当前任务已有进行中的执行，请稍后查看运行记录');
        await selectPipeline(selectedPipeline);
        return;
      }
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const latestRuns = await listPipelineRuns(selectedPipeline.id, 1, 0);
          const latestRun = latestRuns[0];
          const hasNewRun = latestRun && latestRun.id !== previousLatestRunId;
          if (hasNewRun) {
            if (isTerminalRunStatus(latestRun.status)) {
              await selectPipeline(selectedPipeline);
              return;
            }
          }
        } catch { /* keep polling */ }
      }
      await selectPipeline(selectedPipeline);
      toast.info('运行已发起，请稍后在记录列表查看最新状态');
    } catch (e) {
      console.error(e);
      toast.error((e as Error)?.message || '手动执行失败');
    } finally {
      setTesting(false);
    }
  }, [runs, selectedPipeline, selectPipeline]);

  const handlePublish = useCallback(async () => {
    if (!selectedPipeline) return;
    setPublishing(true);
    try {
      await publishAsTemplate(selectedPipeline.id);
      setPublishMsg('已发布为团队模版');
      window.dispatchEvent(new CustomEvent('asset-changed', { detail: { type: 'automations' } }));
    } catch (e: any) {
      setPublishMsg(e?.message || '发布失败');
    }
    setPublishing(false);
    setTimeout(() => setPublishMsg(null), 3000);
  }, [selectedPipeline]);

  const handleReference = useCallback(() => {
    if (!selectedPipeline || !onInjectInput) return;
    const name = selectedPipeline.display_name || selectedPipeline.name;
    onInjectInput(`基于自动化任务「${name}」，`);
    onClose();
  }, [selectedPipeline, onInjectInput, onClose]);

  const handleDelete = useCallback(async () => {
    if (!selectedPipeline) return;
    const name = selectedPipeline.display_name || selectedPipeline.name;
    if (!window.confirm(`确定删除自动化任务「${name}」？此操作不可撤销。`)) return;
    try {
      await deletePipeline(selectedPipeline.id);
      setSelectedPipeline(null);
      loadData();
    } catch (e) { console.error(e); }
  }, [selectedPipeline, loadData]);

  const handleEditPipeline = useCallback(async () => {
    if (!selectedPipeline) return;
    try {
      const freshPipeline = await getPipeline(selectedPipeline.id);
      setCreatorEditPipeline(freshPipeline);
      setCreatorOpen(true);
    } catch (e) {
      console.error(e);
      setCreatorEditPipeline(selectedPipeline);
      setCreatorOpen(true);
    }
  }, [selectedPipeline]);

  const handleCreatePipeline = useCallback(() => {
    setCreatorEditPipeline(null);
    setCreatorOpen(true);
  }, []);

  const triggerLabel = (pipe: AutomationPipeline) => {
    const tc = pipe.trigger_config || {};
    return triggerToHuman(tc);
  };

  // 渲染单个 pipeline 行
  const renderPipeRow = (pipe: AutomationPipeline, dimmed?: boolean) => (
    <div
      key={pipe.id}
      className="automation-pipeline-row"
      onClick={() => selectPipeline(pipe)}
      style={{
        padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
        // Match the hover background edge to the 16px panel action baseline.
        margin: '0 -4px',
        border: '1px solid transparent', position: 'relative',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: dimmed ? 0.55 : 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--hover-bg)';
        const bar = e.currentTarget.querySelector('.accent-bar') as HTMLElement;
        if (bar) bar.style.opacity = '1';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        const bar = e.currentTarget.querySelector('.accent-bar') as HTMLElement;
        if (bar) bar.style.opacity = '0';
      }}
      data-testid={`automation-pipeline-row-${pipe.id}`}
    >
      <div className="accent-bar" style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, borderRadius: 1, background: 'var(--text-primary)', opacity: 0, transition: 'opacity 0.2s' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: pipe.is_active ? 'var(--text-primary)' : 'var(--text-muted)',
          opacity: pipe.is_active ? 1 : 0.3,
          animation: pipe.is_active ? 'pulseNode 3s ease-in-out infinite' : 'none',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {pipe.display_name || pipe.name}
            </span>
            {pipe.agent_name && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: 'var(--hover-bg)', color: 'var(--text-muted)',
                fontWeight: 500, whiteSpace: 'nowrap',
              }}>
                {getAgentDisplayName(pipe.agent_name)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{triggerLabel(pipe)}</span>
            <span>&middot;</span>
            <span>{pipe.trigger_count} 次</span>
          </div>
        </div>
        <RunHistoryBar pipeline={pipe} />
      </div>
    </div>
  );

  return (
    <div
      className={drawerStyles.drawer}
      style={{
        position: 'relative',
      }}
      data-testid="automation-panel"
    >
      {/* Header */}
      <header className={drawerStyles.header} data-testid="automation-header">
        <div className={drawerStyles.titleWrap}>
          {selectedPipeline ? (
            <button onClick={() => { setSelectedPipeline(null); loadData(); }} style={{ display: 'flex', padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} data-testid="automation-detail-back">
              <BackIcon size={16} />
            </button>
          ) : (
            <img src={automationIcon} alt="" aria-hidden="true" className={drawerStyles.titleIcon} />
          )}
          <span className={drawerStyles.title}>
            {selectedPipeline ? (selectedPipeline.display_name || selectedPipeline.name) : '自动化'}
          </span>
          {selectedPipeline && (
            <AdminStatusTag
              tone={selectedPipeline.is_active ? 'success' : 'warning'}
              data-testid="automation-detail-status-tag"
            >
              {selectedPipeline.is_active ? '运行中' : '已暂停'}
            </AdminStatusTag>
          )}
        </div>
        <div className={drawerStyles.actions}>
          <button
            onClick={onClose}
            className={drawerStyles.iconBtn}
            title="关闭"
            aria-label="关闭自动化"
            data-testid="automation-close-btn"
          >
            <img src={closeIcon} alt="" aria-hidden="true" className={drawerStyles.headerActionIcon} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px', position: 'relative', zIndex: 1 }} data-testid="automation-content">
        {loading ? (
          <div style={{ padding: '8px 0' }} className="space-y-4" data-testid="automation-loading">
            <div className="skeleton-line" style={{ width: 100, height: 11 }} />
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ padding: 16, borderRadius: 14, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                <div className="skeleton-line" style={{ width: '70%', height: 14, marginBottom: 8 }} />
                <div className="skeleton-line" style={{ width: '100%', height: 12, marginBottom: 6 }} />
                <div className="skeleton-line" style={{ width: '50%', height: 12 }} />
              </div>
            ))}
          </div>
        ) : selectedPipeline ? (
          /* ========== Level 2: Pipeline Detail ========== */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 'var(--spacing-7)', animation: 'atpFadeContent 0.25s ease' }} data-testid="automation-detail">
            <style>{`@keyframes atpFadeContent { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }`}</style>

            {/* Task overview card */}
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 14, padding: 18 }} data-testid="automation-detail-overview">
              {selectedPipeline.description && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                  {selectedPipeline.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                  {triggerLabel(selectedPipeline)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {getAgentDisplayName(selectedPipeline.agent_name, 'Agent')} &middot; 已执行 {selectedPipeline.trigger_count} 次
                </div>
                {selectedPipeline.next_run_at && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    下次: {formatTime(selectedPipeline.next_run_at)}
                  </div>
                )}
              </div>
            </div>

            {/* Task design preview — 放在任务需求上方 */}
            {selectedPipeline.task_design && (
              <div
                onClick={() => setTaskDesignExpanded(!taskDesignExpanded)}
                style={{
                  padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-muted)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                data-testid="automation-task-design"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>任务设计</span>
                  </div>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ transform: taskDesignExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <polyline points="6,9 12,15 18,9"/>
                  </svg>
                </div>
                {!taskDesignExpanded && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedPipeline.task_design.replace(/^---[\s\S]*?---\s*/m, '').replace(/^#+\s*/gm, '').trim().slice(0, 80)}...
                  </div>
                )}
                {taskDesignExpanded && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      marginTop: 12, padding: '12px 14px', borderRadius: 8,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                      fontSize: 12, lineHeight: 1.65, color: 'var(--text-secondary)',
                      fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'pre-wrap',
                      maxHeight: 200, overflow: 'auto',
                    }}
                  >
                    {selectedPipeline.task_design.slice(0, 600)}{selectedPipeline.task_design.length > 600 ? '...' : ''}
                  </div>
                )}
              </div>
            )}

            {/* Variable config form — 任务需求，放在任务设计下方 */}
            {Object.keys(selectedPipeline.variables_schema || {}).length > 0 && (
              <div data-testid="automation-variable-section">
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 14 }}>任务需求</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {Object.entries(vars).map(([key, val]) => {
                    const schema = selectedPipeline.variables_schema?.[key];
                    const displayLabel = schema?.label || key;
                    return (
                    <div key={key} className="automation-variable-field" data-testid={`automation-variable-field-${key}`}>
                      <label style={{ fontSize: 11, letterSpacing: '0.02em', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>{displayLabel}</label>
                      <input
                        className="automation-variable-input"
                        type="text"
                        value={String(val ?? '')}
                        onChange={e => { setVars(prev => ({ ...prev, [key]: e.target.value })); setVarsDirty(true); }}
                        style={{
                          width: '100%', padding: '8px 0', fontSize: 13, color: 'var(--text-primary)',
                          background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)',
                          outline: 'none', transition: 'border-color 0.2s',
                        }}
                        onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--text-primary)'; }}
                        onBlur={e => { e.currentTarget.style.borderBottomColor = 'var(--border-subtle)'; }}
                        data-testid={`automation-variable-input-${key}`}
                      />
                    </div>
                  );
                  })}
                </div>
                <div style={{ overflow: 'hidden', transition: 'max-height 0.3s, opacity 0.3s', maxHeight: varsDirty ? 50 : 0, opacity: varsDirty ? 1 : 0, marginTop: 12 }}>
                  <button
                    onClick={handleSaveVars}
                    disabled={saving}
                    style={{
                      padding: '6px 20px', fontSize: 12, fontWeight: 500, borderRadius: 999,
                      border: 'none', background: 'var(--text-primary)', color: 'var(--bg-primary)',
                      cursor: saving ? 'wait' : 'pointer',
                    }}
                    data-testid="automation-variable-save"
                  >{saving ? '保存中...' : '保存'}</button>
                </div>
              </div>
            )}

            {/* Run timeline */}
            <div data-testid="automation-run-section">
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12 }}>运行记录</div>
              {runsLoading ? (
                <div className="space-y-3" style={{ padding: '4px 0' }} data-testid="automation-runs-loading">
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                      <div className="skeleton-line" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton-line" style={{ width: '60%', height: 12, marginBottom: 4 }} />
                        <div className="skeleton-line" style={{ width: '40%', height: 10 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : runs.length === 0 ? (
                <div style={{
                  padding: '24px 16px', textAlign: 'center', borderRadius: 12,
                  border: '1px dashed var(--border-subtle)',
                }} data-testid="automation-runs-empty">
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 8px', display: 'block' }}>
                    <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
                  </svg>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>尚未执行过</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6, marginTop: 4 }}>首次运行后将在这里显示记录</div>
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 24 }} data-testid="automation-run-list">
                  <div style={{ position: 'absolute', left: 7, top: 4, bottom: 4, width: 2, background: 'var(--border-subtle)', borderRadius: 1 }} />
                  {runs.map((run) => {
                  const summary = cleanSummary(run.result_summary);
                  const resultFiles = getRunResultFiles(run);
                  return (
                    <div
                      key={run.id}
                      className="automation-run-row"
                      onClick={() => { if (run.session_id && onLoadSession) onLoadSession(run.session_id); }}
                      style={{
                        position: 'relative',
                        padding: '10px 8px',
                        cursor: run.session_id ? 'pointer' : 'default',
                        transition: 'all 0.15s', borderRadius: 10,
                      }}
                      onMouseEnter={e => { if (run.session_id) { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.transform = 'translateX(2px)'; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateX(0)'; }}
                      data-testid={`automation-run-row-${run.id}`}
                    >
                      <div style={{ position: 'absolute', left: -20, top: 14, width: 10, height: 10 }}>
                        {run.status === 'running' ? (
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--text-primary)', animation: 'pulseNode 2s ease-in-out infinite' }} />
                        ) : run.status === 'completed' ? (
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--text-primary)' }} />
                        ) : (
                          <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #ef4444', background: 'transparent' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{formatTime(run.started_at)}</span>
                          {run.duration_ms > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDuration(run.duration_ms)}</span>}
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                            color: run.status === 'completed' ? 'var(--text-muted)' : run.status === 'running' ? 'var(--text-primary)' : '#ef4444',
                            background: run.status === 'completed' ? 'var(--hover-bg)' : run.status === 'running' ? 'rgba(139,92,246,0.08)' : 'rgba(239,68,68,0.06)',
                          }}>
                            {run.status === 'completed' ? '完成' : run.status === 'running' ? '运行中' : '失败'}
                          </span>
                          {run.session_id && (
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: 'auto', opacity: 0.5 }}>
                              <polyline points="9,18 15,12 9,6"/>
                            </svg>
                          )}
                        </div>
                        {summary && (
                          <div style={{
                            fontSize: 12, color: 'var(--text-secondary)', marginTop: 6,
                            lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                          }}>
                            {summary}
                          </div>
                        )}
                        {resultFiles.length > 0 && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>结果文件</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {resultFiles.map((filePath) => (
                                <button
                                  key={filePath}
                                  type="button"
                                  className="automation-run-result-file"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openFile({
                                      name: filePath.split('/').pop() || filePath,
                                      path: filePath,
                                      level: 'user-file',
                                    });
                                  }}
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    border: '1px solid var(--border-subtle)',
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    lineHeight: 1.5,
                                    maxWidth: '100%',
                                  }}
                                  title={`files/${filePath}`}
                                  data-testid={`automation-run-result-file-${filePath}`}
                                >
                                  {`files/${filePath}`}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {run.error && (
                          <div style={{
                            fontSize: 11, color: '#ef4444', marginTop: 4,
                            lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', opacity: 0.8,
                          }}>
                            {run.error}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                  <style>{`@keyframes pulseNode { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }} data-testid="automation-detail-actions">
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleTest}
                  disabled={testing}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 500, borderRadius: 10,
                    border: 'none', background: 'var(--text-primary)', color: 'var(--bg-primary)',
                    cursor: testing ? 'wait' : 'pointer', opacity: testing ? 0.6 : 1,
                  }}
                  data-testid="automation-run-now"
                >{testing ? '执行中...' : '手动执行'}</button>
                <button
                  onClick={() => handleToggle(selectedPipeline)}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 500, borderRadius: 10,
                    border: '1px solid var(--border-subtle)', background: 'transparent',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}
                  data-testid="automation-toggle-active"
                >{selectedPipeline.is_active ? '暂停' : '恢复'}</button>
                {onInjectInput && (
                  <button
                    onClick={handleReference}
                    style={{
                      flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 500, borderRadius: 10,
                      border: '1px solid var(--border-subtle)', background: 'transparent',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                    }}
                    data-testid="automation-reference"
                  >引用</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleEditPipeline}
                  style={{
                    flex: 1, padding: '9px 0', fontSize: 12, borderRadius: 10,
                    border: '1px solid var(--border-subtle)', background: 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                  data-testid="automation-edit-config"
                >编辑配置</button>
                {/* 发布为模版：v11 暂时隐藏（代码保留，待后续版本启用） */}
                {false && (
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    style={{
                      flex: 1, padding: '9px 0', fontSize: 12, borderRadius: 10,
                      border: '1px solid var(--border-subtle)', background: 'transparent',
                      color: 'var(--text-muted)', cursor: publishing ? 'wait' : 'pointer',
                    }}
                  >{publishing ? '发布中...' : '发布为模版'}</button>
                )}
              </div>
              {publishMsg && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>{publishMsg}</div>
              )}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 2, display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '6px 16px', fontSize: 11, borderRadius: 8,
                    border: 'none', background: 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    opacity: 0.5, transition: 'opacity 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  data-testid="automation-delete"
                >删除此任务</button>
              </div>
            </div>
          </div>
        ) : (
          /* ========== Level 1: Overview with grouping ========== */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }} data-testid="automation-overview">
            {/* Dashboard stats */}
            {dashboard && pipelines.length > 0 && (
              <div style={{ display: 'flex', gap: 0, justifyContent: 'space-between', padding: 'var(--spacing-3) 0', marginTop: 'var(--spacing-9)' }} data-testid="automation-dashboard-stats">
                {[
                  { id: 'active', label: '运行中', value: dashboard.active_pipelines },
                  { id: 'today-runs', label: '今日执行', value: dashboard.today_runs },
                  { id: 'success-rate', label: '成功率', value: `${dashboard.success_rate}%` },
                ].map(stat => (
                  <div key={stat.label} className="automation-stat" style={{ textAlign: 'center', flex: 1 }} data-testid={`automation-stat-${stat.id}`}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em', marginTop: 6 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--spacing-3)',
                minHeight: 'var(--spacing-8)',
                marginTop: 'var(--spacing-5)',
                // Content padding is 20px; pull the header to the 16px sidebar/header baseline.
                marginLeft: -4,
                marginRight: -4,
                padding: 0,
              }}
              data-testid="automation-task-list-header"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-3)',
                  fontSize: 14,
                  lineHeight: '20px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                任务列表
                {dashboard && (
	                  <AdminMetaTag
	                    data-testid="automation-task-list-count"
	                    // Compact count badge should scale with the 14px task-list title.
	                    style={{
	                      fontSize: 11,
                      lineHeight: '16px',
                      padding: '0 5px',
                    }}
                  >
                    {dashboard.total_pipelines}
                  </AdminMetaTag>
                )}
              </div>
              <button
                onClick={handleCreatePipeline}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  height: 32, padding: '0 12px', fontSize: 12, lineHeight: '16px', fontWeight: 500,
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--btn-mono-bg)',
                  color: 'var(--btn-mono-text)', cursor: 'pointer',
                  transition: 'opacity var(--transition-fast)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                data-testid="automation-overview-create-btn"
              >
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                新建自动化任务
              </button>
            </div>

            {/* Pipeline cards — grouped */}
            {pipelines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: '40px 24px' }} data-testid="automation-empty">
                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <BoltIcon size={28} className="text-zinc-500" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                  自动化任务
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 260, marginBottom: 24 }}>
                  让 Agent 帮你自动完成重复性工作。只需在对话中告诉 Agent「每天早上帮我整理一份日报」，它就会自动创建定时任务
                </p>
                <div className="flex flex-col items-start" style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-tertiary)', gap: 6 }}>
                  {['在对话中描述需求即可创建', '支持定时、周期任务', '随时查看执行记录和结果'].map(t => (
                    <div key={t} className="flex items-center" style={{ gap: 8 }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-muted)', opacity: 0.5 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }} data-testid="automation-pipeline-list">
                {/* Active group */}
                {activePipes.length > 0 && (
                  <div data-testid="automation-pipeline-group-active">
                    {activePipes.map(p => renderPipeRow(p))}
                  </div>
                )}

                {/* Recent completed group */}
                {recentPipes.length > 0 && (
                  <div style={{ marginTop: activePipes.length > 0 ? 16 : 0 }} data-testid="automation-pipeline-group-recent">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 16px', marginBottom: 4, opacity: 0.7 }}>近期完成</div>
                    {recentPipes.map(p => renderPipeRow(p, true))}
                  </div>
                )}

                {/* Archived group */}
                {archivedPipes.length > 0 && (
                  <div style={{ marginTop: 16 }} data-testid="automation-pipeline-group-archived">
                    <div
                      onClick={() => setShowArchived(!showArchived)}
                      style={{
                        fontSize: 11, color: 'var(--text-muted)', padding: '8px 16px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        opacity: 0.7, borderRadius: 8, transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      data-testid="automation-archived-toggle"
                    >
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        style={{ transform: showArchived ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="9,6 15,12 9,18"/>
                      </svg>
                      <span>已归档</span>
                      <span style={{ fontSize: 10, opacity: 0.6 }}>{archivedPipes.length}</span>
                    </div>
                    {showArchived && (
                      <div style={{ animation: 'atpFadeContent 0.2s ease' }}>
                        {archivedPipes.map(p => renderPipeRow(p, true))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {creatorOpen && (
        <PipelineCreator
          isOpen={true}
          onClose={() => { setCreatorOpen(false); setCreatorEditPipeline(null); }}
          onCreated={async (createdPipeline) => {
            setCreatorOpen(false);
            const wasEditing = creatorEditPipeline;
            setCreatorEditPipeline(null);
            await loadData();
            if (createdPipeline) {
              await selectPipeline(createdPipeline);
            } else if (wasEditing) {
              await selectPipeline(wasEditing);
            }
          }}
          editPipeline={creatorEditPipeline}
          agentId={creatorEditPipeline?.agent_id ?? currentAgentId ?? ''}
        />
      )}
    </div>
  );
};

export default AutomationPanel;
