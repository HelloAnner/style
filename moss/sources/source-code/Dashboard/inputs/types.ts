/**
 * Input 控件统一接口
 *
 * 所有看板的查询条件控件都遵循这个 props 签名，
 * DashboardQueryForm 按 field.type 通过 DynamicInput 选择渲染哪一个。
 */

import { DashboardInput } from '../../../api/dashboards';

export interface InputComponentProps<T = any> {
  field: DashboardInput;
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  disabled?: boolean;
  sessionId?: string | null;
}
