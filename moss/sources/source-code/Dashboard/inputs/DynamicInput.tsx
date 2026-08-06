/**
 * DynamicInput — 按 field.type 分派到具体的输入控件
 *
 * 用法：
 *   <DynamicInput field={schemaField} value={inputs[name]} onChange={v => setInput(name, v)} />
 *
 * 如果 type 不识别，渲染降级到 TextInput，保证表单不崩。
 */
import React from 'react';
import { InputComponentProps } from './types';
import { TextInput } from './TextInput';
import { TextareaInput } from './TextareaInput';
import { CompanySearchInput } from './CompanySearchInput';
import { SelectInput } from './SelectInput';
import { MultiSelectInput } from './MultiSelectInput';
import { RangeInput } from './RangeInput';
import { DateRangeInput } from './DateRangeInput';
import { RemoteSearchInput } from './RemoteSearchInput';
import { RegionCascader } from './RegionCascader';
import { FileUploadInput } from './FileUploadInput';

export const DynamicInput: React.FC<InputComponentProps> = (props) => {
  const t = props.field.type;
  switch (t) {
    case 'text':            return <TextInput {...props} />;
    case 'textarea':        return <TextareaInput {...props} />;
    case 'company_search':  return <CompanySearchInput {...props} />;
    case 'select':          return <SelectInput {...props} />;
    case 'multi_select':    return <MultiSelectInput {...props} />;
    case 'range':           return <RangeInput {...props} />;
    case 'date_range':      return <DateRangeInput {...props} />;
    case 'remote_search':   return <RemoteSearchInput {...props} />;
    case 'region_cascader': return <RegionCascader {...props} />;
    case 'file_upload':     return <FileUploadInput {...props} />;
    default:
      console.warn(`[DynamicInput] unknown field type "${t}", falling back to TextInput`);
      return <TextInput {...props} />;
  }
};
