/**
 * 文件选择 — 使用 FineDesign Upload 的交互壳，查询时随 dashboard refresh 临时提交
 *
 * 值结构：{ file, filename, size, content_type }
 */
import { Upload as FineUpload, type UploadCustomRequest } from '@fx-ui/fine-design';
import React, { useState } from 'react';
import { Upload as UploadGlyph, X, FileText } from 'lucide-react';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { fetchUploadLimits } from '../../../api/config';
import { InputComponentProps } from './types';
import { dashboardFileTooLargeMessage } from './fileUploadErrors';

interface FileValue {
  path?: string;
  filename: string;
  size: number;
  content_type?: string | null;
  url?: string | null;
  session_path?: string | null;
  file?: File;
}

const XLSX_EXT = '.xlsx';
const PNG_EXT = '.png';
const JPG_EXTS = new Set(['.jpg', '.jpeg']);

/**
 * 看板输入的文件选择只保存浏览器 File 引用，不调用文件上传接口。
 * 用户点击查询时，dashboard refresh multipart 会把文件作为本次解析输入提交；
 * 后端解析完成后不会写入会话文件区或用户文件资产。
 */
function toDashboardTempFileValue(file: File): FileValue {
  return {
    file,
    filename: file.name,
    size: file.size,
    content_type: file.type || null,
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function allowedExtensions(accept?: string | null): Set<string> {
  return new Set(
    (accept || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.startsWith('.')),
  );
}

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

async function validateDashboardFile(file: File, accept?: string | null): Promise<void> {
  if (file.size <= 0) {
    throw new Error('上传文件为空，请检查文件内容后重新上传。');
  }

  const ext = fileExtension(file.name);
  if (ext === '.xls') {
    throw new Error('暂不支持旧版 .xls 文件，请另存为 .xlsx 后重新上传。');
  }
  const allowed = allowedExtensions(accept);
  if (allowed.size > 0 && !allowed.has(ext)) {
    throw new Error(`文件格式不受支持，请上传 ${Array.from(allowed).join('、')} 文件。`);
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (ext === XLSX_EXT && !hasPrefix(header, [0x50, 0x4b])) {
    throw new Error('Excel 文件已损坏或不是有效的 .xlsx 文件，请重新导出后上传。');
  }
  if (ext === PNG_EXT && !hasPrefix(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    throw new Error('图片文件已损坏或不是有效的 PNG 文件，请重新导出后上传。');
  }
  if (JPG_EXTS.has(ext) && !hasPrefix(header, [0xff, 0xd8, 0xff])) {
    throw new Error('图片文件已损坏或不是有效的 JPG 文件，请重新导出后上传。');
  }
}

export const FileUploadInput: React.FC<InputComponentProps<FileValue>> = ({
  field, value, onChange, disabled,
}) => {
  const agentId = useDashboardStore((s) => s.agentId);
  const dashboardKey = useDashboardStore((s) => s.currentKey);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadWithFineDesign = async (options: UploadCustomRequest) => {
    const file = options.file as File;
    if (!file || !agentId || !dashboardKey) {
      options.onError({ message: '请选择智能体和看板后再上传' });
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { maxFileSize } = await fetchUploadLimits();
      if (file.size > maxFileSize) {
        throw new Error(dashboardFileTooLargeMessage(maxFileSize));
      }
      await validateDashboardFile(file, field.accept);
      const selected = toDashboardTempFileValue(file);
      onChange(selected);
      options.onSuccess(selected);
    } catch (err: any) {
      const message = err?.message || '上传失败';
      setError(message);
      options.onError({ message });
    } finally {
      setUploading(false);
    }
  };

  const clear = () => onChange(undefined);

  return (
    <div className="dashboard-fileupload">
      {value ? (
        <div className="dashboard-fileupload-card">
          <FileText size={16} className="dashboard-fileupload-icon" />
          <div className="dashboard-fileupload-info">
            <div className="dashboard-fileupload-name" title={value.filename}>{value.filename}</div>
            <div className="dashboard-fileupload-meta">{formatSize(value.size)}</div>
          </div>
          {!disabled && (
            <button type="button" className="dashboard-fileupload-clear" onClick={clear} aria-label="移除">
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <FineUpload
          className="dashboard-fd-upload"
          accept={field.accept || undefined}
          disabled={disabled || uploading || !agentId || !dashboardKey}
          maxCount={1}
          showUploadList={false}
          customRequest={uploadWithFineDesign}
        >
          <button
            type="button"
            className="dashboard-fileupload-trigger"
            disabled={disabled || uploading || !agentId || !dashboardKey}
          >
            <UploadGlyph size={14} />
            <span>{uploading ? '上传中…' : (field.placeholder || '点击上传文件')}</span>
          </button>
        </FineUpload>
      )}
      {error && <div className="dashboard-fileupload-err">{error}</div>}
      {field.accept && !value && (
        <div className="dashboard-fileupload-hint">支持：{field.accept}</div>
      )}
    </div>
  );
};
