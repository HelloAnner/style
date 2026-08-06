import React from 'react';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { useAgentStore } from '../../stores/agentStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useUiStore } from '../../stores/uiStore';
import { DashboardTabBar } from '../../components/Dashboard/DashboardTabBar';
import { DashboardQueryForm } from '../../components/Dashboard/DashboardQueryForm';
import { DashboardRenderer, type DashboardRendererHandle } from '../../components/Dashboard/DashboardRenderer';
import { DashboardEmpty } from '../../components/Dashboard/DashboardEmpty';
import { DashboardLoading } from '../../components/Dashboard/DashboardLoading';
import { DashboardStreamSkeleton } from '../../components/Dashboard/DashboardStreamSkeleton';
import drawerStyles from '../../components/Workspace/WorkspaceDrawer.module.css';
import { saveDashboardSnapshotHtml } from '../../api/dashboards';
import { useTheme } from '../../components/common/ThemeProvider';
import boardIcon from '../../assets/icons/sidebar/board.svg';
import closeIcon from '../../assets/icons/file-panel/close.svg';
import collapseIcon from '../../assets/icons/file-panel/collapse.svg';
import maximizeIcon from '../../assets/icons/file-panel/maximize.svg';
import { ChevronDown, Download, FileText, Save } from 'lucide-react';
import { toast } from '../../utils/toast';
import { track } from '../../utils/track';
import '../../components/Dashboard/dashboard.css';
import {
  dashboardSnapshotTitleFromInputs,
  resolveDashboardInsightPrompt,
  sanitizeDashboardFilenamePart,
} from '../../utils/dashboardInsight';
import { getAgentDisplayName, type Agent } from '../../types/platform';

const BOARD_PANEL_COPY = {
  zh: {
    title: '智能看板',
    agentTitleTemplate: '{agentName}看板',
    noAgent: '请选择一个智能体后使用看板',
    noBoards: '当前智能体暂无可用看板',
    resultFallback: '查询结果',
    askAboutResult: 'MOSS洞察',
    saveAs: '保存为',
    saveAsSnapshot: '看板快照',
    saveAsLocalImage: '本地图片',
    saveHtml: '保存看板快照',
    savingHtml: '正在保存看板快照…',
    saveHtmlPending: '查询完成后可保存看板快照',
    savedHtml: '已保存到会话文件',
    saveHtmlFailPrefix: '保存失败',
    exportPng: '导出 PNG',
    exportingPng: '正在生成 PNG…',
    exportedPng: 'PNG 已导出',
    exportPngFailPrefix: '导出失败',
    restore: '还原',
    maximize: '最大化',
    close: '关闭',
    streamingStatus: '看板数据正在持续更新',
    settlingStatus: '看板正在完成渲染',
  },
  en: {
    title: 'Smart Board',
    agentTitleTemplate: '{agentName} Board',
    noAgent: 'Select an agent to use the board',
    noBoards: 'No boards are available for this agent',
    resultFallback: 'Query result',
    askAboutResult: 'MOSS insight',
    saveAs: 'Save as',
    saveAsSnapshot: 'Board snapshot',
    saveAsLocalImage: 'Local image',
    saveHtml: 'Save board snapshot',
    savingHtml: 'Saving board snapshot…',
    saveHtmlPending: 'Available after the query finishes',
    savedHtml: 'Saved to session files',
    saveHtmlFailPrefix: 'Save failed',
    exportPng: 'Export PNG',
    exportingPng: 'Generating PNG…',
    exportedPng: 'PNG exported',
    exportPngFailPrefix: 'Export failed',
    restore: 'Restore',
    maximize: 'Maximize',
    close: 'Close',
    streamingStatus: 'Board data is updating',
    settlingStatus: 'Board is finishing rendering',
  },
} as const;

type BoardPanelLocale = keyof typeof BOARD_PANEL_COPY;

