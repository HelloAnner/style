/**
 * What's New — 产品更新公告弹窗
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';

// ========== 类型 ==========

interface UpdateItem {
  tag: string;
  title: string;
  description: string;
}

interface UpdateGroup {
  date: string;
  items: UpdateItem[];
}

interface WhatsNewProps {
  isOpen: boolean;
  onClose: () => void;
}

// ========== SVG 标签图标 ==========

const TagIcons: Record<string, React.ReactNode> = {
  'Agent 内核升级': (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" fill="currentColor"/>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    </svg>
  ),
  '平台能力与体验升级': (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  ),
  '性能与稳定提升': (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
      <path d="M2 12l3.5-4 3 2.5L14 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M10.5 4H14v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
};

// ========== 标签配色 ==========

const TAG_STYLES: Record<string, { bg: string; color: string; darkColor: string }> = {
  'Agent 内核升级':    { bg: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed', darkColor: '#a78bfa' },
  '平台能力与体验升级': { bg: 'rgba(59, 130, 246, 0.12)',  color: '#2563eb', darkColor: '#60a5fa' },
  '性能与稳定提升':    { bg: 'rgba(16, 185, 129, 0.12)',  color: '#059669', darkColor: '#34d399' },
};

const DEFAULT_TAG_STYLE = { bg: 'rgba(148, 163, 184, 0.12)', color: '#64748b', darkColor: '#94a3b8' };

function getTagStyle(tag: string) {
  return TAG_STYLES[tag] || DEFAULT_TAG_STYLE;
}

const toTestIdSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-');

// ========== 日期格式化 ==========

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);

  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff < 7) return `${diff} 天前`;

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  return year === now.getFullYear()
    ? `${month} 月 ${day} 日`
    : `${year} 年 ${month} 月 ${day} 日`;
}

// ========== 检测当前主题 ==========

function useIsDark() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'dark'
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// ========== 主组件 ==========

const WhatsNew: React.FC<WhatsNewProps> = ({ isOpen, onClose }) => {
  const [updates] = useState<UpdateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const isDark = useIsDark();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    // TODO: updates 接口暂未实现，跳过加载
    setLoading(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        data-testid="whats-new-backdrop"
        style={{ background: 'var(--modal-backdrop)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          data-testid="whats-new-panel"
          onClick={e => e.stopPropagation()}
          style={{
            width: 560,
            maxHeight: 'min(700px, 85vh)',
            background: 'var(--modal-bg)',
            borderRadius: 20,
            border: '1px solid var(--modal-border)',
            boxShadow: 'var(--modal-shadow)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div data-testid="whats-new-header" style={{
            padding: '24px 28px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 style={{
                  fontFamily: "'Snell Roundhand', 'Apple Chancery', 'Segoe Script', 'Lucida Handwriting', cursive",
                  fontSize: 22,
                  fontWeight: 400,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.01em',
                  margin: 0,
                }}>
                  What's New
                </h2>
              </div>
              <button
                onClick={onClose}
                data-testid="whats-new-close"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'transparent', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div data-testid="whats-new-content" style={{
            flex: 1, overflowY: 'auto', padding: '8px 28px 28px',
          }}>
            {loading ? (
              <div data-testid="whats-new-loading" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 200, color: 'var(--text-muted)', fontSize: 13,
              }}>
                加载中...
              </div>
            ) : updates.length === 0 ? (
              <div data-testid="whats-new-empty" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 200, color: 'var(--text-muted)', fontSize: 13,
              }}>
                暂无更新
              </div>
            ) : (
              updates.map((group, gi) => (
                <div
                  key={group.date}
                  className="whats-new-group"
                  data-testid={`whats-new-group-${toTestIdSegment(group.date)}`}
                  style={{ marginTop: gi === 0 ? 16 : 28 }}
                >
                  {/* 日期标题 */}
                  <div className="flex items-center" style={{ gap: 10, marginBottom: 14 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatDate(group.date)}
                    </div>
                    <div style={{
                      flex: 1, height: 1,
                      background: 'var(--border-subtle)',
                    }} />
                    <div style={{
                      fontSize: 11, color: 'var(--text-muted)',
                      whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {group.date}
                    </div>
                  </div>

                  {/* 更新条目 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {group.items.map((item, ii) => {
                      const tagStyle = getTagStyle(item.tag);
                      const tagColor = isDark ? tagStyle.darkColor : tagStyle.color;
                      return (
                        <motion.div
                          key={ii}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: gi * 0.06 + ii * 0.04, duration: 0.25 }}
                          className="whats-new-item"
                          data-testid={`whats-new-item-${toTestIdSegment(group.date)}-${ii}`}
                          style={{
                            padding: '14px 16px',
                            borderRadius: 12,
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-subtle)',
                            transition: 'border-color 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                        >
                          <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 11, fontWeight: 600,
                              padding: '2px 8px', borderRadius: 5,
                              background: tagStyle.bg, color: tagColor,
                              letterSpacing: '0.02em',
                            }}>
                              {TagIcons[item.tag] || null}
                              {item.tag}
                            </span>
                          </div>
                          <div style={{
                            fontSize: 14, fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: 4,
                            lineHeight: 1.4,
                          }}>
                            {item.title}
                          </div>
                          <div style={{
                            fontSize: 13, color: 'var(--text-secondary)',
                            lineHeight: 1.6,
                          }}>
                            {item.description}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default WhatsNew;
