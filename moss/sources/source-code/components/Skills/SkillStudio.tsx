/**
 * SkillStudio — 全屏技能创建/编辑面板
 *
 * 布局：左侧「技能身份」+ 右侧「技能内容」
 * 右侧采用 Tab 切换：SKILL.md ｜ 脚本 ｜ 参考文档
 * 每个 Tab 独占整个右侧编辑区域，解决旧版三块内容互相挤占的问题。
 * 创建模式下脚本/参考文档以「草稿」形式暂存，保存时先创建技能再批量上传。
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { skillManagementApi, type SkillFileTreeResponse } from '../../api/skillManagement';
import { track } from '../../utils/track';
import { toast } from '../../utils/toast';
import { CorevoDesignButton } from '../common/CorevoDesignButton';
import { ConfirmDialog } from '../common/ConfirmDialog';

/* ── Icons ── */

const BackIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/>
  </svg>
);

const SkillIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10,9 9,9 8,9"/>
  </svg>
);

const PlusIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const UploadIcon: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const TrashIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
  </svg>
);

const FileIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>
  </svg>
);

/* ── Types ── */

interface SkillFormData {
  name: string;
  description: string;
  body: string;
}

interface DraftFile {
  path: string;
  content: string;
  isNew?: boolean; // 创建模式下新增的草稿
}

type TabType = 'skill' | 'scripts' | 'references';

const DEFAULT_BODY = `# 技能标题

描述这个技能的使用场景和工作流程。此区域为 SKILL.md 正文（Markdown），当技能被触发时 Agent 会阅读这部分内容来执行任务。

## 核心工作流

1. 第一步：分析用户需求
2. 第二步：执行具体操作
3. 第三步：输出结果

## 注意事项

- 编写时以指导 Agent 执行任务的口吻
- 保持简明（建议 < 500 行），详细内容可拆分到「参考文档」
- 如有可执行脚本，请在「脚本」Tab 中添加`;

const EMPTY_FORM: SkillFormData = {
  name: '',
  description: '',
  body: DEFAULT_BODY,
};

const SHOW_SKILL_AI_ENTRY = false;

function buildSuggestedName(baseName: string, existingNames: string[]): string {
  const trimmed = (baseName || '新技能').trim() || '新技能';
  let suffix = 2;
  let candidate = `${trimmed}-${suffix}`;
  while (existingNames.includes(candidate)) {
    suffix += 1;
    candidate = `${trimmed}-${suffix}`;
  }
  return candidate;
}

export interface SkillStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onDesign?: (prompt: string) => void;
  existingNames?: string[];
  /** 编辑现有技能时传入，含服务端 skillId（用于编辑锁和文件操作）*/
  editSkill?: {
    name: string;
    content: string;
    skillId?: string;
    /** true = 来自对话卡片的只读预览，form 只读，隐藏保存按钮 */
    preview?: boolean;
    /** 打开 Studio 时默认定位的文件路径 */
    initialFilePath?: string;
  } | null;
}

/* ── Helpers ── */

function buildSkillMd(form: SkillFormData, skillId?: string | null): string {
  const frontmatter = [
    '---',
    skillId ? `id: ${skillId}` : null,
    `name: ${form.name}`,
    form.description ? `description: ${form.description}` : null,
    '---',
  ].filter(Boolean).join('\n');
  return frontmatter + '\n\n' + form.body;
}

function parseSkillMd(content: string): { name: string; description: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n*([\s\S]*)$/);
  if (!match) return { name: '', description: '', body: content };
  const frontmatter = match[1];
  const body = match[2];
  const nameMatch = frontmatter.match(/name:\s*(.+)/);
  const descMatch = frontmatter.match(/description:\s*(.+)/);
  return {
    name: nameMatch?.[1]?.trim() || '',
    description: descMatch?.[1]?.trim() || '',
    body: body.trim(),
  };
}

/* ── Component ── */

