import { app, BrowserWindow, protocol, shell, Tray, Menu, nativeImage, Notification, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import Store from 'electron-store'
import { generationEvents, initDatabase, listActiveGenerations } from './services/database'
import { setupIpcHandlers } from './services/ipc'
import { getDataPath, ensureDirectories } from './services/file'
import { resumePendingVideoTasks } from './services/api'

 if (process.platform === 'win32') {
   try {
     app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
   } catch {
   }
   try {
     app.commandLine.appendSwitch('disable-renderer-backgrounding')
   } catch {
   }
   try {
     app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
   } catch {
   }
   try {
     app.disableHardwareAcceleration()
   } catch {
   }
 }

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  try {
    app.quit()
  } catch {
  }
} else {
  app.on('second-instance', () => {
    try {
      if (mainWindow) {
        showMainWindow()
        return
      }
      if (splashWindow) {
        splashWindow.show()
        splashWindow.focus()
        return
      }
      if (app.isReady()) {
        createWindow()
      }
    } catch {
      // ignore
    }
  })
}

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let tray: Tray | null = null
let trayRefreshTimer: NodeJS.Timeout | null = null
let isQuitting = false
let rendererReady = false
let mainWindowReadyToShow = false
let splashShownAt = 0
let revealTimer: NodeJS.Timeout | null = null

function resolveAppIconPath(): string {
  const candidates = [
    path.join(process.resourcesPath || '', 'resources', 'icon.ico'),
    path.join(app.getAppPath(), 'resources', 'icon.ico'),
    path.join(__dirname, '../resources/icon.ico'),
    path.join(process.cwd(), 'resources', 'icon.ico'),
  ]

  for (const p of candidates) {
    if (!p) continue
    try {
      if (fs.existsSync(p)) return p
    } catch {
      // ignore
    }
  }
  return candidates[candidates.length - 1]
}

function showMainWindow() {
  if (!mainWindow) return
  if (!rendererReady) {
    try {
      splashWindow?.show()
      splashWindow?.focus()
    } catch {
    }
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

function closeSplashWindow() {
  if (!splashWindow) return
  try {
    splashWindow.close()
  } catch {
  }
  splashWindow = null
}

function scheduleRevealMainWindow() {
  if (!rendererReady) return
  if (!mainWindowReadyToShow) return
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    closeSplashWindow()
    return
  }
  const minMs = 3000
  const elapsed = splashShownAt ? Date.now() - splashShownAt : 0
  const waitMs = Math.max(0, minMs - elapsed)

  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }

  const doReveal = () => {
    revealTimer = null
    closeSplashWindow()
    showMainWindow()
  }

  if (waitMs > 0) {
    revealTimer = setTimeout(doReveal, waitMs)
  } else {
    doReveal()
  }
}

function createSplashWindow() {
  if (splashWindow) return
  splashShownAt = 0

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>交绘AI</title>
    <style>
      html, body { height: 100%; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif; background: #fff; }
      .wrap { height: 100%; display: flex; align-items: center; justify-content: center; }
      .card { width: 100%; padding: 28px 20px; text-align: center; }
      .title { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 14px; }
      .sub { font-size: 13px; color: #6b7280; }
      .spinner { width: 28px; height: 28px; border-radius: 9999px; border: 3px solid #e5e7eb; border-top-color: #2563eb; margin: 0 auto 14px; animation: spin 0.9s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="spinner"></div>
        <div class="title">交绘AI</div>
        <div class="sub">应用启动中...</div>
      </div>
    </div>
  </body>
</html>`

  const tmpHtmlPath = path.join(app.getPath('temp'), 'veo-splash.html')
  try {
    fs.writeFileSync(tmpHtmlPath, html, 'utf-8')
  } catch {
  }

  splashWindow = new BrowserWindow({
    width: 360,
    height: 240,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    alwaysOnTop: true,
    center: true,
    show: false,
    transparent: false,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: '#ffffff',
    icon: resolveAppIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })

  try {
    splashWindow.setMenuBarVisibility(false)
    ;(splashWindow as any).removeMenu?.()
  } catch {
  }

  splashWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (!splashWindow) return
      splashShownAt = Date.now()
      splashWindow.show()
      scheduleRevealMainWindow()
    }, 150)
  })

  try {
    splashWindow.loadFile(tmpHtmlPath)
  } catch {
    splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  }

  splashWindow.on('closed', () => {
    splashWindow = null
  })
}

function toggleMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    showMainWindow()
  }
}

async function navigateTo(hashPath: string) {
  if (!mainWindow) return
  const p = hashPath.startsWith('/') ? hashPath : `/${hashPath}`
  try {
    await mainWindow.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(p)}`)
  } catch {
    try {
      const url = mainWindow.webContents.getURL()
      const base = url.split('#')[0]
      await mainWindow.loadURL(`${base}#${p}`)
    } catch {
      // ignore
    }
  }
}

function getTaskSummary() {
  const items = listActiveGenerations(200)
  const counts = {
    processing: 0,
    pending: 0,
    failed: 0,
    other: 0,
  }
  for (const g of items) {
    if (g.status === 'processing') counts.processing += 1
    else if (g.status === 'pending') counts.pending += 1
    else if (g.status === 'failed') counts.failed += 1
    else counts.other += 1
  }
  return { items, counts }
}

function refreshTray() {
  if (!tray) return
  const { items, counts } = getTaskSummary()

  tray.setToolTip(
    `交绘AI\n进行中: ${counts.processing} 失败: ${counts.failed} 待处理: ${counts.pending}`
  )

  const taskLines = items.slice(0, 5).map((g) => {
    const title = String(g.prompt || '').replace(/\s+/g, ' ').slice(0, 30)
    const suffix = title.length >= 30 ? '…' : ''
    const st = g.status === 'processing' ? '进行中' : g.status === 'failed' ? '失败' : g.status
    return {
      label: `${st}: ${title}${suffix}`,
      enabled: false,
    } as Electron.MenuItemConstructorOptions
  })

  const menu = Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible() ? '隐藏窗口' : '显示窗口',
      click: () => toggleMainWindow(),
    },
    { type: 'separator' },
    { label: '设置', click: async () => { showMainWindow(); await navigateTo('/settings') } },
    { type: 'separator' },
    {
      label: `任务状态：进行中 ${counts.processing} / 失败 ${counts.failed} / 待处理 ${counts.pending}`,
      enabled: false,
    },
    ...(taskLines.length > 0 ? taskLines : [{ label: '暂无未完成任务', enabled: false }]),
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        trayRefreshTimer && clearInterval(trayRefreshTimer)
        trayRefreshTimer = null
        tray?.destroy()
        tray = null
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
}

