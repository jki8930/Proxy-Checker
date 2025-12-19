/**
 * Модуль экспорта прокси в различные форматы
 * 
 * Поддерживаемые форматы:
 * - TXT: простой текст IP:PORT
 * - CSV: таблица с полной информацией
 * - JSON: массив объектов
 * - NekoBox: конфиг для sing-box/NekoBox
 * - V2ray: конфиг для V2rayNG
 * - Clash: YAML конфиг для Clash
 */

import fs from 'fs';

/** Прокси для экспорта */
export interface ExportProxy {
  ip: string;
  port: number;
  type: string;
  country?: string;
  country_code?: string;
  anonymity?: string;
  latency?: number;
  username?: string;
  password?: string;
}

/**
 * Экспортировать прокси в файл
 * @param proxies - массив прокси
 * @param format - формат экспорта
 * @param filePath - путь к файлу
 * @returns true если успешно
 */
export function exportProxies(proxies: ExportProxy[], format: string, filePath: string): boolean {
  try {
    let content = '';
    
    switch (format) {
      case 'txt':
        content = exportToTxt(proxies);
        break;
      case 'csv':
        content = exportToCsv(proxies);
        break;
      case 'json':
        content = exportToJson(proxies);
        break;
      case 'nekobox':
        content = exportToNekoBox(proxies);
        break;
      case 'v2ray':
        content = exportToV2ray(proxies);
        break;
      case 'clash':
        content = exportToClash(proxies);
        break;
      default:
        content = exportToTxt(proxies);
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Ошибка экспорта:', error);
    return false;
  }
}

/**
 * Экспорт в TXT
 * Формат: IP:PORT или IP:PORT:USER:PASS для приватных
 */
function exportToTxt(proxies: ExportProxy[]): string {
  return proxies.map(p => {
    if (p.username && p.password) {
      return `${p.ip}:${p.port}:${p.username}:${p.password}`;
    }
    return `${p.ip}:${p.port}`;
  }).join('\n');
}

/**
 * Экспорт в CSV
 * Включает все поля для анализа в Excel/Google Sheets
 */
function exportToCsv(proxies: ExportProxy[]): string {
  const header = 'IP,Port,Type,Country,Anonymity,Latency,Username,Password';
  const rows = proxies.map(p => 
    `${p.ip},${p.port},${p.type},${p.country || ''},${p.anonymity || ''},${p.latency || ''},${p.username || ''},${p.password || ''}`
  );
  return [header, ...rows].join('\n');
}

/**
 * Экспорт в JSON
 * Полный массив объектов с форматированием
 */
function exportToJson(proxies: ExportProxy[]): string {
  return JSON.stringify(proxies, null, 2);
}

/**
 * Экспорт в формат NekoBox (URI-ссылки)
 * Генерирует ссылки вида socks5://ip:port или http://ip:port
 * Можно скопировать и вставить в NekoBox через буфер обмена
 */
function exportToNekoBox(proxies: ExportProxy[]): string {
  return proxies.map((p, index) => {
    const type = p.type.toUpperCase();
    let protocol = 'http';
    
    if (type.includes('SOCKS5')) {
      protocol = 'socks5';
    } else if (type.includes('SOCKS4')) {
      protocol = 'socks4';
    } else if (type === 'HTTPS') {
      protocol = 'http';  // HTTPS прокси используют http:// схему
    }
    
    // Формат: protocol://user:pass@ip:port#name
    // или: protocol://ip:port#name
    const name = `Proxy-${index + 1}${p.country_code ? '-' + p.country_code : ''}`;
    const encodedName = encodeURIComponent(name);
    
    if (p.username && p.password) {
      const encodedUser = encodeURIComponent(p.username);
      const encodedPass = encodeURIComponent(p.password);
      return `${protocol}://${encodedUser}:${encodedPass}@${p.ip}:${p.port}#${encodedName}`;
    }
    
    return `${protocol}://${p.ip}:${p.port}#${encodedName}`;
  }).join('\n');
}

/**
 * Экспорт в формат V2rayNG (URI-ссылки)
 * Аналогично NekoBox — URI-ссылки для импорта через буфер
 */
function exportToV2ray(proxies: ExportProxy[]): string {
  // V2rayNG тоже принимает socks/http URI
  return proxies.map((p, index) => {
    const type = p.type.toUpperCase();
    let protocol = 'http';
    
    if (type.includes('SOCKS5')) {
      protocol = 'socks5';
    } else if (type.includes('SOCKS4')) {
      protocol = 'socks4';
    }
    
    const name = `Proxy-${index + 1}${p.country_code ? '-' + p.country_code : ''}`;
    const encodedName = encodeURIComponent(name);
    
    if (p.username && p.password) {
      const encodedUser = encodeURIComponent(p.username);
      const encodedPass = encodeURIComponent(p.password);
      return `${protocol}://${encodedUser}:${encodedPass}@${p.ip}:${p.port}#${encodedName}`;
    }
    
    return `${protocol}://${p.ip}:${p.port}#${encodedName}`;
  }).join('\n');
}

/**
 * Экспорт в формат Clash
 * Создаёт YAML конфиг с proxies и proxy-groups
 */
function exportToClash(proxies: ExportProxy[]): string {
  const proxyConfigs = proxies.map((p, index) => {
    const isSocks = p.type.toUpperCase().includes('SOCKS');
    const name = `proxy-${index + 1}-${p.country_code || 'XX'}`;
    
    const config: any = {
      name,
      type: isSocks ? 'socks5' : 'http',
      server: p.ip,
      port: p.port,
    };
    
    if (p.username && p.password) {
      config.username = p.username;
      config.password = p.password;
    }
    
    return config;
  });
  
  const proxyNames = proxyConfigs.map(p => p.name);
  
  // Формируем YAML вручную для лучшего форматирования
  let yaml = 'proxies:\n';
  for (const p of proxyConfigs) {
    yaml += `  - name: "${p.name}"\n`;
    yaml += `    type: ${p.type}\n`;
    yaml += `    server: ${p.server}\n`;
    yaml += `    port: ${p.port}\n`;
    if (p.username) {
      yaml += `    username: "${p.username}"\n`;
      yaml += `    password: "${p.password}"\n`;
    }
    yaml += '\n';
  }
  
  // Добавляем группу для выбора прокси
  yaml += '\nproxy-groups:\n';
  yaml += '  - name: "Proxy"\n';
  yaml += '    type: select\n';
  yaml += '    proxies:\n';
  for (const name of proxyNames) {
    yaml += `      - "${name}"\n`;
  }
  
  return yaml;
}
