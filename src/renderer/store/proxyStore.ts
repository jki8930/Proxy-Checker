import { create } from 'zustand';

export interface Proxy {
  id: number;
  ip: string;
  port: number;
  type: string;
  country?: string;
  country_code?: string;
  anonymity?: string;
  latency?: number;
  speed?: number;
  status: 'unchecked' | 'working' | 'dead';
  username?: string;
  password?: string;
  last_checked?: number;
}

interface ProxyState {
  proxies: Proxy[];
  selectedIds: number[];
  isLoading: boolean;
  isParsing: boolean;
  isChecking: boolean;
  parseProgress: { source: string; count: number; status: string } | null;
  checkProgress: { checked: number; total: number; working: number; dead: number } | null;
  
  setProxies: (proxies: Proxy[]) => void;
  addProxies: (proxies: Proxy[]) => void;
  updateProxy: (id: number, data: Partial<Proxy>) => void;
  removeProxies: (ids: number[]) => void;
  clearProxies: () => void;
  
  setSelectedIds: (ids: number[]) => void;
  toggleSelected: (id: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  
  setIsLoading: (loading: boolean) => void;
  setIsParsing: (parsing: boolean) => void;
  setIsChecking: (checking: boolean) => void;
  setParseProgress: (progress: { source: string; count: number; status: string } | null) => void;
  setCheckProgress: (progress: { checked: number; total: number; working: number; dead: number } | null) => void;
}

export const useProxyStore = create<ProxyState>((set) => ({
  proxies: [],
  selectedIds: [],
  isLoading: false,
  isParsing: false,
  isChecking: false,
  parseProgress: null,
  checkProgress: null,

  setProxies: (proxies) => set({ proxies }),
  addProxies: (newProxies) => set((state) => {
    const existingKeys = new Set(state.proxies.map(p => `${p.ip}:${p.port}`));
    const unique = newProxies.filter(p => !existingKeys.has(`${p.ip}:${p.port}`));
    return { proxies: [...state.proxies, ...unique] };
  }),
  updateProxy: (id, data) => set((state) => ({
    proxies: state.proxies.map(p => p.id === id ? { ...p, ...data } : p)
  })),
  removeProxies: (ids) => set((state) => ({
    proxies: state.proxies.filter(p => !ids.includes(p.id)),
    selectedIds: state.selectedIds.filter(id => !ids.includes(id))
  })),
  clearProxies: () => set({ proxies: [], selectedIds: [] }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  toggleSelected: (id) => set((state) => ({
    selectedIds: state.selectedIds.includes(id)
      ? state.selectedIds.filter(i => i !== id)
      : [...state.selectedIds, id]
  })),
  selectAll: () => set((state) => ({ selectedIds: state.proxies.map(p => p.id) })),
  deselectAll: () => set({ selectedIds: [] }),

  setIsLoading: (isLoading) => set({ isLoading }),
  setIsParsing: (isParsing) => set({ isParsing }),
  setIsChecking: (isChecking) => set({ isChecking }),
  setParseProgress: (parseProgress) => set({ parseProgress }),
  setCheckProgress: (checkProgress) => set({ checkProgress }),
}));
