/**
 * Обработчики IPC (Inter-Process Communication)
 * 
 * Связывает renderer процесс (React UI) с main процессом (Node.js).
 * Все операции с БД, файлами и сетью проходят через эти обработчики.
 */

import { ipcMain, dialog } from 'electron';
import { 
  getAllProxies, 
  insertProxies, 
  deleteProxies, 
  clearAllProxies,
  getSettings,
  saveSetting,
  getSources
} from './database';
import { parseFromSources } from './parsers';
import { ProxyChecker } from './checker';
import { exportProxies } from './exporter';

/** Текущий экземпляр чекера (для возможности остановки) */
let checker: ProxyChecker | null = null;

/**
 * Настройка всех IPC обработчиков
 * Вызывается при инициализации приложения
 */
export function setupIpcHandlers() {
  
  // ==================== Операции с прокси ====================
  
  /** Получить список прокси с фильтрацией */
  ipcMain.handle('get-proxies', async (_, filters) => {
    return getAllProxies(filters);
  });

  /** Сохранить прокси в БД */
  ipcMain.handle('save-proxies', async (_, proxies) => {
    return insertProxies(proxies);
  });

  /** Удалить прокси по ID */
  ipcMain.handle('delete-proxies', async (_, ids) => {
    deleteProxies(ids);
    return true;
  });

  /** Очистить все прокси */
  ipcMain.handle('clear-proxies', async () => {
    clearAllProxies();
    return true;
  });

  // ==================== Парсинг ====================

  /** Парсинг прокси из выбранных источников */
  ipcMain.handle('parse-proxies', async (event, sourceNames, filters) => {
    const sources = getSources() as any[];
    
    // Фильтруем источники по выбранным названиям
    const selectedSources = sourceNames.length > 0 
      ? sources.filter(s => sourceNames.includes(s.name))
      : sources.filter(s => s.enabled);
    
    // Получаем прокси для парсинга из настроек (если источники заблокированы)
    const settings = getSettings();
    const proxyForParsing = settings.proxyForParsing;

    // Парсим и отправляем прогресс в renderer
    const proxies = await parseFromSources(
      selectedSources, 
      filters, 
      proxyForParsing,
      (progress) => {
        event.sender.send('parse-progress', progress);
      }
    );

    // Сохраняем в БД
    if (proxies.length > 0) {
      insertProxies(proxies);
    }

    return proxies;
  });

  // ==================== Проверка ====================

  /** Проверка списка прокси */
  ipcMain.handle('check-proxies', async (event, proxies, options) => {
    const settings = getSettings();
    
    // Создаём чекер с опциями
    checker = new ProxyChecker({
      threads: options.threads || settings.threads || 50,
      timeout: options.timeout || settings.timeout || 10000,
      testUrl: options.testUrl || 'http://httpbin.org/ip',
      deleteDead: options.deleteDead ?? true,
      checkAnonymity: options.checkAnonymity ?? true,
    });

    // Подписываемся на прогресс и пересылаем в renderer
    checker.on('progress', (progress) => {
      event.sender.send('check-progress', progress);
    });

    const results = await checker.checkAll(proxies);
    checker = null;
    
    return results;
  });

  /** Остановить текущую проверку */
  ipcMain.handle('stop-checking', async () => {
    if (checker) {
      checker.stop();
      checker = null;
    }
    return true;
  });

  // ==================== Экспорт ====================

  /** Экспортировать прокси в файл */
  ipcMain.handle('export-proxies', async (_, proxies, format, filePath) => {
    return exportProxies(proxies, format, filePath);
  });

  /** Открыть диалог выбора пути для сохранения */
  ipcMain.handle('select-export-path', async (_, format) => {
    const extensions: Record<string, string[]> = {
      txt: ['txt'],
      csv: ['csv'],
      json: ['json'],
      nekobox: ['txt'],   // URI-ссылки в текстовом файле
      v2ray: ['txt'],     // URI-ссылки в текстовом файле
      clash: ['yaml', 'yml'],
    };

    const result = await dialog.showSaveDialog({
      filters: [
        { name: format.toUpperCase(), extensions: extensions[format] || ['txt'] }
      ],
    });

    return result.filePath;
  });

  // ==================== Импорт ====================

  /** Открыть диалог выбора файла для импорта */
  ipcMain.handle('select-import-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [
        { name: 'Proxy Files', extensions: ['txt', 'csv', 'json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    return result.filePaths[0];
  });

  /** Импортировать прокси из файла */
  ipcMain.handle('import-proxies', async (_, filePath) => {
    const { importProxiesFromFile } = await import('./importer');
    const proxies = await importProxiesFromFile(filePath);
    
    if (proxies.length > 0) {
      insertProxies(proxies);
    }
    
    return proxies.length;
  });

  // ==================== Настройки ====================

  /** Получить все настройки */
  ipcMain.handle('get-settings', async () => {
    return getSettings();
  });

  /** Сохранить настройки */
  ipcMain.handle('save-settings', async (_, settings) => {
    for (const [key, value] of Object.entries(settings)) {
      saveSetting(key, value);
    }
    return true;
  });
}
