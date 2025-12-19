import { useEffect, useState, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useProxyStore, Proxy } from '../store/proxyStore';

type FilterStatus = 'all' | 'working' | 'dead' | 'unchecked';
type FilterType = 'all' | 'HTTP' | 'HTTPS' | 'SOCKS4' | 'SOCKS5';

interface CheckProgress {
  checked: number;
  total: number;
  working: number;
  dead: number;
  deleted?: number;
  percent: number;
  logs?: string[];
  lastResult?: {
    proxy: string;
    status: 'working' | 'dead';
    latency?: number;
    anonymity?: string;
  };
}

export default function Checker() {
  const {
    proxies, setProxies, selectedIds, setSelectedIds, toggleSelected,
    deselectAll, isChecking, setIsChecking,
    removeProxies, clearProxies
  } = useProxyStore();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [testUrl, setTestUrl] = useState('http://httpbin.org/ip');
  const [threads, setThreads] = useState(50);
  const [timeout, setTimeout] = useState(10000);
  const [deleteDead, setDeleteDead] = useState(true);
  const [checkAnonymity, setCheckAnonymity] = useState(true);
  const [checkProgress, setCheckProgress] = useState<CheckProgress | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const parentRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProxies();
    
    window.electronAPI.onCheckProgress((progress: any) => {
      setCheckProgress(progress);
      if (progress.logs) {
        setLogs(progress.logs);
      }
    });

    return () => {
      window.electronAPI.removeAllListeners('check-progress');
    };
  }, []);

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  const loadProxies = async () => {
    const data = await window.electronAPI.getProxies();
    setProxies(data);
  };

  const filteredProxies = useMemo(() => {
    return proxies.filter(p => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterType !== 'all' && p.type !== filterType) return false;
      return true;
    });
  }, [proxies, filterStatus, filterType]);

  const rowVirtualizer = useVirtualizer({
    count: filteredProxies.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 20,
  });

  const startChecking = async () => {
    const toCheck = selectedIds.length > 0
      ? proxies.filter(p => selectedIds.includes(p.id))
      : proxies.filter(p => p.status === 'unchecked');

    if (toCheck.length === 0) {
      alert('Нет прокси для проверки. Выберите прокси или спарсите новые.');
      return;
    }

    setIsChecking(true);
    setLogs([]);
    setCheckProgress({ checked: 0, total: toCheck.length, working: 0, dead: 0, percent: 0 });
    
    requestAnimationFrame(() => setShowProgress(true));
    
    try {
      await window.electronAPI.checkProxies(toCheck, { 
        threads, 
        timeout, 
        testUrl,
        deleteDead,
        checkAnonymity,
      });
      await loadProxies();
    } catch (error) {
      console.error('Check error:', error);
    }
    
    setIsChecking(false);
    
    await new Promise(r => window.setTimeout(r, 3000));
    setShowProgress(false);
    setCheckProgress(null);
  };

  const stopChecking = async () => {
    await window.electronAPI.stopChecking();
    setIsChecking(false);
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    await window.electronAPI.deleteProxies(selectedIds);
    removeProxies(selectedIds);
  };

  const clearAll = async () => {
    if (!confirm('Удалить все прокси?')) return;
    await window.electronAPI.clearProxies();
    clearProxies();
  };

  const copySelected = () => {
    const toCopy = selectedIds.length > 0
      ? proxies.filter(p => selectedIds.includes(p.id))
      : filteredProxies;
    
    const text = toCopy.map(p => `${p.ip}:${p.port}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'working':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">Рабочий</span>;
      case 'dead':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Мёртвый</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">Не проверен</span>;
    }
  };

  const getAnonymityBadge = (anonymity?: string) => {
    switch (anonymity) {
      case 'elite':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">Elite</span>;
      case 'anonymous':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">Anonymous</span>;
      case 'transparent':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Transparent</span>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  const handleSelectAllFiltered = () => {
    if (selectedIds.length === filteredProxies.length) {
      deselectAll();
    } else {
      setSelectedIds(filteredProxies.map(p => p.id));
    }
  };

  const stats = useMemo(() => ({
    total: proxies.length,
    unchecked: proxies.filter(p => p.status === 'unchecked').length,
    working: proxies.filter(p => p.status === 'working').length,
  }), [proxies]);

  return (
    <div className="animate-fadeIn h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Проверка прокси</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Всего: <span className="font-medium text-gray-900 dark:text-white">{stats.total.toLocaleString()}</span>
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            Рабочих: <span className="font-medium text-green-500">{stats.working.toLocaleString()}</span>
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            Не проверено: <span className="font-medium text-yellow-500">{stats.unchecked.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* Check Progress */}
      <div className={`transition-all duration-300 ease-out overflow-hidden ${
        showProgress && checkProgress ? 'max-h-[500px] opacity-100 mb-4' : 'max-h-0 opacity-0'
      }`}>
        {checkProgress && (
          <div className="p-5 bg-white dark:bg-dark-card border-2 border-primary-500 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {isChecking && (
                  <div className="relative">
                    <div className="w-3 h-3 bg-primary-500 rounded-full animate-ping absolute" />
                    <div className="w-3 h-3 bg-primary-500 rounded-full" />
                  </div>
                )}
                <span className="font-semibold text-lg">
                  {isChecking ? 'Проверка прокси...' : 'Проверка завершена'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowLogs(true)}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Логи
                </button>
                <span className="text-2xl font-bold text-primary-500">
                  {checkProgress.percent}%
                </span>
              </div>
            </div>
            
            <div className="h-3 bg-gray-200 dark:bg-dark-border rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-150 ease-out"
                style={{ width: `${checkProgress.percent}%` }}
              />
            </div>
            
            <div className="grid grid-cols-5 gap-3 text-center">
              <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Проверено</p>
                <p className="text-xl font-bold">{checkProgress.checked.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Всего</p>
                <p className="text-xl font-bold">{checkProgress.total.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <p className="text-xs text-green-600 dark:text-green-400 mb-1">Рабочие</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{checkProgress.working.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                <p className="text-xs text-red-600 dark:text-red-400 mb-1">Мёртвые</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{checkProgress.dead.toLocaleString()}</p>
              </div>
              {deleteDead && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                  <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">Удалено</p>
                  <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{(checkProgress.deleted || 0).toLocaleString()}</p>
                </div>
              )}
            </div>

            {checkProgress.lastResult && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-mono flex items-center gap-2 ${
                checkProgress.lastResult.status === 'working' 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}>
                <span>{checkProgress.lastResult.status === 'working' ? '✅' : '❌'}</span>
                <span>{checkProgress.lastResult.proxy}</span>
                {checkProgress.lastResult.latency && (
                  <span className="text-gray-500">({checkProgress.lastResult.latency}ms)</span>
                )}
                {checkProgress.lastResult.anonymity && checkProgress.lastResult.status === 'working' && (
                  <span className="ml-auto">{getAnonymityBadge(checkProgress.lastResult.anonymity)}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowLogs(false)}>
          <div 
            className="w-full max-w-3xl max-h-[80vh] bg-white dark:bg-dark-card rounded-xl shadow-2xl flex flex-col animate-slideIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
              <h3 className="font-semibold text-lg">Логи проверки</h3>
              <button
                onClick={() => setShowLogs(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-sm bg-gray-50 dark:bg-dark-bg">
              {logs.length > 0 ? (
                <div className="space-y-1">
                  {logs.map((log, i) => (
                    <div 
                      key={i} 
                      className={`${
                        log.includes('✅') ? 'text-green-600 dark:text-green-400' :
                        log.includes('❌') ? 'text-red-600 dark:text-red-400' :
                        log.includes('🚀') || log.includes('⚙️') || log.includes('🔗') || log.includes('🔒') || log.includes('🗑️') ? 'text-primary-600 dark:text-primary-400' :
                        log.includes('⚠️') ? 'text-yellow-600 dark:text-yellow-400' :
                        log.includes('📍') ? 'text-blue-600 dark:text-blue-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Логи появятся после начала проверки
                </p>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-dark-border flex justify-between items-center">
              <span className="text-sm text-gray-500">{logs.length} записей</span>
              <button
                onClick={() => navigator.clipboard.writeText(logs.join('\n'))}
                className="px-4 py-2 bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg text-sm transition-colors"
              >
                Копировать логи
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-3 py-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg text-sm"
          >
            <option value="all">Все статусы</option>
            <option value="working">Рабочие</option>
            <option value="dead">Мёртвые</option>
            <option value="unchecked">Не проверены</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="px-3 py-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg text-sm"
          >
            <option value="all">Все типы</option>
            <option value="HTTP">HTTP</option>
            <option value="HTTPS">HTTPS</option>
            <option value="SOCKS4">SOCKS4</option>
            <option value="SOCKS5">SOCKS5</option>
          </select>
          
          <span className="text-sm text-gray-500 ml-2">
            Показано: {filteredProxies.length.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copySelected}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
          >
            Копировать
          </button>
          <button
            onClick={deleteSelected}
            disabled={selectedIds.length === 0}
            className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50"
          >
            Удалить ({selectedIds.length.toLocaleString()})
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
          >
            Очистить всё
          </button>
        </div>
      </div>

      {/* Check options */}
      <div className="mb-4 p-4 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">URL для проверки</label>
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border rounded-lg text-sm"
              placeholder="http://httpbin.org/ip"
              disabled={isChecking}
            />
          </div>
          <div className="w-24">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Потоки</label>
            <input
              type="number"
              value={threads}
              onChange={(e) => setThreads(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border rounded-lg text-sm"
              min={1}
              max={200}
              disabled={isChecking}
            />
          </div>
          <div className="w-28">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Таймаут (мс)</label>
            <input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border rounded-lg text-sm"
              min={1000}
              max={60000}
              step={1000}
              disabled={isChecking}
            />
          </div>
          <div className="pt-5">
            {isChecking ? (
              <button
                onClick={stopChecking}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Стоп
              </button>
            ) : (
              <button
                onClick={startChecking}
                disabled={proxies.length === 0}
                className="px-6 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Проверить
              </button>
            )}
          </div>
        </div>
        
        {/* Options row */}
        <div className="flex items-center gap-6 pt-3 border-t border-gray-100 dark:border-dark-border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteDead}
              onChange={(e) => setDeleteDead(e.target.checked)}
              disabled={isChecking}
              className="w-4 h-4 rounded text-primary-500"
            />
            <span className="text-sm">Удалять мёртвые прокси</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checkAnonymity}
              onChange={(e) => setCheckAnonymity(e.target.checked)}
              disabled={isChecking}
              className="w-4 h-4 rounded text-primary-500"
            />
            <span className="text-sm">Проверять анонимность</span>
            <span className="text-xs text-gray-400" title="Elite — IP скрыт, Anonymous — прокси виден, Transparent — IP виден">ⓘ</span>
          </label>
        </div>
      </div>

      {/* Virtualized Table */}
      <div className="flex-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center bg-gray-50 dark:bg-dark-hover border-b border-gray-200 dark:border-dark-border text-sm font-medium">
          <div className="w-12 p-3 flex-shrink-0">
            <input
              type="checkbox"
              checked={selectedIds.length === filteredProxies.length && filteredProxies.length > 0}
              onChange={handleSelectAllFiltered}
              className="w-4 h-4 rounded"
            />
          </div>
          <div className="flex-1 p-3">IP:Port</div>
          <div className="w-24 p-3">Тип</div>
          <div className="w-28 p-3">Анонимность</div>
          <div className="w-24 p-3">Latency</div>
          <div className="w-28 p-3">Статус</div>
        </div>

        <div ref={parentRef} className="flex-1 overflow-auto">
          {filteredProxies.length > 0 ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const proxy = filteredProxies[virtualRow.index];
                return (
                  <div
                    key={proxy.id}
                    className="absolute top-0 left-0 w-full flex items-center border-b border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover text-sm"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="w-12 p-3 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(proxy.id)}
                        onChange={() => toggleSelected(proxy.id)}
                        className="w-4 h-4 rounded"
                      />
                    </div>
                    <div className="flex-1 p-3 font-mono truncate">{proxy.ip}:{proxy.port}</div>
                    <div className="w-24 p-3">{proxy.type}</div>
                    <div className="w-28 p-3">{getAnonymityBadge(proxy.anonymity)}</div>
                    <div className="w-24 p-3">{proxy.latency ? `${proxy.latency}ms` : '-'}</div>
                    <div className="w-28 p-3">{getStatusBadge(proxy.status)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>Нет прокси</p>
              <p className="text-sm">Перейдите в раздел "Парсер" чтобы добавить прокси</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
