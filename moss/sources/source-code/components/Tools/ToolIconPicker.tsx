/**
 * ToolIconPicker — 预制图标库 + 图标选择器 Popover
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Wrench, Zap, Cog, Sparkles, Shield,
  Download, CloudDownload, ArrowDownToLine, PackageOpen,
  Database, Server, HardDrive, Plug,
  Search, ScanSearch, FileSearch, Filter,
  Send, Mail, MessageSquare, Webhook,
  BarChart3, PieChart, Calculator, BrainCircuit,
  type LucideIcon,
} from 'lucide-react';

type IconComponent = LucideIcon;

interface IconEntry {
  key: string;
  label: string;
  icon: IconComponent;
}

interface IconCategory {
  name: string;
  icons: IconEntry[];
}

export const ICON_CATEGORIES: IconCategory[] = [
  {
    name: '通用',
    icons: [
      { key: 'wrench', label: '工具', icon: Wrench },
      { key: 'zap', label: '闪电', icon: Zap },
      { key: 'cog', label: '齿轮', icon: Cog },
      { key: 'sparkles', label: '闪光', icon: Sparkles },
      { key: 'shield', label: '盾牌', icon: Shield },
    ],
  },
  {
    name: '数据获取',
    icons: [
      { key: 'download', label: '下载', icon: Download },
      { key: 'cloud-download', label: '云下载', icon: CloudDownload },
      { key: 'arrow-down', label: '下拉', icon: ArrowDownToLine },
      { key: 'package-open', label: '包裹', icon: PackageOpen },
    ],
  },
  {
    name: '数据源',
    icons: [
      { key: 'database', label: '数据库', icon: Database },
      { key: 'server', label: '服务器', icon: Server },
      { key: 'hard-drive', label: '硬盘', icon: HardDrive },
      { key: 'plug', label: '连接', icon: Plug },
    ],
  },
  {
    name: '搜索',
    icons: [
      { key: 'search', label: '搜索', icon: Search },
      { key: 'scan-search', label: '扫描', icon: ScanSearch },
      { key: 'file-search', label: '文件搜索', icon: FileSearch },
      { key: 'filter', label: '筛选', icon: Filter },
    ],
  },
  {
    name: '通信',
    icons: [
      { key: 'send', label: '发送', icon: Send },
      { key: 'mail', label: '邮件', icon: Mail },
      { key: 'message', label: '消息', icon: MessageSquare },
      { key: 'webhook', label: 'Webhook', icon: Webhook },
    ],
  },
  {
    name: '分析',
    icons: [
      { key: 'bar-chart', label: '柱状图', icon: BarChart3 },
      { key: 'pie-chart', label: '饼图', icon: PieChart },
      { key: 'calculator', label: '计算', icon: Calculator },
      { key: 'brain', label: '智能', icon: BrainCircuit },
    ],
  },
];

const ALL_ICONS: Record<string, IconComponent> = {};
for (const cat of ICON_CATEGORIES) {
  for (const entry of cat.icons) {
    ALL_ICONS[entry.key] = entry.icon;
  }
}

export function getToolIcon(key: string | undefined): IconComponent {
  if (!key) return Wrench;
  return ALL_ICONS[key] || Wrench;
}

interface ToolIconPickerProps {
  value: string;
  onChange: (key: string) => void;
  testId?: string;
  triggerTestId?: string;
  popoverTestId?: string;
  optionTestIdPrefix?: string;
}

export const ToolIconPicker: React.FC<ToolIconPickerProps> = ({
  value,
  onChange,
  testId,
  triggerTestId,
  popoverTestId,
  optionTestIdPrefix,
}) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const SelectedIcon = getToolIcon(value);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
      triggerRef.current && !triggerRef.current.contains(e.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div
      className="tool-icon-picker"
      data-testid={testId}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        ref={triggerRef}
        onClick={() => setOpen(prev => !prev)}
        className="tool-icon-picker-trigger"
        data-testid={triggerTestId}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 10,
          border: '1px solid var(--input-border)', background: 'var(--input-bg)',
          color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
        }}
      >
        <SelectedIcon size={15} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {value || 'wrench'}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          style={{ marginLeft: 2, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <polyline points="2,3.5 5,6.5 8,3.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="tool-icon-picker-popover scrollbar-hide"
          data-testid={popoverTestId}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
            width: 280, maxHeight: 320, overflowY: 'auto',
            background: 'var(--modal-bg)', borderRadius: 12,
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            padding: '8px',
          }}
        >
          {ICON_CATEGORIES.map(cat => (
            <div key={cat.name} className="tool-icon-picker-category" style={{ marginBottom: 6 }}>
              <div className="tool-icon-picker-category-title" style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 6px', fontWeight: 500 }}>
                {cat.name}
              </div>
              <div className="tool-icon-picker-category-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
                {cat.icons.map(entry => {
                  const Icon = entry.icon;
                  const selected = entry.key === (value || 'wrench');
                  return (
                    <button
                      key={entry.key}
                      title={entry.label}
                      onClick={() => { onChange(entry.key); setOpen(false); }}
                      className="tool-icon-picker-option"
                      data-testid={optionTestIdPrefix ? `${optionTestIdPrefix}-${entry.key}` : undefined}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '100%', aspectRatio: '1', borderRadius: 8,
                        border: selected ? '1.5px solid var(--text-primary)' : '1px solid transparent',
                        background: selected ? 'var(--hover-bg-strong)' : 'transparent',
                        color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => {
                        if (!selected) {
                          e.currentTarget.style.background = 'var(--hover-bg)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!selected) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }
                      }}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
