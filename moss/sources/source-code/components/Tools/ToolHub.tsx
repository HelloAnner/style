/**
 * ToolHub — 工具管理主页
 *
 * 替代 SettingsPage 中原有的 AssetSettings 工具部分。
 * 展示：工具包卡片网格 + 独立工具列表 + 创建入口。
 * 点击工具或工具包内工具 → 打开 ToolStudio 编辑。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  toolPacksApi, tenantAssetsApi,
  type ToolPackMeta, type ToolConfig,
} from '../../api/tenants';
import { useAuthStore } from '../../stores/authStore';
import { useDesignSuggestionsStore } from '../../stores/designSuggestionsStore';
import { useAgentStore } from '../../stores/agentStore';
import { usePreviewStore } from '../../stores/previewStore';
import { ToolStudio } from './ToolStudio';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';

/* ── Icons ── */

const PlusIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const PackIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const ToolIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
  </svg>
);

const TrashIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
  </svg>
);

const ChevronDownIcon: React.FC<{ size?: number; expanded?: boolean }> = ({ size = 14, expanded }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <polyline points="6,9 12,15 18,9"/>
  </svg>
);

const CloseIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/* ── Types ── */

interface ToolItem {
  name: string;
  description?: string;
  display_name?: string;
  description_zh?: string;
  _pack?: string;
  _has_script?: boolean;
  [key: string]: unknown;
}

/* ── Component ── */

