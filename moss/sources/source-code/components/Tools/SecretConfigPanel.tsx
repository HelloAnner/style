/**
 * SecretConfigPanel — 密钥配置面板
 *
 * 声明密钥列表，查询配置状态，支持团队级/用户级 scope 标签。
 * 内嵌在 ToolStudio 右侧底部的折叠区域中。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { secretsApi, type SecretStatusMap, type SecretDeclaration } from '../../api/tenants';

/* ── Icons ── */

const LockIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

const EyeIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const ChevronIcon: React.FC<{ size?: number; expanded?: boolean }> = ({ size = 16, expanded }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <polyline points="6,9 12,15 18,9"/>
  </svg>
);

/* ── Types ── */

interface SecretConfigPanelProps {
  toolName: string;
  packName?: string;
  secrets: SecretDeclaration[];
  onSecretsChange: (secrets: SecretDeclaration[]) => void;
}

/* ── Component ── */

export const SecretConfigPanel: React.FC<SecretConfigPanelProps> = ({
  toolName,
  packName,
  secrets,
  onSecretsChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [statusMap, setStatusMap] = useState<SecretStatusMap>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newScope, setNewScope] = useState<'tenant' | 'user'>('tenant');
  const [newLabel, setNewLabel] = useState('');

  const loadStatus = useCallback(async () => {
    if (!toolName || secrets.length === 0) return;
    try {
      const status = await secretsApi.getStatus(toolName, packName);
      setStatusMap(status);
    } catch { /* ignore */ }
  }, [toolName, packName, secrets.length]);

  useEffect(() => {
    if (secrets.length > 0) loadStatus();
  }, [loadStatus, secrets.length]);

  const handleSaveSecret = async (key: string, scope: string) => {
    if (!editValue.trim()) return;
    setSaving(true);
    try {
      await secretsApi.set({ key, value: editValue, scope });
      setEditingKey(null);
      setEditValue('');
      setShowValue(false);
      loadStatus();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDeleteSecret = async (key: string, scope: string) => {
    try {
      await secretsApi.delete(key, scope);
      loadStatus();
    } catch { /* ignore */ }
  };

  const handleAddSecret = () => {
    if (!newKey.trim()) return;
    const updated = [...secrets, { key: newKey.trim(), scope: newScope, label: newLabel.trim() || undefined }];
    onSecretsChange(updated);
    setNewKey('');
    setNewLabel('');
    setAddMode(false);
  };

  const handleRemoveDeclaration = (idx: number) => {
    const updated = secrets.filter((_, i) => i !== idx);
    onSecretsChange(updated);
  };

  const configuredCount = secrets.filter(s => statusMap[s.key]?.configured).length;

  return (
    <div data-testid="secret-config-panel" style={{
      borderRadius: 12,
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-tertiary)',
      overflow: 'hidden',
    }}>
      {/* Header - collapsible */}
      <button
        data-testid="secret-config-panel-toggle"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LockIcon size={14} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>密钥声明</span>
          {secrets.length > 0 && (
            <span style={{
              fontSize: 11, padding: '1px 6px', borderRadius: 10,
              background: 'var(--hover-bg)', color: 'var(--text-muted)',
            }}>
              {configuredCount}/{secrets.length}
            </span>
          )}
        </div>
        <ChevronIcon expanded={expanded} />
      </button>

      {expanded && (
        <div data-testid="secret-config-panel-content" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {secrets.length === 0 && !addMode && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
              尚未声明任何密钥
            </div>
          )}

          {secrets.map((secret, idx) => {
            const status = statusMap[secret.key];
            const configured = status?.configured ?? false;
            const isEditing = editingKey === secret.key;

            return (
              <div key={`${secret.key}-${idx}`} style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{secret.key}</code>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 6,
                      background: 'var(--hover-bg)',
                      color: 'var(--text-muted)',
                    }}>
                      {secret.scope === 'user' ? '个人' : '团队'}
                    </span>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: configured ? 'var(--text-secondary)' : 'var(--text-muted)',
                      opacity: configured ? 0.6 : 0.3,
                    }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => { setEditingKey(secret.key); setEditValue(''); setShowValue(false); }}
                          style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 4,
                            background: 'none', border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)', cursor: 'pointer',
                          }}
                        >{configured ? '更新' : '配置'}</button>
                        <button
                          onClick={() => handleRemoveDeclaration(idx)}
                          style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 4,
                            background: 'none', border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)', cursor: 'pointer',
                          }}
                        >移除</button>
                      </>
                    )}
                  </div>
                </div>
                {secret.label && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{secret.label}</div>
                )}
                {isEditing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <input
                      autoFocus
                      type={showValue ? 'text' : 'password'}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveSecret(secret.key, secret.scope); }}
                      placeholder="输入密钥值"
                      style={{
                        flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6,
                        border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                        color: 'var(--text-primary)', outline: 'none', fontFamily: 'monospace',
                      }}
                    />
                    <button
                      onClick={() => setShowValue(!showValue)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}
                    >
                      {showValue ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                    <button
                      onClick={() => handleSaveSecret(secret.key, secret.scope)}
                      disabled={saving || !editValue.trim()}
                      style={{
                        fontSize: 11, padding: '5px 10px', borderRadius: 6,
                        background: 'var(--text-primary)', color: 'var(--bg-primary)',
                        border: 'none', cursor: 'pointer',
                        opacity: !editValue.trim() ? 0.4 : 1,
                      }}
                    >{saving ? '...' : '保存'}</button>
                    <button
                      onClick={() => { setEditingKey(null); setEditValue(''); }}
                      style={{
                        fontSize: 11, padding: '5px 8px', borderRadius: 6,
                        background: 'none', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)', cursor: 'pointer',
                      }}
                    >取消</button>
                    {configured && (
                      <button
                        onClick={() => handleDeleteSecret(secret.key, secret.scope)}
                        style={{
                          fontSize: 11, padding: '5px 8px', borderRadius: 6,
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)', cursor: 'pointer',
                        }}
                      >清除</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new secret declaration */}
          {addMode ? (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  value={newKey}
                  onChange={e => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  placeholder="KEY_NAME"
                  style={{
                    flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6,
                    border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                    color: 'var(--text-primary)', outline: 'none', fontFamily: 'monospace',
                  }}
                />
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  {(['tenant', 'user'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setNewScope(s)}
                      style={{
                        fontSize: 11, padding: '4px 10px', border: 'none', cursor: 'pointer',
                        background: newScope === s ? 'var(--hover-bg-strong)' : 'transparent',
                        color: newScope === s ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >{s === 'tenant' ? '团队' : '个人'}</button>
                  ))}
                </div>
              </div>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="描述（可选）"
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                  color: 'var(--text-primary)', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setAddMode(false); setNewKey(''); setNewLabel(''); }}
                  style={{
                    fontSize: 11, padding: '5px 10px', borderRadius: 6,
                    background: 'none', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                >取消</button>
                <button
                  onClick={handleAddSecret}
                  disabled={!newKey.trim()}
                  style={{
                    fontSize: 11, padding: '5px 10px', borderRadius: 6,
                    background: 'var(--text-primary)', color: 'var(--bg-primary)',
                    border: 'none', cursor: 'pointer',
                    opacity: !newKey.trim() ? 0.4 : 1,
                  }}
                >添加</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddMode(true)}
              style={{
                fontSize: 12, padding: '8px 0', borderRadius: 8, width: '100%',
                background: 'none', border: '1px dashed var(--border-subtle)',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              + 添加密钥声明
            </button>
          )}
        </div>
      )}
    </div>
  );
};
