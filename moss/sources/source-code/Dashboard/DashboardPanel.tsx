/**
 * DashboardPanel - 看板主舞台容器
 *
 * 视觉对齐工作室：
 *   - 顶部 14px 高的标题栏（图标 + "看板" 名称 + 右侧 Maximize/Close 按钮）
 *   - 下方一条操作栏（搜索框 + 查询按钮，由 DashboardToolbar 提供）
 *   - 主体：iframe / 加载态 / 空态 / 错误态
 *
 * 注：Agent ↔ dashboardStore 的同步由 App.tsx 统一负责，本组件只读 store。
 */

import React, { useCallback, useRef, useState } from 'react';
import { LayoutDashboard, Maximize2, Minimize2, X, Save } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useAgentStore } from '../../stores/agentStore';
import { DashboardTabBar } from './DashboardTabBar';
import { DashboardQueryForm } from './DashboardQueryForm';
import { DashboardRenderer } from './DashboardRenderer';
import { DashboardEmpty } from './DashboardEmpty';
import { DashboardLoading } from './DashboardLoading';
import { DashboardStreamSkeleton } from './DashboardStreamSkeleton';
import { track } from '../../utils/track';
import { saveDashboardSnapshotHtml } from '../../api/dashboards';
import type { DashboardSnapshot } from '../../api/dashboards';
import { useTheme } from '../common/ThemeProvider';
import { toast } from '../../utils/toast';
import './dashboard.css';

