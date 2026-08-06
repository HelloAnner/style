/**
 * ThemeProvider - 应用主题上下文
 *
 * 当前产品临时固定亮色主题。保留 setTheme/toggleTheme API 以兼容调用方，
 * 但运行态统一归一到 light，避免历史 localStorage 暗色偏好继续生效。
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
const FIXED_THEME: Theme = 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  storageKey = 'corevo-theme',
}) => {
  const [theme, setThemeState] = useState<Theme>(FIXED_THEME);

  const applyFixedTheme = () => {
    setThemeState(FIXED_THEME);
    localStorage.setItem(storageKey, FIXED_THEME);
    document.documentElement.setAttribute('data-theme', FIXED_THEME);
  };

  useEffect(() => {
    applyFixedTheme();
  }, [storageKey]);

  const setTheme = (_newTheme: Theme) => {
    applyFixedTheme();
  };

  const toggleTheme = () => {
    applyFixedTheme();
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeProvider;
