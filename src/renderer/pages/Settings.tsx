import { useState, useEffect } from 'react';
import { useThemeStore } from '../store/themeStore';

interface Settings {
  threads: number;
  timeout: number;
  proxyForParsing: string;
  language: string;
}

export default function Settings() {
  const { theme, setTheme } = useThemeStore();
  const [settings, setSettings] = useState<Settings>({
    threads: 50,
    timeout: 10000,
    proxyForParsing: '',
    language: 'ru',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await window.electronAPI.getSettings() as Settings;
    setSettings(prev => ({ ...prev, ...data }));
  };

  const saveSettings = async () => {
    await window.electronAPI.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="animate-fadeIn max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Настройки</h1>

      <div className="space-y-6">
        {/* Appearance */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Внешний вид</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Тема</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex-1 py-3 px-4 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                    theme === 'light'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                      : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Светлая
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex-1 py-3 px-4 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                    theme === 'dark'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                      : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Тёмная
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Proxy for parsing */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Прокси для парсинга</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Используйте прокси если источники заблокированы в вашей стране
          </p>
          
          <input
            type="text"
            value={settings.proxyForParsing}
            onChange={(e) => updateSetting('proxyForParsing', e.target.value)}
            placeholder="http://user:pass@ip:port или socks5://ip:port"
            className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border rounded-lg"
          />
        </div>

        {/* Check settings */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Параметры проверки</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
                Количество потоков
              </label>
              <input
                type="number"
                value={settings.threads}
                onChange={(e) => updateSetting('threads', Number(e.target.value))}
                min={1}
                max={200}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border rounded-lg"
              />
              <p className="text-xs text-gray-400 mt-1">Рекомендуется: 50-100</p>
            </div>
            
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
                Таймаут (мс)
              </label>
              <input
                type="number"
                value={settings.timeout}
                onChange={(e) => updateSetting('timeout', Number(e.target.value))}
                min={1000}
                max={60000}
                step={1000}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border rounded-lg"
              />
              <p className="text-xs text-gray-400 mt-1">Рекомендуется: 10000</p>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-4">
          <button
            onClick={saveSettings}
            className="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors"
          >
            Сохранить настройки
          </button>
          
          {saved && (
            <span className="text-green-500 animate-fadeIn">Сохранено!</span>
          )}
        </div>

        {/* About */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">О программе</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Proxy Checker v1.0.0
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Приложение для парсинга и проверки прокси-серверов
          </p>
        </div>
      </div>
    </div>
  );
}
