import { app, BrowserWindow, dialog, ipcMain, nativeImage, Tray, Menu, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Store from 'electron-store'
import { registerSpotifyIPCs } from './spotify'
import { registerYoutubeIPCs } from './youtube'
import { registerPlaylistIPCs } from './playlist'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const store = new Store({
  defaults: {
    theme: {
      name: 'Ocean',
      primary: '#3B82F6',
      secondary: '#10B981',
      accent: '#F59E0B',
      background: '#0F172A',
      surface: '#1E293B',
      surfaceAlt: '#334155',
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
      border: '#475569',
      error: '#EF4444',
      success: '#22C55E',
      warning: '#F59E0B',
      fontFamily: 'Inter, system-ui, sans-serif',
      borderRadius: 12,
      compact: true,
      blur: false,
      blurAmount: 20,
      spacing: 4,
      animations: true,
    },
    windowBounds: { width: 400, height: 600, x: undefined as number | undefined, y: undefined as number | undefined },
    alwaysOnTop: false,
    spotifyToken: null as string | null,
    spotifyRefreshToken: null as string | null,
  }
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

process.on('uncaughtException', (error) => {
  console.error('[Main Uncaught]', error)
})
process.on('unhandledRejection', (error) => {
  console.error('[Main Unhandled Rejection]', error)
})

function createMainWindow() {
  const bounds = store.get('windowBounds')

  const iconPath = join(__dirname, '../image.ico')

  mainWindow = new BrowserWindow({
    width: bounds.width || 400,
    height: bounds.height || 600,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: false,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      backgroundThrottling: false,
    },
    icon: iconPath,
    show: false,
    minWidth: 300,
    minHeight: 400,
  })

  mainWindow.setBackgroundColor('#0F172A')

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'bottom' })
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Show window after ready to avoid flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer:${level}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.on('close', () => {
    if (!mainWindow?.isDestroyed()) {
      const b = mainWindow?.getBounds()
      if (b) store.set('windowBounds', b)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    app.quit()
  })
}

function createTray() {
  const iconPath = join(__dirname, '../image.ico')
  let trayIcon: nativeImage
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow?.show()
          mainWindow?.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])

  tray.setToolTip('Nyu\'rka')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// ─── Auto-updater ───
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version of Nyu\'rka is available. Do you want to download it?',
    buttons: ['Download', 'Later'],
  }).then(({ response }) => {
    if (response === 0) autoUpdater.downloadUpdate()
  })
})

autoUpdater.on('update-not-available', () => {
  // Silent — gak perlu notif kalo gak ada update
})

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. Restart Nyu\'rka to apply?',
    buttons: ['Restart', 'Later'],
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall()
  })
})

app.whenReady().then(() => {
  createMainWindow()
  createTray()

  registerSpotifyIPCs(store, mainWindow!)
  registerYoutubeIPCs()
  registerPlaylistIPCs(() => store.get('spotifyToken') as string | null)

  // Cek update setelah window siap
  setTimeout(() => autoUpdater.checkForUpdates(), 3000)

  // Theme IPC
  ipcMain.handle('get-theme', () => store.get('theme'))
  ipcMain.handle('set-theme', (_event, theme) => {
    store.set('theme', theme)
    return true
  })

  // Window controls
  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow?.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window-close', () => mainWindow?.close())
  ipcMain.on('window-hide', () => mainWindow?.hide())

  // Always on top
  ipcMain.handle('get-always-on-top', () => store.get('alwaysOnTop'))
  ipcMain.on('set-always-on-top', (_event, value: boolean) => {
    store.set('alwaysOnTop', value)
    mainWindow?.setAlwaysOnTop(value)
  })

  // Tray notification
  ipcMain.on('show-tray-notification', (_event, { title, body }: { title: string; body: string }) => {
    tray?.displayBalloon({ title, content: body })
  })

  // Store
  ipcMain.handle('store-get', (_event, key: string) => store.get(key))
  ipcMain.handle('store-set', (_event, key: string, value: any) => {
    store.set(key, value)
    return true
  })

  // Auto-update IPC
  ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates())
  ipcMain.on('check-update-now', () => {
    autoUpdater.autoDownload = true
    autoUpdater.checkForUpdates()
  })

  // File dialog for custom GIF mascot
  ipcMain.handle('select-gif', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select GIF for Mascot',
      filters: [{ name: 'GIF Images', extensions: ['gif'] }],
      properties: ['openFile'],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  // Lyrics fetch via main process (biar gak kena CSP blokade)
  ipcMain.handle('fetch-lyrics', async (_event, url: string) => {
    try {
      const response = await net.fetch(url)
      if (!response.ok) {
        return { error: `HTTP ${response.status}`, status: response.status }
      }
      const data = await response.json()
      return { data, status: response.status }
    } catch (err) {
      return { error: (err as Error).message, status: 0 }
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (!mainWindow) {
    createMainWindow()
  } else {
    mainWindow.show()
  }
})

app.on('before-quit', () => {
  tray?.destroy()
  tray = null
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}