function setupTray() {
  if (tray) return

  const iconPath = resolveAppIconPath()
  const img = nativeImage.createFromPath(iconPath)
  if (img.isEmpty()) {
    console.warn('[tray] icon load failed:', iconPath)
  }
  tray = new Tray(img)
  tray.on('click', () => toggleMainWindow())
  refreshTray()

  trayRefreshTimer = setInterval(() => {
    try {
      refreshTray()
    } catch {
      // ignore
    }
  }, 5000)
}

function createWindow() {
  mainWindowReadyToShow = false
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: resolveAppIconPath(),
    title: '交绘AI',
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    titleBarStyle: 'default',
    show: false,
  })

  try {
    mainWindow.setMenuBarVisibility(false)
    ;(mainWindow as any).removeMenu?.()
  } catch {
    // ignore
  }

  // 开发模式加载本地服务器，生产模式加载打包文件
  const isDev = !app.isPackaged
  if (isDev) {
    // 开发模式：连接 Vite 服务器
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindowReadyToShow = true
    scheduleRevealMainWindow()
  })

  mainWindow.on('close', (e) => {
    let closeToTray = true
    try {
      closeToTray = Boolean(new Store().get('closeToTray', true))
    } catch {
      closeToTray = true
    }
    if (!isQuitting && closeToTray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 外部链接在默认浏览器中打开
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// 注册自定义协议用于访问本地文件
function registerFileProtocol() {
  protocol.registerFileProtocol('local-file', (request: any, callback: any) => {
    try {
      const url = new URL(request.url)
      let pathname = decodeURIComponent(url.pathname)
      const hostname = url.hostname

      // 处理异常情况：local-file:////C:/... 会得到 //C:/...，先压缩为 /C:/...
      pathname = pathname.replace(/^\/+/, '/')

      if (process.platform === 'win32') {
        // 兼容错误格式：local-file://c/Users/...（host=c，pathname=/Users/...）
        if (hostname && hostname.length === 1 && !/^[A-Za-z]:/.test(pathname)) {
          pathname = `${hostname.toUpperCase()}:\\${pathname.replace(/^\/+/, '').replace(/\//g, '\\')}`
        }

        if (pathname.startsWith('/') && /^[A-Za-z]:/.test(pathname.slice(1))) {
          pathname = pathname.slice(1)
        }
        pathname = pathname.replace(/\//g, '\\')
      }

      callback({ path: pathname })
    } catch {
      callback({ error: -324 })
    }
  })
}

app.whenReady().then(async () => {
  try {
    app.setName('交绘AI')
  } catch {
    // ignore
  }

  try {
    Menu.setApplicationMenu(null)
  } catch {
    // ignore
  }

  try {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.veo-studio.app')
    }
  } catch {
    // ignore
  }

  // 确保数据目录存在
  ensureDirectories()
  
  // 初始化数据库
  initDatabase()
  
  // 注册文件协议
  registerFileProtocol()
  
  // 设置 IPC 处理器
  setupIpcHandlers()

  ipcMain.on('app:ready', () => {
    rendererReady = true
    scheduleRevealMainWindow()
  })

  try {
    const store = new Store()
    const apiKey = String(store.get('apiKey', '') || '')
    resumePendingVideoTasks(apiKey)
  } catch {
    // ignore
  }
  
  createSplashWindow()

  // 创建窗口
  createWindow()

  setupTray()

  generationEvents.on('completed', (payload: any) => {
    try {
      const store = new Store()
      const enabled = Boolean(store.get('notifyTaskCompleted', true))
      if (!enabled) return
      const typeName = payload?.type === 'image' ? '图片' : '视频'
      const title = `${typeName}任务已完成`
      const body = String(payload?.prompt || '').trim().slice(0, 120)
      new Notification({ title, body }).show()
    } catch {
      // ignore
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  try {
    const store = new Store()
    const closeToTray = Boolean(store.get('closeToTray', true))
    if (!closeToTray) {
      app.quit()
    }
  } catch {
    app.quit()
  }
})

// 导出获取数据路径的函数供 IPC 使用
export { getDataPath }
