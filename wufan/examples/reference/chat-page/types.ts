import type { ReactNode } from 'react';

export type WufanTheme = 'light' | 'dark';

export type WufanTraceStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type WufanTraceStepStatus =
  | 'pending'
  | 'running'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type WufanTraceIcon = 'read' | 'search' | 'draw' | 'warning';

export type WufanProcessNoteStep = {
  id: string;
  kind: 'note';
  seq: number;
  content: string;
  status: Extract<
    WufanTraceStepStatus,
    'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  >;
  segmentId?: string;
};

export type WufanToolCallStep = {
  id: string;
  kind: 'tool';
  seq: number;
  toolName: string;
  displayName: string;
  summary: string;
  status: WufanTraceStepStatus;
  icon?: WufanTraceIcon;
  durationMs?: number;
};

export type WufanReasoningStep = WufanProcessNoteStep | WufanToolCallStep;

export type WufanAnswerSource = {
  id: string;
  title: string;
  url: string;
  domain?: string;
};

export type WufanReasoningTrace = {
  id: string;
  status: WufanTraceStatus;
  durationMs?: number;
  steps: WufanReasoningStep[];
  sources?: WufanAnswerSource[];
  /**
   * Reference/demo-only initial UI state. A backend response should not control
   * whether a completed trace is expanded.
   */
  initialExpanded?: boolean;
};

export type WufanThumbsState = 'none' | 'liked' | 'disliked';

export type WufanFeedbackChoice =
  | 'solved'
  | 'partial'
  | 'unsolved'
  | 'thumbs_up'
  | 'thumbs_down';

export type WufanFeedbackReason =
  | '数据不准'
  | '反应过慢'
  | '分析不深'
  | '废话冗长'
  | '答非所问';

export type WufanFeedbackSubmission = {
  sessionId: string;
  messageId: string;
  choice: WufanFeedbackChoice;
  reasons?: WufanFeedbackReason[];
  comment?: string;
  runId?: string;
};

export type WufanMessageFeedback = {
  sessionId: string;
  runId?: string;
  initialState?: WufanThumbsState;
};

export type WufanRightPanelType =
  | 'none'
  | 'workspace'
  | 'execution'
  | 'automation';

export type WufanWorkspaceFileLevel =
  | 'agent-config'
  | 'agent-shared'
  | 'session';

export type WufanFilePreviewKind =
  | 'image'
  | 'pdf'
  | 'spreadsheet'
  | 'presentation'
  | 'video'
  | 'audio'
  | 'csv'
  | 'markdown'
  | 'json'
  | 'html'
  | 'text'
  | 'unsupported';

export type WufanWorkspaceFile = {
  id: string;
  name: string;
  path: string;
  level: WufanWorkspaceFileLevel;
  sessionId?: string;
  sizeBytes: number;
  contentType?: string | null;
  updatedAt: string;
  shared?: boolean;
  /**
   * Demo/reference shortcut. Production clients should derive this from the
   * filename and validate it against the server response.
   */
  previewKind?: WufanFilePreviewKind;
};

export type WufanFilePreviewPayload = {
  kind: WufanFilePreviewKind;
  content?: string;
  inlineUrl?: string;
  downloadUrl?: string;
  pageCount?: number;
  sheetNames?: string[];
};

export type WufanWorkspaceFilesProps = {
  files?: WufanWorkspaceFile[];
  initialFileId?: string;
  isMobile?: boolean;
  expanded?: boolean;
  onClose?: () => void;
  onToggleExpanded?: () => void;
  onLoadPreview?: (
    file: WufanWorkspaceFile,
    signal: AbortSignal,
  ) => Promise<WufanFilePreviewPayload>;
  onUploadRequest?: () => void;
  onDownload?: (file: WufanWorkspaceFile) => void | Promise<void>;
  onReferenceChange?: (
    file: WufanWorkspaceFile,
    referenced: boolean,
  ) => void | Promise<void>;
  onSave?: (
    file: WufanWorkspaceFile,
    content: string,
  ) => void | Promise<void>;
  onShare?: (file: WufanWorkspaceFile) => void | Promise<void>;
  onOpenNewWindow?: (file: WufanWorkspaceFile) => void | Promise<void>;
};

export type WufanExecutionNoticeStatus = 'success' | 'failed' | 'updated';

export type WufanExecutionNotice = {
  id: string;
  title: string;
  summary?: string;
  status: WufanExecutionNoticeStatus;
  createdAt: string;
  referenceType: 'session' | 'automation_pipeline';
  referenceId: string;
};

export type WufanSessionGroup = {
  label: string;
  sessions: Array<{
    id: string;
    title: string;
    active?: boolean;
  }>;
};

export type WufanMessage = {
  id: string;
  role: 'user' | 'agent';
  author: string;
  time: string;
  content?: ReactNode;
  trace?: WufanReasoningTrace;
  feedback?: WufanMessageFeedback;
};

export type WufanChatPageProps = {
  theme: WufanTheme;
  agentName?: string;
  sessionTitle?: string;
  sessionGroups?: WufanSessionGroup[];
  initialMessages?: WufanMessage[];
  modelLabel?: string;
  onSend?: (value: string) => void;
  onThemeChange?: (theme: WufanTheme) => void;
  onSourcesClick?: (
    messageId: string,
    sources: WufanAnswerSource[],
  ) => void;
  onSubmitFeedback?: (
    feedback: WufanFeedbackSubmission,
  ) => void | Promise<void>;
  onRevokeFeedback?: (
    sessionId: string,
    messageId: string,
  ) => void | Promise<void>;
  initialRightPanel?: WufanRightPanelType;
  workspaceFiles?: WufanWorkspaceFilesProps;
  executionNotices?: WufanExecutionNotice[];
  onExecutionNoticeClick?: (notice: WufanExecutionNotice) => void;
  showToolDurations?: boolean;
  className?: string;
};
