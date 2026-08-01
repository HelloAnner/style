/**
 * 侧边栏展开态容器。
 *
 * 该文件只保留状态组装、handler、辅助弹窗挂载和整体布局。
 * 展示结构拆到同目录组件，避免与对话区并行开发产生大文件冲突。
 */

import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { useUiStore } from '../../stores/uiStore';
import { useDesignSuggestionsStore } from '../../stores/designSuggestionsStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useBillingStore } from '../../stores/billingStore';
import { useExecutionStatusStore } from '../../stores/executionStatusStore';
import { useAgent } from '../../hooks/useAgent';
import type { Session } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import WhatsNew from '../common/WhatsNew';
import { PipelineCreator } from '../Automation/PipelineCreator';
import { toast } from '../../utils/toast';
import { BOARD_HOME_PATH, WORKSPACE_HOME_PATH } from '../../utils/routes';
import { SidebarAgentList } from './SidebarAgentList';
import { SidebarBrand } from './SidebarBrand';
import { SidebarFooterActions } from './SidebarFooterActions';
import { SidebarNewSessionButton } from './SidebarNewSessionButton';
import { SidebarSessionGroups, type SidebarGroupedSessions } from './SidebarSessionGroups';
import { SidebarUserEntry } from './SidebarUserEntry';
import closeIcon from '../../assets/icons/file-panel/close.svg';
import drawerStyles from '../Workspace/WorkspaceDrawer.module.css';

const AutomationTemplatePanel = lazy(() => import('../Automation/AutomationTemplatePanel'));
const NEW_SESSION_TOAST_DURATION_MS = 2000;

function showAlreadyOnNewSessionToast() {
  let toastId: string | number | undefined;
  toastId = toast.info('当前已处于新会话', {
    duration: NEW_SESSION_TOAST_DURATION_MS,
    style: {
      padding: '10px 12px 10px 16px',
    },
    action: (
      <button
        type="button"
        className={drawerStyles.iconBtn}
        style={{ marginLeft: 'auto' }}
        title="关闭"
        aria-label="关闭"
        onClick={(event) => {
          event.stopPropagation();
          toast.dismiss(toastId);
        }}
      >
        <img src={closeIcon} alt="" aria-hidden="true" className={drawerStyles.headerActionIcon} />
      </button>
    ),
  });
}

