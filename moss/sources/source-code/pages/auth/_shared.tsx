/**
 * 认证页面共享：色板、校验工具、图标、通用组件、卡片壳
 *
 * 工作区 onboarding 等认证相关页面共用的元素都放这里。
 * 改主题色或调通用 UI 时只改这一处。
 *
 * 注意：本文件仅服务于 pages/auth/ 下的几个固定亮色主题页面。工作台内的设置弹窗
 * 等使用 globals.css 中的 CSS 变量，不要消费本文件的 C 色板。
 */

import React from 'react';
import { AccountErrorCodes, getErrorCode } from '../../api/errorCodes';

// ========== 色板（与 docs/frontend-platform/prototype/auth-flow.html 对齐） ==========

export const C = {
  bgPage: '#FAF9F7',
  bgCard: '#FFFFFF',
  bgTertiary: '#F5F4F2',
  textPrimary: '#1A1A1A',
  textSecondary: '#3A3A3A',
  textTertiary: '#5A5A5A',
  textMuted: '#7A7A7A',
  textPlaceholder: '#9A9A9A',
  borderSubtle: 'rgba(0, 0, 0, 0.06)',
  inputBorder: '#E4E4E7',
  inputBg: '#FFFFFF',
  inputErrorBorder: '#fca5a5',
  inputErrorBg: '#fef2f2',
  hoverBg: 'rgba(0, 0, 0, 0.04)',
  btnBg: '#18181B',
  btnHover: '#27272A',
  error: '#dc2626',
  errorBg: '#fef2f2',
  errorBorder: '#fecaca',
  success: '#16a34a',
  successBg: '#f0fdf4',
  logoRing: '#27272A',
  logoCore: '#18181B',
  logoAccent: '#3F3F46',
  logoText: '#18181B',
  pwWeak: '#f87171',
  pwMid: '#fbbf24',
  pwStrong: '#22c55e',
  shadowCard: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
};

// ========== 校验工具 ==========
//
// 与 V1 fineinsight `frontend/src/pages/auth/ForgotPassword.tsx` 对齐：
// - 严格手机号正则（11 位且第二位 3-9）
// - 自动 normalize：去 +86 / 86 前缀、空格、连字符、邮箱小写
// 调用方应使用 resolveIdentity() 拿到 normalized 后的值再发给后端，
// 避免后端因为大小写或前缀差异校验失败。

export const PHONE_RE = /^1[3-9]\d{9}$/;
export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export type IdentityType = 'PHONE' | 'EMAIL';

function normalizePhone(value: string): string {
  const compact = value.replace(/[\s-]/g, '');
  if (compact.startsWith('+86')) return compact.slice(3);
  if (compact.startsWith('86') && compact.length === 13) return compact.slice(2);
  return compact;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function inferIdentityType(value: string): IdentityType {
  return value.includes('@') ? 'EMAIL' : 'PHONE';
}

/**
 * 解析用户输入的账号 → 推断类型 + normalize + 校验。
 *
 * 返回 `error` 非空表示前端校验未通过；调用方应展示该错误，不要发请求。
 * 否则使用 `identity`（normalized 后的）与 `identityType` 调后端。
 */
export function resolveIdentity(value: string): {
  identityType: IdentityType;
  identity: string;
  error: string | null;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { identityType: 'PHONE', identity: '', error: '请输入手机号或邮箱' };
  }
  const identityType = inferIdentityType(trimmed);
  if (identityType === 'EMAIL') {
    const email = normalizeEmail(trimmed);
    return {
      identityType,
      identity: email,
      error: EMAIL_RE.test(email) ? null : '请输入有效的邮箱地址',
    };
  }
  const phone = normalizePhone(trimmed);
  return {
    identityType,
    identity: phone,
    error: PHONE_RE.test(phone) ? null : '请输入有效的手机号',
  };
}

/**
 * 仅判断类型是否能识别，不返回 normalized 结果。
 * 旧代码的兼容入口；新代码请用 resolveIdentity。
 */
export function detectIdentityType(value: string): IdentityType | null {
  const resolved = resolveIdentity(value);
  return resolved.error ? null : resolved.identityType;
}

export function isValidPassword(v: string): boolean {
  return v.length >= 8 && /[a-zA-Z]/.test(v) && /[0-9]/.test(v);
}

