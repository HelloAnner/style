/**
 * 输入框组件 - 支持文件/图片上传 + 文件引用(@)
 * 
 * ┌─────────────────────────────────────────┐
 * │  [@file chip] [@file chip]              │ ← 文件引用 chips
 * ├─────────────────────────────────────────┤
 * │  多行文本输入区 "输入消息..."            │
 * ├─────────────────────────────────────────┤
 * │  📎 附件                          [发送] │
 * └─────────────────────────────────────────┘
 */

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { Paperclip, X, Loader2 } from 'lucide-react';
import { kernelApiFetch } from '../../api/gateway';
import { FilePickerPopover, type FilePickerFile } from './FilePickerPopover';

import { useFileReferenceStore, type FileReference } from '../../stores/fileReferenceStore';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useDesignSuggestionsStore } from '../../stores/designSuggestionsStore';

import { track } from '../../utils/track';
import { randomShortId } from '../../lib/id';
import { translateUploadError } from '../../utils/fileTypes';
import type { ComposerStateVM } from '../../conversation/model/viewTypes';

// 文件上传限制：黑名单模式，禁止危险可执行文件，其余全部允许
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif',
  'vbs', 'vbe', 'wsf', 'wsh', 'ps1',
  'dll', 'sys', 'drv', 'cpl',
]);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const CLIPBOARD_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
};

function clipboardImageFileName(file: File): string {
  const ext = CLIPBOARD_IMAGE_EXTENSIONS[file.type] ?? 'png';
  return `screenshot-${randomShortId(12)}.${ext}`;
}

function withUniqueClipboardImageName(file: File): File {
  return new File([file], clipboardImageFileName(file), {
    type: file.type || 'image/png',
    lastModified: file.lastModified || Date.now(),
  });
}

const fileReferenceToken = (ref: FileReference) => `@${ref.fileName}`;

const DEFAULT_COMPOSER_PLACEHOLDER = '描述需求，@引用文件';
const USE_CONTENT_EDITABLE_COMPOSER = false;

const normalizePlaceholder = (value?: string) => {
  if (!value || value === '输入消息...') return DEFAULT_COMPOSER_PLACEHOLDER;
  return value;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function isCompositionInputEvent(event: React.FormEvent<HTMLElement>): boolean {
  const native = event.nativeEvent as InputEvent;
  return native.isComposing === true || native.inputType === 'insertCompositionText';
}

function isCompositionKeyboardEvent(event: React.KeyboardEvent): boolean {
  return event.nativeEvent.isComposing === true || event.keyCode === 229;
}

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'document';
  status: 'uploading' | 'ready' | 'error';
  uploadedPath?: string;
  error?: string;
  abortController?: AbortController;
  isStaged?: boolean;
}

export interface RoundtablePromptTag {
  mode: 'moderator' | 'ordered' | 'free';
  label: string;
  template: string;
}

export interface ComposerAttachmentPreview {
  id: string;
  name: string;
  sizeLabel: string;
  typeLabel?: string;
  highlight?: boolean;
  uploadedPath?: string;
  stagingId?: string;
}

interface InputBarProps {
  onSend: (message: string, uploadedPaths?: string[], fileRefs?: FileReference[], stagingId?: string) => void;
  onCancel: () => void;
  isRunning: boolean;
  isCancelling?: boolean;
  disabled?: boolean;
  roundtableTag?: RoundtablePromptTag | null;
  onClearRoundtableTag?: () => void;
  channelHint?: string | null;
  compressionHint?: string | null;
  commandHistory?: string[];
  prefillText?: string | null;
  onPrefillConsumed?: () => void;
  /** 精简模式：隐藏 @引用/思考模式/设计建议/圆桌/提示条，保留附件功能，适合嵌入侧栏/弹窗等非主对话场景 */
  compact?: boolean;
  /** 自定义占位符 */
  placeholder?: string;
  /** 精简模式下的发送适配器：收到文本 + 已上传文件路径 + stagingId 后调用（不经 onSend）。未提供则回退到 onSend(message) */
  sendAdapter?: (text: string, uploadedPaths?: string[], stagingId?: string) => void;
  /** 精简模式下的外层容器 padding 覆盖（默认压缩为 '8px 12px'）*/
  containerPadding?: string;
  /** 主输入框内容最大宽度 */
  maxWidth?: number | string;
  /** 覆盖从全局 store 读取的 agentId（精简模式下用于让附件上传走非主对话 agent，例如 skill_creator）*/
  agentIdOverride?: string;
  /** 覆盖从全局 store 读取的 sessionId（同上）*/
  sessionIdOverride?: string | null;
  composerState?: ComposerStateVM;
  attachmentPreviews?: ComposerAttachmentPreview[];
  onAttachmentPreviewRemove?: (id: string) => void;
  onAttachmentPreviewsConsumed?: () => void;
  autoFocusSignal?: number;
}

const RT_TAG_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  moderator: { bg: 'rgba(244,114,182,0.10)', border: 'rgba(244,114,182,0.25)', text: '#F472B6' },
  ordered: { bg: 'rgba(129,140,248,0.10)', border: 'rgba(129,140,248,0.25)', text: '#818CF8' },
  free: { bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.25)', text: '#34D399' },
};

const PlusGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const SendGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 13V3M8 3L4.5 6.5M8 3L11.5 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StopGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" fill="currentColor" />
  </svg>
);

