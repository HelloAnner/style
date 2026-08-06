const DEFAULT_MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatUploadLimit(bytes: number): string {
  if (bytes % (1024 * 1024) === 0) return `${bytes / 1024 / 1024}MB`;
  return formatSize(bytes);
}

export function dashboardFileTooLargeMessage(limitBytes = DEFAULT_MAX_UPLOAD_SIZE): string {
  return `文件过大，最大支持 ${formatUploadLimit(limitBytes)}，请压缩后重新上传`;
}

export function normalizeUploadErrorMessage(raw: string, status?: number, limitBytes?: number): string {
  const text = String(raw || '').trim();
  let message = text;

  if (text.startsWith('{')) {
    try {
      const body = JSON.parse(text) as { message?: unknown; detail?: unknown; error?: unknown };
      const nested = body.message ?? body.detail ?? body.error;
      if (typeof nested === 'string' && nested.trim()) {
        message = nested.trim();
      }
    } catch {
      message = text;
    }
  }

  if (/file\s+is\s+too\s+large/i.test(message) || /maximum\s+\d+\s*mb/i.test(message) || status === 413) {
    return dashboardFileTooLargeMessage(limitBytes);
  }

  return message || '上传失败';
}
