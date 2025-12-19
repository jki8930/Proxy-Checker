/**
 * Модуль импорта прокси из файлов
 * 
 * Поддерживаемые форматы:
 * - TXT: IP:PORT или IP:PORT:USER:PASS (по одному на строку)
 * - CSV: с заголовками или без
 * - JSON: массив объектов с полями ip, port, type и т.д.
 * 
 * Автоматически определяет формат по расширению и содержимому.
 */

import fs from 'fs';
import path from 'path';

/** Импортированный прокси */
interface ImportedProxy {
  ip: string;
  port: number;
  type?: string;
  username?: string;
  password?: string;
}

/**
 * Импортировать прокси из файла
 * Автоматически определяет формат
 */
export async function importProxiesFromFile(filePath: string): Promise<ImportedProxy[]> {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, 'utf-8');
  
  switch (ext) {
    case '.json':
      return parseJson(content);
    case '.csv':
      return parseCsv(content);
    case '.txt':
    default:
      return parseTxt(content);
  }
}

/**
 * Парсинг TXT файла
 * Поддерживает форматы:
 * - IP:PORT
 * - IP:PORT:USER:PASS
 * - socks5://IP:PORT
 * - http://user:pass@IP:PORT
 */
function parseTxt(content: string): ImportedProxy[] {
  const proxies: ImportedProxy[] = [];
  const lines = content.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const proxy = parseLine(trimmed);
    if (proxy) {
      proxies.push(proxy);
    }
  }
  
  return proxies;
}

/**
 * Парсинг одной строки с прокси
 */
function parseLine(line: string): ImportedProxy | null {
  // URI формат: protocol://[user:pass@]ip:port
  const uriMatch = line.match(/^(https?|socks[45]?):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)/i);
  if (uriMatch) {
    const [, protocol, user, pass, ip, port] = uriMatch;
    return {
      ip,
      port: parseInt(port),
      type: protocol.toUpperCase().replace('SOCKS', 'SOCKS5'),
      username: user,
      password: pass,
    };
  }
  
  // Формат IP:PORT:USER:PASS
  const parts = line.split(':');
  if (parts.length >= 2) {
    const ip = parts[0].trim();
    const port = parseInt(parts[1].trim());
    
    // Проверяем что IP валидный
    if (!isValidIp(ip) || isNaN(port) || port < 1 || port > 65535) {
      return null;
    }
    
    const proxy: ImportedProxy = { ip, port, type: 'HTTP' };
    
    if (parts.length >= 4) {
      proxy.username = parts[2].trim();
      proxy.password = parts[3].trim();
    }
    
    return proxy;
  }
  
  return null;
}

/**
 * Проверка валидности IP адреса
 */
function isValidIp(ip: string): boolean {
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    return parts.every(p => p >= 0 && p <= 255);
  }
  
  // Домен (для некоторых прокси)
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$/;
  return domainRegex.test(ip);
}

/**
 * Парсинг CSV файла
 * Поддерживает с заголовками и без
 */
function parseCsv(content: string): ImportedProxy[] {
  const proxies: ImportedProxy[] = [];
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  
  if (lines.length === 0) return proxies;
  
  // Определяем есть ли заголовки
  const firstLine = lines[0].toLowerCase();
  const hasHeaders = firstLine.includes('ip') || firstLine.includes('host') || firstLine.includes('port');
  
  const startIndex = hasHeaders ? 1 : 0;
  
  // Определяем индексы колонок
  let ipIndex = 0;
  let portIndex = 1;
  let typeIndex = -1;
  let userIndex = -1;
  let passIndex = -1;
  
  if (hasHeaders) {
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    ipIndex = headers.findIndex(h => h === 'ip' || h === 'host' || h === 'address');
    portIndex = headers.findIndex(h => h === 'port');
    typeIndex = headers.findIndex(h => h === 'type' || h === 'protocol');
    userIndex = headers.findIndex(h => h === 'username' || h === 'user' || h === 'login');
    passIndex = headers.findIndex(h => h === 'password' || h === 'pass');
    
    if (ipIndex === -1) ipIndex = 0;
    if (portIndex === -1) portIndex = 1;
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    
    const ip = cols[ipIndex];
    const port = parseInt(cols[portIndex]);
    
    if (!ip || isNaN(port)) continue;
    
    const proxy: ImportedProxy = {
      ip,
      port,
      type: typeIndex >= 0 ? (cols[typeIndex] || 'HTTP').toUpperCase() : 'HTTP',
    };
    
    if (userIndex >= 0 && cols[userIndex]) {
      proxy.username = cols[userIndex];
    }
    if (passIndex >= 0 && cols[passIndex]) {
      proxy.password = cols[passIndex];
    }
    
    proxies.push(proxy);
  }
  
  return proxies;
}

/**
 * Парсинг JSON файла
 * Ожидает массив объектов с полями ip, port
 */
function parseJson(content: string): ImportedProxy[] {
  try {
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : (data.proxies || data.data || []);
    
    return items
      .filter((item: any) => item.ip && item.port)
      .map((item: any) => ({
        ip: item.ip || item.host || item.address,
        port: parseInt(item.port),
        type: (item.type || item.protocol || 'HTTP').toUpperCase(),
        username: item.username || item.user,
        password: item.password || item.pass,
      }));
  } catch {
    return [];
  }
}
