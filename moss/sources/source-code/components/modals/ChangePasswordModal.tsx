import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { platformAuthApi } from '../../api/platformAuth';
import { AccountErrorCodes, getErrorCode } from '../../api/errorCodes';
import { useAuthStore } from '../../stores/authStore';

/**
 * 修改密码弹窗。
 *
 * 业务含义：
 * - 在个人设置弹窗中使用，独立弹窗覆盖层；
 * - 三个字段：旧密码 / 新密码 / 确认新密码，各自有显示/隐藏切换；
 * - 错误码精细映射（对应 V1 mapPasswordError）：
 *   INVALID_CREDENTIALS → 旧密码错误；WEAK_PASSWORD → 密码须包含字母和数字且不少于 8 位；
 * - "忘记密码"先 clearAuth 再跳转，防止返回时 Guard 自动跳回工作台；
 * - 提交中禁止关闭弹窗（与 V1 保持一致）。
 */

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function mapPasswordError(code: string | null): string {
  if (code === AccountErrorCodes.INVALID_CREDENTIALS) {
    return '旧密码错误';
  }
  if (code === AccountErrorCodes.WEAK_PASSWORD) {
    return '密码须包含字母和数字，且不少于 8 位';
  }
  return '修改密码失败，请重试';
}

const EyeIcon: React.FC<{ open: boolean }> = ({ open }) =>
  open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canSubmit =
    Boolean(oldPassword.trim()) &&
    Boolean(newPassword.trim()) &&
    Boolean(confirmPassword.trim()) &&
    !saving;

  const handleClose = () => {
    if (saving) return;
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorText(null);
    setShowOld(false);
    setShowNew(false);
    setShowConfirm(false);
    onClose();
  };

  const handleForgotPassword = () => {
    handleClose();
    navigate('/forgot-password', { replace: true });
    // 先跳转再清 token，避免 AuthGuard 在跳转前把用户截回 /login
    clearAuth();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    if (newPassword !== confirmPassword) {
      setErrorText('两次输入的密码不一致');
      return;
    }
    setSaving(true);
    try {
      await platformAuthApi.changePassword({ oldPassword, newPassword });
      handleClose();
    } catch (error: unknown) {
      setErrorText(mapPasswordError(getErrorCode(error)));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      data-testid="change-password-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        data-testid="change-password-modal-panel"
        style={{
          background: 'var(--bg-primary, #fff)',
          borderRadius: '12px',
          width: '400px',
          maxWidth: '90vw',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="修改密码"
      >
        {/* 标题 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #18181b)' }}>
            修改密码
          </span>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              color: 'var(--text-secondary, #71717a)',
              padding: '4px',
              lineHeight: 1,
              borderRadius: '6px',
              transition: 'all 0.12s',
            }}
            aria-label="关闭"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg, rgba(0,0,0,0.04))'; e.currentTarget.style.color = 'var(--text-primary, #18181b)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary, #71717a)'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form data-testid="change-password-modal-form" onSubmit={(e) => void handleSubmit(e)}>
          {/* 旧密码 */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="cp-old-password"
              style={{
                display: 'block',
                fontSize: '13px',
                color: 'var(--text-secondary, #71717a)',
                marginBottom: '6px',
              }}
            >
              当前密码
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="cp-old-password"
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={saving}
                placeholder="请输入当前密码"
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 12px',
                  border: '1px solid var(--border-default, #e4e4e7)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'var(--bg-primary, #fff)',
                  color: 'var(--text-primary, #18181b)',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowOld((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary, #a1a1aa)',
                  padding: '2px',
                }}
                aria-label={showOld ? '隐藏密码' : '显示密码'}
              >
                <EyeIcon open={showOld} />
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={saving}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--text-secondary, #71717a)',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                忘记密码？
              </button>
            </div>
          </div>

          {/* 新密码 */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="cp-new-password"
              style={{
                display: 'block',
                fontSize: '13px',
                color: 'var(--text-secondary, #71717a)',
                marginBottom: '6px',
              }}
            >
              新密码
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="cp-new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={saving}
                placeholder="至少 8 位，含字母和数字"
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 12px',
                  border: '1px solid var(--border-default, #e4e4e7)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'var(--bg-primary, #fff)',
                  color: 'var(--text-primary, #18181b)',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary, #a1a1aa)',
                  padding: '2px',
                }}
                aria-label={showNew ? '隐藏密码' : '显示密码'}
              >
                <EyeIcon open={showNew} />
              </button>
            </div>
          </div>

          {/* 确认新密码 */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="cp-confirm-password"
              style={{
                display: 'block',
                fontSize: '13px',
                color: 'var(--text-secondary, #71717a)',
                marginBottom: '6px',
              }}
            >
              确认新密码
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="cp-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={saving}
                placeholder="再次输入新密码"
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 12px',
                  border: '1px solid var(--border-default, #e4e4e7)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'var(--bg-primary, #fff)',
                  color: 'var(--text-primary, #18181b)',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary, #a1a1aa)',
                  padding: '2px',
                }}
                aria-label={showConfirm ? '隐藏密码' : '显示密码'}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {errorText && (
            <div
              style={{
                marginBottom: '16px',
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

          {/* 底部按钮 */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              style={{
                padding: '8px 16px',
                border: '1px solid var(--border-default, #e4e4e7)',
                borderRadius: '6px',
                background: 'var(--bg-primary, #fff)',
                color: 'var(--text-primary, #18181b)',
                fontSize: '14px',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg, rgba(0,0,0,0.04))'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-primary, #fff)'; }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: canSubmit ? 'var(--btn-mono-bg)' : 'var(--btn-mono-disabled-bg)',
                color: canSubmit ? 'var(--btn-mono-text)' : 'var(--btn-mono-disabled-text)',
                fontSize: '14px',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontWeight: 500,
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = 'var(--btn-mono-hover-bg)'; }}
              onMouseLeave={(e) => { if (canSubmit) e.currentTarget.style.background = 'var(--btn-mono-bg)'; }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
