import React from 'react';
import {
  Brain,
  Edit,
  Loader2,
  Power,
  PowerOff,
  Star,
  Trash2,
  Zap,
  Sparkles,
} from 'lucide-react';
import { type SaLlmConfigItem } from '../../api/superadminLlmConfigApi';

export interface LlmConfigTableProps {
  items: SaLlmConfigItem[];
  busyId: string | null;
  onEdit: (item: SaLlmConfigItem) => void;
  onToggleEnabled: (item: SaLlmConfigItem, enabled: boolean) => void;
  onToggleThinking: (item: SaLlmConfigItem, mode: SaLlmConfigItem['thinkingMode']) => void;
  onSetDefault: (item: SaLlmConfigItem) => void;
  onDelete: (item: SaLlmConfigItem) => void;
}

const iconSize = 14;

function thinkingModeLabel(mode: SaLlmConfigItem['thinkingMode']): string {
  if (mode === 'enabled') return '深度';
  if (mode === 'auto') return '自动';
  return '快速';
}

function thinkingModeNext(mode: SaLlmConfigItem['thinkingMode']): SaLlmConfigItem['thinkingMode'] {
  if (mode === 'enabled') return 'disabled';
  if (mode === 'auto') return 'enabled';
  return 'auto';
}

function Badge({
  children,
  color,
  bg,
  border,
  icon,
}: {
  children: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 11,
        border: `1px solid ${border}`,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </span>
  );
}

