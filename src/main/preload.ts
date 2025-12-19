/**
 * Preload скрипт
 * 
 * Безопасный мост между main и renderer процессами.
 * Экспортирует API для работы с прокси, базой данных и настройками.
 * 
 * Использует contextBridge для изоляции — renderer не имеет
 * прямого доступа к Node.js API.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ==================== Управление окном ====================
  
  /** Свернуть окно */
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  
  /** Развернуть/восстановить окно */
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  
  /** Закрыть окно */
  closeWindow: () => ipcRenderer.send('window-close'),

  // ==================== Операции с прокси ====================
  
  /**
   * Парсинг прокси из выбранных источников
   * @param sources - массив названий источников
   * @param filters - фильтры (типы прокси и т.д.)
   */
  parseProxies: (sources: string[], filters: object) => 
    ipcRenderer.invoke('parse-proxies', sources, filters),
  
  /**
   * Проверка списка прокси
   * @param proxies - массив прокси для проверки
   * @param options - опции (потоки, таймаут, URL, удалять мёртвые)
   */
  checkProxies: (proxies: object[], options: object) => 
    ipcRenderer.invoke('check-proxies', proxies, options),
  
  /** Остановить текущую проверку */
  stopChecking: () => ipcRenderer.invoke('stop-checking'),
  
  // ==================== Работа с базой данных ====================
  
  /**
   * Получить список прокси из БД
   * @param filters - опциональные фильтры (статус, тип, страна)
   */
  getProxies: (filters?: object) => ipcRenderer.invoke('get-proxies', filters),
  
  /** Сохранить прокси в БД */
  saveProxies: (proxies: object[]) => ipcRenderer.invoke('save-proxies', proxies),
  
  /** Удалить прокси по ID */
  deleteProxies: (ids: number[]) => ipcRenderer.invoke('delete-proxies', ids),
  
  /** Очистить все прокси */
  clearProxies: () => ipcRenderer.invoke('clear-proxies'),

  // ==================== Экспорт ====================
  
  /**
   * Экспортировать прокси в файл
   * @param proxies - массив прокси
   * @param format - формат (txt, csv, json, nekobox, v2ray, clash)
   * @param filePath - путь к файлу
   */
  exportProxies: (proxies: object[], format: string, filePath: string) => 
    ipcRenderer.invoke('export-proxies', proxies, format, filePath),
  
  /** Открыть диалог выбора пути для сохранения */
  selectExportPath: (format: string) => ipcRenderer.invoke('select-export-path', format),

  // ==================== Импорт ====================
  
  /** Открыть диалог выбора файла для импорта */
  selectImportFile: () => ipcRenderer.invoke('select-import-file'),
  
  /** Импортировать прокси из файла */
  importProxies: (filePath: string) => ipcRenderer.invoke('import-proxies', filePath),

  // ==================== Настройки ====================
  
  /** Получить все настройки */
  getSettings: () => ipcRenderer.invoke('get-settings'),
  
  /** Сохранить настройки */
  saveSettings: (settings: object) => ipcRenderer.invoke('save-settings', settings),

  // ==================== События (подписки) ====================
  
  /** Подписка на прогресс парсинга */
  onParseProgress: (callback: (progress: object) => void) => {
    ipcRenderer.on('parse-progress', (_, progress) => callback(progress));
  },
  
  /** Подписка на прогресс проверки */
  onCheckProgress: (callback: (progress: object) => void) => {
    ipcRenderer.on('check-progress', (_, progress) => callback(progress));
  },
  
  /** Отписаться от всех событий канала */
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
