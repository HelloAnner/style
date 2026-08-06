/**
 * 区域级联 — 省 / 市 / 区（3 级）
 *
 * 值结构：{ province, city, district, province_label, city_label, district_label }
 *
 * 工作方式：
 *   - 使用 FineDesignSystem MCascader 作为一个级联选择器
 *   - 上一级变化时，下一级清空 + 重新加载选项
 *   - 通过 store.loadOptions(field, parent_code) 拉数据；yaml 端约定用 $q 占位符接收 parent_code
 *
 * 看板 yaml 示例：
 *   - name: region
 *     type: region_cascader
 *     api: government_get_region_list_sys
 *     api_args: { parent_code: "$q" }   # 空字符串 = 省级；省 code = 市；市 code = 区
 *     label_field: name
 *     value_field: code
 *     levels: [province, city, district]
 */
import { MCascader } from '@fx-ui/fine-design';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { InputComponentProps } from './types';

type RegionOptionValue = string | number;

interface RegionOption {
  label: string;
  value: RegionOptionValue;
  children?: RegionOption[];
  isLeaf?: boolean;
  disabled?: boolean;
}

interface RegionValue {
  province?: any;
  city?: any;
  district?: any;
  province_label?: string;
  city_label?: string;
  district_label?: string;
}

const LEVEL_LABELS = ['province', 'city', 'district'] as const;

function toOptionValue(value: any): RegionOptionValue {
  return typeof value === 'number' ? value : String(value);
}

function isRegionCode(value: any): value is string {
  return typeof value === 'string' && /^\d{6}$/.test(value);
}

function canRegionCodeHaveChildren(value: any): boolean {
  if (!isRegionCode(String(value))) return true;
  const code = String(value);
  return code.endsWith('0000') || code.endsWith('00');
}

function toRegionOptions(
  items: Array<{ label: string; value: any }>,
  lvl: number,
  visibleLevels: number,
): RegionOption[] {
  return items.map((it) => ({
    label: it.label,
    value: toOptionValue(it.value),
    isLeaf: lvl >= visibleLevels - 1 || !canRegionCodeHaveChildren(it.value),
  }));
}

function findOptionByValue(options: RegionOption[], value: any): RegionOption | undefined {
  return options.find((option) => String(option.value) === String(value));
}

function getCurrentPath(v: RegionValue, visibleLevels: number): RegionOptionValue[] {
  return [v.province, v.city, v.district]
    .slice(0, visibleLevels)
    .filter((item) => item != null && item !== '')
    .map(toOptionValue);
}

export const RegionCascader: React.FC<InputComponentProps<RegionValue>> = ({
  field, value, onChange, disabled,
}) => {
  const loadOptions = useDashboardStore((s) => s.loadOptions);
  const levels = field.levels && field.levels.length ? field.levels : LEVEL_LABELS as unknown as string[];
  const v: RegionValue = value || {};
  const visibleLevels = Math.min(levels.length, 3);

  const [perLevelOptions, setPerLevelOptions] = useState<Array<Array<{ label: string; value: any }>>>([
    [], [], [],
  ]);

  // 第 lvl 级根据上一级的 value 加载选项
  // 省级（lvl=0）最多 34 个，传 limit=50 避免被默认的 20 截断
  const fetchLevel = useCallback(async (lvl: number, parentCode: string) => {
    if (disabled) return;
    const resp = await loadOptions(field.name, parentCode, lvl === 0 ? 50 : undefined);
    setPerLevelOptions((prev) => {
      const next = prev.slice();
      next[lvl] = resp?.items || [];
      return next;
    });
  }, [disabled, field.name, loadOptions]);

  const cascaderOptions = useMemo(() => {
    const provinceOptions = toRegionOptions(perLevelOptions[0] || [], 0, visibleLevels);
    const province = findOptionByValue(provinceOptions, v.province);
    if (province && visibleLevels > 1 && (perLevelOptions[1] || []).length > 0) {
      province.children = toRegionOptions(perLevelOptions[1] || [], 1, visibleLevels);
      const city = findOptionByValue(province.children, v.city);
      if (city && visibleLevels > 2 && (perLevelOptions[2] || []).length > 0) {
        city.children = toRegionOptions(perLevelOptions[2] || [], 2, visibleLevels);
      }
    }
    return provinceOptions;
  }, [perLevelOptions, v.city, v.province, visibleLevels]);

  // 首次加载：拉省级
  useEffect(() => {
    fetchLevel(0, '');
  }, [fetchLevel]);

  // 已选省 → 拉市
  useEffect(() => {
    if (v.province != null && v.province !== '') {
      fetchLevel(1, String(v.province));
    } else {
      setPerLevelOptions((prev) => { const n = prev.slice(); n[1] = []; n[2] = []; return n; });
    }
  }, [fetchLevel, v.province]);

  // 已选市 → 拉区
  useEffect(() => {
    if (v.city != null && v.city !== '') {
      fetchLevel(2, String(v.city));
    } else {
      setPerLevelOptions((prev) => { const n = prev.slice(); n[2] = []; return n; });
    }
  }, [fetchLevel, v.city]);

  const handleChange = (
    nextPath: Array<string | number>,
    selectedOptions: RegionOption[],
  ) => {
    if (disabled) return;
    const nv: RegionValue = {};
    const province = selectedOptions[0];
    const city = selectedOptions[1];
    const district = selectedOptions[2];

    if (nextPath[0] != null && province) {
      nv.province = province.value;
      nv.province_label = province.label;
    }
    if (nextPath[1] != null && city) {
      nv.city = city.value;
      nv.city_label = city.label;
    }
    if (nextPath[2] != null && district) {
      nv.district = district.value;
      nv.district_label = district.label;
    }
    onChange(nv);
  };

  const currentPath = getCurrentPath(v, visibleLevels);

  return (
    <div className="dashboard-cascader">
      <MCascader<RegionOption, 'value'>
        className="dashboard-region-cascader"
        dropdownClassName="dashboard-region-cascader-dropdown"
        value={currentPath}
        options={cascaderOptions}
        placeholder={field.placeholder}
        disabled={disabled || cascaderOptions.length === 0}
        changeOnSelect
        allowClear
        expandTrigger="click"
        onChange={handleChange}
      />
    </div>
  );
};
