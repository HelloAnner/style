/**
 * SharePage — 公开回放页面
 *
 * 黑白色系，极简底部（进度条 + 1x/2x + 跳到结尾 + 输入框 + 提任务）
 * "提任务"是界面唯一的黑色按钮。
 */

import React, { useEffect, useReducer, useRef, useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import {
  buildEventSequence,
  replayReducer,
  createInitialState,
  type ReplayFileItem,
} from './ReplayEngine';
import { ReplayMessageList, ReplayTodoDrawer } from './ReplayMessageList';
import { ShareFileWorkspace } from './ShareFileWorkspace';
import { buildShareWorkspaceFiles } from './shareWorkspaceFiles';
import { kernelApiFetch } from '../../api/gateway';
import {
  parsePlanReview,
  parseQuestionData,
  parseRoundtableCreated,
  parseWidgetRender,
  stripAllMarkers,
} from '../../lib/wsContentParsers';
import { normalizeAnswerSources } from '../../lib/answerSources';
import { normalizeFollowUpQuestions } from '../../lib/followUpQuestions';
import { normalizeSubagentResults } from '../../lib/subagentResults';
import { getAgentDisplayName } from '../../types/platform';
import { useAuthStore } from '../../stores/authStore';
import { useAuthRehydrated } from '../../hooks/useAuthRehydrated';
import { appendRedirect } from '../../utils/authNavigation';
import { buildCurrentOriginUrl } from './shareNavigation';
import { useResizablePanelWidth } from '../../hooks/useResizablePanelWidth';
import { ResizeHandle } from '../../components/common/ResizeHandle';
import { SidebarFooterButton } from '../../components/Sidebar/SidebarFooterActions';
import { dashboardDisplayTextFromUserContent } from '../../components/Chat/DashboardAskChip';
import './SharePage.css';

interface AutomationInfo {
  name: string;
  description: string;
  trigger_config: any;
  trigger_count: number;
  agent_name: string;
}

interface ShareWidgetEvent {
  eventSeq: number;
  executionId?: string | null;
  responseMessageId?: string | null;
  widgetData: any;
}

interface ShareData {
  token: string;
  share_type?: 'enterprise' | 'public';
  title: string;
  description?: string;
  agent: { name: string; avatar_url?: string | null };
  messages: any[];
  executions: any[];
  widget_events?: ShareWidgetEvent[];
  files: { shared: any[]; session: any[] };
  view_count: number;
  automation?: AutomationInfo | null;
}

type ShareSidePanel = 'files';

function matchesShareFile(files: ReplayFileItem[], fileName: string): boolean {
  return files.some((file) =>
    file.name === fileName ||
    file.path === fileName ||
    file.path.endsWith('/' + fileName) ||
    fileName.includes(file.name)
  );
}

function toReplayFiles(files: any[] | undefined | null): ReplayFileItem[] {
  const seen = new Set<string>();
  const result: ReplayFileItem[] = [];
  for (const file of files || []) {
    const path = String(file?.path || file?.name || '').replace(/^\/+/, '');
    if (!path || seen.has(path)) continue;
    seen.add(path);
    result.push({
      name: String(file?.name || path.split('/').pop() || path),
      path,
      type: 'file',
      size: typeof file?.size === 'number' ? file.size : undefined,
    });
  }
  return result;
}

function preprocessMessages(
  messages: any[],
  executions?: any[],
  widgetEvents?: ShareWidgetEvent[],
): any[] {
  const processed = messages.map((msg) => {
    const next = { ...msg };
    const metadata = next.metadata && typeof next.metadata === 'object' && !Array.isArray(next.metadata)
      ? next.metadata
      : {};
    if (next.role === 'user') {
      if (!next.questionnaireReply && metadata.questionnaireReply) {
        next.questionnaireReply = metadata.questionnaireReply;
      }
      const persistedDisplayContent =
        typeof next.displayContent === 'string' ? next.displayContent :
        typeof metadata.displayContent === 'string' ? metadata.displayContent :
        typeof metadata.display_content === 'string' ? metadata.display_content :
        '';
      const dashboardDisplayContent = dashboardDisplayTextFromUserContent(persistedDisplayContent || next.content || '');
      if (persistedDisplayContent || dashboardDisplayContent) {
        next.displayContent = dashboardDisplayContent || persistedDisplayContent;
      }
      return next;
    }
    if (next.role !== 'assistant') return next;
    const content = next.content || '';
    const question = parseQuestionData(content);
    if (question.questionData) next.questionData = next.questionData || question.questionData;
    const plan = parsePlanReview(question.cleanContent);
    if (plan.planReviewData) next.planReviewData = next.planReviewData || plan.planReviewData;
    const widget = parseWidgetRender(plan.cleanContent);
    if (widget.widgetData) pushUniqueWidget(next, widget.widgetData);
    const roundtable = parseRoundtableCreated(widget.cleanContent);
    if (roundtable.roundtableData) {
      next.roundtableData = next.roundtableData || roundtable.roundtableData;
      next.roundtableDataList = Array.isArray(next.roundtableDataList) && next.roundtableDataList.length > 0
        ? next.roundtableDataList
        : [roundtable.roundtableData];
    }
    const followUpFromMarker = markerPayload(content, 'FOLLOW_UP_QUESTIONS');
    next.followUpQuestions = normalizeFollowUpQuestions(
      next.follow_up_questions ?? next.followUpQuestions ?? metadata.follow_up_questions ?? followUpFromMarker,
    );
    const sources = normalizeAnswerSources(next.sources ?? metadata.sources);
    if (sources.length > 0) next.sources = sources;
    next.subagentResults = normalizeSubagentResults(
      next.subagent_results ?? next.subagentResults ?? metadata.subagent_results,
    ) ?? next.subagentResults;
    next.replayContent = buildReplayContent(next.anchoredContent, content);
    // 后续还会合并 widget_events / tool_calls，避免只保留 marker 或只保留事件时任一侧丢失。
    return next;
  });

  const assistantMsgs = processed.filter(m => m.role === 'assistant');
  const eventWidgetMessageIds = new Set<string>();
  const findAssistantMessage = (
    responseMessageId?: string | null,
    executionId?: string | null,
    fallbackToLatest = false,
  ) => {
    let target = responseMessageId
      ? assistantMsgs.find(m => m.id === responseMessageId)
      : undefined;
    if (!target && executionId) {
      target = assistantMsgs.find(m => m.executionId === executionId);
    }
    if (!target && fallbackToLatest && assistantMsgs.length > 0) {
      target = assistantMsgs[assistantMsgs.length - 1];
    }
    return target;
  };

  for (const event of [...(widgetEvents || [])].sort((a, b) => a.eventSeq - b.eventSeq)) {
    const target = findAssistantMessage(event.responseMessageId, event.executionId);
    if (!target || !event.widgetData?.code) continue;
    eventWidgetMessageIds.add(target.id);
    pushUniqueWidget(target, event.widgetData);
  }

  if (executions) {
    for (const exec of executions) {
      for (const iter of exec.iterations || []) {
        for (const tc of iter.tool_calls || []) {
          if (tc.name === 'show_widget' || tc.name === 'graph_3d') {
            const result = tc.result || '';
            const args = tc.arguments || {};
            let wData: any = null;
            const wMatch = result.match(/\[\[WIDGET_RENDER\]\]([\s\S]*?)\[\[\/WIDGET_RENDER\]\]/);
            if (wMatch) {
              try { const d = JSON.parse(wMatch[1]); if (d.code) wData = { title: d.title || '', code: d.code }; } catch { /* ignore */ }
            }
            if (!wData && args.widget_code) {
              wData = { title: args.title || '', code: args.widget_code };
            }
            if (wData) {
              const target = findAssistantMessage(null, exec.id, true);
              if (target && !eventWidgetMessageIds.has(target.id)) {
                pushUniqueWidget(target, wData);
              }
            }
          }
        }
      }
    }
  }

  return processed;
}

function buildReplayContent(anchoredContent: unknown, content: string): string {
  const anchored = typeof anchoredContent === 'string' ? stripAllMarkers(anchoredContent).trim() : '';
  const current = stripAllMarkers(content || '').trim();
  if (anchored && current) return `${anchored}\n\n---\n\n${current}`;
  return anchored || current;
}

function markerPayload(content: string, marker: string): unknown {
  const pattern = new RegExp(`\\[\\[${marker}\\]\\]([\\s\\S]*?)\\[\\[\\/${marker}\\]\\]`);
  const match = content.match(pattern);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

function pushUniqueWidget(message: any, widgetData: any): void {
  if (!widgetData?.code) return;
  if (!Array.isArray(message.widgetDataList)) message.widgetDataList = [];
  const exists = message.widgetDataList.some((item: any) => (
    item?.title === widgetData.title && item?.code === widgetData.code
  ));
  if (!exists) message.widgetDataList.push(widgetData);
}

const SharePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [manifestFiles, setManifestFiles] = useState<ReplayFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const authRehydrated = useAuthRehydrated();
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const attemptedAuthRestoreRef = useRef(false);

  const [state, dispatch] = useReducer(replayReducer, createInitialState());
  const timerRef = useRef<any>(null);
  const typingRef = useRef<any>(null);
  const sharePanelGroupRef = useRef<HTMLDivElement>(null);
  const workspaceResize = useResizablePanelWidth({
    storageKey: 'corevo.share-workspace-panel-width',
    defaultRatio: 0.35,
    minRatio: 0.35,
    maxRatio: 0.5,
    getContainerWidth: () => sharePanelGroupRef.current?.clientWidth ?? 1120,
  });

  useEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light');
    return () => {
      if (prev) document.documentElement.setAttribute('data-theme', prev);
      else document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  useEffect(() => {
    if (!token || !authRehydrated) return;
    (async () => {
      try {
        let res = await kernelApiFetch(`/api/v1/share/${token}`);
        if (res.status === 401 && !attemptedAuthRestoreRef.current) {
          attemptedAuthRestoreRef.current = true;
          const { user } = useAuthStore.getState();
          if (user && await restoreSession()) {
            res = await kernelApiFetch(`/api/v1/share/${token}`);
          }
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const message = data.detail || data.message || data.error || '分享不存在或已失效';
          const err = new Error(message) as Error & { status?: number };
          err.status = res.status;
          throw err;
        }
        const data: ShareData = await res.json();
        data.messages = preprocessMessages(data.messages, data.executions, data.widget_events);
        setManifestFiles(toReplayFiles(data.files?.session));
        setShareData(data);
      } catch (e: any) {
        setError(e.message || '加载失败');
        setErrorStatus(typeof e.status === 'number' ? e.status : null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, authRehydrated, restoreSession]);

  useEffect(() => {
    if (!token || !shareData) return;

    let cancelled = false;
    const refreshFiles = async () => {
      try {
        const res = await kernelApiFetch(`/api/v1/share/${token}/files`);
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setManifestFiles(toReplayFiles(data.files));
        }
      } catch {
        // Public shares omit unavailable files quietly.
      }
    };

    const timer = window.setInterval(refreshFiles, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, shareData]);

  const sessionFilesRef = useRef<ReplayFileItem[]>([]);
  const [sidePanel, setSidePanel] = useState<ShareSidePanel | null>(null);
  const [workspaceMaximized, setWorkspaceMaximized] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const openSidePanel = useCallback((panel: ShareSidePanel) => {
    setSidePanel(panel);
    dispatch({ type: 'OPEN_WORKSPACE' });
  }, []);

  const closeSidePanel = useCallback(() => {
    setWorkspaceMaximized(false);
    dispatch({ type: 'CLOSE_WORKSPACE' });
  }, []);

  const buildEventsWithOrphans = useCallback((speed: 1 | 2 = 1) => {
    if (!shareData) return [];
    const events = buildEventSequence(shareData.messages, shareData.executions, speed);
    const sessionFiles = sessionFilesRef.current;
    if (sessionFiles.length === 0) return events;

    const explicitPaths = new Set<string>();
    for (const ev of events) {
      if (ev.type === 'file_created') {
        const fn = ev.payload.fileName || '';
        explicitPaths.add(fn);
        explicitPaths.add(fn.split('/').pop() || fn);
      }
    }
    const orphanFiles = sessionFiles.filter((f: ReplayFileItem) =>
      !explicitPaths.has(f.path) && !explicitPaths.has(f.name)
    );
    if (orphanFiles.length > 0) {
      let insertIdx = -1;
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].type === 'sub_agent_complete') {
          insertIdx = i + 1;
          while (insertIdx < events.length && events[insertIdx].type === 'file_created') {
            insertIdx++;
          }
          break;
        }
      }
      if (insertIdx === -1) {
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].type === 'tools_collapse') { insertIdx = i + 1; break; }
        }
      }
      if (insertIdx === -1) insertIdx = events.length;
      const orphanEvents = orphanFiles.map((f: ReplayFileItem) => ({
        type: 'file_created' as const,
        duration: 300,
        payload: { toolCall: null, fileName: f.path },
      }));
      events.splice(insertIdx, 0, ...orphanEvents);
    }
    return events;
  }, [shareData]);

  useEffect(() => {
    if (!shareData) return;
    sessionFilesRef.current = toReplayFiles(shareData.files?.session);
    const events = buildEventsWithOrphans(1);
    dispatch({ type: 'INIT', events });
  }, [shareData, buildEventsWithOrphans]);

  useEffect(() => {
    sessionFilesRef.current = manifestFiles;
    if (state.isComplete && manifestFiles.length > 0) {
      dispatch({ type: 'SET_SESSION_FILES', files: manifestFiles });
    }
  }, [manifestFiles, state.isComplete]);

  useEffect(() => {
    if (state.isComplete && sessionFilesRef.current.length > 0) {
      dispatch({ type: 'SET_SESSION_FILES', files: sessionFilesRef.current });
    }
  }, [state.isComplete]);

  // Replay loop
  useEffect(() => {
    if (!state.isPlaying || state.isComplete) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    const currentEvent = state.events[state.currentIndex];
    if (!currentEvent && state.currentIndex === -1) {
      dispatch({ type: 'ADVANCE' });
      return;
    }
    if (state.typingMessageId) return;
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.events.length) {
      dispatch({ type: 'COMPLETE' });
      return;
    }
    const isPostTyping = currentEvent?.type === 'agent_text';
    const delay = isPostTyping ? 80 : (currentEvent ? currentEvent.duration / state.speed : 80);
    timerRef.current = setTimeout(() => dispatch({ type: 'ADVANCE' }), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.isPlaying, state.currentIndex, state.isComplete, state.typingMessageId, state.speed, state.events]);

  // Typewriter — non-uniform rhythm for natural feel
  useEffect(() => {
    if (!state.typingMessageId || !state.isPlaying) {
      if (typingRef.current) clearTimeout(typingRef.current);
      return;
    }
    const fullText = state.typingFullText;
    let charIndex = state.typingText.length;
    const speed = state.speed;

    const typeNextChunk = () => {
      if (charIndex >= fullText.length) {
        dispatch({ type: 'TYPING_DONE' });
        return;
      }

      const ch = fullText[charIndex - 1] || '';
      const isPunct = /[。！？\n]/.test(ch);
      const isMinorPunct = /[，、；：,.;:]/.test(ch);

      if (isPunct && Math.random() < 0.4) {
        dispatch({ type: 'TYPING_PROGRESS', text: fullText.slice(0, charIndex) });
        typingRef.current = setTimeout(typeNextChunk, (250 + Math.random() * 200) / speed);
        return;
      }
      if (isMinorPunct && Math.random() < 0.25) {
        dispatch({ type: 'TYPING_PROGRESS', text: fullText.slice(0, charIndex) });
        typingRef.current = setTimeout(typeNextChunk, (100 + Math.random() * 120) / speed);
        return;
      }

      const burst = Math.random() < 0.75
        ? Math.max(4, Math.floor(speed * 7 + Math.random() * 5))
        : Math.max(2, Math.floor(speed * 3));

      charIndex = Math.min(charIndex + burst, fullText.length);
      dispatch({ type: 'TYPING_PROGRESS', text: fullText.slice(0, charIndex) });

      if (charIndex >= fullText.length) {
        dispatch({ type: 'TYPING_DONE' });
        return;
      }

      const delay = Math.random() < 0.88 ? 15 / speed : 30 / speed;
      typingRef.current = setTimeout(typeNextChunk, delay);
    };

    typeNextChunk();
    return () => { if (typingRef.current) clearTimeout(typingRef.current); };
  }, [state.typingMessageId, state.typingFullText, state.isPlaying, state.speed]);

  const handleTogglePlay = useCallback(() => {
    if (state.isComplete) {
      const events = buildEventsWithOrphans(state.speed);
      dispatch({ type: 'INIT', events });
    } else {
      dispatch({ type: 'SET_PLAYING', isPlaying: !state.isPlaying });
    }
  }, [state.isComplete, state.isPlaying, state.speed, buildEventsWithOrphans]);

  const handleSetSpeed = useCallback((speed: 1 | 2) => {
    dispatch({ type: 'SET_SPEED', speed });
  }, []);

  const handleSkipToEnd = useCallback(() => {
    dispatch({ type: 'JUMP_TO', index: state.events.length });
  }, [state.events.length]);

  const handleSeek = useCallback((index: number) => {
    dispatch({ type: 'JUMP_TO', index });
  }, []);

  const [pendingOpenFile, setPendingOpenFile] = useState<{ name: string; ts: number } | null>(null);
  const handleFileClick = useCallback((fileName: string) => {
    const isManifestFile = matchesShareFile(manifestFiles, fileName);
    if (!isManifestFile) return;
    openSidePanel('files');
    setPendingOpenFile({ name: fileName, ts: Date.now() });
  }, [manifestFiles, openSidePanel]);

  const progress = state.events.length > 0 ? Math.min((state.currentIndex + 1) / state.events.length, 1) : 0;
  const progressRef = useRef<HTMLDivElement>(null);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || state.events.length === 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      handleSeek(Math.round(ratio * (state.events.length - 1)));
    },
    [state.events.length, handleSeek],
  );

  // Track whether the user manually toggled the todo drawer
  const todoUserToggledRef = useRef(false);
  const todoFirstAppearedRef = useRef(false);

  const handleTodoToggle = useCallback(() => {
    todoUserToggledRef.current = true;
    dispatch({ type: 'TODO_TOGGLE' });
  }, []);

  // Auto-collapse 3s after first appearance (unless user manually toggled)
  useEffect(() => {
    if (state.globalTodos.length === 0 || !state.todoExpanded) return;
    if (todoFirstAppearedRef.current) return;
    todoFirstAppearedRef.current = true;
    const timer = setTimeout(() => {
      if (!todoUserToggledRef.current) {
        dispatch({ type: 'TODO_COLLAPSE' });
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [state.globalTodos.length > 0 && state.todoExpanded]);

  // Auto-collapse 3s after all tasks complete (always, even if user toggled)
  useEffect(() => {
    if (state.globalTodos.length === 0 || !state.todoExpanded) return;
    const allDone = state.globalTodos.every(t => t.status === 'completed' || t.status === 'cancelled');
    if (allDone) {
      const timer = setTimeout(() => dispatch({ type: 'TODO_COLLAPSE' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.globalTodos, state.todoExpanded]);

  const sharePath = token ? `/share/${encodeURIComponent(token)}` : '/';
  const redirectTop = useCallback((url: string) => {
    if (window.top !== window.self) {
      window.top!.location.href = url;
    } else {
      window.location.href = url;
    }
  }, []);

  const handleLogin = useCallback(() => {
    redirectTop(appendRedirect('/login', sharePath));
  }, [redirectTop, sharePath]);

  const handleCTA = useCallback(() => {
    if (shareData?.share_type === 'enterprise') {
      const { isAuthenticated } = useAuthStore.getState();
      if (isAuthenticated) {
        redirectTop(buildCurrentOriginUrl('/'));
      } else {
        redirectTop(appendRedirect('/login', '/'));
      }
      return;
    }
    redirectTop(buildCurrentOriginUrl('/'));
  }, [redirectTop, shareData?.share_type]);

  const workspaceFiles = useMemo(() => {
    return buildShareWorkspaceFiles(manifestFiles, state.activeFiles);
  }, [manifestFiles, state.activeFiles]);

  const hasSessionFiles = workspaceFiles.length > 0;
  const activeSidePanel: ShareSidePanel | null = sidePanel ?? (hasSessionFiles ? 'files' : null);

  // Loading
  if (loading) {
    return (
      <div data-testid="share-page-loading" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}>
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ fontSize: 15 }}>
          加载中...
        </motion.div>
      </div>
    );
  }

  // Error
  if (error || !shareData) {
    const loginRequired = errorStatus === 401;
    const forbidden = errorStatus === 403;
    const expired = errorStatus === 410;
    const title = loginRequired ? '需要登录后查看' : forbidden ? '无权访问该分享' : expired ? '分享链接已失效' : '分享无法打开';
    const description = error || (loginRequired ? '这是企业内分享链接，请先登录 Moss。' : '分享不存在或已失效');
    return (
      <div data-testid="share-page-error" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', gap: 12 }}>
        <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '8px 0 0' }}>{description}</p>
        </div>
        {loginRequired ? (
          <button
            onClick={handleLogin}
            data-testid="share-page-login"
            style={{
              marginTop: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--btn-mono-bg)',
              background: 'var(--btn-mono-bg)',
              color: 'var(--btn-mono-text)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            登录 Moss
          </button>
        ) : (
          <a href="/" target="_top" style={{ fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'underline' }}>回到首页</a>
        )}
      </div>
    );
  }

  // Speed button style helper
  const speedBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px', fontSize: 12, fontWeight: active ? 600 : 400,
    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
    background: active ? 'var(--bg-tertiary)' : 'transparent',
    border: 'none', borderRadius: 4, cursor: 'pointer', transition: 'all 0.15s',
  });
  const agentDisplayName = getAgentDisplayName(shareData.agent.name);
  const sessionTitle = shareData.title?.trim() || '未命名任务';
  const toggleSidePanel = (panel: ShareSidePanel) => {
    if (state.workspaceOpen && activeSidePanel === panel) {
      closeSidePanel();
      return;
    }
    openSidePanel(panel);
  };

  return (
    <div
      ref={sharePanelGroupRef}
      data-testid="share-page"
      className="share-page-root flex overflow-hidden"
      style={{ background: 'var(--bg-primary)', padding: 0, gap: 0, position: 'relative', height: '100dvh', minHeight: '100dvh' }}
    >
      {/* Keep the header at page-root level: nesting it in the chat column makes right: 0 stop before the workspace. */}
      <div
        className="flex items-center justify-between"
        data-testid="share-page-header"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          padding: '0 16px',
          height: 48,
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-primary)',
          flexShrink: 0,
        }}
      >
        <div className="flex items-center" style={{ gap: 10, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            MOSS·谋士
          </span>
          <div className="share-page-brand-divider" style={{ width: 1, height: 16, background: 'var(--border-subtle)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sessionTitle}
          </span>
          <span
            className="share-page-agent-badge"
            style={{
              height: 20,
              padding: '0 8px',
              borderRadius: 4,
              background: 'var(--info-bg-soft)',
              color: 'var(--btn-primary-bg)',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {agentDisplayName}
          </span>
        </div>
        <div className="flex items-center" style={{ gap: 8, flexShrink: 0 }}>
          {hasSessionFiles && (
            <SidebarFooterButton
              entry="workspace"
              label="分享会话文件"
              testId="share-page-files-toggle"
              onClick={() => toggleSidePanel('files')}
              isActive={activeSidePanel === 'files' && state.workspaceOpen}
              title="打开会话文件"
              style={{ flex: '0 0 auto', minWidth: 128, padding: '5px 12px' }}
            />
          )}
        </div>
      </div>

      {/* ─── Left: Chat column (messages + bottom dock) ─── */}
      <div
        data-testid="share-page-chat-column"
        className="share-page-chat-column"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', paddingTop: 48, transition: 'flex 0.4s cubic-bezier(0.32, 0.72, 0, 1)', position: 'relative' }}
      >
        {/* Messages */}
        <ReplayMessageList state={state} agentName={agentDisplayName} agentAvatarId={shareData.agent.avatar_url} automation={shareData.automation} onFileClick={handleFileClick} />

        {/* Bottom dock */}
        <div className="share-page-bottom-dock" data-testid="share-page-bottom-dock" style={{ flexShrink: 0, padding: '10px 0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Todo drawer — fixed above progress bar */}
          <AnimatePresence>
            {state.globalTodos.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ maxWidth: 640, width: '100%', margin: '0 auto', overflow: 'hidden' }}
              >
                <ReplayTodoDrawer
                  todos={state.globalTodos}
                  isExpanded={state.todoExpanded}
                  onToggle={handleTodoToggle}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center" style={{ gap: 10, maxWidth: 640, width: '100%', margin: '0 auto' }} data-testid="share-page-controls">
            <button
              onClick={handleTogglePlay}
              data-testid="share-page-play-toggle"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '1.5px solid var(--border-default)',
                background: 'transparent', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
              }}
              title={state.isComplete ? '重播' : state.isPlaying ? '暂停' : '播放'}
            >
              {state.isComplete ? (
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1,4 1,10 7,10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              ) : state.isPlaying ? (
                <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="5" height="18" rx="1" /><rect x="14" y="3" width="5" height="18" rx="1" /></svg>
              ) : (
                <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21" /></svg>
              )}
            </button>
            <div
              ref={progressRef}
              onClick={handleProgressClick}
              data-testid="share-page-progress"
              style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border-subtle)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            >
              <motion.div
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 2, background: 'var(--text-tertiary)' }}
              />
            </div>
            <div className="flex items-center" style={{ gap: 2, flexShrink: 0 }}>
              <button onClick={() => handleSetSpeed(1)} style={speedBtnStyle(state.speed === 1)} data-testid="share-page-speed-1x">1x</button>
              <button onClick={() => handleSetSpeed(2)} style={speedBtnStyle(state.speed === 2)} data-testid="share-page-speed-2x">2x</button>
            </div>
            <button
              onClick={handleSkipToEnd}
              data-testid="share-page-skip-end"
              style={{ ...speedBtnStyle(false), display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--text-tertiary)' }}
              title="查看全部"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.7 }}>
                <polygon points="5,4 15,12 5,20" />
                <rect x="17" y="4" width="3" height="16" rx="1" />
              </svg>
            </button>
          </div>
          <AnimatePresence>
            {state.isComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                data-testid="share-page-cta"
                style={{
                  minHeight: 40,
                  maxWidth: 640,
                  width: '100%',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  background: 'var(--bg-primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    MOSS·谋士
                  </span>
                  <motion.button
                    onClick={handleCTA}
                    data-testid="share-page-cta-button"
                    initial={{ opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.32, delay: 0.1, ease: 'easeOut' }}
                    style={{
                      padding: '0 14px',
                      height: 34,
                      fontSize: 12,
                      fontWeight: 400,
                      whiteSpace: 'nowrap',
                      color: 'var(--btn-primary-bg)',
                      background: 'color-mix(in srgb, var(--info-bg-soft) 55%, var(--bg-primary))',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    {shareData.share_type === 'enterprise' ? '立即登录 Moss →' : '免费试用 Moss →'}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Right: Workspace — peer of chat column, full height ─── */}
      <AnimatePresence>
        {state.workspaceOpen && activeSidePanel && (
          <motion.div
            layout
            layoutDependency={workspaceMaximized}
            initial={prefersReducedMotion ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={prefersReducedMotion ? { x: 0 } : { x: '100%' }}
            data-testid="share-page-workspace-shell"
            className="share-page-workspace-shell"
            transition={{
              x: {
                duration: prefersReducedMotion ? 0 : 0.32,
                ease: [0.32, 0.72, 0, 1],
              },
              layout: {
                duration: prefersReducedMotion ? 0 : 0.3,
                ease: 'easeInOut',
              },
            }}
            style={{
              position: workspaceMaximized ? 'absolute' : undefined,
              inset: workspaceMaximized ? '48px 0 0' : undefined,
              zIndex: workspaceMaximized ? 30 : undefined,
              width: workspaceMaximized ? '100%' : undefined,
              height: workspaceMaximized ? 'auto' : 'calc(100% - 48px)',
              marginTop: workspaceMaximized ? 0 : 48,
              display: 'flex',
              flexShrink: 0,
              minWidth: 0,
              overflow: 'hidden',
              background: workspaceMaximized ? 'var(--bg-primary)' : undefined,
            }}
          >
            {!workspaceMaximized && (
              <ResizeHandle
                onMouseDown={(e) => workspaceResize.startResize(e, 'left')}
                ariaLabel="拖拽调整分享会话文件区宽度"
              />
            )}
            <motion.div
              initial={false}
              data-testid="share-page-workspace-panel"
              className="share-page-workspace-panel"
              style={{
                width: workspaceMaximized ? '100%' : workspaceResize.width,
                minWidth: workspaceMaximized ? 0 : 480,
                height: '100%',
                overflow: 'hidden',
                flexShrink: 0,
                transformOrigin: 'right center',
              }}
            >
              <ShareFileWorkspace
                files={workspaceFiles}
                shareToken={token!}
                allowDownload={shareData.share_type === 'enterprise'}
                isOpen={state.workspaceOpen}
                isMaximized={workspaceMaximized}
                onToggleMaximized={() => setWorkspaceMaximized((maximized) => !maximized)}
                onClose={closeSidePanel}
                openFileRequest={pendingOpenFile}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SharePage;
