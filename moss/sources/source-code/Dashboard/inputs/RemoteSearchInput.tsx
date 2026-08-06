/**
 * 远程搜索下拉 — 输入关键词 → 调 /inputs/options 接口拉候选
 *
 * 体验：
 *   - 输入达到字段 min_search_length（默认 1）后，200ms 防抖触发后端查询
 *   - 下拉显示候选列表（label + 可选 description）
 *   - 用户点选后 value = 候选的 value（或 { value, label } 二元组以保留 label 显示）
 *   - 已选状态显示 label，点 × 可清除
 */
import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@fx-ui/fine-design';
import { X } from 'lucide-react';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { InputComponentProps } from './types';

const DEBOUNCE_MS = 200;
const REQUEST_TIMEOUT_MS = 8000;

interface RemoteValue {
  value: any;
  label: string;
}

export const RemoteSearchInput: React.FC<InputComponentProps<RemoteValue>> = ({
  field, value, onChange, disabled,
}) => {
  const loadOptions = useDashboardStore((s) => s.loadOptions);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Array<{ label: string; value: any }>>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tokenRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 已选时输入框显示 label
  const hasSelected = !!value?.value;
  const displayText = hasSelected ? value!.label : q;
  const query = q.trim();
  const minSearchLength = Math.max(1, field.min_search_length ?? 1);
  const tooShort = !hasSelected && query.length > 0 && query.length < minSearchLength;

  useEffect(() => {
    if (disabled) {
      tokenRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      setItems([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    if (hasSelected) {
      setLoading(false);
      setSearchFailed(false);
      return;
    }
    if (!query || query.length < minSearchLength) {
      tokenRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      setItems([]);
      setLoading(false);
      setSearchFailed(false);
      return;
    }
    setLoading(true);
    setSearchFailed(false);
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    const myToken = ++tokenRef.current;
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      let didTimeout = false;
      const timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
      try {
        const resp = await loadOptions(field.name, query, undefined, { signal: controller.signal });
        if (myToken !== tokenRef.current) return;
        setItems(resp?.items || []);
        setSearchFailed(!resp || didTimeout);
      } finally {
        clearTimeout(timeoutId);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (myToken === tokenRef.current) {
          setLoading(false);
          setOpen(true);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [disabled, query, hasSelected, minSearchLength, field.name, loadOptions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (it: { label: string; value: any }) => {
    if (disabled) return;
    onChange({ value: it.value, label: it.label });
    setQ('');
    setItems([]);
    setOpen(false);
  };

  const clear = () => {
    if (disabled) return;
    onChange(undefined);
    setQ('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(items[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="dashboard-typeahead">
      <div className="dashboard-remote-wrap">
        <Input
          type="text"
          className="dashboard-fd-input dashboard-remote-input"
          placeholder={field.placeholder || '输入关键词搜索'}
          value={displayText}
          disabled={disabled || hasSelected}
          onChange={(nextValue) => {
            setQ(nextValue);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          autoComplete={false}
          block
        />
        {hasSelected && !disabled && (
          <button type="button" className="dashboard-remote-clear" onClick={clear} aria-label="清除">
            <X size={14} />
          </button>
        )}
      </div>

      {open && !hasSelected && (q.length >= 1 || items.length > 0) && (
        <div className="dashboard-dropdown">
          {tooShort && (
            <div className="dashboard-dropdown-item empty">
              至少输入 {minSearchLength} 个字后搜索
            </div>
          )}
          {loading && items.length === 0 && !tooShort && (
            <div className="dashboard-dropdown-item loading">搜索中...</div>
          )}
          {items.map((it, i) => (
            <div
              key={String(it.value)}
              className={'dashboard-dropdown-item' + (i === highlight ? ' highlight' : '')}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(it); }}
            >
              <div className="dashboard-dropdown-name">{it.label}</div>
            </div>
          ))}
          {!loading && !tooShort && searchFailed && items.length === 0 && (
            <div className="dashboard-dropdown-item empty">搜索失败或超时，请换个关键词重试</div>
          )}
          {!loading && !tooShort && !searchFailed && items.length === 0 && q.length >= 1 && (
            <div className="dashboard-dropdown-item empty">没有匹配项</div>
          )}
        </div>
      )}
    </div>
  );
};