function IconButton({
  title,
  onClick,
  disabled,
  children,
  active,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        background: active ? 'var(--btn-mono-bg)' : 'var(--bg-tertiary)',
        color: active ? 'var(--btn-mono-text)' : 'var(--text-secondary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export const LlmConfigTable: React.FC<LlmConfigTableProps> = ({
  items,
  busyId,
  onEdit,
  onToggleEnabled,
  onToggleThinking,
  onSetDefault,
  onDelete,
}) => {
  return (
    <div
      className="superadmin-llm-config-table-wrap"
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        background: 'var(--bg-card)',
        overflow: 'auto',
      }}
    >
      <table className="superadmin-llm-config-table" style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', width: 90 }}>状态</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', minWidth: 220 }}>名称</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', width: 110 }}>API Key</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', width: 90 }}>思考模式</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', width: 150 }}>参数</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', minWidth: 220 }}>Base URL</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', width: 140 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const disabled = item.enabled === false;
            const canEdit = !disabled;
            const canSetDefault = !disabled && item.hasApiKey;
            const canDisable = !disabled && !item.isDefault && !item.protectedSystem;
            const canDelete = !disabled && !item.isDefault && !item.protectedSystem;
            const nextThinking = thinkingModeNext(item.thinkingMode || 'auto');
            const thinkingColor = item.thinkingMode === 'enabled'
              ? 'var(--info)'
              : item.thinkingMode === 'auto'
                ? 'var(--warning)'
                : 'var(--text-muted)';
            const thinkingBg = item.thinkingMode === 'enabled'
              ? 'var(--info-bg-soft)'
              : item.thinkingMode === 'auto'
                ? 'var(--warning-bg-soft)'
                : 'var(--bg-tertiary)';
            const thinkingBorder = item.thinkingMode === 'enabled'
              ? 'var(--info-border-soft)'
              : item.thinkingMode === 'auto'
                ? 'var(--warning-border-soft)'
                : 'var(--border-subtle)';

            return (
              <tr
                key={item.id}
                className="superadmin-llm-config-row"
                data-testid={`superadmin-llm-config-row-${item.id}`}
                style={{
                  background: index % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-tertiary)',
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <td style={{ padding: '10px 16px' }}>
                  {item.isDefault && !disabled ? (
                    <Badge color="var(--success)" bg="var(--success-bg-soft)" border="var(--success-border-soft)" icon={<Star size={10} />}>
                      主对话
                    </Badge>
                  ) : disabled ? (
                    <Badge color="var(--text-muted)" bg="var(--bg-tertiary)" border="var(--border-subtle)" icon={<PowerOff size={10} />}>
                      停用
                    </Badge>
                  ) : (
                    <Badge color="var(--success)" bg="var(--success-bg-soft)" border="var(--success-border-soft)" icon={<Power size={10} />}>
                      已启用
                    </Badge>
                  )}
                  {item.protectedSystem && (
                    <div style={{ marginTop: 4 }}>
                      <Badge color="var(--info)" bg="var(--info-bg-soft)" border="var(--info-border-soft)">系统</Badge>
                    </div>
                  )}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontWeight: 600, color: disabled ? 'var(--text-muted)' : 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {item.provider} / {item.model}
                  </div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {item.hasApiKey ? (
                    <Badge color="var(--success)" bg="var(--success-bg-soft)" border="var(--success-border-soft)">
                      {item.maskedApiKey ?? '已配置'}
                    </Badge>
                  ) : (
                    <Badge color="var(--warning)" bg="var(--warning-bg-soft)" border="var(--warning-border-soft)">未配置</Badge>
                  )}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <Badge color={thinkingColor} bg={thinkingBg} border={thinkingBorder} icon={
                    item.thinkingMode === 'enabled' ? <Brain size={10} /> : item.thinkingMode === 'disabled' ? <Zap size={10} /> : <Sparkles size={10} />
                  }>
                    {thinkingModeLabel(item.thinkingMode || 'auto')}
                  </Badge>
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>
                  <div>temp {item.temperature ?? 0.7} · max {item.maxTokens ?? 20000}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>stream {item.streamMode || 'full'}</div>
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: 11, wordBreak: 'break-all' }}>
                  {item.baseUrl || '默认'}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <IconButton
                      title={disabled ? '启用配置' : canDisable ? '停用配置' : '默认/系统配置不可停用'}
                      onClick={() => onToggleEnabled(item, disabled)}
                      disabled={busyId === item.id || (!disabled && !canDisable)}
                    >
                      {busyId === item.id ? <Loader2 size={iconSize} /> : disabled ? <PowerOff size={iconSize} /> : <Power size={iconSize} />}
                    </IconButton>
                    <IconButton title="编辑" onClick={() => onEdit(item)} disabled={busyId === item.id || !canEdit}>
                      {busyId === item.id ? <Loader2 size={iconSize} /> : <Edit size={iconSize} />}
                    </IconButton>
                    <IconButton
                      title={`切换思考模式：当前 ${thinkingModeLabel(item.thinkingMode || 'auto')}，点击切换为 ${thinkingModeLabel(nextThinking)}`}
                      onClick={() => onToggleThinking(item, nextThinking)}
                      disabled={busyId === item.id || !canEdit}
                    >
                      {busyId === item.id ? <Loader2 size={iconSize} /> : item.thinkingMode === 'enabled' ? <Brain size={iconSize} /> : item.thinkingMode === 'disabled' ? <Zap size={iconSize} /> : <Sparkles size={iconSize} />}
                    </IconButton>
                    <IconButton
                      title={disabled ? '已停用配置不能设为主对话模型' : !item.hasApiKey ? '请先配置 API Key' : '设为主对话模型'}
                      onClick={() => onSetDefault(item)}
                      disabled={busyId === item.id || !canSetDefault || item.isDefault}
                      active={item.isDefault}
                    >
                      {busyId === item.id ? <Loader2 size={iconSize} /> : <Star size={iconSize} />}
                    </IconButton>
                    <IconButton
                      title={!canDelete ? (disabled ? '已停用配置不能删除' : '默认/系统配置不能删除') : '删除'}
                      onClick={() => onDelete(item)}
                      disabled={busyId === item.id || !canDelete}
                    >
                      {busyId === item.id ? <Loader2 size={iconSize} /> : <Trash2 size={iconSize} />}
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LlmConfigTable;
