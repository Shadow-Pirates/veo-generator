import { app, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'

// 获取数据目录路径
export function getDataPath(...subPaths: string[]): string {
  const basePath = path.join(app.getPath('userData'), 'data')
  return path.join(basePath, ...subPaths)
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
export async function downloadFile(url: string, filename: string, subDir: string = 'images'): Promise<string> {
  return new Promise((resolve, reject) => {
    const filePath = getDataPath(subDir, filename)
    const file = fs.createWriteStream(filePath)
    
    const protocol = url.startsWith('https') ? https : http
    
    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // 处理重定向
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          downloadFile(redirectUrl, filename, subDir).then(resolve).catch(reject)
          return
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`))
        return
      }
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        resolve(filePath)
      })
    }).on('error', (err) => {
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
  // 使用 file:// 协议
  return `file://${filePath.replace(/\\/g, '/')}`
}

// 检查文件是否存在
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}
