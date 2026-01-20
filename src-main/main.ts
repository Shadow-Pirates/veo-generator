import { app, BrowserWindow, protocol, shell } from 'electron'
import path from 'path'
import { initDatabase } from './services/database'
import { setupIpcHandlers } from './services/ipc'
import { getDataPath, ensureDirectories } from './services/file'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    titleBarStyle: 'default',
    show: false,
  })

  // 开发模式加载本地服务器，生产模式加载打包文件
  const isDev = !app.isPackaged
  if (isDev) {
    // 开发模式：连接 Vite 服务器
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
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
    const filePath = request.url.replace('local-file://', '')
    callback({ path: decodeURIComponent(filePath) })
  })
}

app.whenReady().then(async () => {
  // 确保数据目录存在
  ensureDirectories()
  
  // 初始化数据库
  initDatabase()
  
  // 注册文件协议
  registerFileProtocol()
  
  // 设置 IPC 处理器
  setupIpcHandlers()
  
  // 创建窗口
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 导出获取数据路径的函数供 IPC 使用
export { getDataPath }
