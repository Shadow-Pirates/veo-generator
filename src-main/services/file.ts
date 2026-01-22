import { app, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import Store from 'electron-store'

function canWriteToDir(dirPath: string): boolean {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    const testFile = path.join(dirPath, '.write_test')
    fs.writeFileSync(testFile, 'ok')
    fs.unlinkSync(testFile)
    return true
  } catch {
    return false
  }
}

export async function saveFilesToDirectory(
  dirPath: string,
  items: Array<{ sourcePath: string; fileName: string }>
): Promise<{ success: boolean; saved?: number; failed?: number; errors?: string[]; dirPath?: string; error?: string }> {
  try {
    if (!dirPath || typeof dirPath !== 'string') {
      return { success: false, error: 'Invalid directory' }
    }
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'No files to save' }
    }

    fs.mkdirSync(dirPath, { recursive: true })
    const errors: string[] = []
    let saved = 0
    let failed = 0

    for (const it of items) {
      try {
        const src = String(it?.sourcePath || '')
        if (!src || !fs.existsSync(src)) {
          failed++
          continue
        }

        const safeName = sanitizeWindowsFilename(String(it?.fileName || ''))
        const baseName = path.basename(safeName || path.basename(src))
        const ext = path.extname(baseName) || path.extname(src)
        const baseNoExt = ext ? baseName.slice(0, -ext.length) : baseName

        let dest = path.join(dirPath, `${baseNoExt}${ext}`)
        let n = 1
        while (fs.existsSync(dest)) {
          dest = path.join(dirPath, `${baseNoExt}(${n})${ext}`)
          n++
          if (n > 999) break
        }

        fs.copyFileSync(src, dest)
        saved++
      } catch (e: any) {
        failed++
        errors.push(e?.message || String(e))
      }
    }

    return { success: true, saved, failed, errors, dirPath }
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) }
  }
}

export function getDataBasePath(): string {
  const store = new Store()
  const configured = store.get('dataDir', '') as string
  if (configured && typeof configured === 'string') {
    return configured
  }

  // 默认优先使用打包后的 exe 同目录下的 data/（如果可写）
  if (app.isPackaged) {
    const exeDir = path.dirname(app.getPath('exe'))
    const candidate = path.join(exeDir, 'data')
    if (canWriteToDir(candidate)) {
      return candidate
    }
  }

  // 回退到 Electron 默认 userData 目录
  return path.join(app.getPath('userData'), 'data')
}

export function migrateDataDirectory(oldBase: string, newBase: string) {
  if (!oldBase || !newBase) return
  if (oldBase === newBase) return
  if (!fs.existsSync(oldBase)) return

  try {
    fs.mkdirSync(newBase, { recursive: true })
  } catch {
    return
  }

  const subDirs = ['images', 'videos', 'thumbnails']
  for (const dir of subDirs) {
    const from = path.join(oldBase, dir)
    const to = path.join(newBase, dir)
    if (!fs.existsSync(from)) continue

    try {
      // Node.js 16+ 支持 fs.cpSync
      ;(fs as any).cpSync(from, to, { recursive: true, force: false, errorOnExist: false })
    } catch {
      // 忽略复制失败（例如权限问题），至少不影响新目录写入
    }
  }

  // 尝试迁移 DB 文件（如尚不存在）
  const oldDb = path.join(oldBase, 'veo-studio.db')
  const newDb = path.join(newBase, 'veo-studio.db')
  try {
    if (fs.existsSync(oldDb) && !fs.existsSync(newDb)) {
      fs.copyFileSync(oldDb, newDb)
    }
  } catch {
    // ignore
  }
}

// 获取数据目录路径
export function getDataPath(...subPaths: string[]): string {
  return path.join(getDataBasePath(), ...subPaths)
}

// 确保必要的目录存在
export function ensureDirectories() {
  const dirs = [
    getDataPath(),
    getDataPath('images'),
    getDataPath('videos'),
    getDataPath('thumbnails'),
  ]
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

// 下载文件到本地
export async function downloadFile(
  url: string,
  filename: string,
  subDir: string = 'images',
  extraHeaders?: Record<string, string>
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      fs.mkdirSync(getDataPath(subDir), { recursive: true })
    } catch {
      // ignore
    }
    const filePath = getDataPath(subDir, filename)
    const file = fs.createWriteStream(filePath)
    
    const protocol = url.startsWith('https') ? https : http
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      ...(extraHeaders || {}),
    }
    
    protocol.get(url, { headers }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // 处理重定向
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          file.close()
          fs.unlink(filePath, () => {})
          let next = redirectUrl
          try {
            next = new URL(redirectUrl, url).toString()
          } catch {
            // keep as-is
          }
          downloadFile(next, filename, subDir, extraHeaders).then(resolve).catch(reject)
          return
        }
      }
      
      if (response.statusCode !== 200) {
        file.close()
        fs.unlink(filePath, () => {})
        reject(new Error(`Download failed with status ${response.statusCode}`))
        return
      }
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close(() => {
          try {
            const st = fs.statSync(filePath)
            if (!st.isFile() || st.size <= 0) {
              fs.unlink(filePath, () => {})
              reject(new Error('Downloaded file is empty'))
              return
            }
            resolve(filePath)
          } catch (e) {
            fs.unlink(filePath, () => {})
            reject(e)
          }
        })
      })
    })
      .on('error', (err) => {
        fs.unlink(filePath, () => {})
        reject(err)
      })

    file.on('error', (err) => {
      fs.unlink(filePath, () => {})
      reject(err)
    })
  })
}

