/**
 * 多行文本输入 — FineDesign Input.TextArea
 */
import { Input } from '@fx-ui/fine-design';
import React from 'react';
import { InputComponentProps } from './types';

function countVisibleLines(text?: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).filter((line) => line.length > 0).length;
}

export const TextareaInput: React.FC<InputComponentProps<string>> = ({ field, value, onChange, disabled }) => {
  const placeholder = field.placeholder || '';
  const placeholderRows = Math.max(3, countVisibleLines(placeholder));
  const valueRows = ((value || '').match(/\n/g)?.length || 0) + 1;
  const rows = Math.max(placeholderRows, Math.min(8, valueRows));

  return (
    <Input.TextArea
      className="dashboard-fd-textarea"
      placeholder={placeholder}
      value={value || ''}
      disabled={disabled}
      rows={rows}
      block
      onChange={(nextValue) => onChange(nextValue)}
    />
  );
};
