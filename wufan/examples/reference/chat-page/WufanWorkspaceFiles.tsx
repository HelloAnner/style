import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  WufanFilePreviewKind,
  WufanFilePreviewPayload,
  WufanWorkspaceFile,
  WufanWorkspaceFilesProps,
} from './types';

type WorkspaceTab =
  | { id: 'canvas'; kind: 'canvas'; name: '文件画布' }
  | { id: string; kind: 'file'; file: WufanWorkspaceFile };

type FileMode = 'preview' | 'edit' | 'render';

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading'; slow: boolean }
  | { status: 'ready'; payload: WufanFilePreviewPayload }
  | { status: 'error'; message: string; retries: number };

export const WUFAN_WORKSPACE_FILE_FIXTURES: WufanWorkspaceFile[] = [
  {
    id: 'file-insight',
    name: '客户洞察分析.md',
    path: '客户洞察分析.md',
    level: 'session',
    sessionId: 'session-workspace-query',
    sizeBytes: 18_432,
    contentType: 'text/markdown',
    updatedAt: '2026-07-30T10:32:41.000Z',
    previewKind: 'markdown',
  },
  {
    id: 'file-entities',
    name: '企业主体核验.csv',
    path: '企业主体核验.csv',
    level: 'session',
    sessionId: 'session-workspace-query',
    sizeBytes: 6_144,
    contentType: 'text/csv',
    updatedAt: '2026-07-30T10:29:41.000Z',
    previewKind: 'csv',
  },
  {
    id: 'file-priority',
    name: '合作优先级建议.pdf',
    path: '合作优先级建议.pdf',
    level: 'session',
    sessionId: 'session-workspace-query',
    sizeBytes: 1_258_291,
    contentType: 'application/pdf',
    updatedAt: '2026-07-30T10:24:41.000Z',
    previewKind: 'pdf',
  },
  {
    id: 'file-source',
    name: '主体数据源.json',
    path: 'files/主体数据源.json',
    level: 'agent-shared',
    sizeBytes: 8_716,
    contentType: 'application/json',
    updatedAt: '2026-07-30T10:21:12.000Z',
    previewKind: 'json',
  },
  {
    id: 'file-dashboard',
    name: '客户优先级看板.html',
    path: 'files/客户优先级看板.html',
    level: 'agent-shared',
    sizeBytes: 24_820,
    contentType: 'text/html',
    updatedAt: '2026-07-30T10:18:00.000Z',
    previewKind: 'html',
  },
  {
    id: 'file-template',
    name: '客户调研模板.xlsx',
    path: 'files/客户调研模板.xlsx',
    level: 'agent-shared',
    sizeBytes: 46_080,
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    updatedAt: '2026-07-29T08:20:00.000Z',
    previewKind: 'spreadsheet',
  },
  {
    id: 'file-archive',
    name: '历史资料.zip',
    path: 'files/历史资料.zip',
    level: 'agent-shared',
    sizeBytes: 4_823_040,
    contentType: 'application/zip',
    updatedAt: '2026-07-25T09:10:00.000Z',
    previewKind: 'unsupported',
  },
];

const CONTENT = {
  markdown: `# 三家汽车企业合作优先级

本轮分析已完成主体核验、客户洞察与合作场景匹配。

## 建议顺序

1. 比亚迪：优先推进数据协同与渠道分析。
2. 蔚来：适合从用户运营与服务体验切入。
3. 理想汽车：先验证家庭用户场景的联合方案。

> 结论基于本次会话检索到的公开资料，请在商务推进前复核时效。`,
  csv: `企业,主体状态,统一社会信用代码,建议
比亚迪股份有限公司,存续,91440300192317458F,优先
蔚来控股有限公司,存续,91340111MA2RAD3M4R,跟进
北京车和家信息技术有限公司,存续,91110108355231542F,验证`,
  json: JSON.stringify(
    {
      verified_at: '2026-07-30T10:29:41+08:00',
      count: 3,
      entities: [
        { name: '比亚迪股份有限公司', confidence: 0.98 },
        { name: '蔚来控股有限公司', confidence: 0.96 },
      ],
    },
    null,
    2,
  ),
  html: `<!doctype html>
<html><head><style>
body{font-family:Inter,system-ui;margin:0;padding:32px;background:#f8fafc;color:#172033}
h1{font-size:24px;margin:0 0 20px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.card{padding:18px;border-radius:14px;background:white;box-shadow:0 8px 24px rgba(15,23,42,.08)}
.bar{height:8px;margin-top:18px;border-radius:8px;background:linear-gradient(90deg,#6366f1,#22d3ee)}
</style></head><body><h1>客户优先级看板</h1><div class="cards"><div class="card">比亚迪<div class="bar"></div></div><div class="card">蔚来<div class="bar" style="width:78%"></div></div><div class="card">理想汽车<div class="bar" style="width:66%"></div></div></div></body></html>`,
};

