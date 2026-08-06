import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

export interface FilterableSelectOption {
  value: string;
  label: string;
}

interface FilterableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const triggerStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  minWidth: 140,
  userSelect: 'none',
};

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 4,
  borderRadius: 10,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  boxShadow: 'var(--shadow-lg)',
  zIndex: 3000,
  overflow: 'hidden',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  height: 32,
  border: 'none',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'transparent',
  color: 'var(--text-primary)',
  padding: '0 10px',
  outline: 'none',
  fontSize: 13,
};

const optionStyle: React.CSSProperties = {
  height: 32,
  padding: '0 10px',
  display: 'flex',
  alignItems: 'center',
  fontSize: 13,
  color: 'var(--text-primary)',
  cursor: 'pointer',
};

const ARROW_DOWN = '▼'; // ▼

export const FilterableSelect: React.FC<FilterableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled = false,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // focus search input when opening
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  const selectedLabel = useMemo(() => {
    if (!value) return placeholder;
    const found = options.find(o => o.value === value);
    return found ? found.label : value;
  }, [value, options, placeholder]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const handleSelect = useCallback((optValue: string) => {
    onChange(optValue);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  const toggleOpen = useCallback(() => {
    if (disabled) return;
    setOpen(prev => !prev);
    setSearch('');
  }, [disabled]);

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div
        role="combobox"
        tabIndex={0}
        onClick={toggleOpen}
        onKeyDown={e => {
          if (e.key === 'Escape') { setOpen(false); setSearch(''); return; }
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); }
        }}
        style={{
          ...triggerStyle,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selectedLabel}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{ARROW_DOWN}</span>
      </div>
      {open && (
        <div style={menuStyle}>
          <input
            ref={searchInputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索..."
            style={searchInputStyle}
            onKeyDown={e => {
              if (e.key === 'Escape') { setOpen(false); setSearch(''); }
              if (e.key === 'Enter' && filtered.length > 0) {
                e.preventDefault();
                handleSelect(filtered[0].value);
              }
            }}
          />
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ ...optionStyle, color: 'var(--text-muted)', cursor: 'default' }}>
                无匹配结果
              </div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={optionStyle}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterableSelect;
