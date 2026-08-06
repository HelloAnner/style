/**
 * 日期区间 — { start, end }（YYYY-MM-DD 字符串）
 */
import React from 'react';
import { DatetimeRange } from '@fx-ui/fine-design';
import { InputComponentProps } from './types';

interface DateRangeValue {
  start?: string | null;
  end?: string | null;
}

export const DateRangeInput: React.FC<InputComponentProps<DateRangeValue>> = ({
  value, onChange, disabled,
}) => {
  const v = value || {};
  return (
    <DatetimeRange
      className="dashboard-fd-datetime-range"
      dropdownClassName="dashboard-fd-datetime-range-dropdown"
      format="YYYY-MM-DD"
      value={[v.start || null, v.end || null]}
      disabled={disabled}
      placeholder={['年 / 月 / 日', '年 / 月 / 日']}
      hasClear
      onChange={(_, formatString) => {
        const [start, end] = formatString;
        onChange({
          start: start || null,
          end: end || null,
        });
      }}
    />
  );
};
