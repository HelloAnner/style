import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export const USAGE_RECORD_PAGE_SIZES = [20, 25, 50, 100] as const;

export type UsageRecordStatus = 'success' | 'failed' | 'timeout' | 'running' | 'cancelled';

export const CONVERSATION_STATUS_OPTIONS = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '超时', value: 'timeout' },
  { label: '运行中', value: 'running' },
];

export const DASHBOARD_STATUS_OPTIONS = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '运行中', value: 'running' },
  { label: '已取消', value: 'cancelled' },
];

export const USAGE_RECORD_CHARGE_SOURCE_OPTIONS = [
  { label: 'MOSS 积分', value: 'MOSS_CREDIT' },
  { label: '飞书 AI 包', value: 'FEISHU_AI_PACKAGE' },
];

export function formatUsageRecordTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.replace('T', ' ').replace(/(\.\d+)?Z$/, '');
  }
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const mapped = parts.reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${mapped.year}-${mapped.month}-${mapped.day} ${mapped.hour}:${mapped.minute}:${mapped.second}`;
}

export function formatUsageRecordAmount(
  value: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (value == null) return '-';
  return unit ? `${value} ${unit}` : String(value);
}

export function usageRecordStatusLabel(status: string | null | undefined): string {
  if (status === 'success') return '成功';
  if (status === 'failed') return '失败';
  if (status === 'timeout') return '超时';
  if (status === 'running') return '运行中';
  if (status === 'cancelled') return '已取消';
  return status ?? '-';
}

export function UsageRecordStatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span className={`record-status is-${status || 'unknown'}`}>
      {usageRecordStatusLabel(status)}
    </span>
  );
}

interface UsageRecordsFilterBarProps {
  children: React.ReactNode;
  hasAnyFilter: boolean;
  loading: boolean;
  onClear: () => void;
  onRefresh: () => void;
}

export function UsageRecordsFilterBar({
  children,
  hasAnyFilter,
  loading,
  onClear,
  onRefresh,
}: UsageRecordsFilterBarProps) {
  return (
    <div className="usage-records-filter-bar">
      <div className="usage-records-filter-controls">{children}</div>
      <div className="usage-records-filter-actions">
        {hasAnyFilter && (
          <button type="button" className="usage-records-clear" onClick={onClear}>
            清除筛选
          </button>
        )}
        <button
          type="button"
          className="usage-records-refresh"
          onClick={onRefresh}
          disabled={loading}
          aria-label="刷新"
        >
          <RefreshCw size={15} aria-hidden="true" />
          {loading ? '加载中…' : '刷新'}
        </button>
      </div>
    </div>
  );
}

interface UsageRecordsPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function UsageRecordsPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: UsageRecordsPaginationProps) {
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const pageSizeRef = useRef<HTMLDivElement | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visiblePages = Array.from({ length: Math.min(totalPages, 7) }, (_, index) => {
    if (totalPages <= 7 || page <= 3) return index;
    if (page >= totalPages - 4) return totalPages - 7 + index;
    return page - 3 + index;
  });

  useEffect(() => {
    if (!pageSizeOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!pageSizeRef.current?.contains(event.target as Node)) {
        setPageSizeOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPageSizeOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pageSizeOpen]);

  return (
    <div className="usage-records-pagination">
      <div className="usage-records-pagination-main">
        <span>共 {total} 条</span>
        <nav aria-label="使用记录分页">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => onPageChange(Math.max(0, page - 1))}
            aria-label="上一页"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          {visiblePages.map(pageIndex => (
            <button
              key={pageIndex}
              type="button"
              className={page === pageIndex ? 'is-active' : ''}
              onClick={() => onPageChange(pageIndex)}
              aria-current={page === pageIndex ? 'page' : undefined}
            >
              {pageIndex + 1}
            </button>
          ))}
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            aria-label="下一页"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      </div>
      <div className="usage-records-page-size" ref={pageSizeRef}>
        <span>每页</span>
        <button
          type="button"
          className="usage-records-page-size-trigger"
          aria-haspopup="listbox"
          aria-expanded={pageSizeOpen}
          onClick={() => setPageSizeOpen(open => !open)}
        >
          <span>{pageSize} 条</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {pageSizeOpen && (
          <div className="usage-records-page-size-menu" role="listbox" aria-label="每页条数">
            {USAGE_RECORD_PAGE_SIZES.map(size => (
              <button
                key={size}
                type="button"
                role="option"
                aria-selected={pageSize === size}
                className={`usage-records-page-size-option${pageSize === size ? ' is-selected' : ''}`}
                onClick={() => {
                  onPageSizeChange(size);
                  setPageSizeOpen(false);
                }}
              >
                <span className="usage-records-page-size-check">
                  {pageSize === size && <Check size={14} aria-hidden="true" />}
                </span>
                <span>{size} 条</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const chipBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-default)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 13,
  cursor: "pointer",
  outline: "none",
  transition: "border-color 0.15s, background 0.15s",
  whiteSpace: "nowrap" as const,
};

export const chipActiveStyle: React.CSSProperties = {
  ...chipBase,
  border: "1px solid var(--text-primary)",
  background: "var(--text-primary)",
  color: "var(--bg-primary)",
};

const inputChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-default)",
  background: "var(--bg-secondary)",
  fontSize: 13,
};

const inputInlineStyle: React.CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: 13,
  color: "var(--text-primary)",
  width: 120,
};

const clearBtnStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "var(--text-muted)",
  padding: "0 2px",
  lineHeight: 1,
  fontSize: 13,
};

export const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  background: "var(--bg-secondary)",
  borderBottom: "1px solid var(--border-subtle)",
  lineHeight: "18px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export const tdStyle: React.CSSProperties = {
  padding: "9px 14px",
  fontSize: 13,
  color: "var(--text-primary)",
  borderBottom: "1px solid var(--border-subtle)",
  lineHeight: "20px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// ── 筛选 Chip 组件 ──

interface TextFilterChipProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function TextFilterChip({
  label,
  value,
  onChange,
  placeholder,
}: TextFilterChipProps) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.trim().length > 0;

  return (
    <span
      style={{
        ...inputChipStyle,
        borderColor:
          hasValue || focused
            ? "var(--text-primary)"
            : "var(--border-default)",
      }}
    >
      <span
        style={{
          color: "var(--text-secondary)",
          fontSize: 12,
          whiteSpace: "nowrap",
        }}
      >
        {label}：
      </span>
      <input
        aria-label={label}
        style={inputInlineStyle}
        value={value}
        placeholder={placeholder ?? `搜索${label}`}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {hasValue && (
        <button
          type="button"
          style={clearBtnStyle}
          onClick={() => onChange("")}
          aria-label={`清除${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

interface SelectFilterChipProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}

