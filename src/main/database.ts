/**
 * Модуль работы с базой данных SQLite
 * 
 * Использует sql.js — чистый JavaScript порт SQLite.
 * Не требует компиляции нативных модулей.
 * 
 * База хранится в файле proxies.db в папке userData приложения.
 */

import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/** Экземпляр базы данных */
let db: Database;

/** Путь к файлу базы данных */
let dbPath: string;

/**
 * Инициализация базы данных
 * Создаёт таблицы если их нет, загружает существующую БД
 */
export async function initDatabase() {
  const SQL = await initSqlJs();
  dbPath = path.join(app.getPath('userData'), 'proxies.db');
  
  // Загружаем существующую БД или создаём новую
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  // Создаём таблицы
  db.run(`
    -- Таблица прокси
    CREATE TABLE IF NOT EXISTS proxies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      port INTEGER NOT NULL,
      type TEXT DEFAULT 'HTTP',           -- HTTP, HTTPS, SOCKS4, SOCKS5
      country TEXT,                        -- Название страны
      country_code TEXT,                   -- Код страны (RU, US, etc)
      anonymity TEXT,                      -- transparent, anonymous, elite
      latency INTEGER,                     -- Время отклика в мс
      speed REAL,                          -- Скорость загрузки (не используется пока)
      status TEXT DEFAULT 'unchecked',     -- unchecked, working, dead
      username TEXT,                       -- Логин (для приватных прокси)
      password TEXT,                       -- Пароль
      last_checked INTEGER,                -- Unix timestamp последней проверки
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(ip, port)                     -- Уникальность по IP:PORT
    );

    -- Таблица источников для парсинга
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_parsed INTEGER
    );

    -- Таблица настроек (ключ-значение)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Создаём индексы для быстрого поиска
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_proxies_country ON proxies(country_code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_proxies_type ON proxies(type)');
  } catch (e) {
    // Индексы могут уже существовать
  }

  // Добавляем источники по умолчанию
  const defaultSources = [
    { name: 'Free Proxy List', url: 'https://free-proxy-list.net/' },
    { name: 'SSL Proxies', url: 'https://www.sslproxies.org/' },
    { name: 'Proxy List Download', url: 'https://www.proxy-list.download/api/v1/get' },
    { name: 'ProxyScrape', url: 'https://api.proxyscrape.com/v2/' },
    { name: 'GeoNode', url: 'https://proxylist.geonode.com/api/proxy-list' },
  ];

  for (const source of defaultSources) {
    try {
      db.run('INSERT OR IGNORE INTO sources (name, url) VALUES (?, ?)', [source.name, source.url]);
    } catch (e) {
      // Источник уже существует
    }
  }

  saveDatabase();
  return db;
}

/**
 * Сохранение базы данных в файл
 * sql.js работает в памяти, поэтому нужно явно сохранять
 */
export function saveDatabase() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/** Получить экземпляр БД */
export function getDb() {
  return db;
}

// ==================== Операции с прокси ====================

/**
 * Получить все прокси с опциональной фильтрацией
 * Результаты отсортированы по latency (быстрые первыми)
 */
export function getAllProxies(filters?: {
  status?: string;
  type?: string;
  country?: string;
  anonymity?: string;
}) {
  let query = 'SELECT * FROM proxies WHERE 1=1';
  const params: any[] = [];

  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters?.country) {
    query += ' AND country_code = ?';
    params.push(filters.country);
  }
  if (filters?.anonymity) {
    query += ' AND anonymity = ?';
    params.push(filters.anonymity);
  }

  // Сортировка: сначала с latency, потом без (NULL в конце)
  query += ' ORDER BY CASE WHEN latency IS NULL THEN 1 ELSE 0 END, latency ASC';
  
  const stmt = db.prepare(query);
  if (params.length > 0) {
    stmt.bind(params);
  }
  
  const results: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  
  return results;
}

/**
 * Вставить прокси в БД
 * Использует INSERT OR REPLACE для обновления существующих
 */
export function insertProxies(proxies: any[]) {
  let inserted = 0;
  
  for (const proxy of proxies) {
    try {
      db.run(
        `INSERT OR REPLACE INTO proxies (ip, port, type, username, password, status)
         VALUES (?, ?, ?, ?, ?, 'unchecked')`,
        [proxy.ip, proxy.port, proxy.type || 'HTTP', proxy.username || null, proxy.password || null]
      );
      inserted++;
    } catch (e) {
      // Дубликат или ошибка
    }
  }
  
  saveDatabase();
  return inserted;
}

// Счётчик обновлений для оптимизации сохранения
let pendingUpdates = 0;
let saveTimeout: NodeJS.Timeout | null = null;

/**
 * Отложенное сохранение БД
 * Сохраняет через 1 секунду после последнего изменения
 */
function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDatabase();
    pendingUpdates = 0;
  }, 1000);
}

/**
 * Обновить данные прокси по ID
 * Оптимизировано: сохраняет каждые 100 обновлений или с debounce
 */
export function updateProxy(id: number, data: any) {
  // Фильтруем undefined значения (sql.js не принимает undefined)
  const filteredData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      filteredData[key] = value ?? null;
    }
  }
  
  if (Object.keys(filteredData).length === 0) return;
  
  const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
  const values = Object.values(filteredData).map(v => v ?? null);
  
  try {
    db.run(`UPDATE proxies SET ${fields} WHERE id = ?`, [...values, id]);
    pendingUpdates++;
    
    // Сохраняем каждые 100 обновлений или с задержкой
    if (pendingUpdates >= 100) {
      saveDatabase();
      pendingUpdates = 0;
    } else {
      debouncedSave();
    }
  } catch (e) {
    console.error('Ошибка обновления прокси:', e);
  }
}

/** Удалить прокси по массиву ID */
export function deleteProxies(ids: number[]) {
  const placeholders = ids.map(() => '?').join(',');
  db.run(`DELETE FROM proxies WHERE id IN (${placeholders})`, ids);
  saveDatabase();
}

/** Удалить все прокси */
export function clearAllProxies() {
  db.run('DELETE FROM proxies');
  saveDatabase();
}

/** Получить список источников */
export function getSources() {
  const stmt = db.prepare('SELECT * FROM sources');
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/** Получить все настройки */
export function getSettings() {
  const stmt = db.prepare('SELECT key, value FROM settings');
  const settings: Record<string, any> = {};
  
  while (stmt.step()) {
    const row = stmt.getAsObject() as { key: string; value: string };
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }
  stmt.free();
  
  return settings;
}

/** Сохранить настройку */
export function saveSetting(key: string, value: any) {
  const strValue = typeof value === 'string' ? value : JSON.stringify(value);
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, strValue]);
  saveDatabase();
}
