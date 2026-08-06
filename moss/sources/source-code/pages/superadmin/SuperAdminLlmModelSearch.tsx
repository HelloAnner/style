import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, RefreshCw, Search } from 'lucide-react';
import type { SaLlmModelOption } from '../../api/superadminLlmConfigApi';

interface Props {
  value: string;
  options: SaLlmModelOption[];
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onOpen?: () => void;
  onRefresh?: () => void;
}

const inputStyle: React.CSSProperties = {
  height: 38,
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px 0 34px',
  outline: 'none',
  fontSize: 13,
  width: '100%',
};

export const SuperAdminLlmModelSearch: React.FC<Props> = ({
  value,
  options,
  loading = false,
  disabled = false,
  error = null,
  onChange,
  onOpen,
  onRefresh,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((option) => {
      const id = option.id.toLowerCase();
      const name = option.name.toLowerCase();
      return id.includes(query) || name.includes(query);
    });
  }, [options, value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [value, options.length]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const choose = (option: SaLlmModelOption) => {
    onChange(option.id);
    setOpen(false);
  };

  const openDropdown = () => {
    if (disabled) return;
    if (!open) {
      onOpen?.();
    }
    setOpen(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      openDropdown();
      return;
    }
    if (!open || filtered.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filtered.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex] ?? filtered[0];
      if (option) {
        choose(option);
      }
    }
  };

  return (
    <div ref={rootRef} data-testid="superadmin-llm-model-search" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <Search
        size={15}
        style={{
          position: 'absolute',
          left: 11,
          top: 12,
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
      />
      <input
        value={value}
        disabled={disabled}
        onFocus={openDropdown}
        onChange={(event) => {
          if (disabled) return;
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="搜索或输入模型"
        style={{
          ...inputStyle,
          opacity: disabled ? 0.65 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      {open && !disabled && (
        <div
          data-testid="superadmin-llm-model-search-dropdown"
          role="listbox"
          style={{
            position: 'absolute',
            top: 42,
            left: 0,
            right: 0,
            zIndex: 120,
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            background: 'var(--modal-bg)',
            boxShadow: 'var(--shadow-lg)',
            padding: 6,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div
              style={{
                minHeight: 38,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 10px',
                color: 'var(--text-muted)',
                fontSize: 12,
              }}
            >
              <Loader2 size={14} />
              正在拉取模型...
            </div>
          ) : error ? (
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ color: 'var(--warning)', fontSize: 12, lineHeight: '18px' }}>
                {error}
              </div>
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  style={{
                    width: 'fit-content',
                    height: 30,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 9px',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={13} />
                  重试
                </button>
              )}
            </div>
          ) : filtered.length > 0 ? filtered.map((option, index) => {
            const active = index === activeIndex;
            const selected = option.id === value;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                className="sa-llm-model-option"
                data-testid={`superadmin-llm-model-option-${option.id}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                style={{
                  width: '100%',
                  minHeight: 34,
                  border: 'none',
                  borderRadius: 6,
                  background: active ? 'var(--bg-hover)' : 'transparent',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '7px 8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>
                    {option.id}
                  </span>
                  {option.name !== option.id && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-word' }}>
                      {option.name}
                    </span>
                  )}
                </span>
                {selected && <Check size={14} style={{ color: 'var(--success)', flex: '0 0 auto' }} />}
              </button>
            );
          }) : (
            <div style={{ padding: '12px 10px', color: 'var(--text-muted)', fontSize: 12 }}>
              {options.length === 0 ? '未自动获取到模型，可手动输入模型名称。' : '没有匹配结果，可继续手动输入。'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuperAdminLlmModelSearch;
