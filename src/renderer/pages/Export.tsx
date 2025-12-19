import { useState } from 'react';
import { useProxyStore } from '../store/proxyStore';

const EXPORT_FORMATS = [
  { id: 'txt', name: 'TXT', description: 'Простой текст (IP:PORT)' },
  { id: 'csv', name: 'CSV', description: 'Таблица с полной информацией' },
  { id: 'json', name: 'JSON', description: 'JSON формат' },
  { id: 'nekobox', name: 'NekoBox', description: 'Конфиг для NekoBox/sing-box' },
  { id: 'v2ray', name: 'V2rayNG', description: 'Конфиг для V2rayNG' },
  { id: 'clash', name: 'Clash', description: 'YAML конфиг для Clash' },
];

export default function Export() {
  const { proxies, selectedIds } = useProxyStore();
  const [selectedFormat, setSelectedFormat] = useState('txt');
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [onlyWorking, setOnlyWorking] = useState(true);

  const getProxiesToExport = () => {
    let toExport = selectedIds.length > 0
      ? proxies.filter(p => selectedIds.includes(p.id))
      : proxies;

    if (onlyWorking) {
      toExport = toExport.filter(p => p.status === 'working');
    }

    return toExport;
  };

  const handleExport = async () => {
    const toExport = getProxiesToExport();
    if (toExport.length === 0) return;

    const filePath = await window.electronAPI.selectExportPath(selectedFormat);
    if (!filePath) return;

    const success = await window.electronAPI.exportProxies(toExport, selectedFormat, filePath);
    setExportStatus(success ? 'success' : 'error');

    setTimeout(() => setExportStatus('idle'), 3000);
  };

  const copyToClipboard = () => {
    const toExport = getProxiesToExport();
    const text = toExport.map(p => `${p.ip}:${p.port}`).join('\n');
    navigator.clipboard.writeText(text);
    setExportStatus('success');
    setTimeout(() => setExportStatus('idle'), 2000);
  };

  const exportCount = getProxiesToExport().length;
  const workingCount = proxies.filter(p => p.status === 'working').length;

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold mb-6">Экспорт прокси</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Format selection */}
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Формат экспорта</h2>
          <div className="space-y-2">
            {EXPORT_FORMATS.map(format => (
              <label
                key={format.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedFormat === format.id
                    ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-500'
                    : 'hover:bg-gray-50 dark:hover:bg-dark-hover border border-transparent'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={format.id}
                  checked={selectedFormat === format.id}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="w-4 h-4 text-primary-500"
                />
                <div>
                  <p className="font-medium text-sm">{format.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{format.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Options & Export */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Статистика</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Всего прокси</p>
                <p className="text-2xl font-bold">{proxies.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Рабочих</p>
                <p className="text-2xl font-bold text-green-500">{workingCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Выбрано</p>
                <p className="text-2xl font-bold">{selectedIds.length || 'Все'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">К экспорту</p>
                <p className="text-2xl font-bold text-primary-500">{exportCount}</p>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Опции</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWorking}
                onChange={(e) => setOnlyWorking(e.target.checked)}
                className="w-4 h-4 rounded text-primary-500"
              />
              <span className="text-sm">Только рабочие прокси</span>
            </label>
          </div>

          {/* Status message */}
          {exportStatus !== 'idle' && (
            <div className={`p-4 rounded-xl animate-slideIn ${
              exportStatus === 'success' 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}>
              {exportStatus === 'success' ? 'Экспорт завершён!' : 'Ошибка экспорта'}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={exportCount === 0}
              className="flex-1 py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Экспортировать ({exportCount})
            </button>
            <button
              onClick={copyToClipboard}
              disabled={exportCount === 0}
              className="px-6 py-4 bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-dark-border disabled:opacity-50 font-semibold rounded-xl transition-colors"
            >
              Копировать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
