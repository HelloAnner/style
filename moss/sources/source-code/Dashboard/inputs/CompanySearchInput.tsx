import { Input } from '@fx-ui/fine-design';
import React, { useEffect, useRef, useState } from 'react';
import { CompanyCandidate } from '../../../api/dashboards';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { filterCompanyCandidates, isCreditCodeLikeQuery } from '../../../utils/companySearch';
import { InputComponentProps } from './types';

const DEBOUNCE_MS = 180;

interface CompanySearchValue {
  name?: string;
  credit_code?: string | null;
  company_full_name?: string | null;
}

export const CompanySearchInput: React.FC<InputComponentProps<CompanySearchValue>> = ({
  field, value, onChange, disabled,
}) => {
  const searchCandidates = useDashboardStore((s) => s.searchCandidates);
  const clearCandidates = useDashboardStore((s) => s.clearCandidates);

  const displayName = value?.name || '';
  const hasSelected = !!value?.credit_code;

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pending, setPending] = useState(false);
  const [items, setItems] = useState<CompanyCandidate[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tokenRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasSelected) return;
    setItems([{
      name: value?.company_full_name || value?.name || '',
      credit_code: value?.credit_code || '',
    }].filter((candidate) => candidate.name && candidate.credit_code));
    setPending(false);
    setHighlight(0);
  }, [hasSelected, value?.company_full_name, value?.credit_code, value?.name]);

  useEffect(() => {
    if (disabled) {
      tokenRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      setPending(false);
      setOpen(false);
      return;
    }
    if (!displayName || displayName.length < 2) {
      setPending(false);
      setItems([]);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    if (isCreditCodeLikeQuery(displayName)) {
      tokenRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      setPending(false);
      setItems([]);
      setOpen(true);
      return;
    }
    if (hasSelected) {
      tokenRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      setPending(false);
      return;
    }

    setPending(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    const myToken = ++tokenRef.current;
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const next = await searchCandidates(displayName, { signal: controller.signal });
        if (myToken === tokenRef.current) {
          setItems(filterCompanyCandidates(next));
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (myToken === tokenRef.current) {
          setPending(false);
          setOpen(true);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [disabled, displayName, hasSelected, searchCandidates]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const onInputChange = (name: string) => {
    if (disabled) return;
    onChange({ name, credit_code: null, company_full_name: null });
    setItems([]);
    setOpen(true);
    setHighlight(0);
  };

  const pick = (candidate: CompanyCandidate) => {
    if (disabled) return;
    onChange({ name: candidate.name, credit_code: candidate.credit_code, company_full_name: candidate.name });
    clearCandidates();
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(items[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const creditCodeBlocked = !hasSelected && isCreditCodeLikeQuery(displayName);

  return (
    <div ref={containerRef} className="dashboard-typeahead">
      <Input
        type="text"
        className="dashboard-fd-input"
        placeholder={field.placeholder || '\u8f93\u5165\u4f01\u4e1a\u540d\u79f0\u641c\u7d22'}
        value={displayName}
        disabled={disabled}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        onFocus={() => (displayName.length >= 2 || items.length > 0) && setOpen(true)}
        autoComplete={false}
        block
      />

      {open && (displayName.length >= 2 || items.length > 0) && (
        <div className="dashboard-dropdown">
          {creditCodeBlocked && (
            <div className="dashboard-dropdown-item empty">{'\u4ec5\u652f\u6301\u4f01\u4e1a\u540d\u79f0\u641c\u7d22'}</div>
          )}
          {items.map((candidate, index) => (
            <div
              key={candidate.credit_code}
              className={'dashboard-dropdown-item' + (index === highlight ? ' highlight' : '')}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(event) => { event.preventDefault(); pick(candidate); }}
            >
              <div className="dashboard-dropdown-name">{candidate.name}</div>
              <div className="dashboard-dropdown-code">{candidate.credit_code}</div>
            </div>
          ))}
          {pending && items.length === 0 && (
            <div className="dashboard-dropdown-item loading">{'\u641c\u7d22\u4e2d...'}</div>
          )}
          {!creditCodeBlocked && !hasSelected && !pending && items.length === 0 && displayName.length >= 2 && (
            <div className="dashboard-dropdown-item empty">{'\u6ca1\u6709\u5339\u914d\u4f01\u4e1a'}</div>
          )}
        </div>
      )}
    </div>
  );
};
