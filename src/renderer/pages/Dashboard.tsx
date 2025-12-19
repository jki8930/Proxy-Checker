import { useEffect, useMemo } from 'react';
import { useProxyStore } from '../store/proxyStore';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { proxies, setProxies, setIsLoading } = useProxyStore();
  const navigate = useNavigate();

  // Memoize stats calculation
  const stats = useMemo(() => ({
    total: proxies.length,
    working: proxies.filter(p => p.status === 'working').length,
    dead: proxies.filter(p => p.status === 'dead').length,
    unchecked: proxies.filter(p => p.status === 'unchecked').length,
  }), [proxies]);

  // Memoize type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { HTTP: 0, HTTPS: 0, SOCKS4: 0, SOCKS5: 0 };
    for (const p of proxies) {
      if (counts[p.type] !== undefined) {
        counts[p.type]++;
      }
    }
    return counts;
  }, [proxies]);

  useEffect(() => {
    loadProxies();
  }, []);

  const loadProxies = async () => {
    setIsLoading(true);
    try {
      const data = await window.electronAPI.getProxies();
      setProxies(data);
    } catch (error) {
      console.error('Failed to load proxies:', error);
    }
    setIsLoading(false);
  };

  const StatCard = ({ title, value, color, onClick }: { title: string; value: number; color: string; onClick?: () => void }) => (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6 ${onClick ? 'cursor-pointer hover:border-primary-500 transition-colors' : ''}`}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      <p className={`text-3xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold mb-6">Панель управления</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Всего прокси" 
          value={stats.total} 
          color="text-gray-900 dark:text-white"
          onClick={() => navigate('/checker')}
        />
        <StatCard 
          title="Рабочие" 
          value={stats.working} 
          color="text-green-500"
          onClick={() => navigate('/checker')}
        />
        <StatCard 
          title="Нерабочие" 
          value={stats.dead} 
          color="text-red-500"
          onClick={() => navigate('/checker')}
        />
        <StatCard 
          title="Не проверены" 
          value={stats.unchecked} 
          color="text-yellow-500"
          onClick={() => navigate('/checker')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Быстрые действия</h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/parser')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Спарсить прокси
            </button>
            <button
              onClick={() => navigate('/checker')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-dark-border text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Проверить прокси
            </button>
            <button
              onClick={() => navigate('/export')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-dark-border text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Экспортировать
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">По типам</h2>
          <div className="space-y-3">
            {(['HTTP', 'HTTPS', 'SOCKS4', 'SOCKS5'] as const).map(type => {
              const count = typeCounts[type];
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{type}</span>
                    <span className="font-medium">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-dark-border rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-500 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