export function getPasswordStrength(v: string): 0 | 1 | 2 | 3 {
  if (!v) return 0;
  const hasLetter = /[a-zA-Z]/.test(v);
  const hasNum = /[0-9]/.test(v);
  const hasSpecial = /[^a-zA-Z0-9]/.test(v);
  const score =
    (v.length >= 8 ? 1 : 0) +
    (hasLetter ? 1 : 0) +
    (hasNum ? 1 : 0) +
    (hasSpecial ? 1 : 0) +
    (v.length >= 12 ? 1 : 0);
  if (score <= 2) return 1;
  if (score <= 3) return 2;
  return 3;
}

export { sanitizeRedirect } from '../../utils/authNavigation';

export function normalizeWorkspaceRole(
  role?: string | null,
): 'owner' | 'admin' | 'member' | undefined {
  if (!role) return undefined;
  const normalized = role.trim().toLowerCase();
  if (normalized === 'owner' || normalized === 'admin' || normalized === 'member') {
    return normalized;
  }
  return undefined;
}

// ========== 错误码映射 ==========
//
// 与 V1 fineinsight `pages/auth/Login.tsx` / `Register.tsx` / `ForgotPassword.tsx`
// 中的 mapError 函数对齐。V1 用 i18next 返回 zh_CN key，corevo-platform 暂无 i18n
// 直接返回中文字面量。中文文案对照 V1 lang/zh_CN.json 的 auth.* 翻译。

/**
 * 把后端错误对象映射成用户可读的中文提示。
 *
 * @param error    fetch / API 调用抛出的错误对象（platformAuth.ts 把 code 挂在 Error 上）
 * @param fallback 没有匹配错误码时的兜底文案
 * @param options.identityType 用于消歧 IDENTITY_NOT_REGISTERED 的提示（手机号 vs 邮箱）
 */
export function mapAuthError(
  error: unknown,
  fallback: string,
  options?: { identityType?: IdentityType },
): string {
  const code = getErrorCode(error);
  if (!code) {
    // 没有错误码：优先用 Error.message，最后兜底
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
  switch (code) {
    case AccountErrorCodes.INVALID_CREDENTIALS:
      return '账号或密码错误';
    case AccountErrorCodes.ACCOUNT_DISABLED:
      return '账号已被禁用';
    case AccountErrorCodes.LOGIN_TEMPORARILY_LOCKED:
      return '尝试次数过多，账号已临时锁定，请稍后再试';
    case AccountErrorCodes.IDENTITY_NOT_REGISTERED:
      return options?.identityType === 'EMAIL' ? '该邮箱未注册' : '该手机号未注册';
    case AccountErrorCodes.PHONE_ALREADY_REGISTERED:
    case AccountErrorCodes.EMAIL_ALREADY_REGISTERED:
      return '该账号已被注册';
    case AccountErrorCodes.IDENTITY_ALREADY_BOUND:
      return '该账号已被绑定到其他用户';
    case AccountErrorCodes.INVALID_PHONE_FORMAT:
      return '手机号格式不正确';
    case AccountErrorCodes.INVALID_EMAIL_FORMAT:
      return '邮箱格式不正确';
    case AccountErrorCodes.PASSWORD_MISMATCH:
      return '两次输入的密码不一致';
    case AccountErrorCodes.WEAK_PASSWORD:
      return '密码须包含字母和数字，且不少于 8 位';
    case AccountErrorCodes.CODE_TOO_FREQUENT:
      return '发送过于频繁，请稍后重试';
    case AccountErrorCodes.CODE_INVALID:
      return '验证码错误或已过期';
    case AccountErrorCodes.CODE_DELIVERY_FAILED:
      return '验证码发送失败，请稍后重试';
    case AccountErrorCodes.CHANNEL_NOT_CONFIGURED:
      return '通知服务未配置完成，请联系管理员';
    case AccountErrorCodes.TOO_MANY_REQUESTS:
      return '请求过于频繁，请稍后重试';
    case AccountErrorCodes.AUTH_TOKEN_INVALID:
    case AccountErrorCodes.AUTH_PASSWORD_CHANGED:
    case AccountErrorCodes.AUTH_SESSION_INVALIDATED:
    case AccountErrorCodes.REFRESH_TOKEN_EXPIRED:
      return '登录已过期，请重新登录';
    case AccountErrorCodes.INSTANCE_DRAINING:
      return '服务正在维护，请稍后重试';
    default:
      if (error instanceof Error && error.message) return error.message;
      return fallback;
  }
}

// ========== 图标 ==========

export const UserIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const MailIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

export const LockIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

export const EyeIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export const CodeIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M12 8v4l3 3" />
  </svg>
);

