/**
 * 能力选择器 - 可选资产的弹出卡片
 * 
 * 视觉类似 @ 文件引用的弹出卡片，支持开启/关闭可选工具、技能、伙伴
 */

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';

interface OptionalAsset {
  name: string;
  display_name?: string;
  description: string;
  description_zh?: string;
  asset_type: string;
}

interface CapabilityPickerProps {
  assets: OptionalAsset[];
  activated: string[];
  onToggle: (name: string) => void;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const TYPE_LABELS: Record<string, string> = {
  tool: '工具',
  skill: '技能',
  subagent: '伙伴',
};

const ToolIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
  </svg>
);

const SkillIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
  </svg>
);

const SubAgentIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const getIcon = (type: string) => {
  if (type === 'skill') return <SkillIcon />;
  if (type === 'subagent') return <SubAgentIcon />;
  return <ToolIcon />;
};

const ToggleSwitch: React.FC<{ active: boolean; onClick: (e: React.MouseEvent) => void; testId?: string }> = ({ active, onClick, testId }) => (
  <div
    className="capability-toggle"
    role="switch"
    aria-checked={active}
    data-testid={testId}
    onClick={onClick}
    style={{
      width: 34, height: 20, borderRadius: 10, flexShrink: 0,
      background: active ? 'var(--text-primary)' : 'transparent',
      border: active ? 'none' : '1.5px solid var(--text-muted)',
      position: 'relative',
      transition: 'background 0.15s, border-color 0.15s',
      cursor: 'pointer',
    }}
  >
    <div style={{
      width: 14, height: 14, borderRadius: 7,
      background: active ? 'var(--bg-primary)' : 'var(--text-muted)',
      position: 'absolute',
      top: active ? 3 : 1.5,
      left: active ? 17 : 2,
      transition: 'left 0.15s, top 0.15s',
    }} />
  </div>
);

export const CapabilityPicker: React.FC<CapabilityPickerProps> = ({
  assets,
  activated,
  onToggle,
  isOpen,
  onClose,
  anchorRef,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose, anchorRef]);

  const grouped: Record<string, OptionalAsset[]> = {};
  for (const a of assets) {
    const t = a.asset_type || 'tool';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(a);
  }

  const activatedCount = activated.length;

  return (
    <AnimatePresence>
      {isOpen && assets.length > 0 && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          data-testid="capability-picker"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 8,
            maxHeight: 320,
            overflowY: 'auto',
            borderRadius: 12,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            zIndex: 50,
          }}
          >
          <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border-subtle)' }} data-testid="capability-picker-header">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              可选能力
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {activatedCount > 0 ? `已启用 ${activatedCount} 项` : '点击开关临时启用'}
            </div>
          </div>

          <div style={{ padding: '8px 8px' }} data-testid="capability-picker-groups">
            {Object.entries(grouped).map(([type, items]) => (
              <div className="capability-group" key={type} data-testid={`capability-group-${type}`}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  padding: '6px 8px 4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {TYPE_LABELS[type] || type}
                </div>
                {items.map(asset => {
                  const isActive = activated.includes(asset.name);
                  const displayName = asset.display_name || asset.name;
                  const displayDesc = asset.description_zh || asset.description;
                  return (
                    <div
                      className="capability-item"
                      key={asset.name}
                      data-testid={`capability-item-${asset.name}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: isActive ? 'var(--hover-bg)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <div style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                        {getIcon(asset.asset_type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {displayName}
                        </div>
                        {displayDesc && (
                          <div style={{
                            fontSize: 11, color: 'var(--text-muted)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {displayDesc}
                          </div>
                        )}
                      </div>
                      <ToggleSwitch
                        active={isActive}
                        testId={`capability-toggle-${asset.name}`}
                        onClick={(e) => { e.stopPropagation(); onToggle(asset.name); }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
