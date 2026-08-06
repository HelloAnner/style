/**
 * 管理后台「资产管理」子页面。
 *
 * 三个子 Tab：
 * - 工具：简单列表展示，暂用 mock 数据（TODO: 接后端接口）
 * - 技能：系统级技能 + 自定义技能（CRUD），调用 skillManagementApi
 * - 自动化：占位 UI（TODO: 等后端接口）
 */

import React, { useState } from 'react';
import { ToolsTab } from './asset-tabs/ToolsTab';
import { SkillsTab } from './asset-tabs/SkillsTab';
import { AutomationsTab } from './asset-tabs/AutomationsTab';

// ── Tab 定义 ──

type AssetTab = 'tools' | 'skills' | 'automations';

const TAB_LABELS: Record<AssetTab, string> = {
  tools: '工具',
  skills: '技能',
  automations: '自动化',
};

const TAB_KEYS: AssetTab[] = ['tools', 'skills', 'automations'];

// ── 胶囊 Tab 组件（保持原有风格）──

function CapsuleTabBar({
  active,
  onChange,
}: {
  active: AssetTab;
  onChange: (tab: AssetTab) => void;
}) {
  const [hovered, setHovered] = useState<AssetTab | null>(null);
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        background: 'var(--bg-tertiary)',
        borderRadius: 24,
        padding: '3px 4px',
        marginBottom: 24,
      }}
    >
      {TAB_KEYS.map((key) => {
        const isActive = active === key;
        const isHovered = hovered === key && !isActive;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: '5px 16px',
              borderRadius: 20,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: isHovered ? 'var(--btn-mono-bg)' : 'transparent',
              background: isActive ? 'var(--btn-mono-bg)' : 'transparent',
              color: isActive ? 'var(--btn-mono-text)' : isHovered ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            {TAB_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}

// ── 主组件 ──

/**
 * 资产管理页（管理后台子页面，?tab=assets）。
 */
const AssetManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AssetTab>('tools');

  return (
    <div style={{ padding: '28px' }} data-testid="asset-management-page">
      <div style={{ marginBottom: 6 }} data-testid="asset-management-header">
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 4px',
          }}
        >
          资产管理
        </h2>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            margin: '0 0 20px',
            lineHeight: 1.5,
          }}
        >
          管理租户级工具、技能和自动化资产（跨 Agent 共享）
        </p>
      </div>

      <div data-testid="asset-management-tabs">
        <CapsuleTabBar active={activeTab} onChange={setActiveTab} />
      </div>

      <div data-testid={`asset-management-panel-${activeTab}`}>
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'automations' && <AutomationsTab />}
      </div>
    </div>
  );
};

export default AssetManagement;