export function SelectFilterChip({
  label,
  value,
  options,
  onChange,
}: SelectFilterChipProps) {
  const [open, setOpen] = useState(false);
  const hasValue = value !== "";
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-label={hasValue ? `${label}：${selectedLabel}` : label}
        aria-expanded={open}
        style={hasValue ? chipActiveStyle : chipBase}
        onClick={() => setOpen((v) => !v)}
      >
        {hasValue ? `${label}：${selectedLabel}` : label}
        <span style={{ fontSize: 10, marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 201,
              marginTop: 4,
              background: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              boxShadow: "var(--shadow-lg)",
              minWidth: 120,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 14px",
                border: "none",
                background:
                  value === "" ? "var(--bg-tertiary)" : "transparent",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              全部
            </button>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 14px",
                  border: "none",
                  background:
                    value === opt.value
                      ? "var(--bg-tertiary)"
                      : "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--text-primary)",
                }}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

interface MultiSelectFilterChipProps {
  label: string;
  values: string[];
  options: { label: string; value: string }[];
  onChange: (v: string[]) => void;
}

export function MultiSelectFilterChip({
  label,
  values,
  options,
  onChange,
}: MultiSelectFilterChipProps) {
  const [open, setOpen] = useState(false);
  const hasValue = values.length > 0;
  const preview = values.slice(0, 2).join("、");
  const title = hasValue
    ? `${label}：${preview}${values.length > 2 ? ` +${values.length - 2}` : ""}`
    : label;

  function toggleValue(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-label={title}
        aria-expanded={open}
        style={hasValue ? chipActiveStyle : chipBase}
        onClick={() => setOpen((v) => !v)}
      >
        {title}
        <span style={{ fontSize: 10, marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 201,
              marginTop: 4,
              background: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              boxShadow: "var(--shadow-lg)",
              minWidth: 220,
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            <button
              type="button"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 14px",
                border: "none",
                background: hasValue
                  ? "var(--bg-tertiary)"
                  : "transparent",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
              onClick={() => onChange([])}
            >
              清空选择
            </button>
            {options.map((opt) => {
              const checked = values.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 14px",
                    border: "none",
                    background: checked
                      ? "var(--bg-tertiary)"
                      : "transparent",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--text-primary)",
                  }}
                  onClick={() => toggleValue(opt.value)}
                >
                  <span
                    style={{
                      width: 14,
                      textAlign: "center",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
            {options.length === 0 && (
              <div
                style={{
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                暂无可选项
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}

interface DateRangeChipProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

export function DateRangeChip({
  from,
  to,
  onFromChange,
  onToChange,
}: DateRangeChipProps) {
  const [open, setOpen] = useState(false);
  const hasValue = from || to;

  function clear() {
    onFromChange("");
    onToChange("");
    setOpen(false);
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-label={hasValue ? `时间：${from || ""}～${to || ""}` : "时间范围"}
        aria-expanded={open}
        style={hasValue ? chipActiveStyle : chipBase}
        onClick={() => setOpen((v) => !v)}
      >
        {hasValue ? `时间：${from || ""}～${to || ""}` : "时间范围"}
        <span style={{ fontSize: 10, marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 201,
              marginTop: 4,
              background: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              boxShadow: "var(--shadow-lg)",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minWidth: 260,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                开始时间
              </span>
              <input
                aria-label="开始时间"
                type="datetime-local"
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--text-primary)",
                  background: "var(--bg-secondary)",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                结束时间
              </span>
              <input
                aria-label="结束时间"
                type="datetime-local"
                value={to}
                onChange={(e) => onToChange(e.target.value)}
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--text-primary)",
                  background: "var(--bg-secondary)",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "6px 0",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
                onClick={clear}
              >
                清除
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "6px 0",
                  border: "none",
                  borderRadius: 6,
                  background: "var(--text-primary)",
                  color: "var(--bg-primary)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
                onClick={() => setOpen(false)}
              >
                确认
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

interface CreditRangeChipProps {
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
}

export function CreditRangeChip({
  min,
  max,
  onMinChange,
  onMaxChange,
}: CreditRangeChipProps) {
  const [open, setOpen] = useState(false);
  const hasValue = min !== "" || max !== "";

  function clear() {
    onMinChange("");
    onMaxChange("");
    setOpen(false);
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-label={hasValue ? `消耗量：${min || "∞"}～${max || "∞"}` : "消耗量范围"}
        aria-expanded={open}
        style={hasValue ? chipActiveStyle : chipBase}
        onClick={() => setOpen((v) => !v)}
      >
        {hasValue ? `消耗量：${min || "∞"}～${max || "∞"}` : "消耗量范围"}
        <span style={{ fontSize: 10, marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 201,
              marginTop: 4,
              background: "var(--bg-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              boxShadow: "var(--shadow-lg)",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minWidth: 260,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                最小值（≥）
              </span>
              <input
                aria-label="最小消耗量"
                type="number"
                min="0"
                value={min}
                onChange={(e) => onMinChange(e.target.value)}
                placeholder="如 100"
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--text-primary)",
                  background: "var(--bg-secondary)",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                最大值（≤）
              </span>
              <input
                aria-label="最大消耗量"
                type="number"
                min="0"
                value={max}
                onChange={(e) => onMaxChange(e.target.value)}
                placeholder="如 1000"
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--text-primary)",
                  background: "var(--bg-secondary)",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "6px 0",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
                onClick={clear}
              >
                清除
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "6px 0",
                  border: "none",
                  borderRadius: 6,
                  background: "var(--text-primary)",
                  color: "var(--bg-primary)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
                onClick={() => setOpen(false)}
              >
                确认
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}
