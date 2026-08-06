import React from 'react';
import { AgentHomeBackground } from '../../components/Chat/Home/AgentHomeBackground';
import { DashboardEmpty } from '../../components/Dashboard/DashboardEmpty';
import { DashboardLoading } from '../../components/Dashboard/DashboardLoading';
import { DashboardQueryForm } from '../../components/Dashboard/DashboardQueryForm';
import { DashboardRenderer } from '../../components/Dashboard/DashboardRenderer';
import { DashboardStreamSkeleton } from '../../components/Dashboard/DashboardStreamSkeleton';
import { DashboardTabBar } from '../../components/Dashboard/DashboardTabBar';
import '../../components/Dashboard/dashboard.css';
import { SidebarIcon } from '../../components/Sidebar/icons/SidebarIcon';
import { randomShortId } from '../../lib/id';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { useDashboardStore } from '../../stores/dashboardStore';

const BOARD_COPY = {
  zh: {
    title: '智能看板',
    boardArea: '看板内容',
    noAgent: '请选择一个智能体后使用看板',
    noBoards: '当前智能体暂无可用看板',
    errorPrefix: '看板加载失败',
    streamingStatus: '看板数据正在持续更新',
    settlingStatus: '看板正在完成渲染',
  },
  en: {
    title: 'Smart Board',
    boardArea: 'Board content',
    noAgent: 'Select an agent to use the board',
    noBoards: 'No boards are available for this agent',
    errorPrefix: 'Board failed to load',
    streamingStatus: 'Board data is updating',
    settlingStatus: 'Board is finishing rendering',
  },
} as const;

type BoardLocale = keyof typeof BOARD_COPY;

function resolveBoardLocale(): BoardLocale {
  if (typeof navigator === 'undefined') return 'zh';
  const language = navigator.language || navigator.languages?.[0] || '';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function useBoardCopy() {
  const [locale, setLocale] = React.useState<BoardLocale>(() => resolveBoardLocale());

  React.useEffect(() => {
    const next = resolveBoardLocale();
    if (next !== locale) setLocale(next);
  }, [locale]);

  return BOARD_COPY[locale];
}

export const BoardHomePage: React.FC = () => {
  const copy = useBoardCopy();
  const [boardWorkSessionId] = React.useState(() => randomShortId());
  const agentId = useAgentContextStore((state) => state.currentAgentId);
  const dashboards = useDashboardStore((state) => state.dashboards);
  const currentKey = useDashboardStore((state) => state.currentKey);
  const listLoaded = useDashboardStore((state) => state.listLoaded);
  const loading = useDashboardStore((state) => state.loading);
  const runPhase = useDashboardStore((state) => state.runPhase);
  const streamContentReady = useDashboardStore((state) => state.streamContentReady);
  const error = useDashboardStore((state) => state.error);
  const snapshot = useDashboardStore((state) => state.snapshot);
  const scrollResetToken = useDashboardStore((state) => state.scrollResetToken);
  const setAgent = useDashboardStore((state) => state.setAgent);
  const loadLatest = useDashboardStore((state) => state.loadLatest);
  const markSnapshotRendered = useDashboardStore((state) => state.markSnapshotRendered);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const showStreamSkeleton = runPhase !== 'idle' && (runPhase === 'waiting' || !streamContentReady);

  React.useEffect(() => {
    void setAgent(agentId, { sessionId: boardWorkSessionId });
  }, [agentId, boardWorkSessionId, setAgent]);

  React.useEffect(() => {
    if (!agentId) return;
    void loadLatest({ sessionId: boardWorkSessionId });
  }, [agentId, boardWorkSessionId, currentKey, loadLatest]);

  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [currentKey, scrollResetToken]);

  return (
    <AgentHomeBackground
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <main
        data-testid="board-home-page"
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          gap: 0,
          padding: '0 0 8px 0',
          boxSizing: 'border-box',
          color: 'var(--fg-primary)',
        }}
      >
        <section
          aria-label={copy.title}
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--moss-sidebar-bg)',
            boxSizing: 'border-box',
          }}
        >
          <header
            style={{
              height: 48,
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '0.5px solid var(--border-subtle)',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                fontSize: 16,
                lineHeight: '24px',
                fontWeight: 600,
                color: 'var(--fg-primary)',
              }}
            >
              <SidebarIcon name="board" size={16} />
              <span>{copy.title}</span>
            </div>
          </header>

          <div
            aria-label={copy.boardArea}
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-secondary)',
            }}
          >
            {!agentId ? (
              <div className="dashboard-panel-message">{copy.noAgent}</div>
            ) : !listLoaded ? (
              <DashboardLoading />
            ) : dashboards.length === 0 ? (
              <div className="dashboard-panel-message">{copy.noBoards}</div>
            ) : (
              <>
                <DashboardTabBar />
                <div className="dashboard-scroll" style={{ flex: 1, minHeight: 0 }}>
                  <DashboardQueryForm sessionId={boardWorkSessionId} />
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
                          html={snapshot.html}
                          agentId={agentId}
                          dashboardKey={currentKey}
                          inputs={snapshot.inputs as Record<string, unknown> | null}
                          sessionId={boardWorkSessionId}
                          snapshotId={snapshot.snapshot_id}
                          streaming={runPhase === 'streaming'}
                          finalizing={runPhase === 'settling'}
                          onReady={markSnapshotRendered}
                        />
                      </div>
                    ) : loading ? (
                      <DashboardLoading />
                    ) : error ? (
                      <div className="dashboard-error">{copy.errorPrefix}: {error}</div>
                    ) : (
                      <DashboardEmpty />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </AgentHomeBackground>
  );
};

export default BoardHomePage;
