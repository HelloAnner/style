import { useState } from 'react';
import type { ReactNode } from 'react';

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent;
  const isClassicMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isIpadDesktopUa = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  if (isClassicMobileUa || isIpadDesktopUa) return true;

  if (window.innerWidth > 960 || typeof window.matchMedia !== 'function') return false;

  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(any-pointer: coarse)').matches;
  const hasHoverCapability = window.matchMedia('(hover: hover)').matches
    || window.matchMedia('(any-hover: hover)').matches;

  return hasCoarsePointer && !hasHoverCapability;
}

export function isSessionFilePreviewRoute(pathname: string, search: string): boolean {
  return /^\/s\/[^/]+\/?$/.test(pathname)
    && new URLSearchParams(search).get('preview') === 'session-file';
}

export function isFileShareRoute(pathname: string): boolean {
  return /^\/file\/[^/]+\/?$/.test(pathname);
}

export function isSessionShareRoute(pathname: string): boolean {
  return /^\/share\/[^/]+\/?$/.test(pathname);
}

function normalizePathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function isAuthBridgeRoute(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return normalized === '/login'
    || normalized === '/login/cas'
    || normalized === '/login/feishu'
    || normalized === '/auth/callback';
}

function internalUrlFromRedirect(value: string): URL | null {
  const candidates = [value];
  let current = value;
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      candidates.push(decoded);
      current = decoded;
    } catch {
      break;
    }
  }

  for (const candidate of candidates) {
    if (candidate.startsWith('/') && !candidate.startsWith('//')) {
      return new URL(candidate, window.location.origin);
    }
    try {
      const url = new URL(candidate);
      if (url.origin === window.location.origin) {
        return url;
      }
    } catch {
      // ignore invalid redirect candidate
    }
  }
  return null;
}

function isSessionFilePreviewRedirectValue(value: string | null, depth = 0): boolean {
  if (!value || depth > 2) {
    return false;
  }
  const redirectUrl = internalUrlFromRedirect(value);
  if (!redirectUrl) {
    return false;
  }
  if (
    isSessionFilePreviewRoute(redirectUrl.pathname, redirectUrl.search)
    || isFileShareRoute(redirectUrl.pathname)
    || isSessionShareRoute(redirectUrl.pathname)
  ) {
    return true;
  }
  if (!isAuthBridgeRoute(redirectUrl.pathname)) {
    return false;
  }
  return isSessionFilePreviewRedirectValue(redirectUrl.searchParams.get('redirect'), depth + 1);
}

export function isSessionFilePreviewAccessRoute(pathname: string, search: string): boolean {
  if (isSessionFilePreviewRoute(pathname, search) || isFileShareRoute(pathname) || isSessionShareRoute(pathname)) {
    return true;
  }
  if (isAuthBridgeRoute(pathname)) {
    return isSessionFilePreviewRedirectValue(new URLSearchParams(search).get('redirect'));
  }
  return false;
}

function MobileUnsupportedPage() {
  const [copyText, setCopyText] = useState('复制链接到 PC 端打开');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyText('已复制');
      setTimeout(() => setCopyText('复制链接到 PC 端打开'), 2000);
    } catch {
      setCopyText('复制失败');
      setTimeout(() => setCopyText('复制链接到 PC 端打开'), 2000);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '24px', background: 'var(--bg-primary)',
      textAlign: 'center',
    }}>
      <div style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '12px',
        background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
        marginBottom: '16px',
      }}>
        限 PC 端
      </div>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px', color: 'var(--text-primary)' }}>
        请在电脑上访问
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 32px', lineHeight: 1.6 }}>
        为确保最佳体验，请在 PC 浏览器中打开本页面
      </p>
      <button
        onClick={handleCopy}
        style={{
          padding: '10px 24px', borderRadius: '8px', border: 'none',
          background: 'var(--btn-mono-bg)', color: 'var(--btn-mono-text)', fontSize: '14px', fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {copyText}
      </button>
    </div>
  );
}

export function MobileUnsupportedGuard({ children }: { children: ReactNode }) {
  if (isMobileDevice() && !isSessionFilePreviewAccessRoute(window.location.pathname, window.location.search)) {
    return <MobileUnsupportedPage />;
  }
  return <>{children}</>;
}
