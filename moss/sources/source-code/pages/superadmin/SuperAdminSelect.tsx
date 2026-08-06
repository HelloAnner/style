import React from 'react';
import { Select } from '../../components/common/Select';

type SuperAdminSelectValue = string | number;

export type SuperAdminSelectOption<T extends SuperAdminSelectValue> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SuperAdminSelectProps<T extends SuperAdminSelectValue> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly SuperAdminSelectOption<T>[];
  ariaLabel: string;
  disabled?: boolean;
  size?: 'compact' | 'mini';
  style?: React.CSSProperties;
  triggerStyle?: React.CSSProperties;
};

/** 超管后台单选控件，统一紧凑尺寸、弹窗层级和业务值类型恢复。 */
export function SuperAdminSelect<T extends SuperAdminSelectValue>({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
  size = 'compact',
  style,
  triggerStyle,
}: SuperAdminSelectProps<T>) {
  const serializedOptions = options.map((option) => ({
    ...option,
    value: String(option.value),
  }));

  return (
    <Select
      value={String(value)}
      onChange={(nextValue) => {
        const selected = options.find((option) => String(option.value) === nextValue);
        if (selected) onChange(selected.value);
      }}
      options={serializedOptions}
      disabled={disabled}
      density={size}
      triggerRole="combobox"
      ariaLabel={ariaLabel}
      menuZIndex={3000}
      style={{ minWidth: size === 'mini' ? 100 : 140, ...style }}
      triggerStyle={triggerStyle}
    />
  );
}

export default SuperAdminSelect;