interface Props {
  agentId: string | null;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function stringFromUnknown(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractSnapshotError(snapshot: DashboardSnapshot | null | undefined): string | null {
  if (!snapshot) return null;
  const errors = snapshot.errors ? Object.values(snapshot.errors).map(stringFromUnknown).filter(Boolean) : [];
  if (errors.length > 0) return errors[0];

  for (const binding of Object.values(snapshot.bindings_data || {})) {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) continue;
    const data = binding as Record<string, unknown>;
    const message = stringFromUnknown(data.error) || stringFromUnknown(data._error);
    if (message) return message;
  }
  return null;
}

export const DashboardPanel: React.FC<Props> = ({ agentId, onClose, isExpanded, onToggleExpand }) => {
  const snapshot = useDashboardStore((s) => s.snapshot);
  const dashboardState = useDashboardStore((s) => s.dashboardState);
  const setDashboardInteractionState = useDashboardStore((s) => s.setDashboardInteractionState);
  const loading = useDashboardStore((s) => s.loading);
  const runPhase = useDashboardStore((s) => s.runPhase);
  const streamContentReady = useDashboardStore((s) => s.streamContentReady);
  const queryStreamActive = useDashboardStore((s) => s.queryStreamActive);
  const error = useDashboardStore((s) => s.error);
  const dashboards = useDashboardStore((s) => s.dashboards);
  const currentKey = useDashboardStore((s) => s.currentKey);
  const scrollResetToken = useDashboardStore((s) => s.scrollResetToken);
  const refreshPendingAiSnapshot = useDashboardStore((s) => s.refreshPendingAiSnapshot);
  const markSnapshotRendered = useDashboardStore((s) => s.markSnapshotRendered);
  const currentSessionId = useAgentStore((s) => s.currentSessionId);
  const { theme } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const snapshotError = extractSnapshotError(snapshot);
  const snapshotId = snapshot?.snapshot_id || '';
  const hasSnapshotHtml = !!snapshot?.html;
  const isBiddingEmpty =
    !hasSnapshotHtml &&
    !loading &&
    !error &&
    (currentKey === 'bidding-query' || currentKey === 'bidding');
  const effectiveSessionId = snapshot?.session_id || currentSessionId || '';
  const snapshotReadyToSave = snapshot?.run_status === 'success'
    && !queryStreamActive
    && !loading
    && runPhase === 'idle'
    && !error;

  const [savingHtml, setSavingHtml] = useState(false);
  const handleSaveHtml = useCallback(async () => {
    if (savingHtml || !snapshotReadyToSave || !agentId || !currentKey || !effectiveSessionId || !snapshotId || !hasSnapshotHtml) return;
    track('board_save_snapshot', { board_id: currentKey });
    setSavingHtml(true);
    const toastId = toast.loading('正在保存 HTML 快照…');
    try {
      const saved = await saveDashboardSnapshotHtml(agentId, currentKey, {
        sessionId: effectiveSessionId,
        snapshotId,
        theme: theme === 'dark' ? 'dark' : 'light',
      });
      toast.success(`已保存到会话文件：${saved.filename || saved.path}`, { id: toastId });
      const resourceDetail = {
        resource_type: 'FILE_SESSION',
        action: 'create',
        path: saved.path,
        session_id: effectiveSessionId,
      };
      window.dispatchEvent(new CustomEvent('ws:asset-changed', { detail: resourceDetail }));
      window.dispatchEvent(new CustomEvent('agent-resource-changed', { detail: resourceDetail }));
      window.dispatchEvent(new CustomEvent('session-file-added', {
        detail: {
          path: saved.session_path || saved.path,
          filename: saved.filename,
        },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[dashboard save html]', e);
      toast.error('保存失败：' + msg, { id: toastId });
    } finally {
      setSavingHtml(false);
    }
  }, [agentId, currentKey, effectiveSessionId, hasSnapshotHtml, savingHtml, snapshotId, snapshotReadyToSave, theme]);

  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [currentKey, scrollResetToken]);

  // 没有任何看板时不渲染整个 panel（兜底；正常情况下 App.tsx 不会在此 Agent 选 'dashboard'）
  if (!agentId || dashboards.length === 0) {
    return null;
  }

  const canSaveHtml = !!(hasSnapshotHtml && snapshotId && effectiveSessionId);
  const saveHtmlDisabled = savingHtml || !snapshotReadyToSave;
  const showStreamSkeleton = runPhase !== 'idle' && (runPhase === 'waiting' || !streamContentReady);

  return (
    <div
      className="dashboard-panel-root h-full w-full flex flex-col overflow-hidden"
      style={{
        borderRadius: 16,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--panel-shadow)',
        contain: 'strict',
      }}
    >
      {/* 头部 — 与工作室、执行链保持统一样式（flex-shrink-0 防止被下方滚动容器拉变形） */}
      <div className="dashboard-panel-header flex items-center justify-between px-4 h-14 flex-shrink-0">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={18} className="text-zinc-400" />
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            智能看板
          </span>
        </div>
        <div className="dashboard-panel-header-tabs">
          <DashboardTabBar compact={!isExpanded} />
        </div>
        <div className="flex items-center gap-1">
          {/* 反馈入口：MVP 阶段收集用户反馈用 */}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 10 }}>
            使用反馈
            <a
              href="https://www.jiandaoyun.com/app/638eebcbbb3277000a28f787/entry/6a0fcad46c05b856e5f000dc"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
              style={{
                color: 'var(--accent-color)',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
                fontWeight: 500,
                marginLeft: 2,
              }}
              title="提交看板使用反馈"
            >
              反馈
            </a>
          </span>
          {canSaveHtml && (
            <button
              onClick={handleSaveHtml}
              disabled={saveHtmlDisabled}
              className={`dashboard-panel-icon-button${savingHtml ? ' is-active' : ''}`}
              title={savingHtml ? '正在保存 HTML 快照…' : saveHtmlDisabled ? '查询完成后可保存 HTML 快照' : '保存 HTML 到会话文件'}
            >
              <Save size={16} className={savingHtml ? 'animate-pulse' : ''} />
            </button>
          )}
          {/* 展开/收起按钮 */}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="dashboard-panel-icon-button"
              title={isExpanded ? '退出全屏' : '全屏'}
            >
              {isExpanded ? (
                <Minimize2 size={16} />
              ) : (
                <Maximize2 size={16} />
              )}
            </button>
          )}
          {/* 关闭按钮 */}
          {onClose && (
            <button
              onClick={onClose}
              className="dashboard-panel-icon-button"
              title="关闭"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 统一滚动容器：查询条件区 + 看板内容一起滚动
          —— 之前 QueryForm 固定占顶部一大块，筛选项多了会挤压下方看板可视区。
          现在筛选区跟着主体一起被滚动条滚动，需要看更多看板内容时可直接把筛选滚走。
      */}
      <div className="dashboard-scroll">
        <DashboardQueryForm />
        {snapshot?.html && runPhase !== 'idle' && (
          <div
            className="dashboard-stream-rail dashboard-stream-rail--query-boundary"
            role="status"
            aria-live="polite"
            aria-label={runPhase === 'settling' ? '看板正在完成渲染' : '看板数据正在持续更新'}
          >
            <span className="dashboard-stream-rail-glint" />
          </div>
        )}

        {/* 主体内容
          渲染优先级：
          1. snapshot.html 一旦有就渲染（即使 loading 还在 true）—— Phase 1 流式渲染的关键：
             partial snapshot 进 store 时就立刻显示，AI 卡片走自己的骨架占位
          2. 否则 loading 时显示加载骨架
          3. 否则 error 或 empty
        */}
        <div
          ref={contentRef}
          className={`dashboard-content${snapshot?.html ? ' has-result' : ''}`}
        >
          {snapshot && snapshot.html ? (
            <div className={`dashboard-result-shell${runPhase !== 'idle' ? ' is-streaming' : ''}`}>
              <DashboardStreamSkeleton
                visible={showStreamSkeleton}
                variant={currentKey === 'enterprise-risk' ? 'risk' : 'default'}
              />
              {snapshotError && (
                <div className="dashboard-snapshot-error-summary" role="alert">
                  {snapshotError}
                </div>
              )}
              <DashboardRenderer
                html={snapshot.html}
                agentId={agentId}
                dashboardKey={currentKey}
                inputs={snapshot.inputs as Record<string, unknown> | null}
                sessionId={effectiveSessionId}
                snapshotId={snapshot.snapshot_id}
                streaming={runPhase === 'streaming'}
                finalizing={runPhase === 'settling'}
                onReady={markSnapshotRendered}
                onPendingAiVisible={refreshPendingAiSnapshot}
                interactionState={dashboardState?.interaction_state || null}
                onInteractionStateChange={setDashboardInteractionState}
              />
            </div>
          ) : loading ? (
            <DashboardLoading />
          ) : error ? (
            <div className="dashboard-error">⚠️ {error}</div>
          ) : isBiddingEmpty ? null : (
            <DashboardEmpty />
          )}
        </div>
      </div>
      {isBiddingEmpty && <DashboardEmpty />}
    </div>
  );
};
