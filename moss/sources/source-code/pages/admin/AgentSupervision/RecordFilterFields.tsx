import React, { useEffect, useState } from "react";
import { Button, DatetimeRange, Input, InputNumber, Popover, Select } from "@fx-ui/fine-design";
import type { DashboardInput } from "../../../api/dashboards";
import { MultiSelectInput } from "../../../components/Dashboard/inputs/MultiSelectInput";
import "../../../components/Dashboard/dashboard.css";

function normalizeDateTimeValue(value: string): string | null {
  if (!value) return null;
  return value.replace("T", " ");
}

interface FilterFieldShellProps {
  label: string;
  children: React.ReactNode;
}

export function FilterFieldShell({ label, children }: FilterFieldShellProps) {
  return (
    <div className="session-log-filter-field">
      <span className="session-log-filter-label">{label}</span>
      {children}
    </div>
  );
}

interface ResetFilterButtonProps {
  onClick: () => void;
}

export function ResetFilterButton({ onClick }: ResetFilterButtonProps) {
  return (
    <button type="button" className="session-log-reset-button" onClick={onClick}>
      重置
    </button>
  );
}

interface TextFilterFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
}

export function TextFilterField({
  label,
  value,
  onChange,
  placeholder,
  width = 190,
}: TextFilterFieldProps) {
  return (
    <FilterFieldShell label={label}>
      <Input
        className="dashboard-fd-input"
        style={{ width }}
        value={value}
        placeholder={placeholder ?? `搜索 ${label}`}
        aria-label={label}
        allowClear
        autoComplete={false}
        onChange={(nextValue) => onChange(String(nextValue ?? ""))}
      />
    </FilterFieldShell>
  );
}

interface SelectFilterFieldProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  width?: number;
  placeholder?: string;
}

export function SelectFilterField({
  label,
  value,
  options,
  onChange,
  width = 118,
  placeholder = "全部",
}: SelectFilterFieldProps) {
  return (
    <FilterFieldShell label={label}>
      <Select<string>
        className="dashboard-fd-select"
        dropdownClassName="dashboard-fd-select-dropdown"
        style={{ width }}
        value={value || undefined}
        options={options}
        placeholder={placeholder}
        aria-label={label}
        allowClear
        popupMatchSelectWidth={false}
        onChange={(nextValue) => onChange(nextValue == null ? "" : String(nextValue))}
      />
    </FilterFieldShell>
  );
}

interface MultiSelectFilterFieldProps {
  label: string;
  values: string[];
  options: { label: string; value: string }[];
  onChange: (v: string[]) => void;
  width?: number;
}

export function MultiSelectFilterField({
  label,
  values,
  options,
  onChange,
  width = 160,
}: MultiSelectFilterFieldProps) {
  const field: DashboardInput = {
    name: label,
    label,
    type: "multi_select",
    placeholder: "全部",
    options,
  };

  return (
    <FilterFieldShell label={label}>
      <div style={{ width }}>
        <MultiSelectInput
          field={field}
          value={values}
          onChange={(nextValues) => onChange(Array.isArray(nextValues) ? nextValues.map(String) : [])}
        />
      </div>
    </FilterFieldShell>
  );
}

interface DateRangeFieldProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  label?: string;
  width?: number;
}

export function DateRangeField({
  from,
  to,
  onFromChange,
  onToChange,
  label = "时间范围",
  width = 260,
}: DateRangeFieldProps) {
  return (
    <FilterFieldShell label={label}>
      <DatetimeRange
        className="dashboard-fd-datetime-range session-log-fd-datetime-range"
        dropdownClassName="dashboard-fd-datetime-range-dropdown session-log-fd-dropdown session-log-fd-datetime-dropdown"
        style={{ width }}
        aria-label={label}
        format="YYYY-MM-DD HH:mm"
        value={[normalizeDateTimeValue(from), normalizeDateTimeValue(to)]}
        placeholder={["开始时间", "结束时间"]}
        allowEmpty={[true, true]}
        hasClear
        showTime={{ defaultValue: ["00:00", "23:59"] }}
        onChange={(_, formatString) => {
          const [start, end] = formatString;
          onFromChange(start || "");
          onToChange(end || "");
        }}
      />
    </FilterFieldShell>
  );
}

interface AmountRangeFieldProps {
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  label?: string;
  title?: string;
}

export function AmountRangeField({
  min,
  max,
  onMinChange,
  onMaxChange,
  label = "额度消耗",
  title = "单条记录消耗的额度",
}: AmountRangeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draftMin, setDraftMin] = useState(min);
  const [draftMax, setDraftMax] = useState(max);
  const hasValue = min !== "" || max !== "";
  const displayValue = hasValue ? `${min || "0"}-${max || "∞"}` : "不限";

  useEffect(() => {
    if (!open) {
      setDraftMin(min);
      setDraftMax(max);
    }
  }, [max, min, open]);

  function clear() {
    onMinChange("");
    onMaxChange("");
    setDraftMin("");
    setDraftMax("");
    setOpen(false);
  }

  function confirm() {
    onMinChange(draftMin);
    onMaxChange(draftMax);
    setOpen(false);
  }

  function handleVisibleChange(visible: boolean) {
    if (visible) {
      setDraftMin(min);
      setDraftMax(max);
      setOpen(true);
      return;
    }
    setDraftMin(min);
    setDraftMax(max);
    setOpen(false);
  }

  return (
    <FilterFieldShell label={label}>
      <Popover
        visible={open}
        trigger="click"
        placement="bottom-left"
        overlayClassName="session-log-fd-popover"
        content={(
          <div className="session-log-credit-range-panel">
            <div className="session-log-credit-range-title">{title}</div>
            <label className="session-log-credit-range-field">
              <span>最小值</span>
              <InputNumber<string>
                className="session-log-fd-number"
                value={draftMin || undefined}
                min={0}
                placeholder="如 100"
                size="normal"
                hasControlBtn={false}
                clearable
                onChange={(_, inputStr) => setDraftMin(inputStr)}
              />
            </label>
            <label className="session-log-credit-range-field">
              <span>最大值</span>
              <InputNumber<string>
                className="session-log-fd-number"
                value={draftMax || undefined}
                min={0}
                placeholder="如 1000"
                size="normal"
                hasControlBtn={false}
                clearable
                onChange={(_, inputStr) => setDraftMax(inputStr)}
              />
            </label>
            <div className="session-log-credit-range-actions">
              <Button type="negative" size="small" onClick={clear}>清除</Button>
              <Button type="primary" size="small" onClick={confirm}>确认</Button>
            </div>
          </div>
        )}
        onVisibleChange={handleVisibleChange}
      >
        <Button
          className={`session-log-fd-range-trigger${hasValue ? " is-active" : ""}`}
          type={hasValue ? "secondary" : "negative"}
          size="normal"
          aria-label={label}
        >
          {displayValue}
        </Button>
      </Popover>
    </FilterFieldShell>
  );
}
