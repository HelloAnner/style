import { useEffect, useState } from 'react';

export type ClientTheme = 'light' | 'dark';

function isClientTheme(value: string | null): value is ClientTheme {
  return value === 'light' || value === 'dark';
}

export function resolveClientTheme(): ClientTheme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (isClientTheme(attr)) return attr;
  }

  return 'light';
}

export function useClientTheme(): ClientTheme {
  const [theme, setTheme] = useState<ClientTheme>(() => resolveClientTheme());

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      setTheme(resolveClientTheme());
      return undefined;
    }

    const root = document.documentElement;
    const syncTheme = () => setTheme(resolveClientTheme());
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  return theme;
}
