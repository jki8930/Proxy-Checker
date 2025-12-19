/**
 * Модуль парсинга прокси из различных источников
 * 
 * Поддерживаемые источники:
 * - free-proxy-list.net (HTML таблица)
 * - sslproxies.org (HTML таблица)
 * - proxy-list.download (API, текстовый формат)
 * - proxyscrape.com (API, текстовый формат)
 * - geonode.com (API, JSON формат)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

/** Источник прокси */
export interface ProxySource {
  name: string;
  url: string;
}

/** Спарсенный прокси */
export interface ParsedProxy {
  ip: string;
  port: number;
  type?: string;
  country?: string;
  anonymity?: string;
  username?: string;
  password?: string;
}

/** Фильтры для парсинга */
export interface ParseFilters {
  types?: string[];      // HTTP, HTTPS, SOCKS4, SOCKS5
  countries?: string[];  // Коды стран
}

/** Callback для отслеживания прогресса */
type ProgressCallback = (progress: { source: string; count: number; status: string }) => void;

/**
 * Создать конфигурацию axios с опциональным прокси
 * Используется когда источники заблокированы в стране пользователя
 */
function createAxiosConfig(proxyForParsing?: string) {
  const config: any = {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  };

  if (proxyForParsing) {
    if (proxyForParsing.startsWith('socks')) {
      config.httpsAgent = new SocksProxyAgent(proxyForParsing);
    } else {
      config.httpsAgent = new HttpsProxyAgent(proxyForParsing);
    }
  }

  return config;
}

/**
 * Парсер для free-proxy-list.net и sslproxies.org
 * Парсит HTML таблицу с прокси
 */
async function parseFreeProxyList(url: string, config: any): Promise<ParsedProxy[]> {
  const proxies: ParsedProxy[] = [];
  
  try {
    const response = await axios.get(url, config);
    const $ = cheerio.load(response.data);
    
    // Ищем строки таблицы с прокси
    $('table tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 7) {
        const ip = $(cells[0]).text().trim();
        const port = parseInt($(cells[1]).text().trim());
        const countryCode = $(cells[2]).text().trim();
        const anonymity = $(cells[4]).text().trim().toLowerCase();
        const https = $(cells[6]).text().trim().toLowerCase() === 'yes';
        
        if (ip && port) {
          proxies.push({
            ip,
            port,
            type: https ? 'HTTPS' : 'HTTP',
            country: countryCode,
            anonymity: anonymity.includes('elite') ? 'elite' : 
                      anonymity.includes('anonymous') ? 'anonymous' : 'transparent',
          });
        }
      }
    });
  } catch (error) {
    console.error(`Ошибка парсинга ${url}:`, error);
  }
  
  return proxies;
}

/**
 * Парсер для proxy-list.download
 * API возвращает текст в формате IP:PORT
 */
async function parseProxyListDownload(config: any, filters?: ParseFilters): Promise<ParsedProxy[]> {
  const proxies: ParsedProxy[] = [];
  const types = filters?.types || ['http', 'https', 'socks4', 'socks5'];
  
  for (const type of types) {
    try {
      const url = `https://www.proxy-list.download/api/v1/get?type=${type}`;
      const response = await axios.get(url, config);
      const lines = response.data.split('\n');
      
      for (const line of lines) {
        const [ip, portStr] = line.trim().split(':');
        const port = parseInt(portStr);
        
        if (ip && port) {
          proxies.push({
            ip,
            port,
            type: type.toUpperCase(),
          });
        }
      }
    } catch (error) {
      console.error(`Ошибка парсинга proxy-list.download (${type}):`, error);
    }
  }
  
  return proxies;
}

/**
 * Парсер для proxyscrape.com
 * API возвращает текст в формате IP:PORT
 */
async function parseProxyScrape(config: any, filters?: ParseFilters): Promise<ParsedProxy[]> {
  const proxies: ParsedProxy[] = [];
  const types = filters?.types || ['http', 'socks4', 'socks5'];
  
  for (const type of types) {
    try {
      const url = `https://api.proxyscrape.com/v2/?request=displayproxies&protocol=${type}&timeout=10000&country=all`;
      const response = await axios.get(url, config);
      const lines = response.data.split('\n');
      
      for (const line of lines) {
        const [ip, portStr] = line.trim().split(':');
        const port = parseInt(portStr);
        
        if (ip && port) {
          proxies.push({
            ip,
            port,
            type: type.toUpperCase(),
          });
        }
      }
    } catch (error) {
      console.error(`Ошибка парсинга proxyscrape (${type}):`, error);
    }
  }
  
  return proxies;
}

/**
 * Парсер для geonode.com
 * API возвращает JSON с детальной информацией
 */
async function parseGeoNode(config: any, filters?: ParseFilters): Promise<ParsedProxy[]> {
  const proxies: ParsedProxy[] = [];
  
  try {
    const protocols = filters?.types?.map(t => t.toLowerCase()) || ['http', 'https', 'socks4', 'socks5'];
    const url = `https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc&protocols=${protocols.join(',')}`;
    
    const response = await axios.get(url, config);
    const data = response.data;
    
    if (data.data && Array.isArray(data.data)) {
      for (const item of data.data) {
        proxies.push({
          ip: item.ip,
          port: parseInt(item.port),
          type: (item.protocols?.[0] || 'HTTP').toUpperCase(),
          country: item.country,
          anonymity: item.anonymityLevel?.toLowerCase(),
        });
      }
    }
  } catch (error) {
    console.error('Ошибка парсинга geonode:', error);
  }
  
  return proxies;
}

/**
 * Главная функция парсинга
 * Парсит прокси из всех выбранных источников и удаляет дубликаты
 */
export async function parseFromSources(
  sources: ProxySource[],
  filters?: ParseFilters,
  proxyForParsing?: string,
  onProgress?: ProgressCallback
): Promise<ParsedProxy[]> {
  const allProxies: ParsedProxy[] = [];
  const config = createAxiosConfig(proxyForParsing);
  
  for (const source of sources) {
    onProgress?.({ source: source.name, count: 0, status: 'parsing' });
    
    let proxies: ParsedProxy[] = [];
    
    try {
      // Выбираем парсер в зависимости от источника
      if (source.url.includes('free-proxy-list.net') || source.url.includes('sslproxies.org')) {
        proxies = await parseFreeProxyList(source.url, config);
      } else if (source.url.includes('proxy-list.download')) {
        proxies = await parseProxyListDownload(config, filters);
      } else if (source.url.includes('proxyscrape.com')) {
        proxies = await parseProxyScrape(config, filters);
      } else if (source.url.includes('geonode.com')) {
        proxies = await parseGeoNode(config, filters);
      }
      
      // Применяем фильтр по типу если указан
      if (filters?.types && filters.types.length > 0) {
        proxies = proxies.filter(p => 
          filters.types!.some(t => t.toUpperCase() === p.type?.toUpperCase())
        );
      }
      
      allProxies.push(...proxies);
      onProgress?.({ source: source.name, count: proxies.length, status: 'done' });
    } catch (error) {
      onProgress?.({ source: source.name, count: 0, status: 'error' });
    }
  }
  
  // Удаляем дубликаты по IP:PORT
  const unique = new Map<string, ParsedProxy>();
  for (const proxy of allProxies) {
    const key = `${proxy.ip}:${proxy.port}`;
    if (!unique.has(key)) {
      unique.set(key, proxy);
    }
  }
  
  return Array.from(unique.values());
}