function resolveBoardPanelLocale(): BoardPanelLocale {
  if (typeof navigator === 'undefined') return 'zh';
  const language = navigator.language || navigator.languages?.[0] || '';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function useBoardPanelCopy() {
  const [locale, setLocale] = React.useState<BoardPanelLocale>(() => resolveBoardPanelLocale());

  React.useEffect(() => {
    const next = resolveBoardPanelLocale();
    if (next !== locale) setLocale(next);
  }, [locale]);

  return BOARD_PANEL_COPY[locale];
}

function formatBoardPanelTitle(copy: typeof BOARD_PANEL_COPY[BoardPanelLocale], agent: Agent | null): string {
  const agentName = getAgentDisplayName(agent, '').trim();
  if (!agentName) return copy.title;
  return copy.agentTitleTemplate.replace('{agentName}', agentName);
}

export function BoardPanelDrawer() {
  const copy = useBoardPanelCopy();
  const { theme } = useTheme();
  const { closeRightPanel, restoreWorkspaceSize, workspaceMaximized, toggleWorkspaceMaximized } = useUiStore();
  const agentId = useAgentContextStore((state) => state.currentAgentId);
  const currentAgent = useAgentContextStore((state) => state.getCurrentAgent());
  const currentSessionId = useAgentStore((state) => state.currentSessionId);
  const reservedNewSessionId = useAgentStore((state) => state.reservedNewSessionId);
  const reserveNewSessionId = useAgentStore((state) => state.reserveNewSessionId);
  const dashboards = useDashboardStore((state) => state.dashboards);
  const currentKey = useDashboardStore((state) => state.currentKey);
  const listLoaded = useDashboardStore((state) => state.listLoaded);
  const loading = useDashboardStore((state) => state.loading);
  const runPhase = useDashboardStore((state) => state.runPhase);
  const streamContentReady = useDashboardStore((state) => state.streamContentReady);
  const queryStreamActive = useDashboardStore((state) => state.queryStreamActive);
  const error = useDashboardStore((state) => state.error);
  const snapshot = useDashboardStore((state) => state.snapshot);
  const scrollResetToken = useDashboardStore((state) => state.scrollResetToken);
  const setAgent = useDashboardStore((state) => state.setAgent);
  const setCurrentKey = useDashboardStore((state) => state.setCurrentKey);
  const loadLatest = useDashboardStore((state) => state.loadLatest);
  const refreshPendingAiSnapshot = useDashboardStore((state) => state.refreshPendingAiSnapshot);
  const markSnapshotRendered = useDashboardStore((state) => state.markSnapshotRendered);
  const boardFocusDashboardKey = useUiStore((state) => state.boardFocusDashboardKey);
  const boardFocusRequestId = useUiStore((state) => state.boardFocusRequestId);
  const consumeBoardFocusRequest = useUiStore((state) => state.consumeBoardFocusRequest);
  const [preparingQuestion, setPreparingQuestion] = React.useState(false);
  const [savingHtml, setSavingHtml] = React.useState(false);
  const [exportingPng, setExportingPng] = React.useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const rendererRef = React.useRef<DashboardRendererHandle>(null);
  const saveMenuRef = React.useRef<HTMLDivElement>(null);
  const saveMenuId = React.useId();
  const restoredRealSessionViewRef = React.useRef<string | null>(null);
  const effectiveDashboardSessionId = currentSessionId ?? reservedNewSessionId;

  React.useEffect(() => {
    if (!agentId || currentSessionId || reservedNewSessionId) return;
    reserveNewSessionId();
  }, [agentId, currentSessionId, reserveNewSessionId, reservedNewSessionId]);

  React.useEffect(() => {
    void setAgent(agentId, { sessionId: effectiveDashboardSessionId });
  }, [agentId, effectiveDashboardSessionId, setAgent]);

  React.useEffect(() => {
    if (!agentId || !listLoaded) return;
    const shouldRestoreSessionView = Boolean(
      currentSessionId && restoredRealSessionViewRef.current !== currentSessionId,
    );
    if (!currentSessionId) {
      restoredRealSessionViewRef.current = null;
    }
    void loadLatest({ sessionId: effectiveDashboardSessionId, forceViewState: shouldRestoreSessionView })
      .finally(() => {
        if (shouldRestoreSessionView && currentSessionId === useAgentStore.getState().currentSessionId) {
          restoredRealSessionViewRef.current = currentSessionId;
        }
      });
  }, [agentId, currentKey, currentSessionId, effectiveDashboardSessionId, listLoaded, loadLatest]);

  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [currentKey, scrollResetToken]);

  React.useEffect(() => {
    if (!saveMenuOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && saveMenuRef.current?.contains(target)) return;
      setSaveMenuOpen(false);
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSaveMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [saveMenuOpen]);

  React.useEffect(() => {
    if (!agentId || !listLoaded || boardFocusRequestId <= 0) return;
    const requestId = boardFocusRequestId;
    const requestedKey = boardFocusDashboardKey;
    const scrollToTop = () => {
      contentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    };

    if (requestedKey) {
      const boardExists = dashboards.some((item) => item.key === requestedKey);
      if (boardExists) {
        setCurrentKey(requestedKey, { sessionId: effectiveDashboardSessionId });
        void loadLatest({ sessionId: effectiveDashboardSessionId })
          .finally(() => {
            scrollToTop();
            consumeBoardFocusRequest(requestId);
          });
        return;
      }
      consumeBoardFocusRequest(requestId);
      return;
    }

    void loadLatest({ sessionId: effectiveDashboardSessionId, forceViewState: true })
      .finally(() => {
        scrollToTop();
        consumeBoardFocusRequest(requestId);
      });
  }, [
    agentId,
    boardFocusDashboardKey,
    boardFocusRequestId,
    consumeBoardFocusRequest,
    effectiveDashboardSessionId,
    dashboards,
    listLoaded,
    loadLatest,
    setCurrentKey,
  ]);

  const currentBoard = dashboards.find((item) => item.key === currentKey);
  const currentBoardName = currentBoard?.name || copy.title;
  const panelTitle = formatBoardPanelTitle(copy, currentAgent);
  const canSaveHtml = Boolean(agentId && currentKey && effectiveDashboardSessionId && snapshot?.html && snapshot.snapshot_id);
  const queryInProgress = Boolean(
    loading
    || queryStreamActive
    || runPhase !== 'idle',
  );
  const insightDisabled = preparingQuestion || queryInProgress;
  const saveHtmlDisabled = Boolean(
    savingHtml
    || queryInProgress
    || snapshot?.run_status !== 'success'
    || error,
  );
  const exportPngDisabled = exportingPng || saveHtmlDisabled;
  const showStreamSkeleton = runPhase !== 'idle' && (runPhase === 'waiting' || !streamContentReady);

  React.useEffect(() => {
    if (!canSaveHtml || saveHtmlDisabled) {
      setSaveMenuOpen(false);
    }
  }, [canSaveHtml, saveHtmlDisabled]);

  const handleAskAboutResult = React.useCallback(async () => {
    if (insightDisabled || !snapshot?.html) return;
    setPreparingQuestion(true);
    try {
      restoreWorkspaceSize();
      window.dispatchEvent(new CustomEvent('board-result-ask', {
        detail: {
          boardName: currentBoardName,
          dashboardKey: currentKey,
          prompt: resolveDashboardInsightPrompt(currentBoard?.insight_prompt_template, currentBoardName),
          snapshotId: snapshot.snapshot_id || null,
        },
      }));
    } finally {
      setPreparingQuestion(false);
    }
  }, [currentBoard?.insight_prompt_template, currentBoardName, currentKey, insightDisabled, restoreWorkspaceSize, snapshot?.html, snapshot?.snapshot_id]);

  const handleSaveHtml = React.useCallback(async () => {
    if (saveHtmlDisabled || !agentId || !currentKey || !snapshot?.html || !snapshot.snapshot_id) return;
    track('board_save_snapshot', { board_id: currentKey });
    setSavingHtml(true);
    const toastId = toast.loading(copy.savingHtml);
    try {
      const targetSessionId = snapshot.session_id || effectiveDashboardSessionId;
      const saved = await saveDashboardSnapshotHtml(agentId, currentKey, {
        sessionId: targetSessionId,
        snapshotId: snapshot.snapshot_id,
        theme: theme === 'dark' ? 'dark' : 'light',
      });
      toast.success(`${copy.savedHtml}：${saved.filename || saved.path}`, { id: toastId });
      const resourceDetail = {
        resource_type: 'FILE_SESSION',
        action: 'create',
        path: saved.path,
        session_id: targetSessionId,
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
      console.error('[board save html]', e);
      toast.error(`${copy.saveHtmlFailPrefix}: ${msg}`, { id: toastId });
    } finally {
      setSavingHtml(false);
    }
  }, [agentId, copy.savedHtml, copy.saveHtmlFailPrefix, copy.savingHtml, currentKey, effectiveDashboardSessionId, saveHtmlDisabled, snapshot?.html, snapshot?.session_id, snapshot?.snapshot_id, theme]);

  const handleExportPng = React.useCallback(async () => {
    if (exportPngDisabled || !snapshot?.html || !rendererRef.current) return;
    track('board_save_local_image', { board_id: currentKey ?? undefined });
    setExportingPng(true);
    const toastId = toast.loading(copy.exportingPng);
    try {
      const subject = dashboardSnapshotTitleFromInputs(snapshot.inputs) || copy.resultFallback;
      const now = new Date();
      const pad = (value: number) => String(value).padStart(2, '0');
      const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      const filename = `${sanitizeDashboardFilenamePart(subject)}-${sanitizeDashboardFilenamePart(currentBoardName)}-${date}.png`;
      await rendererRef.current.exportImage(filename);
      toast.success(copy.exportedPng, { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[board export png]', e);
      toast.error(`${copy.exportPngFailPrefix}: ${msg}`, { id: toastId });
    } finally {
      setExportingPng(false);
    }
  }, [copy.exportedPng, copy.exportingPng, copy.exportPngFailPrefix, copy.resultFallback, currentBoardName, exportPngDisabled, snapshot?.html, snapshot?.inputs]);

  const handleCloseBoard = React.useCallback(() => {
    closeRightPanel();
  }, [closeRightPanel]);

  const insightActionButton = snapshot?.html ? (
    <button
      type="button"
      className="dashboard-result-action-button dashboard-result-action-button--compact dashboard-queryform-insight-action primary"
      onClick={handleAskAboutResult}
      disabled={insightDisabled}
      aria-label={copy.askAboutResult}
    >
      <span
        className="dashboard-result-action-icon"
        aria-hidden="true"
        style={{ '--dashboard-result-action-index': 0 } as React.CSSProperties}
      />
      <span className="dashboard-result-action-label" aria-hidden="true">
        {copy.askAboutResult}
      </span>
    </button>
  ) : null;

  const saveSnapshotButton = canSaveHtml ? (
    <div ref={saveMenuRef} className="dashboard-snapshot-save-menu">
      <button
        data-testid="btn-board-save-html"
        type="button"
        onClick={() => setSaveMenuOpen((open) => !open)}
        className="dashboard-snapshot-save-button"
        title={savingHtml ? copy.savingHtml : saveHtmlDisabled ? copy.saveHtmlPending : copy.saveAs}
        aria-label={savingHtml ? copy.savingHtml : saveHtmlDisabled ? copy.saveHtmlPending : copy.saveAs}
        aria-busy={savingHtml}
        aria-haspopup="menu"
        aria-expanded={saveMenuOpen}
        aria-controls={saveMenuOpen ? saveMenuId : undefined}
        disabled={saveHtmlDisabled}
      >
        <Save
          size={14}
          aria-hidden="true"
          className={savingHtml ? 'animate-pulse' : undefined}
        />
        <span>{savingHtml ? copy.savingHtml : copy.saveAs}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={saveMenuOpen ? 'dashboard-snapshot-save-chevron is-open' : 'dashboard-snapshot-save-chevron'}
        />
      </button>
      {saveMenuOpen && (
        <div id={saveMenuId} className="dashboard-snapshot-save-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="dashboard-snapshot-save-option"
            onClick={() => {
              setSaveMenuOpen(false);
              void handleSaveHtml();
            }}
            disabled={saveHtmlDisabled}
          >
            <FileText size={14} aria-hidden="true" />
            {copy.saveAsSnapshot}
          </button>
          <button
            type="button"
            role="menuitem"
            className="dashboard-snapshot-save-option"
            onClick={() => {
              setSaveMenuOpen(false);
              void handleExportPng();
            }}
            disabled={exportPngDisabled}
          >
            <Download size={14} aria-hidden="true" />
            {copy.saveAsLocalImage}
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <aside
      aria-label={panelTitle}
      className={drawerStyles.drawer}
      style={{ minHeight: 0, color: 'var(--text-primary)' }}
    >
      <header className={`${drawerStyles.header} dashboard-panel-header`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <img src={boardIcon} alt="" aria-hidden="true" style={{ width: 20, height: 20, flexShrink: 0 }} />
          <div className={drawerStyles.title}>{panelTitle}</div>
        </div>
        {agentId && listLoaded && dashboards.length > 1 && (
          <div className="dashboard-panel-header-tabs">
            <DashboardTabBar compact={!workspaceMaximized} collapseToDropdownWhenCompact={!workspaceMaximized} />
          </div>
        )}
        <div className={drawerStyles.actions}>
          <button
            data-testid="btn-board-maximize"
            type="button"
            onClick={toggleWorkspaceMaximized}
            className={drawerStyles.iconBtn}
            title={workspaceMaximized ? copy.restore : copy.maximize}
            aria-label={workspaceMaximized ? copy.restore : copy.maximize}
          >
            <img
              src={workspaceMaximized ? collapseIcon : maximizeIcon}
              alt=""
              aria-hidden="true"
              className={drawerStyles.headerActionIcon}
            />
          </button>
          <button
            data-testid="btn-board-close"
            type="button"
            onClick={handleCloseBoard}
            className={drawerStyles.iconBtn}
            title={copy.close}
            aria-label={copy.close}
          >
            <img src={closeIcon} alt="" aria-hidden="true" className={drawerStyles.headerActionIcon} />
          </button>
        </div>
      </header>

      {!agentId ? (
        <div className="dashboard-panel-message">{copy.noAgent}</div>
      ) : !listLoaded ? (
        <DashboardLoading />
      ) : dashboards.length === 0 ? (
        <div className="dashboard-panel-message">{copy.noBoards}</div>
      ) : (
        <div className="dashboard-scroll">
          <DashboardQueryForm
            sessionId={effectiveDashboardSessionId}
            restoreWorkspaceOnSubmit={false}
            actionsStart={(
              <>
                {insightActionButton}
                {saveSnapshotButton}
              </>
            )}
          />
          {snapshot?.html && runPhase !== 'idle' && (
            <div
              className="dashboard-stream-rail dashboard-stream-rail--query-boundary"
              role="status"
              aria-live="polite"
              aria-label={runPhase === 'settling' ? copy.settlingStatus : copy.streamingStatus}
            >
              <span className="dashboard-stream-rail-glint" />
            </div>
          )}
          <div
            ref={contentRef}
            className={`dashboard-content${snapshot?.html ? ' has-result' : ''}`}
          >
            {snapshot?.html ? (
              <div className={`dashboard-result-shell${runPhase !== 'idle' ? ' is-streaming' : ''}`}>
                <DashboardStreamSkeleton
                  visible={showStreamSkeleton}
                  variant={currentKey === 'enterprise-risk' ? 'risk' : 'default'}
                />
                <DashboardRenderer
                  ref={rendererRef}
                  html={snapshot.html}
                  agentId={agentId}
                  dashboardKey={currentKey}
                  inputs={snapshot.inputs as Record<string, unknown>}
                  sessionId={effectiveDashboardSessionId}
                  snapshotId={snapshot.snapshot_id}
                  streaming={runPhase === 'streaming'}
                  finalizing={runPhase === 'settling'}
                  onReady={markSnapshotRendered}
                  onPendingAiVisible={refreshPendingAiSnapshot}
                />
              </div>
            ) : loading ? (
              <DashboardLoading />
            ) : error ? (
              <div className="dashboard-error">{error}</div>
            ) : (
              <DashboardEmpty />
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
