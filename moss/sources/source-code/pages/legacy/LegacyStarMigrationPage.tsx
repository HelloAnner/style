import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  importLegacyStarredSessionIds,
  LEGACY_STAR_MIGRATION_DONE_PARAM,
  readLegacyStarredSessionIds,
  removeLegacyStarredSessionIds,
} from '../../lib/legacyStarMigration';
import { WORKSPACE_HOME_PATH } from '../../utils/routes';

const HYDRATION_TIMEOUT_MS = 1000;
const RESTORE_TIMEOUT_MS = 3000;
const IMPORT_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then(resolve)
      .catch(() => resolve(fallback))
      .finally(() => window.clearTimeout(timer));
  });
}

function waitForAuthHydration(): Promise<void> {
  if (useAuthStore.persist.hasHydrated?.()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useAuthStore.persist.onFinishHydration?.(() => {
      unsubscribe?.();
      resolve();
    });
    if (!unsubscribe) resolve();
  });
}

function resolveReturnUrl(raw: string | null): string {
  if (!raw) return WORKSPACE_HOME_PATH;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return WORKSPACE_HOME_PATH;
    }
    url.searchParams.set(LEGACY_STAR_MIGRATION_DONE_PARAM, 'done');
    return url.toString();
  } catch {
    return WORKSPACE_HOME_PATH;
  }
}

/**
 * 旧入口迁移页：必须运行在旧 origin 下，才能读取旧 localStorage。
 */
const LegacyStarMigrationPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      const returnUrl = resolveReturnUrl(searchParams.get('returnUrl'));
      try {
        await withTimeout(waitForAuthHydration(), HYDRATION_TIMEOUT_MS, undefined);
        const legacyIds = readLegacyStarredSessionIds();
        if (legacyIds.length > 0) {
          const ok = await withTimeout(
            useAuthStore.getState().restoreSession(),
            RESTORE_TIMEOUT_MS,
            false,
          );
          if (ok) {
            const result = await withTimeout(
              importLegacyStarredSessionIds(legacyIds),
              IMPORT_TIMEOUT_MS,
              null,
            );
            const matchedIds = new Set(result?.matched_session_ids ?? []);
            removeLegacyStarredSessionIds(matchedIds);
          }
        }
      } catch (e) {
        console.error('旧收藏迁移失败:', e);
      } finally {
        if (!cancelled) {
          window.location.replace(returnUrl);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return null;
};

export default LegacyStarMigrationPage;
