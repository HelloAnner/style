/**
 * 单选下拉 — 使用 FineDesignSystem Select，并保持原始业务值类型。
 */
import { Select } from '@fx-ui/fine-design';
import React from 'react';
import { InputComponentProps } from './types';

function toSelectKey(value: any): string {
  return String(value);
}

export const SelectInput: React.FC<InputComponentProps<any>> = ({ field, value, onChange, disabled }) => {
  const options = field.options || [];
  const selectOptions = options.map((option) => ({
    label: option.label,
    value: toSelectKey(option.value),
    title: option.description,
  }));

  return (
    <Select<string>
      className="dashboard-fd-select"
      dropdownClassName="dashboard-fd-select-dropdown"
      value={value == null ? undefined : toSelectKey(value)}
      options={selectOptions}
      placeholder={field.placeholder}
      disabled={disabled}
      allowClear={!field.required}
      popupMatchSelectWidth
      onChange={(nextValue) => {
        if (nextValue == null) {
          onChange(undefined);
          return;
        }
        const matched = options.find((option) => toSelectKey(option.value) === String(nextValue));
        onChange(matched ? matched.value : nextValue);
      }}
    />
  );
};
