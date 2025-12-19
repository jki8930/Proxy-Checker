import { useThemeStore } from '../store/themeStore';

declare global {
  interface Window {
    electronAPI: {
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      parseProxies: (sources: string[], filters: object) => Promise<any[]>;
      checkProxies: (proxies: object[], options: object) => Promise<any[]>;
      stopChecking: () => Promise<boolean>;
      getProxies: (filters?: object) => Promise<any[]>;
      saveProxies: (proxies: object[]) => Promise<number>;
      deleteProxies: (ids: number[]) => Promise<boolean>;
      clearProxies: () => Promise<boolean>;
      exportProxies: (proxies: object[], format: string, filePath: string) => Promise<boolean>;
      selectExportPath: (format: string) => Promise<string | undefined>;
      selectImportFile: () => Promise<string | undefined>;
      importProxies: (filePath: string) => Promise<number>;
      getSettings: () => Promise<object>;
      saveSettings: (settings: object) => Promise<boolean>;
      onParseProgress: (callback: (progress: object) => void) => void;
      onCheckProgress: (callback: (progress: object) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

export default function TitleBar() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <div className="h-10 bg-gray-100 dark:bg-dark-card border-b border-gray-200 dark:border-dark-border flex items-center justify-between px-4 titlebar-drag">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
        <span className="font-semibold text-sm">Proxy Checker</span>
      </div>

      <div className="flex items-center gap-1 titlebar-no-drag">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-gray-200 dark:hover:bg-dark-hover rounded-md transition-colors"
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Window controls */}
        <button
          onClick={() => window.electronAPI.minimizeWindow()}
          className="p-2 hover:bg-gray-200 dark:hover:bg-dark-hover rounded-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.maximizeWindow()}
          className="p-2 hover:bg-gray-200 dark:hover:bg-dark-hover rounded-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.closeWindow()}
          className="p-2 hover:bg-red-500 hover:text-white rounded-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