export const SkillStudio: React.FC<SkillStudioProps> = ({
  isOpen,
  onClose,
  onSaved,
  onDesign,
  existingNames = [],
  editSkill,
}) => {
  const navigate = useNavigate();
  const isEdit = !!editSkill;
  /** 只读预览模式（来自对话卡片的 tool_use_pending 审批前预览） */
  const isPreview = SHOW_SKILL_AI_ENTRY && !!editSkill?.preview;
  // skillId 用于编辑锁和文件 API（编辑模式下必填）
  const skillId = editSkill?.skillId ?? null;
  // 编辑锁续期定时器
  const lockRenewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [form, setForm] = useState<SkillFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Tab 状态
  const [activeTab, setActiveTab] = useState<TabType>('skill');

  // 文件管理（编辑模式从服务端加载 + 创建模式的草稿）
  const [treeByPath, setTreeByPath] = useState<Record<string, SkillFileTreeResponse>>({});
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [loadingDirs, setLoadingDirs] = useState<Record<string, boolean>>({});
  const [draftFiles, setDraftFiles] = useState<DraftFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileDirty, setFileDirty] = useState(false);
  const [pendingDeleteFilePath, setPendingDeleteFilePath] = useState<string | null>(null);

  // 新建文件输入
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const duplicateName = !!form.name.trim()
    && existingNames.includes(form.name.trim())
    && (!editSkill || form.name.trim() !== editSkill.name);
  const suggestedName = duplicateName ? buildSuggestedName(form.name, existingNames) : '';

  // 当前 Tab 对应的文件前缀
  const filePrefix = activeTab === 'scripts' ? 'scripts/' : 'references/';

  useEffect(() => {
    if (isOpen) {
      if (editSkill) {
        const parsed = parseSkillMd(editSkill.content);
        setForm({
          name: parsed.name || editSkill.name,
          description: parsed.description,
          body: parsed.body,
        });
        // 编辑模式：获取编辑锁
        if (skillId) {
          skillManagementApi.acquireLock(skillId).catch(() => {/* 锁冲突时前端不强制阻断，依赖后端 409 */});
          // 每 5 分钟续期
          lockRenewTimerRef.current = setInterval(() => {
            skillManagementApi.renewLock(skillId).catch(() => {});
          }, 5 * 60 * 1000);
        }
      } else {
        setForm({ ...EMPTY_FORM });
      }
      setTreeByPath({});
      setExpandedDirs({});
      setLoadingDirs({});
      setDraftFiles([]);
      setActiveFilePath(null);
      setFileContent('');
      setFileDirty(false);
      setActiveTab('skill');
      setShowNewFileInput(false);
      setNewFileName('');
      setError(null);
    } else {
      // 关闭时释放锁 + 清定时器
      if (skillId) {
        skillManagementApi.releaseLock(skillId).catch(() => {});
      }
      if (lockRenewTimerRef.current) {
        clearInterval(lockRenewTimerRef.current);
        lockRenewTimerRef.current = null;
      }
    }
    return () => {
      if (lockRenewTimerRef.current) {
        clearInterval(lockRenewTimerRef.current);
        lockRenewTimerRef.current = null;
      }
    };
  }, [isOpen, editSkill, skillId]);

  const loadTreePath = useCallback(async (path: string) => {
    if (!skillId) return;
    setLoadingDirs(prev => ({ ...prev, [path]: true }));
    try {
      const res = await skillManagementApi.listFileTree(skillId, path);
      setTreeByPath(prev => ({ ...prev, [path]: res }));
    } finally {
      setLoadingDirs(prev => ({ ...prev, [path]: false }));
    }
  }, [skillId]);

  useEffect(() => {
    if (!isOpen || !isEdit || !skillId) return;
    if (activeTab === 'skill') return;
    void loadTreePath(filePrefix);
  }, [isOpen, isEdit, skillId, activeTab, filePrefix, loadTreePath]);

  useEffect(() => {
    const targetPath = editSkill?.initialFilePath;
    if (!isOpen || !isEdit || !targetPath) return;
    if (targetPath.startsWith('scripts/')) {
      setActiveTab('scripts');
      return;
    }
    if (targetPath.startsWith('references/')) {
      setActiveTab('references');
      return;
    }
    setActiveTab('skill');
  }, [isOpen, isEdit, editSkill?.initialFilePath]);

  const update = useCallback(<K extends keyof SkillFormData>(key: K, value: SkillFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const rootServerFiles = treeByPath[filePrefix]?.files.map(item => item.path) || [];
  const rootServerDirs = treeByPath[filePrefix]?.dirs || [];
  const currentFiles = [...new Set([
    ...rootServerFiles,
    ...draftFiles
      .filter(d => d.path.startsWith(filePrefix) && d.isNew)
      .map(d => d.path),
  ])].sort();
  const hasCurrentTreeItems = currentFiles.length > 0 || rootServerDirs.length > 0;

  // 打开服务端文件
  const handleOpenServerFile = useCallback(async (path: string) => {
    if (fileDirty && activeFilePath) {
      const existing = draftFiles.find(d => d.path === activeFilePath);
      if (existing) {
        setDraftFiles(prev => prev.map(d => d.path === activeFilePath ? { ...d, content: fileContent } : d));
      }
    }
    const draft = draftFiles.find(d => d.path === path);
    if (draft) {
      setActiveFilePath(path);
      setFileContent(draft.content);
      setFileDirty(false);
      return;
    }
    if (!skillId) {
      setPendingDeleteFilePath(null);
      return;
    }
    try {
      const res = await skillManagementApi.getFile(skillId, path);
      setActiveFilePath(path);
      setFileContent(res.content ?? '');
      setFileDirty(false);
    } catch {
      setActiveFilePath(null);
      setFileContent('');
    }
  }, [fileDirty, activeFilePath, draftFiles, fileContent, skillId]);

  // 打开草稿文件
  const handleOpenDraftFile = useCallback((path: string) => {
    if (fileDirty && activeFilePath) {
      const existing = draftFiles.find(d => d.path === activeFilePath);
      if (existing) {
        setDraftFiles(prev => prev.map(d => d.path === activeFilePath ? { ...d, content: fileContent } : d));
      }
    }
    const draft = draftFiles.find(d => d.path === path);
    if (draft) {
      setActiveFilePath(path);
      setFileContent(draft.content);
      setFileDirty(false);
    }
  }, [fileDirty, activeFilePath, draftFiles, fileContent]);

  // 打开文件（自动判断来源）
  const handleOpenFile = useCallback((path: string) => {
    const draft = draftFiles.find(d => d.path === path);
    if (draft?.isNew) {
      handleOpenDraftFile(path);
    } else if (isEdit) {
      handleOpenServerFile(path);
    } else {
      handleOpenDraftFile(path);
    }
  }, [draftFiles, isEdit, handleOpenDraftFile, handleOpenServerFile]);

  useEffect(() => {
    const targetPath = editSkill?.initialFilePath;
    if (!isOpen || !isEdit || !skillId || !targetPath || targetPath === 'SKILL.md') return;
    if (activeFilePath === targetPath) return;
    handleOpenFile(targetPath);
  }, [
    isOpen,
    isEdit,
    skillId,
    editSkill?.initialFilePath,
    activeFilePath,
    draftFiles,
    handleOpenFile,
  ]);

  // 保存当前编辑中的文件到服务端（编辑模式）
  const handleSaveCurrentFile = async () => {
    if (!activeFilePath) return;
    const draft = draftFiles.find(d => d.path === activeFilePath);
    if (draft?.isNew) {
      setDraftFiles(prev => prev.map(d => d.path === activeFilePath ? { ...d, content: fileContent } : d));
      setFileDirty(false);
      return;
    }
    if (!skillId) return;
    try {
      await skillManagementApi.putFile(skillId, activeFilePath, fileContent);
      setFileDirty(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败';
      toast.error(`保存失败：${msg}`);
      throw err;
    }
  };

  // 新建文件
  const handleAddFile = () => {
    if (!newFileName.trim()) return;
    const path = filePrefix + newFileName.trim();
    if (currentFiles.includes(path)) {
      setNewFileName('');
      setShowNewFileInput(false);
      handleOpenFile(path);
      return;
    }
    setDraftFiles(prev => [...prev, { path, content: '', isNew: true }]);
    setNewFileName('');
    setShowNewFileInput(false);
    setActiveFilePath(path);
    setFileContent('');
    setFileDirty(false);
  };

  const handleUploadFile = async (uploadedFile: File) => {
    if (!uploadedFile) return;
    if (fileDirty && activeFilePath) {
      const existing = draftFiles.find(d => d.path === activeFilePath);
      if (existing) {
        setDraftFiles(prev => prev.map(d => d.path === activeFilePath ? { ...d, content: fileContent } : d));
      }
    }
    try {
      const content = await uploadedFile.text();
      const path = filePrefix + uploadedFile.name;
      setDraftFiles(prev => {
        const rest = prev.filter(d => d.path !== path);
        return [...rest, { path, content, isNew: true }];
      });
      setActiveFilePath(path);
      setFileContent(content);
      setFileDirty(false);
      setShowNewFileInput(false);
      setNewFileName('');
      setError(null);
    } catch {
      setError('上传失败，仅支持文本文件');
    }
  };

  const parentDir = useCallback((path: string) => {
    const index = path.lastIndexOf('/');
    if (index <= 0) return filePrefix;
    return path.substring(0, index + 1);
  }, [filePrefix]);

  const toggleDir = useCallback((path: string) => {
    const nextExpanded = !expandedDirs[path];
    setExpandedDirs(prev => ({ ...prev, [path]: nextExpanded }));
    if (nextExpanded && !treeByPath[path] && !loadingDirs[path]) {
      void loadTreePath(path);
    }
  }, [expandedDirs, treeByPath, loadingDirs, loadTreePath]);

  // 删除文件
  const handleDeleteFile = async (path: string) => {
    setPendingDeleteFilePath(path);
  };

  const handleConfirmDeleteFile = async () => {
    const path = pendingDeleteFilePath;
    if (!path) return;
    const draft = draftFiles.find(d => d.path === path);
    if (draft?.isNew) {
      setDraftFiles(prev => prev.filter(d => d.path !== path));
      if (activeFilePath === path) {
        setActiveFilePath(null);
        setFileContent('');
      }
      setPendingDeleteFilePath(null);
      return;
    }
    if (!skillId) return;
    try {
      await skillManagementApi.deleteFile(skillId, path);
      if (activeFilePath === path) {
        setActiveFilePath(null);
        setFileContent('');
      }
      void loadTreePath(parentDir(path));
    } catch { /* ignore */ }
    setPendingDeleteFilePath(null);
  };

  // 保存技能（创建模式：先创建技能再批量上传草稿文件）
  const handleSave = async () => {
    track('custom_skill', { sub_event: isEdit && skillId ? 'save' : 'publish' });
    if (!form.name.trim()) { setError('请填写技能名称'); return; }
    if (!form.body.trim()) { setError('请填写技能内容'); return; }
    if (duplicateName) { setError('当前空间已存在同名技能，请先修改名称'); return; }

    setSaving(true);
    setError(null);

    try {
      const skillMdContent = buildSkillMd(form, skillId);

      if (isEdit && skillId) {
        // 编辑模式：更新 SKILL.md + 批量上传新草稿
        await skillManagementApi.putFile(skillId, 'SKILL.md', skillMdContent);
        await skillManagementApi.update(skillId, {
          name: form.name.trim(),
          description: form.description.trim(),
        });
        const newDrafts = draftFiles.filter(d => d.isNew);
        for (const draft of newDrafts) {
          await skillManagementApi.putFile(skillId, draft.path, draft.content);
        }
      } else {
        // 创建模式：先创建技能，再批量上传草稿
        const created = await skillManagementApi.create({
          name: form.name.trim(),
          description: form.description.trim(),
          skillMdBody: form.body,
        });
        if (created.id) {
          const allDrafts = draftFiles.filter(d => d.isNew);
          for (const draft of allDrafts) {
            await skillManagementApi.putFile(created.id, draft.path, draft.content);
          }
        }
      }

      onSaved?.();
      window.dispatchEvent(new CustomEvent('skill-changed', { detail: { type: 'skills' } }));
      onClose();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 自动聚焦新建文件输入
  useEffect(() => {
    if (showNewFileInput && newFileInputRef.current) {
      newFileInputRef.current.focus();
    }
  }, [showNewFileInput]);

  // 切换 Tab 时自动保存并重置文件选择；保存失败则中止切 Tab，保留脏状态
  const handleTabChange = async (tab: TabType) => {
    if (fileDirty && activeFilePath) {
      const draft = draftFiles.find(d => d.path === activeFilePath);
      if (draft) {
        setDraftFiles(prev => prev.map(d => d.path === activeFilePath ? { ...d, content: fileContent } : d));
      } else if (isEdit) {
        try {
          await handleSaveCurrentFile();
        } catch {
          return;
        }
      }
    }
    setActiveTab(tab);
    setActiveFilePath(null);
    setFileContent('');
    setFileDirty(false);
    setShowNewFileInput(false);
    setNewFileName('');
  };

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 10,
    border: '1px solid var(--input-border)', background: 'var(--input-bg)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block',
  };

  const toolIconButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 6,
    background: 'none',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    color: 'var(--text-muted)',
  };

  const emptyActionButtonStyle: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: 11,
    borderRadius: 6,
    border: '1px dashed var(--border-subtle)',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    background: active ? 'var(--bg-primary)' : 'transparent',
    border: active ? '1px solid var(--border-subtle)' : '1px solid transparent',
    borderBottom: active ? '1px solid var(--bg-primary)' : '1px solid var(--border-subtle)',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    position: 'relative',
    marginBottom: -1,
    transition: 'all 0.15s ease',
  });

  const fileTabLabel = (tab: TabType) => {
    if (tab === 'skill') return 'SKILL.md';
    return tab === 'scripts' ? '脚本' : '参考文档';
  };

  const renderTreeLevel = (path: string, depth = 0): React.ReactNode => {
    const node = treeByPath[path];
    const draftEntries = path === filePrefix
      ? draftFiles
        .filter(d => d.isNew && d.path.startsWith(path) && !d.path.substring(path.length).includes('/'))
        .map(d => ({ name: d.path.substring(path.length), path: d.path }))
      : [];
    const files = [
      ...(node?.files || []),
      ...draftEntries.filter(draft => !(node?.files || []).some(file => file.path === draft.path)),
    ];

    if (!node && loadingDirs[path]) {
      return <div className="skill-studio-file-tree-loading" style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)' }} data-testid={`skill-studio-file-tree-loading-${path}`}>加载中...</div>;
    }

    return (
      <>
        {(node?.dirs || []).map(dir => {
          const isExpanded = !!expandedDirs[dir.path];
          return (
            <div key={dir.path}>
              <div
                className="skill-studio-dir-row"
                onClick={() => toggleDir(dir.path)}
                data-testid={`skill-studio-dir-row-${dir.path}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 10px', paddingLeft: 10 + depth * 14, margin: '1px 6px',
                  borderRadius: 6, cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isExpanded ? '▼' : '▶'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{dir.name}</span>
              </div>
              {isExpanded && renderTreeLevel(dir.path, depth + 1)}
            </div>
          );
        })}
        {files.map(file => {
          const isActive = activeFilePath === file.path;
          const isDraft = draftFiles.find(d => d.path === file.path)?.isNew;
          return (
            <div
              key={file.path}
              className="skill-studio-file-row"
              onClick={() => handleOpenFile(file.path)}
              data-testid={`skill-studio-file-row-${file.path}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 10px', paddingLeft: 26 + depth * 14, margin: '1px 6px',
                borderRadius: 6, cursor: 'pointer',
                background: isActive ? 'var(--hover-bg)' : 'transparent',
              }}
            >
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
                <FileIcon />
                <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </span>
                {isDraft && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>new</span>}
              </div>
              {!isPreview && (
                <button
                  className="skill-studio-file-delete"
                  onClick={e => { e.stopPropagation(); void handleDeleteFile(file.path); }}
                  style={{ ...toolIconButtonStyle, opacity: 0.7 }}
                  data-testid={`skill-studio-file-delete-${file.path}`}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          );
        })}
      </>
    );
  };

  return createPortal(
    <>
      <style>{`
        .skill-studio-backdrop { animation: ssFadeIn 0.15s ease-out; }
        .skill-studio-panel { animation: ssScaleIn 0.18s ease-out; }
        @keyframes ssFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ssScaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div
        className="fixed inset-0 z-[200] flex items-center justify-center skill-studio-backdrop"
        style={{ background: 'var(--modal-backdrop)' }}
        data-testid="skill-studio-backdrop"
      >
        <div
          onClick={e => e.stopPropagation()}
          className="skill-studio-panel"
          data-testid="skill-studio-panel"
          style={{
            width: '92vw', maxWidth: 1200, height: '88vh', maxHeight: 820,
            background: 'var(--modal-bg)', borderRadius: 20,
            border: '1px solid var(--modal-border)',
            boxShadow: 'var(--modal-shadow)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }} data-testid="skill-studio-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={onClose}
                data-testid="skill-studio-back"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <BackIcon />
              </button>
              <SkillIcon size={16} />
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }} data-testid="skill-studio-title">
                {isEdit ? `编辑: ${editSkill?.name || ''}` : '创建技能'}
              </span>
              {!isEdit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    建议直接让moss智能体帮你做，
                  </span>
                  <button
                    type="button"
                    className="skill-studio-try-agent"
                    onClick={() => {
                      onClose();
                      navigate('/app?prefillText=' + encodeURIComponent('帮我创建一个这样的技能：'));
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: 'var(--moss-home-title-accent, #D95E3A)',
                      fontSize: 12,
                      lineHeight: '18px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                    }}
                    data-testid="skill-studio-try-agent"
                  >
                    <span data-try-agent-label>去试试</span>
                  </button>
                  <style>
                    {'.skill-studio-try-agent:hover [data-try-agent-label] { text-decoration: underline; }'}
                  </style>
                </div>
              )}
              {isPreview && (
                <span style={{
                  padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                }} data-testid="skill-studio-preview-badge">
                  修改
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-testid="skill-studio-header-actions">
              {SHOW_SKILL_AI_ENTRY && onDesign && (
                <CorevoDesignButton
                  promptHint="帮我设计一个技能，例如：一个代码审查技能，指导 Agent 如何进行专业的代码审查"
                  onDesign={(p) => { onClose(); onDesign(p); }}
                />
              )}
              {error && (
                <span style={{ fontSize: 12, color: 'var(--danger)' }} data-testid="skill-studio-error">{error}</span>
              )}
              {SHOW_SKILL_AI_ENTRY && isPreview ? (
                <span style={{
                  fontSize: 12, color: 'var(--text-muted)',
                  padding: '6px 12px', borderRadius: 8,
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                }}>
                  预览版本，需通过对话中的三选一确认保存
                </span>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  data-testid="skill-studio-save"
                  style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 10,
                    background: 'var(--text-primary)', color: 'var(--bg-primary)',
                    border: 'none', cursor: saving ? 'wait' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              )}
            </div>
          </div>

          {/* ── Body: Left + Right ── */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }} data-testid="skill-studio-body">

            {/* ─── Left: Identity ─── */}
            <div style={{
              width: 300, minWidth: 280, maxWidth: 340,
              borderRight: '1px solid var(--border-subtle)',
              padding: '24px 20px', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 20,
              flexShrink: 0,
            }} data-testid="skill-studio-identity-panel">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: -4 }} data-testid="skill-studio-identity-title">
                技能身份
              </div>

              <div>
                <label style={labelStyle}>技能名称 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(YAML 元数据，Agent 可见)</span></label>
                <input
                  value={form.name}
                  onChange={e => !isPreview && update('name', e.target.value)}
                  placeholder="网络深度研究"
                  readOnly={isPreview}
                  data-testid="skill-studio-name-input"
                  style={{ ...inputStyle, ...(isPreview ? { opacity: 0.7, cursor: 'default' } : {}) }}
                />
                {duplicateName && (
                  <div style={{
                    marginTop: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--warning-border-soft)',
                    background: 'var(--warning-bg-soft)',
                    color: 'var(--warning)',
                    fontSize: 12,
                    lineHeight: 1.6,
                  }} data-testid="skill-studio-duplicate-name-warning">
                    <div style={{ marginBottom: 8 }}>当前空间已存在同名技能，请先修改名称后再保存。</div>
                    <button
                      type="button"
                      onClick={() => update('name', suggestedName)}
                      data-testid="skill-studio-use-suggested-name"
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--warning-border-soft)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--warning)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      使用建议名：{suggestedName}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>描述 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Agent 触发依据)</span></label>
                <textarea
                  value={form.description}
                  onChange={e => !isPreview && update('description', e.target.value)}
                  placeholder="清楚描述技能做什么、何时使用。Agent 根据此描述决定是否触发技能。"
                  rows={6}
                  readOnly={isPreview}
                  data-testid="skill-studio-description-input"
                  style={{ ...inputStyle, minHeight: 140, resize: 'vertical', lineHeight: 1.6, ...(isPreview ? { opacity: 0.7, cursor: 'default' } : {}) }}
                />
              </div>

              {/* 创建模式下的提示 */}
              {!isEdit && draftFiles.length > 0 && (
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'var(--bg-tertiary)', fontSize: 11, color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }} data-testid="skill-studio-draft-file-count">
                  已配置 {draftFiles.length} 个附属文件，保存技能时将一并创建。
                </div>
              )}
            </div>

            {/* ─── Right: Content with Tabs ─── */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
            }} data-testid="skill-studio-editor-panel">
              {/* Tab Bar */}
              <div style={{
                display: 'flex', alignItems: 'flex-end',
                padding: '0 24px', paddingTop: 12,
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
                gap: 2,
              }} data-testid="skill-studio-tablist">
                {(['skill', 'scripts', 'references'] as TabType[]).map(tab => (
                  <button
                    key={tab}
                    className={`skill-studio-tab skill-studio-tab--${tab}`}
                    onClick={() => handleTabChange(tab)}
                    style={tabStyle(activeTab === tab)}
                    data-testid={`skill-studio-tab-${tab}`}
                  >
                    {fileTabLabel(tab)}
                </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="skill-studio-tab-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} data-testid={`skill-studio-tab-content-${activeTab}`}>

                {/* ── SKILL.md Tab ── */}
                {activeTab === 'skill' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, minHeight: 0 }} data-testid="skill-studio-skill-tab">
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>SKILL.md 正文</label>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          保存时自动拼接 YAML 元数据头（name + description）
                      </span>
                      </div>
                      <div style={{
                        padding: '8px 10px', borderRadius: 6, fontSize: 11, lineHeight: 1.5,
                        color: 'var(--text-muted)', background: 'var(--bg-tertiary)',
                      }}>
                        左侧的「名称」→ YAML <code style={{ fontSize: 10, padding: '0 3px', background: 'var(--bg-secondary)', borderRadius: 3 }}>name</code>，「描述」→ <code style={{ fontSize: 10, padding: '0 3px', background: 'var(--bg-secondary)', borderRadius: 3 }}>description</code>，是 Agent 判断何时触发技能的依据。下方编辑的是正文（触发后 Agent 阅读的使用指南）。
                      </div>
                    </div>
                    <textarea
                      ref={editorRef}
                      value={form.body}
                      onChange={e => !isPreview && update('body', e.target.value)}
                      readOnly={isPreview}
                      spellCheck={false}
                      data-testid="skill-studio-body-editor"
                      style={{
                        flex: 1, width: '100%', padding: '14px 16px',
                        fontSize: 13, lineHeight: 1.6, borderRadius: 12,
                        border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                        color: 'var(--text-primary)', outline: 'none',
                        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                        resize: 'none', tabSize: 4, boxSizing: 'border-box',
                        ...(isPreview ? { opacity: 0.85, cursor: 'default' } : {}),
                      }}
                      onKeyDown={e => {
                        if (isPreview) return;
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          const ta = e.currentTarget;
                          const start = ta.selectionStart;
                          const end = ta.selectionEnd;
                          const val = ta.value;
                          update('body', val.substring(0, start) + '    ' + val.substring(end));
                          requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 4; });
                        }
                      }}
                    />
                  </div>
                )}

                {/* ── Scripts / References Tab ── */}
                {(activeTab === 'scripts' || activeTab === 'references') && (
                  <div className="skill-studio-file-tab" style={{ flex: 1, display: 'flex', minHeight: 0 }} data-testid={`skill-studio-file-tab-${activeTab}`}>

                    {/* 文件侧边栏 */}
                    <div style={{
                      width: 200, minWidth: 180,
                      borderRight: '1px solid var(--border-subtle)',
                      display: 'flex', flexDirection: 'column',
                      flexShrink: 0,
                    }} className="skill-studio-file-sidebar" data-testid={`skill-studio-file-sidebar-${activeTab}`}>
                  <input
                    ref={uploadFileInputRef}
                    type="file"
                    accept=".md,.txt,.py,.json,.yaml,.yml,.js,.ts,.tsx,.jsx,.sh,.sql,.csv"
                    className="skill-studio-file-upload-input"
                    style={{ display: 'none' }}
                    data-testid={`skill-studio-file-upload-input-${activeTab}`}
                    onChange={e => {
                      const uploadedFile = e.target.files?.[0];
                      if (uploadedFile) void handleUploadFile(uploadedFile);
                      e.target.value = '';
                    }}
                  />
                  <div style={{
                        padding: '12px 14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border-subtle)',
                      }} className="skill-studio-file-sidebar-header" data-testid={`skill-studio-file-sidebar-header-${activeTab}`}>
                        <span className="skill-studio-file-prefix" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.5 }} data-testid={`skill-studio-file-prefix-${activeTab}`}>
                          {activeTab === 'scripts' ? 'scripts/' : 'references/'}
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="skill-studio-file-upload"
                            onClick={() => uploadFileInputRef.current?.click()}
                            style={toolIconButtonStyle}
                            data-testid={`skill-studio-file-upload-${activeTab}`}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                            title={activeTab === 'scripts' ? '上传脚本文件' : '上传参考文档'}
                          >
                            <UploadIcon />
                          </button>
                          <button
                            className="skill-studio-file-new"
                            onClick={() => { setShowNewFileInput(true); setNewFileName(''); }}
                            style={toolIconButtonStyle}
                            data-testid={`skill-studio-file-new-${activeTab}`}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                            title={activeTab === 'scripts' ? '新建脚本' : '新建参考文档'}
                          >
                            <PlusIcon size={12} />
                          </button>
                        </div>
                      </div>

                      {/* 新建文件输入 */}
                      {showNewFileInput && (
                        <div className="skill-studio-new-file-form" style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }} data-testid={`skill-studio-new-file-form-${activeTab}`}>
                          <input
                            ref={newFileInputRef}
                            value={newFileName}
                            onChange={e => setNewFileName(e.target.value)}
                            placeholder={activeTab === 'scripts' ? 'my_script.py' : 'doc.md'}
                            className="skill-studio-new-file-input"
                            data-testid={`skill-studio-new-file-input-${activeTab}`}
                            style={{
                              width: '100%', padding: '5px 8px', fontSize: 11, borderRadius: 6,
                              border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                              color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAddFile();
                              if (e.key === 'Escape') { setShowNewFileInput(false); setNewFileName(''); }
                            }}
                            onBlur={() => {
                              if (!newFileName.trim()) { setShowNewFileInput(false); }
                            }}
                          />
                          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                            <button
                              className="skill-studio-new-file-create"
                              onClick={handleAddFile}
                              disabled={!newFileName.trim()}
                              data-testid={`skill-studio-new-file-create-${activeTab}`}
                              style={{
                                flex: 1, padding: '4px 0', fontSize: 11, borderRadius: 5,
                                background: newFileName.trim() ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                                color: newFileName.trim() ? 'var(--bg-primary)' : 'var(--text-muted)',
                                border: 'none', cursor: newFileName.trim() ? 'pointer' : 'default',
                              }}
                            >
                              创建
                            </button>
                            <button
                              className="skill-studio-new-file-cancel"
                              onClick={() => { setShowNewFileInput(false); setNewFileName(''); }}
                              data-testid={`skill-studio-new-file-cancel-${activeTab}`}
                              style={{
                                padding: '4px 8px', fontSize: 11, borderRadius: 5,
                                border: '1px solid var(--border-subtle)', background: 'none',
                                cursor: 'pointer', color: 'var(--text-muted)',
                              }}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 文件列表 */}
                      <div className="skill-studio-file-list" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }} data-testid={`skill-studio-file-list-${activeTab}`}>
                        {loadingDirs[filePrefix] && !treeByPath[filePrefix] && (
                          <div className="skill-studio-file-list-loading" style={{ padding: '20px 14px', fontSize: 11, color: 'var(--text-muted)' }} data-testid={`skill-studio-file-list-loading-${activeTab}`}>
                            正在加载目录...
                          </div>
                        )}
                        {!loadingDirs[filePrefix] && !hasCurrentTreeItems && !showNewFileInput && (
                          <div className="skill-studio-file-list-empty" style={{ padding: '20px 14px', textAlign: 'center' }} data-testid={`skill-studio-file-list-empty-${activeTab}`}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                              暂无文件
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                              <button
                                className="skill-studio-empty-upload"
                                onClick={() => uploadFileInputRef.current?.click()}
                                style={emptyActionButtonStyle}
                                data-testid={`skill-studio-empty-upload-${activeTab}`}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                              >
                                上传{activeTab === 'scripts' ? '脚本' : '参考文档'}
                              </button>
                              <button
                                className="skill-studio-empty-add"
                                onClick={() => { setShowNewFileInput(true); setNewFileName(''); }}
                                style={emptyActionButtonStyle}
                                data-testid={`skill-studio-empty-add-${activeTab}`}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                              >
                                + 添加{activeTab === 'scripts' ? '脚本' : '参考文档'}
                              </button>
                            </div>
                          </div>
                        )}
                        {renderTreeLevel(filePrefix)}
                      </div>
                    </div>

                    {/* 文件编辑器 */}
                    <div className="skill-studio-file-editor" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }} data-testid={`skill-studio-file-editor-${activeTab}`}>
                      {activeFilePath ? (
                        <>
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 16px',
                            borderBottom: '1px solid var(--border-subtle)',
                            flexShrink: 0,
                          }} data-testid="skill-studio-file-editor-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <FileIcon size={13} />
                              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }} data-testid="skill-studio-active-file-name">
                                {activeFilePath.split('/').pop()}
                              </span>
                              {fileDirty && (
                                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }} data-testid="skill-studio-file-dirty">
                                  未保存
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {(isEdit && !draftFiles.find(d => d.path === activeFilePath)?.isNew) && (
                                <button
                                  onClick={handleSaveCurrentFile}
                                  disabled={!fileDirty}
                                  data-testid="skill-studio-save-current-file"
                                  style={{
                                    padding: '4px 14px', fontSize: 11, borderRadius: 6,
                                    background: fileDirty ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                                    color: fileDirty ? 'var(--bg-primary)' : 'var(--text-muted)',
                                    border: 'none', cursor: fileDirty ? 'pointer' : 'default',
                                  }}
                                >
                                  保存文件
                                </button>
                              )}
                            </div>
                          </div>
                          <textarea
                            value={fileContent}
                            onChange={e => { setFileContent(e.target.value); setFileDirty(true);
                              const draft = draftFiles.find(d => d.path === activeFilePath);
                              if (draft?.isNew) {
                                setDraftFiles(prev => prev.map(d => d.path === activeFilePath ? { ...d, content: e.target.value } : d));
                              }
                            }}
                            spellCheck={false}
                            data-testid="skill-studio-file-content-editor"
                            style={{
                              flex: 1, width: '100%', padding: '14px 16px',
                              fontSize: 13, lineHeight: 1.6,
                              border: 'none', background: 'transparent',
                              color: 'var(--text-primary)', outline: 'none',
                              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                              resize: 'none', tabSize: 4, boxSizing: 'border-box',
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Tab') {
                                e.preventDefault();
                                const ta = e.currentTarget;
                                const start = ta.selectionStart;
                                const end = ta.selectionEnd;
                                const val = ta.value;
                                const newVal = val.substring(0, start) + '    ' + val.substring(end);
                                setFileContent(newVal);
                                setFileDirty(true);
                                requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 4; });
                              }
                              if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                                e.preventDefault();
                                handleSaveCurrentFile().catch(() => { /* already toasted */ });
                              }
                            }}
                          />
                        </>
                      ) : (
                        <div style={{
                          flex: 1, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-muted)', gap: 12,
                        }} className="skill-studio-file-editor-empty" data-testid={`skill-studio-file-editor-empty-${activeTab}`}>
                          <FileIcon size={28} />
                          <span style={{ fontSize: 13 }}>
                            {hasCurrentTreeItems
                              ? '选择左侧文件开始编辑'
                              : `点击 + 创建${activeTab === 'scripts' ? '脚本' : '参考文档'}文件`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(pendingDeleteFilePath)}
        title="删除文件"
        description={pendingDeleteFilePath ? `确定删除 ${pendingDeleteFilePath.split('/').pop()}？` : undefined}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        onConfirm={handleConfirmDeleteFile}
        onCancel={() => setPendingDeleteFilePath(null)}
      />
    </>,
    document.body,
  );
};
