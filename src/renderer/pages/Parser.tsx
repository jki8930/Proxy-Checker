import { useState, useEffect } from 'react';
import { useProxyStore } from '../store/proxyStore';

const SOURCES = [
  { name: 'Free Proxy List', description: 'free-proxy-list.net' },
  { name: 'SSL Proxies', description: 'sslproxies.org' },
  { name: 'Proxy List Download', description: 'proxy-list.download' },
  { name: 'ProxyScrape', description: 'proxyscrape.com' },
  { name: 'GeoNode', description: 'geonode.com' },
];

const PROXY_TYPES = ['HTTP', 'HTTPS', 'SOCKS4', 'SOCKS5'];

export default function Parser() {
  const { isParsing, parseProgress, setIsParsing, setParseProgress, setProxies } = useProxyStore();
  const [selectedSources, setSelectedSources] = useState<string[]>(SOURCES.map(s => s.name));
  const [selectedTypes, setSelectedTypes] = useState<string[]>(PROXY_TYPES);
  const [parsedCount, setParsedCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; show: boolean } | null>(null);

  useEffect(() => {
    window.electronAPI.onParseProgress((progress: any) => {
      setParseProgress(progress);
      if (progress.status === 'done') {
        setParsedCount(prev => prev + progress.count);
      }
    });

    return () => {
      window.electronAPI.removeAllListeners('parse-progress');
    };
  }, []);

  const toggleSource = (name: string) => {
    setSelectedSources(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const selectAllSources = () => setSelectedSources(SOURCES.map(s => s.name));
  const deselectAllSources = () => setSelectedSources([]);

  const startParsing = async () => {
    if (selectedSources.length === 0) return;
    
    setIsParsing(true);
    setParsedCount(0);
    
    try {
      await window.electronAPI.parseProxies(selectedSources, {
        types: selectedTypes,
      });
      
      const data = await window.electronAPI.getProxies();
      setProxies(data);
    } catch (error) {
      console.error('Parse error:', error);
    }
    
    setIsParsing(false);
    setParseProgress(null);
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const filePath = await window.electronAPI.selectImportFile();
      if (filePath) {
        const count = await window.electronAPI.importProxies(filePath);
        setImportResult({ count, show: true });
        
        // Обновляем список прокси
        const data = await window.electronAPI.getProxies();
        setProxies(data);
        
        // Скрываем уведомление через 3 секунды
        setTimeout(() => setImportResult(null), 3000);
      }
    } catch (error) {
      console.error('Import error:', error);
    }
    setIsImporting(false);
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Парсер прокси</h1>
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="px-4 py-2 bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-dark-border text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {isImporting ? 'Импорт...' : 'Импорт из файла'}
        </button>
      </div>

      {/* Import result notification */}
      {importResult?.show && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-300 animate-slideIn">
          ✅ Импортировано {importResult.count.toLocaleString()} прокси
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Sources */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Источники</h2>
            <div className="flex gap-2">
              <button
                onClick={selectAllSources}
                className="text-xs text-primary-500 hover:text-primary-600"
              >
                Выбрать все
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                onClick={deselectAllSources}
                className="text-xs text-primary-500 hover:text-primary-600"
              >
                Снять все
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {SOURCES.map(source => (
              <label
                key={source.name}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedSources.includes(source.name)}
                  onChange={() => toggleSource(source.name)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <div>
                  <p className="font-medium text-sm">{source.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{source.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Типы прокси</h2>
            <div className="flex flex-wrap gap-2">
              {PROXY_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTypes.includes(type)
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          {isParsing && (
            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6 animate-slideIn">
              <h2 className="text-lg font-semibold mb-4">Прогресс</h2>
              {parseProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {parseProgress.source}
                    </span>
                    <span className={
                      parseProgress.status === 'done' ? 'text-green-500' :
                      parseProgress.status === 'error' ? 'text-red-500' :
                      'text-yellow-500'
                    }>
                      {parseProgress.status === 'parsing' ? 'Парсинг...' :
                       parseProgress.status === 'done' ? `+${parseProgress.count}` :
                       'Ошибка'}
                    </span>
                  </div>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Найдено: <span className="font-semibold text-gray-900 dark:text-white">{parsedCount}</span> прокси
                </p>
              </div>
            </div>
          )}

          {/* Import info */}
          <div className="bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border rounded-xl p-4">
            <h3 className="font-medium text-sm mb-2">Импорт из файла</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Поддерживаемые форматы:
            </p>
            <ul className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1">
              <li>• TXT — IP:PORT или IP:PORT:USER:PASS</li>
              <li>• CSV — с заголовками или без</li>
              <li>• JSON — массив объектов</li>
              <li>• URI — socks5://ip:port, http://ip:port</li>
            </ul>
          </div>

          {/* Start button */}
          <button
            onClick={startParsing}
            disabled={isParsing || selectedSources.length === 0}
            className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isParsing ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Парсинг...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Начать парсинг
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