export const ToolHub: React.FC<{ onSettingsClose?: () => void }> = ({ onSettingsClose }) => {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id || '';
  const navigate = useNavigate();
  const startNewSession = useAgentStore(s => s.startNewSession);
  const closeSessionTabs = usePreviewStore(s => s.closeSessionTabs);
  const handleDesign = useCallback((_prompt: string) => {
    onSettingsClose?.();
    closeSessionTabs();
    startNewSession();
    navigate(WORKSPACE_HOME_PATH);
    setTimeout(() => useDesignSuggestionsStore.getState().show('tool'), 100);
  }, [onSettingsClose, closeSessionTabs, startNewSession, navigate]);

  const [packs, setPacks] = useState<ToolPackMeta[]>([]);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPack, setExpandedPack] = useState<string | null>(null);

  // Tool Studio state
  const [studioOpen, setStudioOpen] = useState(false);
  const [editTool, setEditTool] = useState<ToolConfig | null>(null);
  const [studioPackName, setStudioPackName] = useState<string | undefined>();

  // Create Pack panel
  const [showCreatePack, setShowCreatePack] = useState(false);
  const [packForm, setPackForm] = useState({ name: '', display_name: '', description: '', description_zh: '' });
  const [creatingPack, setCreatingPack] = useState(false);

  const loadAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [packResult, toolResult] = await Promise.allSettled([
        toolPacksApi.list(),
        tenantAssetsApi.list(tenantId, 'tools'),
      ]);
      if (packResult.status === 'fulfilled') setPacks(packResult.value);
      else console.error('[ToolHub] 加载工具包失败:', packResult.reason);
      if (toolResult.status === 'fulfilled') setTools(toolResult.value as ToolItem[]);
      else console.error('[ToolHub] 加载工具列表失败:', toolResult.reason);
    } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const standAloneTools = tools.filter(t => !t._pack);
  const getPackTools = (packName: string) => tools.filter(t => t._pack === packName);

  const handleDeleteTool = async (name: string, pack?: string) => {
    if (!tenantId) return;
    try {
      await tenantAssetsApi.remove(tenantId, 'tools', name, pack ? { pack } : undefined);
      loadAll();
      window.dispatchEvent(new CustomEvent('asset-changed', { detail: { type: 'tools' } }));
    } catch { /* ignore */ }
  };

  const handleDeletePack = async (packName: string) => {
    try {
      await toolPacksApi.delete(packName);
      loadAll();
      window.dispatchEvent(new CustomEvent('asset-changed', { detail: { type: 'tools' } }));
    } catch { /* ignore */ }
  };

  const handleCreatePack = async () => {
    if (!packForm.name.trim() || creatingPack) return;
    setCreatingPack(true);
    try {
      await toolPacksApi.create({
        name: packForm.name.trim(),
        display_name: packForm.display_name.trim() || packForm.name.trim(),
        description: packForm.description.trim(),
        description_zh: packForm.description_zh.trim(),
      });
      setPackForm({ name: '', display_name: '', description: '', description_zh: '' });
      setShowCreatePack(false);
      loadAll();
    } catch { /* ignore */ }
    finally { setCreatingPack(false); }
  };

  const openCreateTool = (pack?: string) => {
    setEditTool(null);
    setStudioPackName(pack);
    setStudioOpen(true);
  };

  const openEditTool = (tool: ToolItem) => {
    setEditTool(tool as ToolConfig);
    setStudioPackName(tool._pack as string | undefined);
    setStudioOpen(true);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 10,
    border: '1px solid var(--input-border)', background: 'var(--input-bg)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  };

  if (loading) {
    return <div data-testid="tool-hub-loading" style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>加载中...</div>;
  }

  return (
    <>
      <div data-testid="tool-hub" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div data-testid="tool-hub-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>自定义工具</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => openCreateTool()}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '7px 14px', fontSize: 12, fontWeight: 500, borderRadius: 10,
                border: 'none', background: 'var(--text-primary)', color: 'var(--bg-primary)', cursor: 'pointer',
              }}
            >
              <PlusIcon size={13} /> 创建工具
            </button>
            <button
              onClick={() => setShowCreatePack(!showCreatePack)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '7px 14px', fontSize: 12, fontWeight: 500, borderRadius: 10,
                border: '1px solid var(--border-subtle)', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              <PlusIcon size={13} /> 创建工具包
            </button>
          </div>
        </div>

        {/* Create Pack form */}
        {showCreatePack && (
          <div data-testid="tool-hub-create-pack-form" style={{
            padding: 20, borderRadius: 14,
            background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>新建工具包</span>
              <button onClick={() => setShowCreatePack(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <CloseIcon size={14} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>包名 (标识符)</div>
                <input value={packForm.name} onChange={e => setPackForm(p => ({ ...p, name: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') }))} placeholder="jiandaoyun" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>显示名称</div>
                <input value={packForm.display_name} onChange={e => setPackForm(p => ({ ...p, display_name: e.target.value }))} placeholder="简道云" style={inputStyle} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>描述</div>
              <input value={packForm.description} onChange={e => setPackForm(p => ({ ...p, description: e.target.value }))} placeholder="简道云全套数据操作工具" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowCreatePack(false)}
                style={{
                  padding: '7px 14px', fontSize: 12, borderRadius: 10,
                  background: 'transparent', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >取消</button>
              <button
                onClick={handleCreatePack}
                disabled={!packForm.name.trim() || creatingPack}
                style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 500, borderRadius: 10,
                  background: 'var(--text-primary)', color: 'var(--bg-primary)',
                  border: 'none', cursor: 'pointer',
                  opacity: !packForm.name.trim() ? 0.4 : 1,
                }}
              >{creatingPack ? '创建中...' : '创建'}</button>
            </div>
          </div>
        )}

        {/* Tool Packs grid */}
        {packs.length > 0 && (
          <div data-testid="tool-hub-pack-section">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>工具包</div>
            <div data-testid="tool-hub-pack-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {packs.map(pack => {
                const packTools = getPackTools(pack.name);
                const isExpanded = expandedPack === pack.name;
                return (
                  <div key={pack.name} style={{
                    borderRadius: 14, background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)', overflow: 'hidden',
                  }}>
                    <div
                      style={{
                        padding: '14px 16px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                      onClick={() => setExpandedPack(isExpanded ? null : pack.name)}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <PackIcon size={20} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                            {pack.display_name || pack.name}
                          </span>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 8,
                            background: 'var(--hover-bg)', color: 'var(--text-muted)',
                          }}>
                            {packTools.length}
                          </span>
                        </div>
                        {(pack.description_zh || pack.description) && (
                          <div style={{
                            fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {pack.description_zh || pack.description}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeletePack(pack.name); }}
                          style={{
                            display: 'flex', padding: 4, borderRadius: 4,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', opacity: 0.4,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; }}
                        >
                          <TrashIcon size={13} />
                        </button>
                        <ChevronDownIcon expanded={isExpanded} />
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{
                        padding: '0 16px 12px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8,
                      }}>
                        {packTools.map(tool => (
                          <div
                            key={tool.name}
                            onClick={() => openEditTool(tool)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                              background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-muted)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                                  {tool.display_name || tool.name}
                                </span>
                                <span style={{
                                  fontSize: 9, padding: '1px 5px', borderRadius: 4,
                                  background: 'var(--hover-bg)', color: 'var(--text-muted)',
                                }}>
                                  {tool._has_script ? 'CoreX' : 'API'}
                                </span>
                              </div>
                              {(tool.description_zh || tool.description) && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {tool.description_zh || tool.description}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteTool(tool.name, tool._pack); }}
                              style={{
                                display: 'flex', padding: 4, borderRadius: 4,
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-muted)', opacity: 0.4,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; }}
                            >
                              <TrashIcon size={12} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => openCreateTool(pack.name)}
                          style={{
                            padding: '8px', borderRadius: 8, width: '100%',
                            background: 'none', border: '1px dashed var(--border-subtle)',
                            color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                        >
                          + 添加工具
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Standalone tools */}
        <div data-testid="tool-hub-standalone-section">
          {packs.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>独立工具</div>
          )}
          {standAloneTools.length === 0 && packs.length === 0 && (
            <div style={{
              padding: 40, textAlign: 'center', borderRadius: 14,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
            }}>
              <ToolIcon size={24} />
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 12, marginBottom: 4 }}>暂无自定义工具</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                创建工具后可在 Agent 设置中启用。支持 API 接入和 CoreX 可编程工具。
              </div>
            </div>
          )}
          {standAloneTools.length === 0 && packs.length > 0 && (
            <div style={{ padding: 20, textAlign: 'center', borderRadius: 10, color: 'var(--text-muted)', fontSize: 12 }}>
              暂无独立工具
            </div>
          )}
          {standAloneTools.length > 0 && (
            <div data-testid="tool-hub-standalone-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {standAloneTools.map(tool => (
                <div
                  key={tool.name}
                  onClick={() => openEditTool(tool)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-muted)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <ToolIcon size={16} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {tool.display_name || tool.name}
                        </span>
                        <span style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 4,
                          background: 'var(--hover-bg)', color: 'var(--text-muted)',
                        }}>
                          {tool._has_script ? 'CoreX' : 'API'}
                        </span>
                      </div>
                      {(tool.description_zh || tool.description) && (
                        <div style={{
                          fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {tool.description_zh || tool.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteTool(tool.name, tool._pack); }}
                    style={{
                      display: 'flex', padding: 6, borderRadius: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', opacity: 0.4,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; }}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tool Studio */}
      <ToolStudio
        isOpen={studioOpen}
        onClose={() => setStudioOpen(false)}
        onSaved={loadAll}
        editTool={editTool}
        packName={studioPackName}
        onDesign={handleDesign}
      />
    </>
  );
};
