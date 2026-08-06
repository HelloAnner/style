/**
 * 文本输入 — 使用 FineDesignSystem Input。
 */
import { Input } from '@fx-ui/fine-design';
import React from 'react';
import { InputComponentProps } from './types';

export const TextInput: React.FC<InputComponentProps<string>> = ({ field, value, onChange, disabled }) => {
  return (
    <Input
      type="text"
      className="dashboard-fd-input"
      placeholder={field.placeholder || ''}
      value={value || ''}
      disabled={disabled}
      onChange={(nextValue) => onChange(nextValue)}
      autoComplete={false}
      block
    />
  );
};