export function detectPreviewKind(name: string): WufanFilePreviewKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (ext === 'pdf' || ['doc', 'docx'].includes(ext)) return 'pdf';
  if (['xlsx', 'xls'].includes(ext)) return 'spreadsheet';
  if (['pptx', 'ppt'].includes(ext)) return 'presentation';
  if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (ext === 'csv') return 'csv';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (ext === 'json') return 'json';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (
    ['txt', 'yaml', 'yml', 'toml', 'ini', 'conf', 'log', 'js', 'ts', 'jsx',
      'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'css', 'scss', 'xml'].includes(ext)
  ) return 'text';
  return 'unsupported';
}

function defaultPayload(file: WufanWorkspaceFile): WufanFilePreviewPayload {
  const kind = file.previewKind ?? detectPreviewKind(file.name);
  const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
  const filePath = file.level === 'session' && file.sessionId
    ? `/api/agents/agent-1/sessions/${encodeURIComponent(file.sessionId)}/files/${encodedPath}`
    : `/api/agents/agent-1/files/${encodedPath}`;
  if (kind === 'markdown') return { kind, content: CONTENT.markdown };
  if (kind === 'csv') return { kind, content: CONTENT.csv };
  if (kind === 'json') return { kind, content: CONTENT.json };
  if (kind === 'html') return { kind, content: CONTENT.html };
  if (kind === 'text') return { kind, content: '文件内容示例\n\n下一步：补充近 90 天公开经营信息。' };
  if (kind === 'pdf') return { kind, pageCount: 6 };
  if (kind === 'spreadsheet') {
    return { kind, sheetNames: ['客户清单', '跟进记录', '口径说明'] };
  }
  return {
    kind,
    inlineUrl: filePath,
    downloadUrl: filePath,
  };
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function Icon({
  name,
  size = 16,
}: {
  name:
    | 'canvas'
    | 'check'
    | 'close'
    | 'download'
    | 'edit'
    | 'external'
    | 'file'
    | 'maximize'
    | 'minimize'
    | 'play'
    | 'plus'
    | 'save'
    | 'search'
    | 'share';
  size?: number;
}): React.ReactElement {
  const path = {
    canvas: <><rect x="4" y="3" width="16" height="12" rx="2" /><path d="m8 19 4-4 4 4M12 15v6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 19h14" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8Z" /><path d="M14 2v6h6" /></>,
    maximize: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></>,
    minimize: <><path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" /></>,
    play: <path d="m8 5 11 7-11 7Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    save: <><path d="M5 3h12l2 2v16H5Z" /><path d="M8 3v6h8V3M8 21v-8h8v8" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" /></>,
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}

function FileBadge({ kind, compact = false }: { kind: WufanFilePreviewKind; compact?: boolean }): React.ReactElement {
  const label = {
    markdown: 'MD', csv: 'CSV', json: '{}', pdf: 'PDF', spreadsheet: 'XLS',
    presentation: 'PPT', image: 'IMG', video: '▶', audio: '♫', html: '</>',
    text: 'TXT', unsupported: 'FILE',
  }[kind];
  return <span className="wufan-studio-file-badge" data-kind={kind} data-compact={compact}>{label}</span>;
}

function MarkdownPreview({ content }: { content: string }): React.ReactElement {
  return (
    <article className="wufan-studio-markdown">
      {content.split('\n').map((line, index) => {
        if (line.startsWith('# ')) return <h1 key={index}>{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={index}>{line.slice(3)}</h2>;
        if (line.startsWith('> ')) return <blockquote key={index}>{line.slice(2)}</blockquote>;
        if (!line) return <span className="wufan-studio-markdown__space" key={index} />;
        return <p key={index}>{line}</p>;
      })}
    </article>
  );
}

function CsvPreview({ content }: { content: string }): React.ReactElement {
  const rows = content.split('\n').filter(Boolean).map((row) => row.split(','));
  return (
    <div className="wufan-studio-table-wrap">
      <table className="wufan-studio-table">
        <thead><tr>{rows[0]?.map((cell) => <th key={cell}>{cell}</th>)}</tr></thead>
        <tbody>{rows.slice(1).map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function PdfPreview({ pageCount = 1 }: { pageCount?: number }): React.ReactElement {
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(86);
  return (
    <div className="wufan-studio-pdf">
      <div className="wufan-studio-pdf__toolbar">
        <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹</button>
        <span>{page} / {pageCount}</span>
        <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>›</button>
        <button type="button" onClick={() => setScale((value) => Math.max(25, value - 10))}>−</button>
        <span>{scale}%</span>
        <button type="button" onClick={() => setScale((value) => Math.min(500, value + 10))}>+</button>
      </div>
      <div className="wufan-studio-pdf__stage">
        <article style={{ width: `${Math.min(scale, 100)}%` }}>
          <small>客户洞察 · 合作建议</small>
          <h2>三家汽车企业合作优先级</h2>
          <p>本报告汇总主体核验、客户洞察与业务匹配结果。</p>
          <div><span /><span /><span /></div>
          <footer>{page}</footer>
        </article>
      </div>
    </div>
  );
}

function SpreadsheetPreview({ sheets = [] }: { sheets?: string[] }): React.ReactElement {
  return (
    <div className="wufan-studio-sheet">
      <div className="wufan-studio-sheet__formula"><span>A1</span><strong>企业</strong></div>
      <CsvPreview content={'企业,合作方向,优先级,下一步\n比亚迪,渠道分析,P0,商务沟通\n蔚来,用户运营,P1,方案确认\n理想汽车,家庭场景,P1,联合验证'} />
      <nav>{sheets.map((sheet, index) => <button type="button" className={index === 0 ? 'is-active' : ''} key={sheet}>{sheet}</button>)}</nav>
    </div>
  );
}

function PreviewContent({
  file,
  payload,
  mode,
  editContent,
  onEditContent,
}: {
  file: WufanWorkspaceFile;
  payload: WufanFilePreviewPayload;
  mode: FileMode;
  editContent: string;
  onEditContent: (value: string) => void;
}): React.ReactElement {
  if (mode === 'edit') {
    return <textarea className="wufan-studio-editor" value={editContent} onChange={(event) => onEditContent(event.target.value)} spellCheck={false} />;
  }
  if (mode === 'render' && payload.kind === 'html') {
    return (
      <div className="wufan-studio-render">
        <div><iframe sandbox="allow-scripts allow-same-origin" srcDoc={payload.content} title="HTML 渲染预览" /></div>
        <span>网页 (1280 × 800)</span>
      </div>
    );
  }
  if (payload.kind === 'markdown') return <MarkdownPreview content={payload.content ?? ''} />;
  if (payload.kind === 'csv') return <CsvPreview content={payload.content ?? ''} />;
  if (payload.kind === 'json' || payload.kind === 'text') return <pre className="wufan-studio-code">{payload.content}</pre>;
  if (payload.kind === 'html') return <iframe className="wufan-studio-html" sandbox="allow-scripts allow-same-origin" srcDoc={payload.content} title={`HTML 预览: ${file.name}`} />;
  if (payload.kind === 'pdf') return <PdfPreview pageCount={payload.pageCount} />;
  if (payload.kind === 'spreadsheet') return <SpreadsheetPreview sheets={payload.sheetNames} />;
  if (payload.kind === 'image' && payload.inlineUrl) return <div className="wufan-studio-media"><img src={payload.inlineUrl} alt={file.name} /></div>;
  if (payload.kind === 'video' && payload.inlineUrl) return <div className="wufan-studio-media"><video src={payload.inlineUrl} controls /></div>;
  if (payload.kind === 'audio' && payload.inlineUrl) return <div className="wufan-studio-media"><audio src={payload.inlineUrl} controls /></div>;
  return <div className="wufan-studio-unsupported"><FileBadge kind="unsupported" /><strong>{file.name}</strong><span>该文件暂不支持在线预览</span></div>;
}

function FileCanvas({
  files,
  onOpen,
  onUploadRequest,
}: {
  files: WufanWorkspaceFile[];
  onOpen: (file: WufanWorkspaceFile) => void;
  onUploadRequest?: () => void;
}): React.ReactElement {
  const [query, setQuery] = useState('');
  const visible = files.filter((file) =>
    file.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const groups = [
    {
      id: 'agent-shared',
      title: '共享文件',
      files: visible.filter((file) => file.level !== 'session'),
    },
    {
      id: 'session',
      title: '会话文件',
      files: visible.filter((file) => file.level === 'session'),
    },
  ].filter((group) => group.files.length > 0);
  return (
    <div className="wufan-studio-canvas">
      <div className="wufan-studio-canvas__toolbar">
        <div><Icon name="canvas" size={16} /><strong>文件画布</strong></div>
        <div>
          <label>
            <Icon name="search" size={13} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件" aria-label="搜索文件" />
          </label>
          <button type="button" onClick={onUploadRequest} title="上传文件" aria-label="上传文件"><Icon name="plus" size={15} /></button>
        </div>
      </div>
      <div className="wufan-studio-canvas__body">
        {groups.map((group) => (
          <section className="wufan-studio-canvas__section" key={group.id}>
            <header><strong>{group.title}</strong><span>{group.files.length}</span></header>
            <div className="wufan-studio-canvas__grid">
              {group.files.map((file) => {
                const kind = file.previewKind ?? detectPreviewKind(file.name);
                return (
                  <button type="button" onClick={() => onOpen(file)} key={file.id} data-file-id={file.id}>
                    <div><FileBadge kind={kind} /></div>
                    <strong title={file.name}>{file.name}</strong>
                    <small>{formatSize(file.sizeBytes)}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 ? <div className="wufan-studio-canvas__empty">没有找到“{query}”</div> : null}
      </div>
    </div>
  );
}

export const WufanWorkspaceStudio = memo(function WufanWorkspaceStudio({
  files = WUFAN_WORKSPACE_FILE_FIXTURES,
  initialFileId,
  isMobile = false,
  expanded = false,
  onClose,
  onToggleExpanded,
  onLoadPreview,
  onUploadRequest,
  onDownload,
  onSave,
  onShare,
  onOpenNewWindow,
}: WufanWorkspaceFilesProps): React.ReactElement {
  const initialFile = files.find((file) => file.id === initialFileId);
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => [
    { id: 'canvas', kind: 'canvas', name: '文件画布' },
    ...(initialFile ? [{ id: `file:${initialFile.id}`, kind: 'file' as const, file: initialFile }] : []),
  ]);
  const [activeTabId, setActiveTabId] = useState(initialFile ? `file:${initialFile.id}` : 'canvas');
  const [modes, setModes] = useState<Record<string, FileMode>>({});
  const [payloads, setPayloads] = useState<Record<string, PreviewState>>({});
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'copied'>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const payloadsRef = useRef(payloads);
  payloadsRef.current = payloads;

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const activeFile = activeTab?.kind === 'file' ? activeTab.file : null;
  const activeMode = modes[activeTabId] ?? 'preview';
  const activePreview = activeFile ? payloads[activeFile.id] ?? { status: 'idle' as const } : { status: 'idle' as const };

  const loadPreview = useCallback(async (file: WufanWorkspaceFile, retries = 0) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestRef.current;
    setPayloads((current) => ({ ...current, [file.id]: { status: 'loading', slow: false } }));
    const slowTimer = window.setTimeout(() => {
      if (requestRef.current !== requestId) return;
      setPayloads((current) => ({
        ...current,
        [file.id]: current[file.id]?.status === 'loading'
          ? { status: 'loading', slow: true }
          : current[file.id],
      }));
    }, 5000);
    try {
      const payload = onLoadPreview
        ? await onLoadPreview(file, controller.signal)
        : await new Promise<WufanFilePreviewPayload>((resolve) => window.setTimeout(() => resolve(defaultPayload(file)), 420));
      if (!controller.signal.aborted && requestRef.current === requestId) {
        setPayloads((current) => ({ ...current, [file.id]: { status: 'ready', payload } }));
      }
    } catch (error) {
      if (!controller.signal.aborted && requestRef.current === requestId) {
        setPayloads((current) => ({
          ...current,
          [file.id]: {
            status: 'error',
            message: error instanceof Error ? error.message : '加载失败',
            retries,
          },
        }));
      }
    } finally {
      window.clearTimeout(slowTimer);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [onLoadPreview]);

  useEffect(() => {
    if (!activeFile) return undefined;
    const current = payloadsRef.current[activeFile.id];
    if (!current || current.status === 'idle') void loadPreview(activeFile);
    return () => {
      abortRef.current?.abort();
      requestRef.current += 1;
    };
  }, [activeFile, loadPreview]);

  const openFile = (file: WufanWorkspaceFile) => {
    const existing = tabs.find((tab) =>
      tab.kind === 'file' && (
        tab.file.id === file.id ||
        (
          tab.file.path === file.path &&
          tab.file.level === file.level &&
          tab.file.sessionId === file.sessionId
        )
      ),
    );
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const next: WorkspaceTab = { id: `file:${file.id}`, kind: 'file', file };
    setTabs((current) => {
      const fileTabs = current.filter((tab) => tab.kind === 'file');
      const removeId = fileTabs.length >= 8 ? fileTabs[0]?.id : null;
      return [...current.filter((tab) => tab.id !== removeId), next];
    });
    setActiveTabId(next.id);
  };

  const closeTab = (tabId: string) => {
    if (tabId === 'canvas') return;
    setTabs((current) => {
      const closedIndex = current.findIndex((tab) => tab.id === tabId);
      const next = current.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[Math.max(0, closedIndex - 1)]?.id ?? 'canvas');
      }
      return next;
    });
  };

  const enterEdit = () => {
    if (!activeFile || activePreview.status !== 'ready') return;
    setEditContent(activePreview.payload.content ?? '');
    setModes((current) => ({ ...current, [activeTabId]: 'edit' }));
  };

  const save = async () => {
    if (!activeFile) return;
    setSaving(true);
    try {
      await onSave?.(activeFile, editContent);
      const previous = activePreview.status === 'ready' ? activePreview.payload : defaultPayload(activeFile);
      setPayloads((current) => ({
        ...current,
        [activeFile.id]: { status: 'ready', payload: { ...previous, content: editContent } },
      }));
      setModes((current) => ({ ...current, [activeTabId]: 'preview' }));
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    if (!activeFile) return;
    setShareState('loading');
    try {
      await onShare?.(activeFile);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2500);
    } catch {
      setShareState('idle');
    }
  };

  const kind = activeFile?.previewKind ?? (activeFile ? detectPreviewKind(activeFile.name) : 'unsupported');
  const editable = ['markdown', 'text', 'csv', 'json', 'html'].includes(kind);

  return (
    <section className="wufan-studio" aria-label="工作室">
      <header className="wufan-studio__header">
        <div>
          <Icon name="canvas" size={18} />
          <strong>工作室</strong>
          {tabs.length > 1 ? <span>{tabs.length - 1}</span> : null}
        </div>
        <div>
          {!isMobile ? (
            <button type="button" onClick={onToggleExpanded} title={expanded ? '退出全屏' : '全屏预览'} aria-label={expanded ? '退出全屏' : '全屏预览'}>
              <Icon name={expanded ? 'minimize' : 'maximize'} />
            </button>
          ) : null}
          <button type="button" onClick={onClose} title="关闭工作室" aria-label="关闭工作室"><Icon name="close" size={isMobile ? 20 : 16} /></button>
        </div>
      </header>

      <nav className="wufan-studio-tabs" aria-label="工作室标签">
        {tabs.map((tab) => {
          const tabKind = tab.kind === 'file'
            ? tab.file.previewKind ?? detectPreviewKind(tab.file.name)
            : null;
          return (
            <button type="button" className="wufan-studio-tab" data-active={tab.id === activeTabId} onClick={() => setActiveTabId(tab.id)} key={tab.id}>
              {tab.kind === 'canvas' ? <Icon name="canvas" size={14} /> : <FileBadge kind={tabKind ?? 'unsupported'} compact />}
              <span>{tab.kind === 'canvas' ? tab.name : tab.file.name}</span>
              {tab.kind === 'file' ? <i role="button" aria-label={`关闭 ${tab.file.name}`} onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}><Icon name="close" size={12} /></i> : null}
            </button>
          );
        })}
      </nav>

      {activeFile ? (
        <div className="wufan-studio-file-header">
          <div><FileBadge kind={kind} compact /><strong>{activeFile.name}</strong>{activeMode === 'edit' ? <em>编辑中</em> : null}</div>
          <div>
            {activeMode === 'edit' ? (
              <>
                <button type="button" onClick={save} disabled={saving}><Icon name="save" size={14} />{saving ? '保存中...' : '保存'}</button>
                <button type="button" onClick={() => setModes((current) => ({ ...current, [activeTabId]: 'preview' }))}>取消</button>
              </>
            ) : (
              <>
                {kind === 'html' ? <button type="button" data-active={activeMode === 'render'} onClick={() => setModes((current) => ({ ...current, [activeTabId]: activeMode === 'render' ? 'preview' : 'render' }))}><Icon name="play" size={14} />渲染</button> : null}
                {editable ? <button type="button" onClick={enterEdit}><Icon name="edit" size={14} />编辑</button> : null}
                <button type="button" onClick={() => onDownload?.(activeFile)}><Icon name="download" size={14} />下载</button>
                <button type="button" onClick={() => onOpenNewWindow?.(activeFile)} title="新窗口打开"><Icon name="external" size={14} /></button>
                <button type="button" onClick={share} title="分享"><Icon name={shareState === 'copied' ? 'check' : 'share'} size={14} />{shareState === 'loading' ? '生成中' : shareState === 'copied' ? '已复制' : ''}</button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="wufan-studio__content">
        {activeTab?.kind === 'canvas' ? <FileCanvas files={files} onOpen={openFile} onUploadRequest={onUploadRequest} /> : null}
        {activeFile && activePreview.status === 'loading' ? (
          <div className="wufan-studio-loading"><span /> <strong>{activePreview.slow ? '加载较慢，请稍候...' : '加载中...'}</strong>{activePreview.slow ? <small>网络可能不稳定</small> : null}</div>
        ) : null}
        {activeFile && activePreview.status === 'error' ? (
          <div className="wufan-studio-error"><b>!</b><strong>无法加载文件</strong><small>{activePreview.message}</small><button type="button" onClick={() => void loadPreview(activeFile, activePreview.retries + 1)}>{activePreview.retries > 0 ? `重试 (${activePreview.retries})` : '重试'}</button></div>
        ) : null}
        {activeFile && activePreview.status === 'ready' ? (
          <PreviewContent file={activeFile} payload={activePreview.payload} mode={activeMode} editContent={editContent} onEditContent={setEditContent} />
        ) : null}
      </div>
    </section>
  );
});

/**
 * Backwards-compatible export name retained for consumers of the first
 * reference draft. The rendered component is the Wufan "工作室".
 */
export const WufanWorkspaceFiles = WufanWorkspaceStudio;
