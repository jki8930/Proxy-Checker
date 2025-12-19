export interface Proxy {
    id: number;
    ip: string;
    port: number;
    type: 'HTTP' | 'HTTPS' | 'SOCKS4' | 'SOCKS5';
    country?: string;
    country_code?: string;
    anonymity?: 'transparent' | 'anonymous' | 'elite' | 'unknown';
    latency?: number;
    speed?: number;
    status: 'unchecked' | 'working' | 'dead';
    username?: string;
    password?: string;
    last_checked?: number;
    created_at?: number;
}
export interface ProxySource {
    id: number;
    name: string;
    url: string;
    enabled: boolean;
    last_parsed?: number;
}
export interface Settings {
    threads: number;
    timeout: number;
    proxyForParsing?: string;
    theme: 'light' | 'dark';
    language: 'ru' | 'en';
}
export interface ParseFilters {
    types?: string[];
    countries?: string[];
}
export interface CheckOptions {
    threads: number;
    timeout: number;
    testUrl: string;
}
export interface ParseProgress {
    source: string;
    count: number;
    status: 'parsing' | 'done' | 'error';
}
export interface CheckProgress {
    checked: number;
    total: number;
    working: number;
    dead: number;
}
//# sourceMappingURL=types.d.ts.map