export const Sidebar: React.FC<{ onOpenAdmin?: () => void }> = ({ onOpenAdmin }) => {
  const {
    startNewSession,
    currentSessionId,
    sessions,
    isSessionStarred,
    closeSidebar,
  } = useAgentStore();
  const { currentAgentId } = useAgentContextStore();
  const executionRecords = useExecutionStatusStore((s) => s.records);
  const navigate = useNavigate();
  const location = useLocation();
  const isOnNewTaskPage = location.pathname === WORKSPACE_HOME_PATH;
  const isOnBoardPage = location.pathname === BOARD_HOME_PATH;
  const showWhatsNew = false;
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [showPipelineCreator, setShowPipelineCreator] = useState(false);
  const [pipelineTemplate, setPipelineTemplate] = useState<any>(null);
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<{ id: string; title: string } | null>(null);
  const currentAgent = useAgentContextStore.getState().getCurrentAgent();
  const openWorkspace = useUiStore((s) => s.openWorkspace);
  const openAutomation = useUiStore((s) => s.openAutomation);
  const ensureAutomationOpen = useUiStore((s) => s.ensureAutomationOpen);
  const rightPanelType = useUiStore((s) => s.rightPanelType);
  const { closeSessionTabs } = usePreviewStore();
  const { deleteSession, renameSession, updateSessionReadState, updateSessionStarState } = useAgent();

  const isBillingBlocked = useBillingStore((s) => {
    const { billingStatus, lastStatusErrorCode } = s;
    if (!billingStatus) return false;
    if (!billingStatus.provisioned) return true;
    if (billingStatus.planStatus === 'expired' || billingStatus.planStatus === 'exhausted') return true;
    if (billingStatus.insufficientForNextJob) return true;
    if (billingStatus.dailyLimitBreached) return true;
    if (lastStatusErrorCode === '7001' || lastStatusErrorCode === '7002' || lastStatusErrorCode === '7003' || lastStatusErrorCode === '7008') return true;
    return false;
  });

  const handleNewSession = () => {
    if (isOnNewTaskPage) {
      showAlreadyOnNewSessionToast();
      return;
    }
    closeSessionTabs();
    startNewSession();
    navigate(WORKSPACE_HOME_PATH);
  };

  const groupedSessions = useMemo<SidebarGroupedSessions>(() => {
    const starred: Session[] = [];
    const today: Session[] = [];
    const yesterday: Session[] = [];
    const older: Session[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const sorted = [...sessions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (const session of sorted) {
      if (session.starred) { starred.push(session); continue; }
      const updatedAt = new Date(session.updated_at);
      if (updatedAt >= todayStart) today.push(session);
      else if (updatedAt >= yesterdayStart) yesterday.push(session);
      else older.push(session);
    }
    return { starred, today, yesterday, older };
  }, [sessions]);

  const markSessionRead = useCallback((id: string) => {
    const session = sessions.find(item => item.id === id);
    if (!session?.is_unread) return;
    useAgentStore.getState().setSessionUnread(id, false);
    void updateSessionReadState(id, false);
  }, [sessions, updateSessionReadState]);

  const handleToggleSessionStar = useCallback((id: string) => {
    const current = useAgentStore.getState().isSessionStarred(id);
    void updateSessionStarState(id, !current);
  }, [updateSessionStarState]);

  const handleTaskNavigate = useCallback((path: string) => {
    const sid = path.replace('/s/', '');
    markSessionRead(sid);
    navigate(path);
  }, [markSessionRead, navigate]);

  const generatingSessionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const record of Object.values(executionRecords)) {
      if (record.executionType === 'chat_job' && record.active && record.sessionId) {
        ids.add(record.sessionId);
      }
    }
    return ids;
  }, [executionRecords]);
  const unreadSessionIds = useMemo(() => {
    return new Set(
      sessions
        .filter(session => session.is_unread)
        .map(session => session.id)
    );
  }, [sessions]);

  useEffect(() => {
    if (!currentSessionId) return;
    markSessionRead(currentSessionId);
  }, [currentSessionId, markSessionRead]);

  const handleDeleteTask = (session: { id: string; title: string }) => {
    setDeleteConfirmSession(session);
  };

  const confirmDeleteTask = async () => {
    if (!deleteConfirmSession) return;
    const sessionId = deleteConfirmSession.id;
    setDeleteConfirmSession(null);
    const isCurrent = sessionId === currentSessionId;
    const ok = await deleteSession(sessionId);
    if (ok && isCurrent && !isOnNewTaskPage) {
      navigate(WORKSPACE_HOME_PATH);
    }
  };

  return (
    <aside
      className="h-full flex flex-col"
      style={{
        width: 260,
        background: 'var(--moss-sidebar-bg)',
        borderRight: '1px solid var(--moss-sidebar-border)',
        boxShadow: 'var(--moss-sidebar-edge-shadow)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      data-testid="sidebar"
    >
      <SidebarBrand onCollapse={closeSidebar} />
      <SidebarAgentList />
      <div style={{ height: 1, background: 'var(--moss-sidebar-border)', margin: '6px 12px 8px' }} />
      <SidebarNewSessionButton
        disabled={isBillingBlocked}
        isActive={false}
        onNewSession={handleNewSession}
      />

      <SidebarSessionGroups
        groupedSessions={groupedSessions}
        currentSessionId={currentSessionId}
        isOnNewTaskPage={isOnNewTaskPage || isOnBoardPage}
        generatingSessionIds={generatingSessionIds}
        unreadSessionIds={unreadSessionIds}
        isSessionStarred={isSessionStarred}
        onNavigate={handleTaskNavigate}
        onDelete={handleDeleteTask}
        onToggleStar={handleToggleSessionStar}
        onRename={renameSession}
      />

      <SidebarFooterActions
        onOpenWorkspace={openWorkspace}
        onOpenAutomation={openAutomation}
        onOpenShowcase={() => navigate('/showcase')}
        activePanel={rightPanelType}
        disabledTools={isOnBoardPage}
      />

      <SidebarUserEntry onOpenAdmin={onOpenAdmin} />

      <WhatsNew isOpen={showWhatsNew} onClose={() => undefined} />
      {showTemplatePanel && (
        <Suspense fallback={null}>
          <AutomationTemplatePanel
            onClose={() => setShowTemplatePanel(false)}
            onCreated={() => { setShowTemplatePanel(false); }}
            onDesign={() => {
              setShowTemplatePanel(false);
              handleNewSession();
              setTimeout(() => useDesignSuggestionsStore.getState().show('automation'), 100);
            }}
            onAdvancedCreate={(template: any) => {
              setShowTemplatePanel(false);
              setPipelineTemplate(template);
              setShowPipelineCreator(true);
            }}
            onManualCreate={() => { setShowTemplatePanel(false); setPipelineTemplate(null); setShowPipelineCreator(true); }}
            agentId={currentAgentId || ''}
            agentAvatarUrl={currentAgent?.avatar_url}
          />
        </Suspense>
      )}

      <PipelineCreator
        isOpen={showPipelineCreator}
        onClose={() => { setShowPipelineCreator(false); setPipelineTemplate(null); }}
        onCreated={(createdPipeline) => { setShowPipelineCreator(false); setPipelineTemplate(null); setShowTemplatePanel(false); ensureAutomationOpen(createdPipeline?.id); }}
        onBack={pipelineTemplate ? () => { setShowPipelineCreator(false); setPipelineTemplate(null); setShowTemplatePanel(true); } : undefined}
        agentId={currentAgentId || ''}
        prefillTemplate={pipelineTemplate}
      />

      <ConfirmDialog
        open={deleteConfirmSession !== null}
        title="删除会话"
        description={`确定要删除“${deleteConfirmSession?.title ?? '未命名任务'}”吗？此操作无法撤销。`}
        variant="danger"
        confirmText="删除"
        cancelText="取消"
        onConfirm={() => { void confirmDeleteTask(); }}
        onCancel={() => setDeleteConfirmSession(null)}
      />
    </aside>
  );
};

export default Sidebar;