// 保存 Buffer 到文件
export function saveFile(buffer: Buffer, filename: string, subDir: string = 'images'): string {
  const filePath = getDataPath(subDir, filename)
  fs.writeFileSync(filePath, buffer)
  return filePath
}

// 删除文件
export function deleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
  } catch (e) {
    console.error('Delete file error:', e)
  }
  return false
}

// 打开文件
export function openFile(filePath: string) {
  shell.openPath(filePath)
}

// 在文件管理器中显示文件
export function showInFolder(filePath: string) {
  shell.showItemInFolder(filePath)
}

// 选择目录对话框
export async function selectDirectory(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  
  return result.filePaths[0]
}

// 获取文件的本地协议 URL
export function getLocalFileUrl(filePath: string): string {
  // 使用 local-file:// 自定义协议，避免开发模式下 http 页面加载 file:// 受限
  // registerFileProtocol 会把该 URL 映射回真实文件路径
  const normalized = filePath.replace(/\\/g, '/')
  return `local-file:///${encodeURI(normalized)}`
}

// 检查文件是否存在
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

function toFsPath(inputPathOrUrl: string): string | null {
  if (!inputPathOrUrl || typeof inputPathOrUrl !== 'string') return null

  // Already an absolute Windows path
  if (/^[A-Za-z]:[\\/]/.test(inputPathOrUrl)) {
    return inputPathOrUrl.replace(/\//g, '\\')
  }

  if (inputPathOrUrl.startsWith('local-file://') || inputPathOrUrl.startsWith('file://')) {
    try {
      const url = new URL(inputPathOrUrl)

      // Compatibility: local-file://c/Users/... (host=c)
      if (url.hostname && url.hostname.length === 1) {
        const drive = url.hostname.toUpperCase()
        const rest = decodeURIComponent(url.pathname).replace(/^\/+/, '')
        return `${drive}:\\${rest.replace(/\//g, '\\')}`
      }

      let p = decodeURIComponent(url.pathname)
      // Windows: file:///C:/... => /C:/...
      if (p.startsWith('/') && /^[A-Za-z]:/.test(p.slice(1))) {
        p = p.slice(1)
      }
      p = p.replace(/^\/+/, '')
      if (/^[A-Za-z]:/.test(p)) {
        return p.replace(/\//g, '\\')
      }
      return null
    } catch {
      return null
    }
  }

  return null
}

function sanitizeWindowsFilename(input: string) {
  const s = String(input || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F#]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return s.replace(/[.\s]+$/g, '')
}

export function deleteLocalFileUnderDataDir(pathOrUrl: string): { success: boolean; freedBytes?: number; error?: string } {
  try {
    const fsPath = toFsPath(pathOrUrl)
    if (!fsPath) {
      return { success: false, error: 'Invalid path' }
    }
    if (!isUnderDataBasePath(fsPath)) {
      return { success: false, error: 'Refuse to delete outside data directory' }
    }
    if (!fs.existsSync(fsPath)) {
      return { success: true, freedBytes: 0 }
    }
    const stat = fs.statSync(fsPath)
    if (!stat.isFile()) {
      return { success: false, error: 'Not a file' }
    }
    fs.unlinkSync(fsPath)
    return { success: true, freedBytes: stat.size }
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) }
  }
}

export async function saveFileAs(sourcePath: string, suggestedName?: string): Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }> {
  try {
    if (!sourcePath || typeof sourcePath !== 'string') {
      return { success: false, error: 'Invalid source path' }
    }

    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Source file not found' }
    }

    const ext = path.extname(sourcePath)
    const base = path.basename(sourcePath)
    let suggested = typeof suggestedName === 'string' ? sanitizeWindowsFilename(suggestedName) : ''
    if (suggested) {
      suggested = path.basename(suggested)
      if (ext && !suggested.toLowerCase().endsWith(ext.toLowerCase())) {
        suggested = `${suggested}${ext}`
      }
    }

    const result = await dialog.showSaveDialog({
      defaultPath: suggested || base,
      filters: ext
        ? [{ name: ext.replace('.', '').toUpperCase(), extensions: [ext.replace('.', '')] }]
        : undefined,
    })

    if (result.canceled || !result.filePath) {
      return { success: true, canceled: true }
    }

    fs.mkdirSync(path.dirname(result.filePath), { recursive: true })
    fs.copyFileSync(sourcePath, result.filePath)

    return { success: true, path: result.filePath }
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) }
  }
}

