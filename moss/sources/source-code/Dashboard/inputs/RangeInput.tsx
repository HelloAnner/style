/**
 * 数字区间输入 — { min, max }
 *
 * 体验：
 *   - 两个数字框（中间一条短横）
 *   - 可选 unit 单位文字（"万元 / 人 / 年" 等）
 *   - 可选 presets 快捷按钮（如"100 万以下"、"100-1000 万"）
 *   - 空值 = 不限制
 */
import React from 'react';
import { InputComponentProps } from './types';

interface RangeValue {
  min?: number | null;
  max?: number | null;
}

function toNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const RangeInput: React.FC<InputComponentProps<RangeValue>> = ({
  field, value, onChange, disabled,
}) => {
  const v = value || {};
  const unit = field.unit || '';
  const presets = field.presets || [];

  const setMin = (s: string) => onChange({ ...v, min: toNum(s) });
  const setMax = (s: string) => onChange({ ...v, max: toNum(s) });

  const isPresetActive = (p: { min?: number | null; max?: number | null }) =>
    (p.min ?? null) === (v.min ?? null) && (p.max ?? null) === (v.max ?? null);

  return (
    <div className="dashboard-range">
      <div className="dashboard-range-row">
        <input
          type="number"
          className="dashboard-input dashboard-range-num"
          placeholder={field.min != null ? String(field.min) : '不限'}
          value={v.min == null ? '' : String(v.min)}
          disabled={disabled}
          onChange={(e) => setMin(e.target.value)}
        />
        {unit && <span className="dashboard-range-unit">{unit}</span>}
        <span className="dashboard-range-dash">—</span>
        <input
          type="number"
          className="dashboard-input dashboard-range-num"
          placeholder={field.max != null ? String(field.max) : '不限'}
          value={v.max == null ? '' : String(v.max)}
          disabled={disabled}
          onChange={(e) => setMax(e.target.value)}
        />
        {unit && <span className="dashboard-range-unit">{unit}</span>}
      </div>
      {presets.length > 0 && (
        <div className="dashboard-range-presets">
          {presets.map((p, i) => (
            <button
              key={i}
              type="button"
              className={'dashboard-range-preset' + (isPresetActive(p) ? ' is-active' : '')}
              disabled={disabled}
              onClick={() => onChange({ min: p.min ?? null, max: p.max ?? null })}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            className="dashboard-range-preset"
            disabled={disabled}
            onClick={() => onChange(undefined)}
          >
            不限
          </button>
        </div>
      )}
    </div>
  );
};
