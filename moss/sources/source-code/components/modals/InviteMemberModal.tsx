/**
 * 邀请成员弹窗。
 *
 * 业务含义：
 * - 承载工作区成员邀请入口，支持"邮件邀请"与"公开链接"两种模式；
 * - 负责公开链接启停、链接复制与邮件邀请提交；
 * - 不负责展示历史邀请列表与成员管理，这些由成员管理列表页承担。
 *
 * 关键逻辑来源（V1 搬运）：
 * - 整体逻辑：src/components/tenant/InviteModal.tsx
 * - API：platformTenantInviteApi.createEmailInvites / createInviteLink / getInviteLinks / revokeInviteLink
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { type InviteLink, platformTenantInviteApi } from '../../api/platformTenantInvite';
import { TenantErrorCodes as TC, getErrorCode } from '../../api/errorCodes';
import { track } from '../../utils/track';
import { toast } from '../../utils/toast';

const DEFAULT_EMAIL_EXPIRE_DAYS = 7;
const DEFAULT_LINK_EXPIRE_DAYS = 7;
// CAS 单点登录过渡期：邮件邀请能力保留代码与接口，仅临时不展示前端入口。
const SHOW_EMAIL_INVITE_TAB = false;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const INVALID_EMAIL_FORMAT_RESULT_CODE = 'INVALID_EMAIL_FORMAT';

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fallback
    }
  }
  if (typeof document === 'undefined') throw new Error('clipboard unavailable');
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(textarea);
  textarea.select();
  const copied =
    typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
  document.body.removeChild(textarea);
  if (!copied) throw new Error('copy failed');
}

function parseEmails(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,\s]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeSingleEmail(value: string): string {
  return value.trim().toLowerCase();
}

function resolveInviteEmailErrorText(
  failedResults: Array<{ email: string; errorCode?: string }>
): string {
  const hasInvalidFormat = failedResults.some(
    (r) => r.errorCode === INVALID_EMAIL_FORMAT_RESULT_CODE
  );
  if (hasInvalidFormat) return '邮箱格式不正确';

  const cooldownCount = failedResults.filter(
    (r) => r.errorCode === TC.EMAIL_INVITE_COOLDOWN
  ).length;
  if (cooldownCount > 0 && cooldownCount === failedResults.length) {
    return '该邮箱已在冷却期内，请稍后再试';
  }
  return '部分邀请发送失败，请检查后重试';
}

// ── 图标 ──

const CloseIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CopyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── 开关组件 ──

const Toggle: React.FC<{
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}> = ({ checked, disabled, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    style={{
      width: '36px',
      height: '20px',
      borderRadius: '10px',
      border: 'none',
      background: checked ? 'var(--btn-mono-bg)' : 'var(--border-default)',
      position: 'relative',
      cursor: disabled ? 'not-allowed' : 'pointer',
      flexShrink: 0,
      transition: 'background 0.15s',
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: '2px',
        left: checked ? '18px' : '2px',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: checked ? 'var(--btn-mono-text)' : 'var(--bg-secondary)',
        transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}
    />
  </button>
);

// ── Props ──

interface InviteMemberModalProps {
  isOpen: boolean;
  tenantId: string;
  onClose: () => void;
}

// ── 主组件 ──

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  tenantId,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'email' | 'link'>(
    SHOW_EMAIL_INVITE_TAB ? 'email' : 'link'
  );
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copyId, setCopyId] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    const result = await platformTenantInviteApi.getInviteLinks(tenantId);
    setLinks(result);
  }, [tenantId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    try {
      await loadLinks();
    } catch (error: unknown) {
      const code = getErrorCode(error);
      if (code === TC.TENANT_FORBIDDEN) {
        setErrorText('无权限访问此工作区');
      } else if (code === TC.PERMISSION_DENIED) {
        setErrorText('权限不足，无法执行此操作');
      } else {
        setErrorText('加载邀请信息失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  }, [loadLinks]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(SHOW_EMAIL_INVITE_TAB ? 'email' : 'link');
    setEmailInput('');
    setErrorText(null);
    void loadData();
  }, [loadData, isOpen]);

  useEffect(() => {
    if (!copyId) return;
    const timer = window.setTimeout(() => setCopyId(null), 1400);
    return () => window.clearTimeout(timer);
  }, [copyId]);

  const activeLink = useMemo(() => links.find((item) => item.status === 'active') ?? null, [links]);
  const emailPreviewList = useMemo(() => parseEmails(emailInput), [emailInput]);

  const handleTogglePublicInvite = useCallback(
    async (enabled: boolean) => {
      if (enabled === Boolean(activeLink)) return;
      setActionKey('toggle-link');
      setErrorText(null);
      try {
        if (enabled) {
          await platformTenantInviteApi.createInviteLink(tenantId, {
            expiresInDays: DEFAULT_LINK_EXPIRE_DAYS,
          });
        } else if (activeLink) {
          await platformTenantInviteApi.revokeInviteLink(tenantId, activeLink.id);
        }
        await loadLinks();
      } catch {
        setErrorText('操作失败，请重试');
      } finally {
        setActionKey(null);
      }
    },
    [activeLink, loadLinks, tenantId]
  );

  const handleCopyLink = useCallback(async () => {
    track('space_invite_copy');
    if (!activeLink) return;
    try {
      const fullUrl = activeLink.url || `${window.location.origin}${activeLink.path}`;
      await copyText(fullUrl);
      setCopyId(activeLink.id);
    } catch {
      setErrorText('复制失败，请手动复制');
    }
  }, [activeLink]);

  const handleSendEmails = useCallback(async () => {
    const trimmedInput = emailInput.trim();
    if (!trimmedInput) {
      setErrorText('请输入邮箱地址');
      return;
    }
    if (emailPreviewList.length > 1) {
      setErrorText('每次只能邀请一个邮箱');
      return;
    }
    const email = normalizeSingleEmail(trimmedInput);
    if (!isValidEmail(email)) {
      setErrorText('邮箱格式不正确');
      return;
    }
    setActionKey('send-email');
    setErrorText(null);
    try {
      const response = await platformTenantInviteApi.createEmailInvites(tenantId, {
        emails: [email],
        expiresInDays: DEFAULT_EMAIL_EXPIRE_DAYS,
      });
      const failedResults = response.results.filter((r) => !r.success);
      if (failedResults.length > 0 || response.summary.failed > 0) {
        if (failedResults.length > 0) {
          setEmailInput(failedResults.map((r) => r.email).join('\n'));
        }
        setErrorText(resolveInviteEmailErrorText(failedResults));
        return;
      }
      setEmailInput('');
      toast.success(`邀请已发送至 ${email}`);
    } catch {
      setErrorText('发送失败，请重试');
    } finally {
      setActionKey(null);
    }
  }, [emailInput, emailPreviewList, tenantId]);

  if (!isOpen) return null;

  const publicInviteEnabled = Boolean(activeLink);
  const publicInviteUrl = activeLink
    ? activeLink.url || `${window.location.origin}${activeLink.path}`
    : '';

  const modalContent = (
    <div
      data-testid="invite-member-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        data-testid="invite-member-modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary, #fff)',
          borderRadius: '12px',
          width: '480px',
          maxWidth: '92vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="邀请成员"
      >
        {/* 标题栏 */}
        <div
          data-testid="invite-member-modal-tabs"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, #f4f4f5)',
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #18181b)' }}>
            邀请成员
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #71717a)',
              padding: '4px',
            }}
            aria-label="关闭"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Tab 导航 */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle, #f4f4f5)',
            padding: '0 20px',
          }}
        >
          {((SHOW_EMAIL_INVITE_TAB ? ['email', 'link'] : ['link']) as Array<'email' | 'link'>).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setErrorText(null);
              }}
              style={{
                padding: '10px 0',
                marginRight: '20px',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab ? 'var(--text-primary)' : 'transparent'}`,
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab ? 600 : 400,
                color:
                  activeTab === tab
                    ? 'var(--text-primary, #18181b)'
                    : 'var(--text-secondary, #71717a)',
              }}
            >
              {tab === 'email' ? '邮件邀请' : '公开链接'}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div data-testid="invite-member-modal-content" style={{ padding: '20px' }}>
          {errorText && (
            <div
              style={{
                marginBottom: '12px',
                padding: '8px 12px',
                background: 'var(--danger-bg-soft)',
                border: '1px solid var(--danger-border-soft)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--danger)',
              }}
            >
              {errorText}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary, #71717a)', padding: '12px 0', fontSize: '13px' }}>
              加载中...
            </div>
          )}

          {/* 邮件邀请 */}
          {!loading && activeTab === 'email' && (
            <div data-testid="invite-member-modal-email-tab" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label
                  htmlFor="invite-email-input"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    color: 'var(--text-secondary, #71717a)',
                    marginBottom: '6px',
                  }}
                >
                  邮箱地址
                </label>
                <input
                  id="invite-email-input"
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (errorText) setErrorText(null);
                  }}
                  placeholder="请输入被邀请人的邮箱地址"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border-default, #e4e4e7)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: 'var(--bg-primary, #fff)',
                    color: 'var(--text-primary, #18181b)',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary, #71717a)' }}>
                  角色
                </label>
                <div
                  style={{
                    marginTop: '6px',
                    padding: '8px 12px',
                    border: '1px solid var(--border-default, #e4e4e7)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: 'var(--text-secondary, #71717a)',
                    background: 'var(--bg-secondary, #fafafa)',
                  }}
                >
                  成员
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={loading || actionKey === 'send-email'}
                  onClick={() => void handleSendEmails()}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background:
                      loading || actionKey === 'send-email' ? 'var(--btn-mono-disabled-bg)' : 'var(--btn-mono-bg)',
                    color: loading || actionKey === 'send-email' ? 'var(--btn-mono-disabled-text)' : 'var(--btn-mono-text)',
                    fontSize: '14px',
                    cursor: loading || actionKey === 'send-email' ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {actionKey === 'send-email' ? '发送中...' : '发送邀请'}
                </button>
              </div>
            </div>
          )}

          {/* 公开链接 */}
          {!loading && activeTab === 'link' && (
            <div data-testid="invite-member-modal-link-tab" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 开关行 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary, #18181b)' }}>
                    公开邀请链接
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary, #71717a)', marginTop: '2px' }}>
                    {publicInviteEnabled
                      ? '任何人通过此链接可申请加入工作区'
                      : '关闭后任何人无法通过链接加入工作区'}
                  </div>
                </div>
                <Toggle
                  checked={publicInviteEnabled}
                  disabled={actionKey === 'toggle-link'}
                  onChange={(v) => void handleTogglePublicInvite(v)}
                />
              </div>

              <div style={{ height: '1px', background: 'var(--border-subtle, #f0f0f0)' }} />

              {/* 链接展示 */}
              {publicInviteEnabled ? (
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary, #71717a)', display: 'block', marginBottom: '6px' }}>
                    邀请链接
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      readOnly
                      value={publicInviteUrl}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid var(--border-default, #e4e4e7)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: 'var(--text-secondary, #71717a)',
                        background: 'var(--bg-secondary, #fafafa)',
                        outline: 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleCopyLink()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px 14px',
                        border: '1px solid var(--border-default, #e4e4e7)',
                        borderRadius: '6px',
                        background: 'var(--bg-primary, #fff)',
                        color: 'var(--text-secondary, #71717a)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {copyId === activeLink?.id ? <CheckIcon /> : <CopyIcon />}
                      {copyId === activeLink?.id ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: 'var(--text-secondary, #71717a)',
                    fontSize: '13px',
                    background: 'var(--bg-secondary, #fafafa)',
                    borderRadius: '8px',
                  }}
                >
                  开启后将生成可分享的邀请链接
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