export const CheckCircleIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22,4 12,14.01 9,11.01" />
  </svg>
);

export const AlertIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export const ErrorBannerIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export const ArrowLeftIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

// ========== 通用组件 ==========

export const CorevoLogo: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
    <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
      <div style={{ position: 'absolute', width: 28, height: 28, top: 2, left: 2, borderRadius: '50%', border: `2px solid ${C.logoRing}` }} />
      <div style={{ position: 'absolute', width: 12, height: 12, top: 10, left: 10, borderRadius: '50%', background: C.logoCore }} />
      <div style={{ position: 'absolute', width: 5, height: 5, top: 5, right: 3, borderRadius: '50%', background: C.logoAccent }} />
    </div>
    <span style={{ fontSize: 18, fontWeight: 600, color: C.logoText }}>Moss</span>
  </div>
);

export const FormField: React.FC<{
  label: string;
  error?: string | null;
  rightLink?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, error, rightLink, children }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary }}>{label}</label>
      {rightLink}
    </div>
    {children}
    {error && (
      <div style={{ fontSize: 12, color: C.error, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertIcon />
        <span>{error}</span>
      </div>
    )}
  </div>
);

export const InputWrap: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
    <div
      style={{
        position: 'absolute',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        color: C.textPlaceholder,
        pointerEvents: 'none',
        zIndex: 1,
        display: 'flex',
      }}
    >
      {icon}
    </div>
    {children}
  </div>
);

export const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '10px 12px 10px 38px',
  border: `1px solid ${hasError ? C.inputErrorBorder : C.inputBorder}`,
  borderRadius: 8,
  fontSize: 13,
  color: C.textPrimary,
  background: hasError ? C.inputErrorBg : C.inputBg,
  outline: 'none',
  transition: 'all 0.15s',
});

export const Divider: React.FC<{ label?: string }> = ({ label = '或者' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
    <div style={{ flex: 1, height: 1, background: C.borderSubtle }} />
    <span style={{ fontSize: 12, color: C.textPlaceholder }}>{label}</span>
    <div style={{ flex: 1, height: 1, background: C.borderSubtle }} />
  </div>
);

// ========== 卡片壳（背景装饰 + 居中卡片） ==========

export const AuthCardLayout: React.FC<{ children: React.ReactNode; testId?: string; cardTestId?: string }> = ({ children, testId, cardTestId }) => (
  <div
    data-testid={testId}
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      background: C.bgPage,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: 'relative',
    }}
  >
    {/* 背景装饰 */}
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          filter: 'blur(80px)',
          opacity: 0.35,
          background: 'rgba(0,0,0,0.03)',
          top: -100,
          right: -50,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          filter: 'blur(80px)',
          opacity: 0.35,
          background: 'rgba(0,0,0,0.02)',
          bottom: -80,
          left: -60,
        }}
      />
    </div>

    <div
      data-testid={cardTestId}
      style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 420,
        background: C.bgCard,
        borderRadius: 16,
        border: `1px solid ${C.borderSubtle}`,
        boxShadow: C.shadowCard,
        padding: '36px 32px',
      }}
    >
      {children}
    </div>
  </div>
);

// ========== 错误 Banner（顶部红色横条） ==========

export const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      padding: '10px 14px',
      borderRadius: 8,
      background: C.errorBg,
      border: `1px solid ${C.errorBorder}`,
      color: C.error,
      fontSize: 12,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}
  >
    <ErrorBannerIcon />
    <span>{message}</span>
  </div>
);

// ========== 主按钮（黑底白字） ==========

export const PrimarySubmitButton: React.FC<{
  loading: boolean;
  disabled?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}> = ({ loading, disabled, loadingText, children }) => (
  <button
    type="submit"
    disabled={loading || disabled}
    style={{
      width: '100%',
      padding: 11,
      background: C.btnBg,
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 500,
      cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
      marginTop: 4,
      opacity: (loading || disabled) ? 0.6 : 1,
      transition: 'background 0.12s',
    }}
    onMouseEnter={(e) => {
      if (!loading && !disabled) e.currentTarget.style.background = C.btnHover;
    }}
    onMouseLeave={(e) => {
      if (!loading && !disabled) e.currentTarget.style.background = C.btnBg;
    }}
  >
    {loading && loadingText ? loadingText : children}
  </button>
);