function getDirStats(dirPath: string): { fileCount: number; totalBytes: number } {
  let fileCount = 0
  let totalBytes = 0

  if (!fs.existsSync(dirPath)) {
    return { fileCount, totalBytes }
  }

  let entries: fs.Dirent[] = []
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return { fileCount, totalBytes }
  }

  for (const entry of entries) {
    const p = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      const sub = getDirStats(p)
      fileCount += sub.fileCount
      totalBytes += sub.totalBytes
      continue
    }
    if (entry.isFile()) {
      try {
        const stat = fs.statSync(p)
        fileCount += 1
        totalBytes += stat.size
      } catch {
        // ignore
      }
    }
  }

  return { fileCount, totalBytes }
}

function isUnderDataBasePath(targetPath: string): boolean {
  try {
    const base = path.resolve(getDataBasePath())
    const target = path.resolve(targetPath)
    return target === base || target.startsWith(base + path.sep)
  } catch {
    return false
  }
}

function isUnderDir(targetPath: string, baseDir: string): boolean {
  try {
    const base = path.resolve(baseDir)
    const target = path.resolve(targetPath)
    return target === base || target.startsWith(base + path.sep)
  } catch {
    return false
  }
}

function walkFiles(
  dirPath: string,
  cb: (filePath: string) => void,
  depth: number = 0
): void {
  if (depth > 20) return
  let entries: fs.Dirent[] = []
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const p = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      walkFiles(p, cb, depth + 1)
      continue
    }
    if (entry.isFile()) {
      cb(p)
    }
  }
}

export function listStorageFiles(target: 'images' | 'videos' | 'thumbnails') {
  const basePath = getDataBasePath()
  const dir = getDataPath(target)

  if (!isUnderDataBasePath(dir)) {
    return { success: false, error: 'Refuse to list outside data directory' }
  }

  const files: Array<{ name: string; path: string; url: string; size: number; mtimeMs: number }> = []

  if (!fs.existsSync(dir)) {
    return { success: true, basePath, dir, files }
  }

  walkFiles(dir, (filePath) => {
    try {
      const stat = fs.statSync(filePath)
      if (!stat.isFile()) return
      files.push({
        name: path.basename(filePath),
        path: filePath,
        url: getLocalFileUrl(filePath),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      })
    } catch {
      // ignore
    }
  })

  files.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return { success: true, basePath, dir, files }
}

export function deleteStorageFiles(target: 'images' | 'videos' | 'thumbnails', filePaths: string[]) {
  try {
    const dir = getDataPath(target)
    if (!isUnderDataBasePath(dir)) {
      return { success: false, error: 'Refuse to delete outside data directory' }
    }

    let removedFiles = 0
    let freedBytes = 0

    for (const p of filePaths || []) {
      if (!p || typeof p !== 'string') continue
      if (!isUnderDir(p, dir)) continue
      try {
        const stat = fs.statSync(p)
        if (!stat.isFile()) continue
        fs.unlinkSync(p)
        removedFiles += 1
        freedBytes += stat.size
      } catch {
        // ignore
      }
    }

    return { success: true, removedFiles, freedBytes }
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) }
  }
}

export function getStorageStats() {
  const basePath = getDataBasePath()
  const imagesPath = getDataPath('images')
  const videosPath = getDataPath('videos')
  const thumbnailsPath = getDataPath('thumbnails')

  const images = getDirStats(imagesPath)
  const videos = getDirStats(videosPath)
  const thumbnails = getDirStats(thumbnailsPath)

  return {
    basePath,
    images,
    videos,
    thumbnails,
    totalBytes: images.totalBytes + videos.totalBytes + thumbnails.totalBytes,
  }
}

export function cleanupStorage(target: 'images' | 'videos' | 'thumbnails' | 'all') {
  try {
    const basePath = getDataBasePath()
    const targets: Array<{ key: 'images' | 'videos' | 'thumbnails'; dir: string }> = [
      { key: 'images', dir: getDataPath('images') },
      { key: 'videos', dir: getDataPath('videos') },
      { key: 'thumbnails', dir: getDataPath('thumbnails') },
    ]

    const selected = target === 'all' ? targets : targets.filter(t => t.key === target)
    let removedFiles = 0
    let freedBytes = 0

    for (const t of selected) {
      if (!isUnderDataBasePath(t.dir)) {
        return { success: false, error: 'Refuse to cleanup outside data directory' }
      }

      const before = getDirStats(t.dir)
      freedBytes += before.totalBytes
      removedFiles += before.fileCount

      try {
        if (fs.existsSync(t.dir)) {
          fs.rmSync(t.dir, { recursive: true, force: true })
        }
        fs.mkdirSync(t.dir, { recursive: true })
      } catch {
        // ignore
      }
    }

    return { success: true, basePath, removedFiles, freedBytes }
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) }
  }
}

export function deleteDirectory(dirPath: string): { success: boolean; error?: string } {
  try {
    if (!dirPath || typeof dirPath !== 'string') {
      return { success: false, error: 'Invalid path' }
    }

    const normalized = path.resolve(dirPath)

    // basic safety guards: never delete drive root like C:\
    if (/^[A-Za-z]:\\?$/.test(normalized)) {
      return { success: false, error: 'Refuse to delete drive root' }
    }

    if (!fs.existsSync(normalized)) {
      return { success: true }
    }

    fs.rmSync(normalized, { recursive: true, force: true })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) }
  }
}