export const InputBar: React.FC<InputBarProps> = ({
  onSend,
  onCancel,
  isRunning,
  isCancelling = false,
  disabled = false,
  roundtableTag,
  onClearRoundtableTag,
  channelHint,
  compressionHint,
  commandHistory = [],
  prefillText,
  onPrefillConsumed,
  compact = false,
  placeholder,
  sendAdapter,
  containerPadding,
  maxWidth = 800,
  agentIdOverride,
  sessionIdOverride,
  composerState,
  attachmentPreviews = [],
  onAttachmentPreviewRemove,
  onAttachmentPreviewsConsumed,
  autoFocusSignal,
}) => {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const inputValueRef = useRef('');
  const historyIndexRef = useRef<number | null>(null);
  const historyDraftRef = useRef('');
  const composingRef = useRef(false);
  const compositionSyncFrameRef = useRef<number | null>(null);
  const caretOffsetRef = useRef(0);
  const pendingCaretOffsetRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastAutoFocusSignalRef = useRef(autoFocusSignal);
  const effectiveDisabled = disabled || composerState?.reason === 'billing';
  const effectiveRunning = isRunning || composerState?.reason === 'running' || composerState?.reason === 'finalizing';
  const effectiveCanCancel = composerState
    ? Boolean(composerState.activeJobId && composerState.canCancel)
    : isRunning;
  const effectivePlaceholder = normalizePlaceholder(composerState?.placeholder ?? placeholder);

  // 推荐问点击 → 填入输入框（对标 V1: 不直接发送，由用户确认后发送）
  useEffect(() => {
    inputValueRef.current = input;
  }, [input]);

  const designActiveType = useDesignSuggestionsStore(s => s.activeType);
  const designSuggestions = useDesignSuggestionsStore(s => s.getSuggestions());
  const dismissDesign = useDesignSuggestionsStore(s => s.dismiss);

  // 上传提示
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const showUploadWarning = useCallback((msg: string) => {
    setUploadWarning(msg);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => setUploadWarning(null), 6000);
  }, []);
  useEffect(() => () => { if (warningTimerRef.current) clearTimeout(warningTimerRef.current); }, []);

  // @ 文件选择器
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [atTriggerPos, setAtTriggerPos] = useState<number | null>(null);
  const atTriggerPosRef = useRef<number | null>(null);
  const updateAtTriggerPos = useCallback((pos: number | null) => {
    atTriggerPosRef.current = pos;
    setAtTriggerPos(pos);
  }, []);

  // 文件引用 store
  const fileReferences = useFileReferenceStore(s => s.references);
  const removeReference = useFileReferenceStore(s => s.removeReference);
  const addReference = useFileReferenceStore(s => s.addReference);
  const clearReferences = useFileReferenceStore(s => s.clearReferences);
  const previousFileReferencesRef = useRef<FileReference[]>([]);

  // Agent context（步骤 010：selectedAgentId 改为 agentContextStore.currentAgentId）
  const storeAgentId = useAgentContextStore(s => s.currentAgentId);
  const storeSessionId = useAgentStore(s => s.currentSessionId);
  // 精简模式下允许覆盖 agent/session（例如技能助手场景用 skill_creator agent + 自己的 sessionId）
  const effectiveAgentId = agentIdOverride ?? storeAgentId;
  const effectiveSessionId = sessionIdOverride !== undefined ? sessionIdOverride : storeSessionId;
  void effectiveAgentId; void effectiveSessionId;
  // 向后兼容：原 currentSessionId / agentId 变量
    const currentSessionId = useAgentStore(s => s.currentSessionId);

  useEffect(() => {
    historyIndexRef.current = null;
    historyDraftRef.current = '';
  }, [effectiveSessionId, commandHistory.length]);

  // 自动调整高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '24px';
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.max(24, Math.min(scrollHeight, 160));
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = scrollHeight > 160 ? 'auto' : 'hidden';
    }
  }, [input]);
  
  // staging 暂存 ID（新会话无 sessionId 时使用）
  const stagingIdRef = useRef<string | null>(null);
  const prevSessionIdRef = useRef<string | null>(currentSessionId);
  const submitInFlightRef = useRef(false);
  const getStagingId = useCallback(() => {
    if (!stagingIdRef.current) {
      stagingIdRef.current = randomShortId();
    }
    return stagingIdRef.current;
  }, []);

  // 会话切换时，清理未提交的 staging 文件并重置输入框
  // 跳过由 handleSubmit 触发的 sessionId 变化（submitInFlightRef 标志）
  useEffect(() => {
    if (compact) return;
    if (prevSessionIdRef.current !== currentSessionId) {
      if (submitInFlightRef.current) {
        submitInFlightRef.current = false;
        prevSessionIdRef.current = currentSessionId;
        return;
      }
      const oldStagingId = stagingIdRef.current;
      if (oldStagingId && prevSessionIdRef.current === null) {
        const aid = agentIdOverride ?? useAgentContextStore.getState().currentAgentId;
        if (aid) {
          kernelApiFetch(`/api/v1/files/staging/${oldStagingId}?agent_id=${encodeURIComponent(aid)}`, { method: 'DELETE' }).catch(() => {});
        }
      }
      stagingIdRef.current = null;
      files.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
        if (f.status === 'uploading' && f.abortController) f.abortController.abort();
      });
      setFiles([]);
      prevSessionIdRef.current = currentSessionId;
    }
  }, [currentSessionId, compact]);

  const stripReferenceTokens = useCallback((value: string) => {
    let next = value;
    fileReferences.forEach(ref => {
      next = next.replace(new RegExp(`(^|\\s)${escapeRegExp(fileReferenceToken(ref))}(?=\\s|$)`, 'g'), '$1');
    });
    return next.replace(/[ \t]{2,}/g, ' ').trim();
  }, [fileReferences]);

  const focusComposerAtOffset = useCallback((offset?: number) => {
    if (compact || !USE_CONTENT_EDITABLE_COMPOSER) {
      textareaRef.current?.focus();
      if (typeof offset === 'number') {
        textareaRef.current?.setSelectionRange(offset, offset);
      }
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    const targetOffset = typeof offset === 'number' ? offset : input.length;
    let cursor = 0;
    let placed = false;

    const placeIn = (node: Node) => {
      if (placed) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const length = node.textContent?.length ?? 0;
        if (targetOffset <= cursor + length) {
          range.setStart(node, Math.max(0, targetOffset - cursor));
          placed = true;
          return;
        }
        cursor += length;
        return;
      }
      if (node instanceof HTMLElement && node.dataset.refToken) {
        const length = node.dataset.refToken.length;
        if (targetOffset <= cursor + length) {
          range.setStartAfter(node);
          placed = true;
          return;
        }
        cursor += length;
        return;
      }
      node.childNodes.forEach(placeIn);
    };

    editor.childNodes.forEach(placeIn);
    if (!placed) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }, [compact, input.length]);

  useEffect(() => {
    if (autoFocusSignal === undefined) return;
    if (lastAutoFocusSignalRef.current === autoFocusSignal) return;
    lastAutoFocusSignalRef.current = autoFocusSignal;

    const timer = window.setTimeout(() => {
      if (effectiveDisabled || effectiveRunning) return;
      focusComposerAtOffset(inputValueRef.current.length);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [autoFocusSignal, effectiveDisabled, effectiveRunning, focusComposerAtOffset]);

  useLayoutEffect(() => {
    if (compact || !USE_CONTENT_EDITABLE_COMPOSER) return;
    if (composingRef.current) return;
    const offset = pendingCaretOffsetRef.current;
    if (offset === null) return;
    pendingCaretOffsetRef.current = null;
    focusComposerAtOffset(offset);
  }, [compact, focusComposerAtOffset, input]);

  const getEditorCaretOffset = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return input.length;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.endContainer)) return input.length;
    const preRange = range.cloneRange();
    preRange.selectNodeContents(editor);
    preRange.setEnd(range.endContainer, range.endOffset);
    return preRange.toString().length;
  }, [input.length]);

  const readEditorText = useCallback((root: HTMLElement | null) => {
    if (!root) return inputValueRef.current;
    let text = '';
    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent ?? '';
        return;
      }
      if (node instanceof HTMLElement && node.dataset.refToken) {
        text += node.dataset.refToken;
        return;
      }
      node.childNodes.forEach(visit);
    };
    root.childNodes.forEach(visit);
    return text.replace(/\u00a0/g, '');
  }, []);

  const renderEditorValue = useCallback((value: string, refs: FileReference[], caretOffset?: number) => {
    if (compact || !USE_CONTENT_EDITABLE_COMPOSER) return;
    const editor = editorRef.current;
    if (!editor) return;
    const matches = refs
      .map(ref => {
        const token = fileReferenceToken(ref);
        const start = value.indexOf(token);
        return start >= 0 ? { ref, token, start, end: start + token.length } : null;
      })
      .filter((match): match is { ref: FileReference; token: string; start: number; end: number } => Boolean(match))
      .sort((a, b) => a.start - b.start);

    editor.replaceChildren();
    let cursor = 0;
    matches.forEach(match => {
      if (match.start < cursor) return;
      if (match.start > cursor) {
        editor.appendChild(document.createTextNode(value.slice(cursor, match.start)));
      }
      const token = document.createElement('span');
      token.dataset.refId = match.ref.id;
      token.dataset.refToken = match.token;
      token.contentEditable = 'false';
      token.className = 'inline-file-ref-token';
      token.style.cssText = [
        'display: inline-flex',
        'position: relative',
        'align-items: center',
        'white-space: nowrap',
        'color: var(--file-ref-token-text, #2563EB)',
        'background: transparent',
        'border-radius: 4px',
        'min-height: 18px',
        'padding: 0 1px',
        'margin: 0 1px',
        'gap: 3px',
        'font-size: 13px',
        'line-height: 18px',
        'vertical-align: baseline',
        'cursor: pointer',
        'transition: padding-left 120ms ease',
      ].join(';');
      token.title = `${match.ref.fileName} - 点击预览`;
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.dataset.refRemove = match.ref.id;
      removeButton.setAttribute('aria-label', `取消引用 ${match.ref.fileName}`);
      removeButton.className = 'inline-file-ref-remove';
      removeButton.style.cssText = [
        'position: absolute',
        'left: 1px',
        'top: 50%',
        'transform: translateY(-50%)',
        'width: 13px',
        'height: 13px',
        'border: 0',
        'padding: 0',
        'border-radius: 6px',
        'display: inline-flex',
        'align-items: center',
        'justify-content: center',
        'background: transparent',
        'color: inherit',
        'cursor: pointer',
      ].join(';');
      removeButton.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';
      const icon = document.createElement('span');
      icon.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>';
      const iconSvg = icon.firstElementChild as HTMLElement;
      iconSvg.style.flexShrink = '0';
      const label = document.createElement('span');
      label.textContent = match.token;
      token.append(removeButton, iconSvg, label);
      editor.appendChild(token);
      cursor = match.end;
    });
    if (cursor < value.length) {
      editor.appendChild(document.createTextNode(value.slice(cursor)));
    }
    requestAnimationFrame(() => focusComposerAtOffset(caretOffset ?? value.length));
  }, [compact, focusComposerAtOffset]);

  const writeTextareaValue = useCallback((value: string, caretOffset = value.length, focus = true) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (textarea.value !== value) {
      textarea.value = value;
    }
    if (focus) {
      textarea.focus();
    }
    const offset = Math.max(0, Math.min(caretOffset, value.length));
    textarea.setSelectionRange(offset, offset);
  }, []);

  const applyExternalComposerText = useCallback((value: string) => {
    inputValueRef.current = value;
    pendingCaretOffsetRef.current = value.length;
    setInput(value);
    if (compact || !USE_CONTENT_EDITABLE_COMPOSER) {
      requestAnimationFrame(() => {
        writeTextareaValue(value);
      });
    } else {
      renderEditorValue(value, fileReferences, value.length);
    }
  }, [compact, fileReferences, renderEditorValue, writeTextareaValue]);

  const clearComposerText = useCallback(() => {
    inputValueRef.current = '';
    pendingCaretOffsetRef.current = 0;
    setInput('');
    if (editorRef.current) editorRef.current.replaceChildren();
    if (compact || !USE_CONTENT_EDITABLE_COMPOSER) {
      requestAnimationFrame(() => writeTextareaValue('', 0));
    }
  }, [compact, writeTextareaValue]);

  useEffect(() => {
    if (prefillText) {
      applyExternalComposerText(prefillText);
      onPrefillConsumed?.();
    }
  }, [applyExternalComposerText, onPrefillConsumed, prefillText]);

  useEffect(() => {
    if (roundtableTag && !input) {
      applyExternalComposerText(roundtableTag.template);
    }
  }, [applyExternalComposerText, input, roundtableTag]);

  const openReferencePreview = useCallback((ref: FileReference) => {
    usePreviewStore.getState().openFile({
      fileId: ref.fileId,
      name: ref.fileName,
      path: ref.filePath,
      level: ref.level === 'user_file'
          ? 'user-file'
          : 'session',
    });
  }, []);

  const removeInlineReference = useCallback((ref: FileReference) => {
    const token = fileReferenceToken(ref);
    const current = inputValueRef.current || input;
    const next = current
      .replace(new RegExp(`(^|\\s)${escapeRegExp(token)}(?=\\s|$)`, 'g'), '$1')
      .replace(/[ \t]{2,}/g, ' ');
    inputValueRef.current = next;
    setInput(next);
    renderEditorValue(next, fileReferences.filter(item => item.id !== ref.id));
    removeReference(ref.id);
    requestAnimationFrame(() => {
      if (compact || !USE_CONTENT_EDITABLE_COMPOSER) {
        writeTextareaValue(next, next.length);
      } else {
        focusComposerAtOffset();
      }
    });
  }, [compact, fileReferences, focusComposerAtOffset, input, removeReference, renderEditorValue, writeTextareaValue]);

  useEffect(() => {
    if (compact) return;
    setInput(current => {
      const removedReferences = previousFileReferencesRef.current.filter(
        previousReference => !fileReferences.some(reference => reference.id === previousReference.id)
      );
      const latest = inputValueRef.current || current;
      let next = latest;
      removedReferences.forEach(reference => {
        next = next
          .replace(new RegExp(`(^|\\s)${escapeRegExp(fileReferenceToken(reference))}(?=\\s|$)`, 'g'), '$1')
          .replace(/[ \t]{2,}/g, ' ');
      });
      const missingTokens = fileReferences
        .map(fileReferenceToken)
        .filter(token => !next.includes(token));
      if (missingTokens.length > 0) {
        const prefix = next && !/\s$/.test(next) ? ' ' : '';
        next = `${next}${prefix}${missingTokens.join(' ')}`;
      }
      previousFileReferencesRef.current = fileReferences;
      if (next === current) return current;
      inputValueRef.current = next;
      renderEditorValue(next, fileReferences);
      if (!USE_CONTENT_EDITABLE_COMPOSER) {
        requestAnimationFrame(() => writeTextareaValue(next, next.length));
      }
      return next;
    });
  }, [compact, fileReferences, renderEditorValue, writeTextareaValue]);

  // 组件卸载 / 离开页面时：中止上传 + 清理 staging
  useEffect(() => {
    const cleanupStaging = () => {
      const sid = stagingIdRef.current;
      const aid = agentIdOverride ?? useAgentContextStore.getState().currentAgentId;
      if (sid && aid) {
        kernelApiFetch(`/api/v1/files/staging/${sid}?agent_id=${encodeURIComponent(aid)}`, { method: 'DELETE', keepalive: true }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', cleanupStaging);
    return () => {
      window.removeEventListener('beforeunload', cleanupStaging);
      files.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
        if (f.status === 'uploading' && f.abortController) f.abortController.abort();
      });
      const sid = stagingIdRef.current;
      const aid = agentIdOverride ?? useAgentContextStore.getState().currentAgentId;
      if (sid && aid) {
        kernelApiFetch(`/api/v1/files/staging/${sid}?agent_id=${encodeURIComponent(aid)}`, { method: 'DELETE' }).catch(() => {});
      }
    };
  }, [compact, agentIdOverride]);

  const uploadFile = useCallback(async (entry: UploadedFile) => {
    const controller = new AbortController();
    setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'uploading' as const, abortController: controller } : f));

    const aid = agentIdOverride ?? useAgentContextStore.getState().currentAgentId;
    const sessionId = sessionIdOverride !== undefined ? sessionIdOverride : useAgentStore.getState().currentSessionId;
    const isStaged = !sessionId;

    try {
      const formData = new FormData();
      formData.append('file', entry.file);
      formData.append('target', 'session');
      if (aid) formData.append('agent_id', aid);

      if (sessionId) {
        formData.append('session_id', sessionId);
      } else {
        formData.append('staging_id', getStagingId());
      }

      const response = await kernelApiFetch('/api/v1/files/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        // Platform 返回 {code, message, traceId}，kernel/FastAPI 返回 {detail}，两边都兼容。
        const detail = await response.json()
          .then(d => d?.message ?? d?.detail)
          .catch(() => response.statusText);
        throw new Error(detail || '上传失败');
      }

      const result = await response.json();
      setFiles(prev => prev.map(f => f.id === entry.id ? {
        ...f, status: 'ready' as const, uploadedPath: result.path, abortController: undefined, isStaged,
      } : f));

      if (!isStaged) {
        window.dispatchEvent(new CustomEvent('session-file-added', {
          detail: { name: result.filename || entry.file.name, path: result.filename || entry.file.name, size: entry.file.size, mime_type: entry.file.type || undefined, is_dir: false },
        }));
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const msg = err?.message || '上传失败';
      setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'error' as const, error: msg, abortController: undefined } : f));
      showUploadWarning(`${entry.file.name}上传失败：${translateUploadError(msg)}`);
    }
  }, [showUploadWarning, getStagingId, agentIdOverride, sessionIdOverride]);

  const handleFilesAdd = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: UploadedFile[] = [];

    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE) {
        showUploadWarning(`${file.name} 大小为 ${(file.size / (1024 * 1024)).toFixed(0)}MB，超过 50MB 限制`);
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (BLOCKED_EXTENSIONS.has(ext)) {
        showUploadWarning(`${file.name}上传失败：不支持的文件类型`);
        continue;
      }
      const isImage = IMAGE_EXTENSIONS.has(ext);
      validFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined,
        type: isImage ? 'image' : 'document',
        status: 'uploading',
      });
    }

    if (validFiles.length === 0) return;
    setFiles(prev => [...prev, ...validFiles]);

    for (const entry of validFiles) {
      uploadFile(entry);
    }
  }, [showUploadWarning, uploadFile]);

  const handleFileRemove = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (!file) return prev;
      if (file.preview) URL.revokeObjectURL(file.preview);
      if (file.status === 'uploading' && file.abortController) {
        file.abortController.abort();
      }
      if (file.status === 'ready' && file.uploadedPath) {
        const filename = file.uploadedPath.split('/').pop() || '';
        const aid = agentIdOverride ?? useAgentContextStore.getState().currentAgentId;
        if (file.isStaged) {
          const sid = stagingIdRef.current;
          if (sid && aid && filename) {
            kernelApiFetch(`/api/v1/files/staging/${sid}/${encodeURIComponent(filename)}?agent_id=${encodeURIComponent(aid)}`, { method: 'DELETE' }).catch(() => {});
          }
        } else {
          const sessionId = sessionIdOverride !== undefined ? sessionIdOverride : useAgentStore.getState().currentSessionId;
          if (aid && sessionId && filename) {
            kernelApiFetch(`/api/v1/agents/${aid}/sessions/${sessionId}/files/${encodeURIComponent(filename)}`, { method: 'DELETE' }).catch(() => {});
          }
          window.dispatchEvent(new CustomEvent('session-file-removed', { detail: { name: filename } }));
        }
      }
      return prev.filter(f => f.id !== id);
    });
  }, [agentIdOverride, sessionIdOverride]);

  const handleAttachmentPreviewRemove = useCallback((attachment: ComposerAttachmentPreview) => {
    if (attachment.uploadedPath) {
      const filename = attachment.uploadedPath.split('/').pop() || '';
      const aid = agentIdOverride ?? useAgentContextStore.getState().currentAgentId;
      if (attachment.stagingId && aid && filename) {
        kernelApiFetch(`/api/v1/files/staging/${attachment.stagingId}/${encodeURIComponent(filename)}?agent_id=${encodeURIComponent(aid)}`, { method: 'DELETE' }).catch(() => {});
      } else {
        const sessionId = sessionIdOverride !== undefined ? sessionIdOverride : useAgentStore.getState().currentSessionId;
        if (aid && sessionId && filename) {
          kernelApiFetch(`/api/v1/agents/${aid}/sessions/${sessionId}/files/${encodeURIComponent(filename)}`, { method: 'DELETE' }).catch(() => {});
        }
        if (filename) {
          window.dispatchEvent(new CustomEvent('session-file-removed', { detail: { name: filename } }));
        }
      }
    }
    onAttachmentPreviewRemove?.(attachment.id);
  }, [agentIdOverride, onAttachmentPreviewRemove, sessionIdOverride]);

  const handleFileRetry = useCallback((id: string) => {
    const file = files.find(f => f.id === id);
    if (!file || file.status !== 'error') return;
    uploadFile(file);
  }, [files, uploadFile]);
  
  // 拖拽事件处理
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 检查是否真的离开了拖放区域
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    // Check for file reference drag from FileCanvas
    const refData = e.dataTransfer.getData('application/x-file-reference');
    if (refData) {
      try {
        const parsed = JSON.parse(refData);
        addReference({
          id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fileId: parsed.fileId,
          fileName: parsed.fileName,
          filePath: parsed.filePath,
          level: parsed.level || 'shared',
          type: 'full',
        });
        return;
      } catch { /* fall through to normal file drop */ }
    }
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFilesAdd(droppedFiles);
    }
  };
  
  const isUploading = files.some(f => f.status === 'uploading');
  const readyPaths = files.filter(f => f.status === 'ready' && f.uploadedPath).map(f => f.uploadedPath!);
  const hasStaged = files.some(f => f.isStaged);
  const previewReadyPaths = attachmentPreviews.map((attachment) => attachment.uploadedPath).filter(Boolean) as string[];
  const previewStagingIds = Array.from(new Set(attachmentPreviews.map((attachment) => attachment.stagingId).filter(Boolean))) as string[];

  const handleSubmit = () => {
    const liveInput = textareaRef.current?.value ?? inputValueRef.current ?? input;
    // 精简模式：文本 + 附件，不走全局 fileReferences / designSuggestions
    if (compact) {
      if (isUploading) return;
      const text = liveInput.trim();
      const allReadyPaths = [...readyPaths, ...previewReadyPaths];
      if ((!text && allReadyPaths.length === 0) || effectiveRunning || effectiveDisabled) return;
      track('send');
      const pendingStagingId = hasStaged ? stagingIdRef.current || undefined : undefined;
      if (pendingStagingId) submitInFlightRef.current = true;
      if (sendAdapter) {
        sendAdapter(
          text,
          allReadyPaths.length > 0 ? allReadyPaths : undefined,
          [pendingStagingId, ...previewStagingIds].filter(Boolean).join(',') || undefined,
        );
      } else {
        onSend(
          text,
          allReadyPaths.length > 0 ? allReadyPaths : undefined,
          undefined,
          [pendingStagingId, ...previewStagingIds].filter(Boolean).join(',') || undefined,
        );
      }
      clearComposerText();
      files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
      setFiles([]);
      stagingIdRef.current = null;
      return;
    }

    if (isUploading) return;
    const messageText = stripReferenceTokens(liveInput);
    const hasRefs = fileReferences.length > 0;
    const allReadyPaths = [...readyPaths, ...previewReadyPaths];
    if ((messageText || allReadyPaths.length > 0 || hasRefs) && !effectiveRunning && !effectiveDisabled) {
      track('send');
      const pendingStagingId = hasStaged ? stagingIdRef.current || undefined : undefined;
      if (pendingStagingId) submitInFlightRef.current = true;
      onSend(
        messageText,
        allReadyPaths.length > 0 ? allReadyPaths : undefined,
        hasRefs ? [...fileReferences] : undefined,
        [pendingStagingId, ...previewStagingIds].filter(Boolean).join(',') || undefined,
      );
      clearComposerText();
      files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
      setFiles([]);
      stagingIdRef.current = null;
      onAttachmentPreviewsConsumed?.();
      clearReferences();
      setShowPicker(false);
      useDesignSuggestionsStore.getState().dismiss();
      updateAtTriggerPos(null);
    }
  };
  
  // @ 选择器：监听输入变化来跟踪 @ 查询
  const applyComposerValue = useCallback((val: string) => {
    inputValueRef.current = val;
    setInput(val);

    if (composingRef.current) {
      return;
    }

    fileReferences.forEach(ref => {
      if (!val.includes(fileReferenceToken(ref))) {
        removeReference(ref.id);
      }
    });

    if (showPicker && atTriggerPos !== null) {
      const caretOffset = Math.max(atTriggerPos + 1, Math.min(caretOffsetRef.current, val.length));
      const afterAt = val.slice(atTriggerPos + 1, caretOffset);
      if (atTriggerPos >= val.length || caretOffset < atTriggerPos + 1) {
        setShowPicker(false);
        updateAtTriggerPos(null);
      } else {
        setPickerQuery(afterAt);
      }
    }
  }, [atTriggerPos, fileReferences, removeReference, showPicker, updateAtTriggerPos]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    historyIndexRef.current = null;
    caretOffsetRef.current = e.target.selectionStart ?? e.target.value.length;
    if (composingRef.current || isCompositionInputEvent(e)) {
      composingRef.current = true;
      inputValueRef.current = e.target.value;
      return;
    }
    applyComposerValue(e.target.value);
  };

  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (composingRef.current || isCompositionInputEvent(e)) {
      composingRef.current = true;
      return;
    }
    const caretOffset = getEditorCaretOffset();
    caretOffsetRef.current = caretOffset;
    pendingCaretOffsetRef.current = caretOffset;
    applyComposerValue(readEditorText(e.currentTarget));
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleEditorBeforeInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!isCompositionInputEvent(e)) {
      return;
    }
    composingRef.current = true;
  };

  const handleEditorCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    composingRef.current = false;
    const editor = e.currentTarget;
    if (compositionSyncFrameRef.current !== null) {
      cancelAnimationFrame(compositionSyncFrameRef.current);
    }
    compositionSyncFrameRef.current = requestAnimationFrame(() => {
      compositionSyncFrameRef.current = null;
      const caretOffset = getEditorCaretOffset();
      caretOffsetRef.current = caretOffset;
      pendingCaretOffsetRef.current = caretOffset;
      applyComposerValue(readEditorText(editor));
    });
  };

  const handleTextareaCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = false;
    const textarea = e.currentTarget;
    if (compositionSyncFrameRef.current !== null) {
      cancelAnimationFrame(compositionSyncFrameRef.current);
    }
    compositionSyncFrameRef.current = requestAnimationFrame(() => {
      compositionSyncFrameRef.current = null;
      const caretOffset = textarea.selectionStart ?? textarea.value.length;
      caretOffsetRef.current = caretOffset;
      pendingCaretOffsetRef.current = caretOffset;
      applyComposerValue(textarea.value);
    });
  };

  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-ref-id]')) {
      e.preventDefault();
    }
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const removeButton = target.closest('[data-ref-remove]') as HTMLElement | null;
    const tokenElement = target.closest('[data-ref-id]') as HTMLElement | null;
    const refId = removeButton?.dataset.refRemove || tokenElement?.dataset.refId;
    if (!refId) return;
    const ref = fileReferences.find(item => item.id === refId);
    if (!ref) return;
    e.stopPropagation();
    if (removeButton) {
      removeInlineReference(ref);
    } else {
      openReferencePreview(ref);
    }
  };

  // 粘贴图片
  const insertPlainTextAtEditorCaret = useCallback((text: string) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor) return false;
    if (!selection || selection.rangeCount === 0) {
      const next = `${inputValueRef.current}${text}`;
      caretOffsetRef.current = next.length;
      pendingCaretOffsetRef.current = next.length;
      applyComposerValue(next);
      renderEditorValue(next, fileReferences, next.length);
      return true;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      const next = `${inputValueRef.current}${text}`;
      caretOffsetRef.current = next.length;
      pendingCaretOffsetRef.current = next.length;
      applyComposerValue(next);
      renderEditorValue(next, fileReferences, next.length);
      return true;
    }

    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    const caretOffset = getEditorCaretOffset();
    caretOffsetRef.current = caretOffset;
    pendingCaretOffsetRef.current = caretOffset;
    applyComposerValue(readEditorText(editor));
    return true;
  }, [applyComposerValue, fileReferences, getEditorCaretOffset, readEditorText, renderEditorValue]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    const imageFiles: File[] = [];
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(withUniqueClipboardImageName(file));
        }
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFilesAdd(imageFiles);
      return;
    }

    const plainText = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text') || '';
    if (!compact && plainText && e.currentTarget === editorRef.current) {
      e.preventDefault();
      insertPlainTextAtEditorCaret(plainText);
    }
  }, [compact, handleFilesAdd, insertPlainTextAtEditorCaret]);

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCompositionKeyboardEvent(e)) return;
    if (!compact && e.key === 'Backspace' && roundtableTag && input === roundtableTag.template && textareaRef.current?.selectionStart === 0) {
      e.preventDefault();
      onClearRoundtableTag?.();
      clearComposerText();
      return;
    }
    // If picker is open, let it handle arrow keys / enter / esc
    if (!compact && showPicker) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return;
    }
    if (!compact && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const textarea = textareaRef.current;
      const hasModifier = e.shiftKey || e.altKey || e.metaKey || e.ctrlKey;
      const hasSelection = textarea && textarea.selectionStart !== textarea.selectionEnd;
      if (hasModifier || hasSelection) return;
      const liveInput = textarea?.value ?? inputValueRef.current;
      const caret = textarea?.selectionStart ?? liveInput.length;
      const atBoundary = e.key === 'ArrowUp'
        ? !liveInput.slice(0, caret).includes('\n')
        : !liveInput.slice(caret).includes('\n');
      const currentIndex = historyIndexRef.current;
      const isBrowsingCurrentHistory = currentIndex !== null && liveInput === commandHistory[currentIndex];
      if (liveInput.length > 0 && !isBrowsingCurrentHistory) {
        historyIndexRef.current = null;
        historyDraftRef.current = '';
        return;
      }
      if (atBoundary && commandHistory.length > 0 && !(e.key === 'ArrowDown' && currentIndex === null)) {
        e.preventDefault();
        if (e.key === 'ArrowUp') {
          if (currentIndex === null) historyDraftRef.current = liveInput;
          historyIndexRef.current = Math.max(0, (currentIndex ?? commandHistory.length) - 1);
        } else {
          historyIndexRef.current = Math.min(commandHistory.length, currentIndex! + 1);
        }
        const nextIndex = historyIndexRef.current;
        if (nextIndex === commandHistory.length) historyIndexRef.current = null;
        applyExternalComposerText(nextIndex === commandHistory.length ? historyDraftRef.current : commandHistory[nextIndex]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }
    if (compact) return;
    if (e.key === 'Backspace') {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart === textarea.selectionEnd) {
        const caret = textarea.selectionStart;
        const refBeforeCaret = fileReferences.find(ref => {
          const token = fileReferenceToken(ref);
          const start = input.lastIndexOf(token, caret);
          return start >= 0 && start + token.length === caret;
        });
        if (refBeforeCaret) {
          e.preventDefault();
          removeInlineReference(refBeforeCaret);
          return;
        }
      }
    }
    // Trigger @ picker on "@" key
    if (e.key === '@' || (e.key === '2' && e.shiftKey)) {
      setTimeout(() => {
        const pos = textareaRef.current?.selectionStart ?? input.length;
        const nextVal = textareaRef.current?.value || inputValueRef.current;
        const atIdx = nextVal.lastIndexOf('@', pos);
        if (atIdx >= 0) {
          updateAtTriggerPos(atIdx);
          setPickerQuery('');
          setShowPicker(true);
        }
      }, 0);
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (effectiveDisabled) {
      e.preventDefault();
      return;
    }
    if (isCompositionKeyboardEvent(e)) return;
    if (showPicker && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.isCollapsed) {
        const focusNode = selection.focusNode;
        const focusOffset = selection.focusOffset;
        const editor = editorRef.current;
        const previousNode = editor && focusNode === editor
          ? editor.childNodes.item(focusOffset - 1)
          : focusOffset === 0
            ? focusNode?.previousSibling
            : null;
        const tokenElement = previousNode instanceof HTMLElement && previousNode.dataset.refId
          ? previousNode
          : null;
        const ref = tokenElement
          ? fileReferences.find(item => item.id === tokenElement.dataset.refId)
          : null;
        if (ref) {
          e.preventDefault();
          removeInlineReference(ref);
          return;
        }
      }
    }
    if (e.key === '@' || (e.key === '2' && e.shiftKey)) {
      setTimeout(() => {
        const pos = getEditorCaretOffset();
        const text = readEditorText(editorRef.current);
        const atIdx = text.lastIndexOf('@', pos);
        if (atIdx >= 0) {
          updateAtTriggerPos(atIdx);
          setPickerQuery('');
          setShowPicker(true);
        }
      }, 0);
    }
  };

  // @ 选择器选中文件（v11: 接受 UserFileInfo 单来源）
  const handlePickerSelect = async (file: FilePickerFile) => {
    const fileName = file.displayName || file.path;
    const nextRef: FileReference = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fileName,
      filePath: file.path,
      level: file.referenceLevel,
      type: 'full',
    };

    // Remove the full @query text from input. In contentEditable, key/input timing can
    // leave repeated trigger chars (for example "@@read"); collapse that whole run.
    const editorText = USE_CONTENT_EDITABLE_COMPOSER ? readEditorText(editorRef.current) : '';
    const liveInput = compact || !USE_CONTENT_EDITABLE_COMPOSER
      ? inputValueRef.current
      : (editorText || inputValueRef.current);
    const liveCaret = compact || !USE_CONTENT_EDITABLE_COMPOSER
      ? textareaRef.current?.selectionStart ?? liveInput.length
      : getEditorCaretOffset();
    const rememberedTrigger = atTriggerPosRef.current ?? atTriggerPos;
    const lastAtBeforeCaret = liveInput.lastIndexOf('@', Math.max(0, liveCaret));
    const anyAt = liveInput.lastIndexOf('@');
    const triggerAt = rememberedTrigger ?? (lastAtBeforeCaret >= 0
      ? lastAtBeforeCaret
      : anyAt >= 0 ? anyAt : null);

    if (triggerAt !== null && triggerAt >= 0) {
      let triggerStart = triggerAt;
      while (triggerStart > 0 && /[@\s]/.test(liveInput[triggerStart - 1])) {
        triggerStart -= 1;
      }
      const activeQuery = pickerQuery;
      let before = liveInput.slice(0, triggerStart);
      const queryEnd = activeQuery
        ? triggerAt + (liveInput[triggerAt] === '@' ? 1 : 0) + activeQuery.length
        : triggerAt + (liveInput[triggerAt] === '@' ? 1 : 0);
      let rest = liveInput.slice(queryEnd);
      if (activeQuery) {
        before = before
          .replace(new RegExp(`${escapeRegExp(`@${activeQuery}`)}$`), '')
          .replace(/@+$/, '');
        rest = rest.replace(new RegExp(`^${escapeRegExp(activeQuery)}`), '');
      }
      const separator = before && !/\s$/.test(before) ? ' ' : '';
      const suffix = rest && !/^\s/.test(rest) ? ` ${rest}` : rest;
      const nextInput = `${before}${separator}${fileReferenceToken(nextRef)}${suffix}`;
      inputValueRef.current = nextInput;
      setInput(nextInput);
      const pos = before.length + separator.length + fileReferenceToken(nextRef).length;
      renderEditorValue(nextInput, [...fileReferences, nextRef], pos);
      if (!USE_CONTENT_EDITABLE_COMPOSER) {
        requestAnimationFrame(() => writeTextareaValue(nextInput, pos));
      }
    }

    addReference(nextRef);
    setShowPicker(false);
    updateAtTriggerPos(null);
    if (triggerAt === null || triggerAt < 0) {
      focusComposerAtOffset();
    }
  };
  
  const getFileTypeConfigByName = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    const configs: Record<string, { gradient: string; text: string; label: string }> = {
      // 数据/表格 — 绿色系
      csv:  { gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', text: '#fff', label: 'CSV' },
      xlsx: { gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', text: '#fff', label: 'XLSX' },
      xls:  { gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', text: '#fff', label: 'XLS' },
      tsv:  { gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', text: '#fff', label: 'TSV' },
      // 文档 — 蓝色系
      pdf:  { gradient: 'linear-gradient(135deg, #DC2626 0%, #F87171 100%)', text: '#fff', label: 'PDF' },
      doc:  { gradient: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)', text: '#fff', label: 'DOC' },
      docx: { gradient: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)', text: '#fff', label: 'DOCX' },
      rtf:  { gradient: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)', text: '#fff', label: 'RTF' },
      odt:  { gradient: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)', text: '#fff', label: 'ODT' },
      epub: { gradient: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)', text: '#fff', label: 'EPUB' },
      // 演示文稿 — 橙色系
      ppt:  { gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', text: '#fff', label: 'PPT' },
      pptx: { gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', text: '#fff', label: 'PPTX' },
      odp:  { gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', text: '#fff', label: 'ODP' },
      key:  { gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', text: '#fff', label: 'KEY' },
      // 文本/Markdown — 紫灰色系
      txt:  { gradient: 'linear-gradient(135deg, #52525B 0%, #71717A 100%)', text: '#fff', label: 'TXT' },
      md:   { gradient: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)', text: '#fff', label: 'MD' },
      log:  { gradient: 'linear-gradient(135deg, #52525B 0%, #71717A 100%)', text: '#fff', label: 'LOG' },
      // 代码 — 青色系
      py:   { gradient: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)', text: '#fff', label: 'PY' },
      js:   { gradient: 'linear-gradient(135deg, #CA8A04 0%, #EAB308 100%)', text: '#fff', label: 'JS' },
      ts:   { gradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)', text: '#fff', label: 'TS' },
      jsx:  { gradient: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)', text: '#fff', label: 'JSX' },
      tsx:  { gradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)', text: '#fff', label: 'TSX' },
      java: { gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)', text: '#fff', label: 'JAVA' },
      go:   { gradient: 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)', text: '#fff', label: 'GO' },
      rs:   { gradient: 'linear-gradient(135deg, #9A3412 0%, #C2410C 100%)', text: '#fff', label: 'RS' },
      c:    { gradient: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', text: '#fff', label: 'C' },
      cpp:  { gradient: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', text: '#fff', label: 'C++' },
      h:    { gradient: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', text: '#fff', label: 'H' },
      cs:   { gradient: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)', text: '#fff', label: 'C#' },
      rb:   { gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)', text: '#fff', label: 'RB' },
      php:  { gradient: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)', text: '#fff', label: 'PHP' },
      swift:{ gradient: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', text: '#fff', label: 'SWIFT' },
      kt:   { gradient: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)', text: '#fff', label: 'KT' },
      sql:  { gradient: 'linear-gradient(135deg, #0369A1 0%, #0284C7 100%)', text: '#fff', label: 'SQL' },
      sh:   { gradient: 'linear-gradient(135deg, #52525B 0%, #71717A 100%)', text: '#fff', label: 'SH' },
      html: { gradient: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', text: '#fff', label: 'HTML' },
      css:  { gradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)', text: '#fff', label: 'CSS' },
      scss: { gradient: 'linear-gradient(135deg, #DB2777 0%, #EC4899 100%)', text: '#fff', label: 'SCSS' },
      vue:  { gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', text: '#fff', label: 'VUE' },
      // 配置/数据 — 灰蓝色系
      json: { gradient: 'linear-gradient(135deg, #52525B 0%, #71717A 100%)', text: '#fff', label: 'JSON' },
      yaml: { gradient: 'linear-gradient(135deg, #52525B 0%, #71717A 100%)', text: '#fff', label: 'YAML' },
      yml:  { gradient: 'linear-gradient(135deg, #52525B 0%, #71717A 100%)', text: '#fff', label: 'YML' },
      toml: { gradient: 'linear-gradient(135deg, #52525B 0%, #71717A 100%)', text: '#fff', label: 'TOML' },
      xml:  { gradient: 'linear-gradient(135deg, #52525B 0%, #71717A 100%)', text: '#fff', label: 'XML' },
      ini:  { gradient: 'linear-gradient(135deg, #52525B 0%, #71717A 100%)', text: '#fff', label: 'INI' },
      env:  { gradient: 'linear-gradient(135deg, #52525B 0%, #71717A 100%)', text: '#fff', label: 'ENV' },
      // 图片
      jpg:  { gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', text: '#fff', label: 'JPG' },
      jpeg: { gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', text: '#fff', label: 'JPEG' },
      png:  { gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)', text: '#fff', label: 'PNG' },
      gif:  { gradient: 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)', text: '#fff', label: 'GIF' },
      webp: { gradient: 'linear-gradient(135deg, #06B6D4 0%, #22D3EE 100%)', text: '#fff', label: 'WEBP' },
      svg:  { gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', text: '#fff', label: 'SVG' },
      bmp:  { gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', text: '#fff', label: 'BMP' },
      ico:  { gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', text: '#fff', label: 'ICO' },
      // 音频 — 粉色系
      mp3:  { gradient: 'linear-gradient(135deg, #DB2777 0%, #EC4899 100%)', text: '#fff', label: 'MP3' },
      wav:  { gradient: 'linear-gradient(135deg, #DB2777 0%, #EC4899 100%)', text: '#fff', label: 'WAV' },
      m4a:  { gradient: 'linear-gradient(135deg, #DB2777 0%, #EC4899 100%)', text: '#fff', label: 'M4A' },
      aac:  { gradient: 'linear-gradient(135deg, #DB2777 0%, #EC4899 100%)', text: '#fff', label: 'AAC' },
      flac: { gradient: 'linear-gradient(135deg, #DB2777 0%, #EC4899 100%)', text: '#fff', label: 'FLAC' },
      ogg:  { gradient: 'linear-gradient(135deg, #DB2777 0%, #EC4899 100%)', text: '#fff', label: 'OGG' },
      // 视频 — 靛蓝色系
      mp4:  { gradient: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', text: '#fff', label: 'MP4' },
      webm: { gradient: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', text: '#fff', label: 'WEBM' },
      mov:  { gradient: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', text: '#fff', label: 'MOV' },
      avi:  { gradient: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', text: '#fff', label: 'AVI' },
      mkv:  { gradient: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', text: '#fff', label: 'MKV' },
      // 压缩包 — 琥珀色系
      zip:  { gradient: 'linear-gradient(135deg, #92400E 0%, #B45309 100%)', text: '#fff', label: 'ZIP' },
      tar:  { gradient: 'linear-gradient(135deg, #92400E 0%, #B45309 100%)', text: '#fff', label: 'TAR' },
      gz:   { gradient: 'linear-gradient(135deg, #92400E 0%, #B45309 100%)', text: '#fff', label: 'GZ' },
      rar:  { gradient: 'linear-gradient(135deg, #92400E 0%, #B45309 100%)', text: '#fff', label: 'RAR' },
      '7z': { gradient: 'linear-gradient(135deg, #92400E 0%, #B45309 100%)', text: '#fff', label: '7Z' },
      // 字体
      ttf:  { gradient: 'linear-gradient(135deg, #525252 0%, #737373 100%)', text: '#fff', label: 'TTF' },
      otf:  { gradient: 'linear-gradient(135deg, #525252 0%, #737373 100%)', text: '#fff', label: 'OTF' },
      woff: { gradient: 'linear-gradient(135deg, #525252 0%, #737373 100%)', text: '#fff', label: 'WOFF' },
      woff2:{ gradient: 'linear-gradient(135deg, #525252 0%, #737373 100%)', text: '#fff', label: 'WOFF2' },
      // 数据库/数据
      db:   { gradient: 'linear-gradient(135deg, #0369A1 0%, #0284C7 100%)', text: '#fff', label: 'DB' },
      sqlite:{ gradient: 'linear-gradient(135deg, #0369A1 0%, #0284C7 100%)', text: '#fff', label: 'SQLITE' },
    };
    
    return configs[ext] || { 
      gradient: 'linear-gradient(135deg, #3F3F46 0%, #52525B 100%)', 
      text: '#fff', 
      label: ext.toUpperCase() || 'FILE' 
    };
  };

  const getFileTypeConfig = (file: File) => getFileTypeConfigByName(file.name);
  
  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const hasContent = compact
    ? (input.trim() || readyPaths.length > 0 || files.length > 0 || previewReadyPaths.length > 0)
    : (input.trim() || readyPaths.length > 0 || files.length > 0 || previewReadyPaths.length > 0 || fileReferences.length > 0);
  const sendButtonDisabled = isCancelling
    || (effectiveRunning
      ? !effectiveCanCancel
      : effectiveDisabled || !hasContent || isUploading);

  // Anchor rect for picker positioning
  const getAnchorRect = (): DOMRect | null => {
    return containerRef.current?.getBoundingClientRect() || null;
  };
  
  const outerPadding = containerPadding ?? (compact ? '8px 12px' : '0 24px 31px');
  const innerClassName = compact ? '' : 'mx-auto';
  const innerStyle = compact ? {} : { maxWidth };
  const inlineInputParts = useMemo(() => {
    if (!input || compact || fileReferences.length === 0) return [{ type: 'text' as const, text: input }];
    const matches = fileReferences
      .map(ref => {
        const token = fileReferenceToken(ref);
        const start = input.indexOf(token);
        return start >= 0 ? { ref, token, start, end: start + token.length } : null;
      })
      .filter((match): match is { ref: FileReference; token: string; start: number; end: number } => Boolean(match))
      .sort((a, b) => a.start - b.start);

    const parts: Array<
      | { type: 'text'; text: string }
      | { type: 'ref'; ref: FileReference; token: string }
    > = [];
    let cursor = 0;
    matches.forEach(match => {
      if (match.start < cursor) return;
      if (match.start > cursor) {
        parts.push({ type: 'text', text: input.slice(cursor, match.start) });
      }
      parts.push({ type: 'ref', ref: match.ref, token: match.token });
      cursor = match.end;
    });
    if (cursor < input.length) {
      parts.push({ type: 'text', text: input.slice(cursor) });
    }
    return parts.length > 0 ? parts : [{ type: 'text' as const, text: input }];
  }, [compact, fileReferences, input]);

  return (
    <div
      className={compact ? 'chat-input-compact' : 'chat-input-area'}
      style={{
        padding: outerPadding,
        ...(compact ? {} : {
          // Reserve the same scrollbar gutter as the message list so composer content stays aligned.
          overflowY: 'auto',
          scrollbarGutter: 'stable both-edges',
        }),
      }}
      data-testid={compact ? 'chat-input-compact' : 'chat-input-area'}
    >
      <div
        ref={dropZoneRef}
        className={innerClassName}
        style={innerStyle}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-testid="chat-input-dropzone"
      >
        {/* 拖拽提示覆盖层 - 全局性提示 */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ 
                background: 'var(--drag-overlay-bg)', 
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="text-center"
                style={{ maxWidth: 400 }}
              >
                {/* 上传图标 - 带动画 */}
                <motion.div 
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--drag-icon-bg)' }}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Paperclip size={36} style={{ color: 'var(--drag-icon-color)' }} />
                </motion.div>
                {/* 主文案 */}
                <p 
                  className="text-xl font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  释放以上传文件
                </p>
                {/* 支持格式说明 */}
                <p 
                  className="text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  支持几乎所有文件格式，单个文件最大 50MB
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* @ 文件选择器浮层 */}
        <AnimatePresence>
          {!compact && showPicker && (
            <FilePickerPopover
              query={pickerQuery}
              anchorRect={getAnchorRect()}
              agentId={effectiveAgentId}
              sessionId={effectiveSessionId}
              onSelect={handlePickerSelect}
              onClose={() => { setShowPicker(false); updateAtTriggerPos(null); }}
            />
          )}
        </AnimatePresence>

        {/* 设计建议用例面板 */}
        <AnimatePresence>
          {!compact && designActiveType && designSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="mb-2 rounded-xl overflow-hidden"
              style={{
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
              }}
            >
              <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                <span className="text-[10px]" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  试试这些
                </span>
                <button
                  onClick={dismissDesign}
                  className="flex items-center justify-center rounded-md transition-colors hover:bg-zinc-500/10"
                  style={{ width: 18, height: 18, color: 'var(--text-muted)' }}
                >
                  <X size={11} />
                </button>
              </div>
              <div className="px-1.5 pb-1.5 flex flex-col gap-0.5">
                {designSuggestions.map((s, i) => {
                  const preview = s.text.length > 72 ? s.text.slice(0, 72) + '...' : s.text;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        applyExternalComposerText(s.text);
                      }}
                      className="group flex items-start gap-2 px-2 py-[6px] rounded-lg text-left transition-colors duration-100"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <svg
                        width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className="flex-shrink-0 mt-[2px] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        style={{ color: 'var(--text-muted)', opacity: 0.5 }}
                      >
                        <line x1="7" y1="17" x2="17" y2="7" />
                        <polyline points="7,7 17,7 17,17" />
                      </svg>
                      <span
                        className="text-[11.5px] leading-relaxed"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {preview}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 上传提示条 */}
        <AnimatePresence>
          {uploadWarning && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="mb-2 flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--warning)', marginTop: 2 }}>
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ wordBreak: 'break-all', lineHeight: 1.5 }}>{uploadWarning}</span>
              <button
                onClick={() => setUploadWarning(null)}
                className="ml-auto flex-shrink-0 p-0.5 rounded hover:bg-zinc-500/20 transition-colors"
                style={{ color: 'var(--text-muted)', marginTop: 1 }}
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 频道触发提示条 */}
        <AnimatePresence>
          {!compact && channelHint && effectiveRunning && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2 px-4 py-2 mb-2 rounded-xl text-xs"
              style={{
                background: 'var(--ch-bar-bg, rgba(139,92,246,0.08))',
                border: '1px solid var(--ch-bar-border, rgba(139,92,246,0.15))',
                color: 'var(--text-secondary)',
              }}
              data-testid="chat-upload-warning"
            >
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: 'rgb(139,92,246)' }} />
                <span className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: 'rgb(139,92,246)' }} />
              </span>
              <span>{channelHint}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 上下文压缩提示条 */}
        <AnimatePresence>
          {!compact && compressionHint && effectiveRunning && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2 px-4 py-2 mb-2 rounded-xl text-xs"
              style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.15)',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: 'rgb(59,130,246)' }} />
                <span className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: 'rgb(59,130,246)' }} />
              </span>
              <span>{compressionHint}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 输入框容器 */}
        <div 
          ref={containerRef}
          className={`relative transition-all duration-200 ${effectiveDisabled ? 'opacity-50' : ''}`}
          style={{
            minHeight: compact ? undefined : 116,
            background: 'var(--sender-bg)',
            border: `0.5px solid ${isDragging ? 'var(--border-muted)' : 'var(--sender-border)'}`,
            borderRadius: 16,
            boxShadow: 'var(--sender-shadow)',
          }}
          data-testid="chat-composer"
        >
          
          {/* 文件引用 chips */}
          <style>
            {`
              @keyframes composer-attachment-highlight {
                0% {
                  border-color: rgba(211, 91, 51, 0.68);
                  box-shadow: 0 0 0 0 rgba(211, 91, 51, 0.22), var(--upload-icon-shadow);
                }
                28% {
                  border-color: rgba(211, 91, 51, 0.92);
                  box-shadow: 0 0 0 4px rgba(211, 91, 51, 0.13), var(--upload-icon-shadow);
                }
                72% {
                  border-color: rgba(211, 91, 51, 0.48);
                  box-shadow: 0 0 0 2px rgba(211, 91, 51, 0.07), var(--upload-icon-shadow);
                }
                100% {
                  border-color: var(--upload-preview-border);
                  box-shadow: none;
                }
              }
            `}
          </style>
          <AnimatePresence>
            {attachmentPreviews.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="flex flex-wrap"
                  style={{
                    gap: compact ? 8 : 10,
                    padding: compact ? '10px 12px 4px' : '8px 12px 4px',
                  }}
                >
                  {attachmentPreviews.map((attachment) => {
                    const config = getFileTypeConfigByName(attachment.name);

                    return (
                      <motion.div
                        key={attachment.id}
                        initial={{ scale: 0.9, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: -10 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="relative group"
                        style={{ width: compact ? 176 : 188 }}
                      >
                        <div
                          className="relative flex items-center gap-3"
                          style={{
                            height: compact ? 48 : 52,
                            width: '100%',
                            padding: '0 10px',
                            borderRadius: 10,
                            background: 'var(--upload-preview-bg)',
                            border: '1px solid var(--upload-preview-border)',
                            animationName: attachment.highlight ? 'composer-attachment-highlight' : undefined,
                            animationDuration: attachment.highlight ? '3000ms' : undefined,
                            animationTimingFunction: attachment.highlight ? 'ease-out' : undefined,
                            animationDelay: attachment.highlight ? '720ms' : undefined,
                            animationFillMode: attachment.highlight ? 'forwards' : undefined,
                          }}
                        >
                          <div
                            className="flex items-center justify-center flex-shrink-0 relative"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 7,
                              background: '#fff',
                              boxShadow: 'var(--upload-icon-shadow)',
                              color: config.label === 'PDF' ? '#DC2626' : '#2563EB',
                            }}
                          >
                            <span style={{ fontSize: config.label.length <= 3 ? 14 : config.label.length <= 4 ? 11 : 9, fontWeight: 700, lineHeight: 1 }}>
                              {config.label === 'DOC' || config.label === 'DOCX' ? 'W' : config.label}
                            </span>
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p className="truncate" style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, lineHeight: '18px' }}>{attachment.name}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: '14px' }}>
                              {attachment.sizeLabel}
                            </p>
                          </div>
                          <button
                            onClick={() => handleAttachmentPreviewRemove(attachment)}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full 
                                     flex items-center justify-center
                                     opacity-0 group-hover:opacity-100 transition-all duration-150"
                            style={{ background: 'var(--upload-remove-btn-bg)', boxShadow: 'var(--upload-remove-btn-shadow)' }}
                            aria-label={`删除 ${attachment.name}`}
                          >
                            <X size={10} strokeWidth={2.5} style={{ color: 'var(--upload-remove-btn-icon)' }} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* 文件预览区域 */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
                data-testid="chat-upload-preview-list"
              >
                <div
                  className="flex flex-wrap"
                  style={{
                    gap: compact ? 8 : 10,
                    padding: compact ? '10px 12px 4px' : '8px 12px 4px',
                  }}
                >
                  {files.map((file) => {
                    const config = getFileTypeConfig(file.file);
                    const isError = file.status === 'error';
                    const isLoading = file.status === 'uploading';
                    
                    return (
                      <motion.div
                        key={file.id}
                        initial={{ scale: 0.9, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: -10 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="chat-upload-preview relative group"
                        style={{ width: compact ? 176 : 188 }}
                        data-testid={`chat-upload-preview-${file.id}`}
                      >
                        {isLoading ? (
                          <div
                            className="absolute left-1/2 flex items-center justify-center"
                            style={{
                              top: -28,
                              transform: 'translateX(-50%)',
                              zIndex: 2,
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                top: 20,
                                width: 1,
                                height: 12,
                                background: 'var(--upload-progress-line)',
                              }}
                            />
                            <span
                              style={{
                                position: 'relative',
                                borderRadius: 4,
                                padding: '3px 7px',
                                background: 'var(--upload-progress-bg)',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 500,
                                lineHeight: '14px',
                              }}
                            >
                              上传中
                            </span>
                          </div>
                        ) : null}
                        {file.type === 'image' ? (
                          <div 
                            className="relative flex items-center gap-3"
                            style={{
                              height: compact ? 48 : 52,
                              width: '100%',
                              padding: '0 10px',
                              borderRadius: 10,
                              background: 'var(--upload-preview-bg)',
                              border: `1px solid ${isError ? 'var(--upload-preview-error-border)' : 'var(--upload-preview-border)'}`,
                            }}
                          >
                            <div 
                              className="relative overflow-hidden flex-shrink-0"
                              style={{ width: 32, height: 32, borderRadius: 7, boxShadow: 'var(--upload-icon-shadow)' }}
                            >
                              <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover" />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p className="truncate" style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, lineHeight: '18px' }}>{file.file.name}</p>
                              <p style={{ color: isError ? 'var(--upload-preview-error-text)' : 'var(--text-muted)', fontSize: 11, lineHeight: '14px' }}>
                                {isError ? '上传失败' : isLoading ? '上传中...' : formatFileSize(file.file.size)}
                              </p>
                            </div>
                            {/* 操作按钮 */}
                            {isError ? (
                              <button
                                onClick={() => handleFileRetry(file.id)}
                                className="chat-upload-retry absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium
                                         opacity-0 group-hover:opacity-100 transition-all duration-200"
                                style={{ background: 'var(--upload-preview-error-border)', color: '#fff' }}
                                data-testid={`chat-upload-retry-${file.id}`}
                              >
                                重试
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleFileRemove(file.id)}
                              className="chat-upload-remove absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full
                                       flex items-center justify-center
                                       opacity-0 group-hover:opacity-100 transition-all duration-150"
                              style={{ background: 'var(--upload-remove-btn-bg)', boxShadow: 'var(--upload-remove-btn-shadow)' }}
                              data-testid={`chat-upload-remove-${file.id}`}
                            >
                              <X size={10} strokeWidth={2.5} style={{ color: 'var(--upload-remove-btn-icon)' }} />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="relative flex items-center gap-3"
                            style={{
                              height: compact ? 48 : 52,
                              width: '100%',
                              padding: '0 10px',
                              borderRadius: 10,
                              background: 'var(--upload-preview-bg)',
                              border: `1px solid ${isError ? 'var(--upload-preview-error-border)' : 'var(--upload-preview-border)'}`,
                            }}
                          >
                            <div
                              className="flex items-center justify-center flex-shrink-0 relative"
                              style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', boxShadow: 'var(--upload-icon-shadow)', color: config.label === 'PDF' ? '#DC2626' : '#2563EB' }}
                            >
                              {isLoading ? (
                                <span style={{ fontSize: config.label.length <= 3 ? 14 : config.label.length <= 4 ? 11 : 9, fontWeight: 700, lineHeight: 1 }}>{config.label === 'DOC' || config.label === 'DOCX' ? 'W' : config.label}</span>
                              ) : (
                                <span style={{ fontSize: config.label.length <= 3 ? 14 : config.label.length <= 4 ? 11 : 9, fontWeight: 700, lineHeight: 1 }}>{config.label === 'DOC' || config.label === 'DOCX' ? 'W' : config.label}</span>
                              )}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p className="truncate" style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, lineHeight: '18px' }}>{file.file.name}</p>
                              <p style={{ color: isError ? 'var(--upload-preview-error-text)' : 'var(--text-muted)', fontSize: 11, lineHeight: '14px' }}>
                                {isError ? '上传失败' : isLoading ? '上传中...' : formatFileSize(file.file.size)}
                              </p>
                            </div>
                            {isError ? (
                              <button
                                onClick={() => handleFileRetry(file.id)}
                                className="chat-upload-retry absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium
                                         opacity-0 group-hover:opacity-100 transition-all duration-200"
                                style={{ background: 'var(--upload-preview-error-border)', color: '#fff' }}
                                data-testid={`chat-upload-retry-${file.id}`}
                              >
                                重试
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleFileRemove(file.id)}
                              className="chat-upload-remove absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full
                                       flex items-center justify-center
                                       opacity-0 group-hover:opacity-100 transition-all duration-150"
                              style={{ background: 'var(--upload-remove-btn-bg)', boxShadow: 'var(--upload-remove-btn-shadow)' }}
                              data-testid={`chat-upload-remove-${file.id}`}
                            >
                              <X size={10} strokeWidth={2.5} style={{ color: 'var(--upload-remove-btn-icon)' }} />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* 圆桌模板标签 */}
          {!compact && roundtableTag && (
            <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontWeight: 600, lineHeight: 1,
                padding: '4px 10px', borderRadius: 8,
                background: RT_TAG_COLORS[roundtableTag.mode]?.bg || 'var(--bg-tertiary)',
                border: `1px solid ${RT_TAG_COLORS[roundtableTag.mode]?.border || 'var(--border-primary)'}`,
                color: RT_TAG_COLORS[roundtableTag.mode]?.text || 'var(--text-primary)',
              }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {roundtableTag.label}
                <button
                  onClick={() => { onClearRoundtableTag?.(); clearComposerText(); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'inherit', opacity: 0.6, display: 'flex', marginLeft: 2,
                  }}
                >
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            </div>
          )}

          {/* 上部：文本输入区 */}
          <div style={{ padding: compact ? '12px 12px 8px' : '16px 16px 0' }}>
            <div style={{ position: 'relative' }}>
              {!compact && USE_CONTENT_EDITABLE_COMPOSER ? (
                <>
                {!input ? (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      minHeight: 60,
                      fontSize: 14,
                      lineHeight: '22px',
                      color: 'var(--text-placeholder)',
                      pointerEvents: 'none',
                    }}
                  >
                    {effectiveDisabled ? effectivePlaceholder : (effectivePlaceholder ?? '描述需求，@引用文件')}
                  </div>
                ) : null}
                <div
                  ref={editorRef}
                  contentEditable={!effectiveDisabled}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBeforeInput={handleEditorBeforeInput}
                  onInput={handleEditorInput}
                  onKeyDown={handleEditorKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleEditorCompositionEnd}
                  onMouseDown={handleEditorMouseDown}
                  onClick={handleEditorClick}
                  onPaste={handlePaste}
                  className="w-full bg-transparent border-0 focus:outline-none focus:ring-0"
                  style={{
                    minHeight: 60,
                    maxHeight: 160,
                    overflowY: 'auto',
                    fontSize: 14,
                    lineHeight: '22px',
                    color: 'var(--text-primary)',
                    caretColor: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'break-word',
                    cursor: effectiveDisabled ? 'not-allowed' : 'text',
                  }}
                  data-testid="chat-composer-editor"
                >
                  {false ? inlineInputParts.map((part, index) => part.type === 'ref' ? (
                    <span
                      key={`${part.ref.id}-${index}`}
                      data-ref-id={part.ref.id}
                      data-ref-token={part.token}
                      contentEditable={false}
                      className="inline-flex items-center align-baseline group"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openReferencePreview(part.ref)}
                      style={{
                        color: 'var(--file-ref-token-text, #2563EB)',
                        background: 'transparent',
                        borderRadius: 4,
                        minHeight: 18,
                        padding: '0 1px',
                        margin: '0 1px',
                        gap: 3,
                        fontSize: 13,
                        lineHeight: '18px',
                        verticalAlign: 'baseline',
                        cursor: 'pointer',
                      }}
                      title={`${part.ref.fileName} - 点击预览`}
                    >
                      <button
                        type="button"
                        aria-label={`取消引用 ${part.ref.fileName}`}
                        onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeInlineReference(part.ref);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          width: 13,
                          height: 13,
                          border: 0,
                          padding: 0,
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          color: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                      <Paperclip size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span>{part.token}</span>
                    </span>
                  ) : (
                    <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>
                  )) : null}
                </div>
                </>
              ) : null}
              <textarea
                ref={textareaRef}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleTextareaCompositionEnd}
                onPaste={handlePaste}
                placeholder={effectiveDisabled ? effectivePlaceholder : (effectivePlaceholder ?? '描述需求，@引用文件')}
                disabled={effectiveDisabled}
                spellCheck={false}
                rows={1}
                className="w-full bg-transparent border-0 resize-none placeholder:text-[color:var(--text-placeholder)]
                       focus:outline-none focus:ring-0
                       disabled:cursor-not-allowed"
                style={{
                  display: compact || !USE_CONTENT_EDITABLE_COMPOSER ? undefined : 'none',
                  minHeight: compact ? 24 : 60,
                  maxHeight: 160,
                  fontSize: compact ? 13 : 14,
                  lineHeight: compact ? 1.6 : '22px',
                  padding: 0,
                  transform: compact ? undefined : 'translateY(-4px)',
                  color: 'var(--text-primary)',
                  caretColor: 'var(--text-primary)',
                }}
                data-testid="chat-composer-textarea"
              />
            </div>
          </div>
          
          {/* 下部：工具栏 */}
          <div
            className="flex items-center justify-between"
            style={{
              padding: compact ? '8px 12px' : 8,
            }}
          >
            {/* 隐藏的文件输入 */}
            {/* onClick 复位 value：浏览器在 value 未变时不再触发 onChange，导致用户连续选同一文件无任何反馈 */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ''; }}
              onChange={(e) => e.target.files && handleFilesAdd(e.target.files)}
              className="hidden"
              data-testid="chat-image-file-input"
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ''; }}
              onChange={(e) => e.target.files && handleFilesAdd(e.target.files)}
              className="hidden"
              data-testid="chat-file-input"
            />

            {/* 左侧：+ 按钮 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                disabled={effectiveDisabled || effectiveRunning}
                className="flex items-center justify-center transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  width: compact ? 30 : 32,
                  height: compact ? 30 : 32,
                  borderRadius: compact ? 10 : 10,
                  border: 0,
                  background: 'transparent',
                  color: 'var(--text-primary)',
                }}
                data-testid="chat-attach-file-btn"
              >
                <PlusGlyph />
              </button>
            </div>

            {/* 右侧：发送/停止按钮 */}
            <motion.button
              whileHover={{ scale: isCancelling ? 1 : 1.02 }}
              whileTap={{ scale: isCancelling ? 1 : 0.98 }}
              onClick={effectiveCanCancel && !isCancelling ? onCancel : (!effectiveRunning ? handleSubmit : undefined)}
              disabled={sendButtonDisabled}
              className="chat-send-control flex-shrink-0 flex items-center justify-center
                        transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                  width: compact ? 30 : 34,
                  height: compact ? 30 : 34,
                  borderRadius: compact ? 15 : 17,
                  boxShadow: (!effectiveRunning && hasContent) ? 'var(--send-btn-active-shadow)' : 'none',
                  background: (effectiveRunning || hasContent)
                  ? 'var(--send-btn-active-bg)'
                  : 'var(--send-btn-default-bg)',
                color: (effectiveRunning || hasContent)
                  ? 'var(--send-btn-active-icon)'
                  : 'var(--send-btn-default-icon)',
              }}
              title={isCancelling ? '正在取消...' : isUploading ? '文件上传中...' : (effectiveCanCancel ? '停止' : '发送')}
              data-testid={effectiveCanCancel ? 'chat-stop-btn' : 'chat-send-btn'}
            >
              {isCancelling ? (
                <Loader2 size={16} className="animate-spin" />
              ) : effectiveRunning ? (
                <StopGlyph />
              ) : isUploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <SendGlyph />
              )}
            </motion.button>
          </div>
        </div>
        {!compact && (
          <div
            style={{
              marginTop: 10,
              textAlign: 'center',
              fontSize: 11,
              lineHeight: '16px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            内容由 AI 生成，请仔细甄别
          </div>
        )}
      </div>
    </div>
  );
};
