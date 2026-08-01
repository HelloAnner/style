import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileShare, listFileShares, updateFileShare, type FileShareRecord, type FileShareType } from '../../api/fileShare';
import { SharePopover, type SharePopoverItem, type SharePopoverItemType } from '../common/SharePopover';
import { isFilePreviewSupported } from './FilePreview';

interface FileShareDialogProps {
  open: boolean;
  fileId?: string;
  fileName: string;
  anchorRect?: DOMRect | null;
  onClose: () => void;
}

interface ShareItemState {
  url: string;
  token: string;
  loading: boolean;
  copied: boolean;
  error: string;
}

const emptyShareItem = (): ShareItemState => ({ url: '', token: '', loading: false, copied: false, error: '' });

function urlFromRecord(record: FileShareRecord | null | undefined): string {
  if (!record?.token || record.is_active === false) return '';
  return `${window.location.origin}/file/${record.token}`;
}

function toItemState(record: FileShareRecord | null | undefined): ShareItemState {
  if (!record?.token || record.is_active === false) return emptyShareItem();
  return { ...emptyShareItem(), token: record.token, url: urlFromRecord(record) };
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function FileShareDialog({ open, fileId, fileName, anchorRect, onClose }: FileShareDialogProps) {
  const [shares, setShares] = useState<Record<FileShareType, ShareItemState>>({
    enterprise: emptyShareItem(),
    public: emptyShareItem(),
  });
  const copyResetTimerRef = useRef<Record<FileShareType, number | null>>({ enterprise: null, public: null });

  const updateItem = useCallback((type: FileShareType, patch: Partial<ShareItemState>) => {
    setShares(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }, []);

  const clearCopyTimer = useCallback((type: FileShareType) => {
    const timer = copyResetTimerRef.current[type];
    if (timer !== null) {
      window.clearTimeout(timer);
      copyResetTimerRef.current[type] = null;
    }
  }, []);

  const markCopied = useCallback((type: FileShareType) => {
    clearCopyTimer(type);
    updateItem(type, { copied: true });
    copyResetTimerRef.current[type] = window.setTimeout(() => {
      updateItem(type, { copied: false });
      copyResetTimerRef.current[type] = null;
    }, 2000);
  }, [clearCopyTimer, updateItem]);

  const copyLink = useCallback((type: FileShareType, url: string) => {
    if (!url) return;
    writeClipboard(url).then(ok => {
      if (!ok) {
        updateItem(type, { error: '复制失败，请手动复制链接' });
        return;
      }
      markCopied(type);
    });
  }, [markCopied, updateItem]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setShares({ enterprise: { ...emptyShareItem(), loading: Boolean(fileId) }, public: emptyShareItem() });
    if (!fileId) return () => { cancelled = true; };

    const prepareShares = async () => {
      try {
        const data = await listFileShares(fileId);
        if (cancelled) return;
        setShares({
          enterprise: toItemState(data.enterprise),
          public: toItemState(data.public),
        });
      } catch (e: any) {
        if (cancelled) return;
        setShares({
          enterprise: { ...emptyShareItem(), error: e?.message || '获取分享链接失败' },
          public: emptyShareItem(),
        });
      }
    };

    void prepareShares();
    return () => { cancelled = true; };
  }, [fileId, open]);

  useEffect(() => () => {
    (['enterprise', 'public'] as FileShareType[]).forEach(clearCopyTimer);
  }, [clearCopyTimer]);

  const handleToggle = useCallback(async (type: FileShareType) => {
    if (!fileId) return;
    const item = shares[type];
    updateItem(type, { loading: true, error: '' });
    try {
      if (item.token && item.url) {
        await updateFileShare(item.token, false);
        clearCopyTimer(type);
        updateItem(type, emptyShareItem());
        return;
      }
      const record = await createFileShare(fileId, type);
      updateItem(type, { token: record.token, url: urlFromRecord(record), loading: false, error: '', copied: false });
    } catch (e: any) {
      updateItem(type, { loading: false, error: e?.message || '操作失败' });
    }
  }, [clearCopyTimer, fileId, shares, updateItem]);

  const handleCopy = useCallback((type: FileShareType) => {
    const url = shares[type].url;
    if (!url) return;
    clearCopyTimer(type);
    copyLink(type, url);
  }, [clearCopyTimer, copyLink, shares]);

  const handleOpen = useCallback((type: SharePopoverItemType) => {
    const url = shares[type].url;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [shares]);

  if (!open) return null;

  const supportsPreview = isFilePreviewSupported(fileName);
  const shareItems: SharePopoverItem[] = [
    { type: 'enterprise', label: '企业内分享', ...shares.enterprise, disabled: !fileId },
    { type: 'public', label: '公开分享', ...shares.public, disabled: !fileId },
  ];

  return (
    <SharePopover
      open={open}
      title="分享文件"
      anchorRect={anchorRect}
      zIndex={70}
      items={shareItems}
      onClose={onClose}
      onToggle={handleToggle}
      onCopy={handleCopy}
      onOpen={handleOpen}
    >
      {!supportsPreview && (
        <div style={{ margin: '12px 0 0', padding: '8px 10px', borderRadius: 8, background: 'var(--warning-bg-soft)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
          该文件类型暂不支持在线预览，访客页会显示不支持提示。
        </div>
      )}
    </SharePopover>
  );
}
