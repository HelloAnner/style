import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  createLegacyStarMigrationTicket,
  getLegacyStarMigrationOldOrigin,
  LEGACY_STAR_MIGRATION_DONE_PARAM,
  LEGACY_STAR_MIGRATION_PATH,
  LEGACY_STAR_MIGRATION_STATIC_PATH,
  legacyStarMigrationAttemptKey,
} from '../../lib/legacyStarMigration';
import { useAuthStore } from '../../stores/authStore';

const attemptedInMemory = new Set<string>();
const pendingInMemory = new Set<string>();

function buildReturnUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set(LEGACY_STAR_MIGRATION_DONE_PARAM, 'done');
  return url.toString();
}

function buildLegacyMigrationUrl(oldOrigin: string, ticket: string, returnUrl: string): string {
  const url = new URL(LEGACY_STAR_MIGRATION_STATIC_PATH, oldOrigin);
  url.hash = new URLSearchParams({ ticket, returnUrl }).toString();
  return url.toString();
}

function readAttempted(key: string): boolean {
  if (pendingInMemory.has(key)) return true;
  if (attemptedInMemory.has(key)) return true;
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markAttempted(key: string): void {
  attemptedInMemory.add(key);
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // sessionStorage 不可用时用模块内存兜底，避免当前页面生命周期内重复跳转。
  }
}

/**
 * 新入口首次访问时，顶层跳到旧入口执行 localStorage 收藏迁移。
 */
export const LegacyStarMigrationRedirect: React.FC = () => {
  const location = useLocation();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const token = useAuthStore(state => state.token);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated || !token) return;

    const oldOrigin = getLegacyStarMigrationOldOrigin();
    if (!oldOrigin) return;
    if (window.location.origin === oldOrigin) return;
    if (window.location.pathname.startsWith('/auth/')) return;
    if (window.location.pathname.startsWith('/login')) return;
    if (window.location.pathname === LEGACY_STAR_MIGRATION_PATH) return;
    if (window.location.pathname === LEGACY_STAR_MIGRATION_STATIC_PATH) return;

    const legacyOrigin = oldOrigin;
    const attemptKey = legacyStarMigrationAttemptKey(oldOrigin);
    const params = new URLSearchParams(window.location.search);
    if (params.get(LEGACY_STAR_MIGRATION_DONE_PARAM) === 'done') {
      markAttempted(attemptKey);
      return;
    }
    if (readAttempted(attemptKey)) return;

    let cancelled = false;
    async function requestTicketAndRedirect() {
      pendingInMemory.add(attemptKey);
      try {
        const returnUrl = buildReturnUrl();
        const ticket = await createLegacyStarMigrationTicket(returnUrl);
        if (cancelled || !ticket?.ticket) return;
        markAttempted(attemptKey);
        window.location.replace(buildLegacyMigrationUrl(legacyOrigin, ticket.ticket, returnUrl));
      } catch (e) {
        console.error('旧收藏迁移凭证申请失败:', e);
      } finally {
        if (!cancelled) {
          pendingInMemory.delete(attemptKey);
        }
      }
    }

    void requestTicketAndRedirect();
    return () => {
      cancelled = true;
      pendingInMemory.delete(attemptKey);
    };
  }, [isAuthenticated, location.pathname, location.search, token]);

  return null;
};
