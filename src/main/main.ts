/**
 * Главный процесс Electron
 * 
 * Отвечает за:
 * - Создание и управление окном приложения
 * - Инициализацию базы данных
 * - Обработку системных событий (закрытие, сворачивание)
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { setupIpcHandlers } from './ipc';
import { initDatabase } from './database';

/** Ссылка на главное окно приложения */
let mainWindow: BrowserWindow | null = null;

/** Флаг режима разработки */
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * Создаёт главное окно приложения
 * В dev-режиме загружает localhost, в production — собранные файлы
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,                    // Убираем стандартную рамку Windows
    titleBarStyle: 'hidden',         // Скрываем заголовок для кастомного title bar
    webPreferences: {
      nodeIntegration: false,        // Отключаем Node.js в renderer для безопасности
      contextIsolation: true,        // Изолируем контекст preload от renderer
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#0f0f0f',      // Цвет фона при загрузке (тёмная тема)
  });

  if (isDev) {
    // В режиме разработки загружаем с Vite dev-сервера
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // В production загружаем собранные файлы
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Инициализация приложения при готовности Electron
 */
app.whenReady().then(async () => {
  // Инициализируем базу данных перед созданием окна
  await initDatabase();
  
  // Настраиваем обработчики IPC для связи с renderer
  setupIpcHandlers();
  
  // Создаём окно
  createWindow();

  // Обработчики управления окном (кастомный title bar)
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow?.close());
});

// Закрываем приложение при закрытии всех окон (кроме macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Пересоздаём окно при активации (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
