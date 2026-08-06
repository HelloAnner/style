/**
 * 多选下拉 — 使用 FineDesignSystem Select，并保持原始业务值数组。
 */
import { Select } from '@fx-ui/fine-design';
import React, { useMemo } from 'react';
import { InputComponentProps } from './types';

function toSelectKey(value: any): string {
  return String(value);
}

export const MultiSelectInput: React.FC<InputComponentProps<any[]>> = ({
  field, value, onChange, disabled,
}) => {
  const options = field.options || [];
  const selected: any[] = Array.isArray(value) ? value : [];

  const valueByKey = useMemo(() => {
    const entries = options.map((option) => [toSelectKey(option.value), option.value] as const);
    return new Map(entries);
  }, [options]);

  const selectOptions = useMemo(() => options.map((option) => ({
    label: option.label,
    value: toSelectKey(option.value),
    title: option.description,
  })), [options]);

  const selectedKeys = useMemo(
    () => selected.map(toSelectKey).filter((key) => valueByKey.has(key)),
    [selected, valueByKey],
  );

  return (
    <Select<string[]>
      className="dashboard-fd-select dashboard-fd-select-multiple"
      dropdownClassName="dashboard-fd-select-dropdown"
      value={selectedKeys}
      options={selectOptions}
      placeholder={field.placeholder}
      disabled={disabled}
      multiple
      allowClear
      maxTagCount="responsive"
      popupMatchSelectWidth={false}
      onChange={(nextKeys) => {
        const keys = Array.isArray(nextKeys) ? nextKeys : [];
        onChange(keys.map((key) => valueByKey.get(String(key))).filter((item) => item !== undefined));
      }}
    />
  );
};
