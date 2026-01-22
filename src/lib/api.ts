// Electron API 封装
// 通过 preload 脚本暴露的 electronAPI 调用主进程服务

declare global {
  interface Window {
    electronAPI: {
      generateImage: (params: ImageGenParams) => Promise<ImageResult>
      generateVideo: (params: VideoGenParams) => Promise<VideoResult>
      pollVideoStatus: (taskId: string, apiKey: string) => Promise<VideoStatus>
      downloadVideo: (taskId: string, apiKey: string) => Promise<VideoStatus>
      getDraft: (key: string) => Promise<any>
      setDraft: (key: string, value: any) => Promise<{ success: boolean }>
      clearDraft: (key: string) => Promise<{ success: boolean }>
      getTasks: () => Promise<Generation[]>
      getHistory: (filters: HistoryFilters) => Promise<HistoryList>
      getHistoryItem: (id: string) => Promise<Generation>
      deleteHistory: (id: string) => Promise<void>
      toggleFavorite: (id: string) => Promise<{ id: string; is_favorite: boolean }>
      updateTags: (id: string, tags: string[]) => Promise<void>
      getStats: () => Promise<Stats>
      getStorageStats: () => Promise<StorageStats>
      cleanupStorage: (target: 'images' | 'videos' | 'thumbnails' | 'all') => Promise<{ success: boolean; basePath?: string; removedFiles?: number; freedBytes?: number; error?: string }>
      listStorageFiles: (target: 'images' | 'videos' | 'thumbnails') => Promise<{ success: boolean; basePath?: string; dir?: string; files?: StorageFileItem[]; error?: string }>
      deleteStorageFiles: (target: 'images' | 'videos' | 'thumbnails', filePaths: string[]) => Promise<{ success: boolean; removedFiles?: number; freedBytes?: number; error?: string }>
      getTemplates: () => Promise<Template[]>
      getTemplate: (id: number) => Promise<Template>
      createTemplate: (template: Partial<Template>) => Promise<{ id: number }>
      updateTemplate: (id: number, template: Partial<Template>) => Promise<void>
      deleteTemplate: (id: number) => Promise<void>
      toggleTemplateFavorite: (id: number) => Promise<{ id: number; is_favorite: boolean }>
      syncBuiltinTemplates: () => Promise<{ success: boolean }>
      getFilePath: (relativePath: string) => Promise<string>
      openFile: (path: string) => Promise<void>
      selectDirectory: () => Promise<string | null>
      deleteDirectory: (path: string) => Promise<{ success: boolean; error?: string }>
      saveFileAs: (path: string, suggestedName?: string) => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>
      saveFilesToDirectory: (dirPath: string, items: Array<{ sourcePath: string; fileName: string }>) => Promise<{ success: boolean; saved?: number; failed?: number; errors?: string[]; dirPath?: string; error?: string }>
      deleteLocalFile: (pathOrUrl: string) => Promise<{ success: boolean; freedBytes?: number; error?: string }>
      getSettings: () => Promise<Settings>
      saveSettings: (settings: Partial<Settings>) => Promise<void>
      getAppInfo: () => Promise<AppInfo>
      appReady: () => void
    }
  }
}

// 类型定义
export interface ImageGenParams {
  apiKey: string
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
  numImages?: number
  model?: string
  referenceImage?: ArrayBuffer
}

export interface ImageResult {
  id: string
  status: string
  images: string[]
}

export interface VideoGenParams {
  apiKey: string
  prompt: string
  systemContext?: string
  storyboard?: string
  negativePrompt?: string
  aspectRatio?: string
  duration?: number
  model?: string
  imageData?: ArrayBuffer
}

export interface VideoResult {
  id: string
  taskId: string
  status: string
}

export interface VideoStatus {
  status: string
  progress?: number
  videoUrl?: string
  localPath?: string
  error?: string
}

export interface HistoryFilters {
  type?: string
  status?: string
  isFavorite?: boolean
  search?: string
  startAt?: string
  endAt?: string
  page?: number
  pageSize?: number
}

export interface Generation {
  id: string
  type: string
  prompt: string
  system_context?: string
  storyboard?: string
  negative_prompt?: string
  model?: string
  aspect_ratio?: string
  duration?: number
  status: string
  progress: number
  task_id?: string
  result_path?: string
  result_url?: string
  thumbnail_path?: string
  api_response?: any
  error_message?: string
  tags: string[]
  is_favorite: boolean
  reference_images: string[]
  created_at: string
  updated_at?: string
}

export interface HistoryList {
  items: Generation[]
  total: number
  page: number
  pageSize: number
}

export interface Stats {
  total_videos: number
  total_images: number
  completed: number
  favorites: number
}

export interface StorageStats {
  basePath: string
  images: { fileCount: number; totalBytes: number }
  videos: { fileCount: number; totalBytes: number }
  thumbnails: { fileCount: number; totalBytes: number }
  totalBytes: number
}

export interface StorageFileItem {
  name: string
  path: string
  url: string
  size: number
  mtimeMs: number
}

export interface Template {
  id: number
  name: string
  category?: string
  system_context?: string
  storyboard?: string
  negative_prompt?: string
  source?: 'builtin' | 'user'
  is_favorite: boolean
  use_count: number
  created_at: string
  updated_at?: string
}

export interface Settings {
  apiKey: string
  dataDir: string
  theme: string
  closeToTray?: boolean
  notifyTaskCompleted?: boolean
}

export interface AppInfo {
  version: string
  name: string
  dataPath: string
}

// API 封装函数
export const api = {
  // 图片生成
  async generateImage(params: ImageGenParams): Promise<ImageResult> {
    return window.electronAPI.generateImage(params)
  },

  // 视频生成
  async generateVideo(params: VideoGenParams): Promise<VideoResult> {
    return window.electronAPI.generateVideo(params)
  },

  async pollVideoStatus(taskId: string, apiKey: string): Promise<VideoStatus> {
    return window.electronAPI.pollVideoStatus(taskId, apiKey)
  },

  async downloadVideo(taskId: string, apiKey: string): Promise<VideoStatus> {
    return window.electronAPI.downloadVideo(taskId, apiKey)
  },

  async getDraft(key: string): Promise<any> {
    return window.electronAPI.getDraft(key)
  },

  async setDraft(key: string, value: any): Promise<{ success: boolean }> {
    return window.electronAPI.setDraft(key, value)
  },

  async clearDraft(key: string): Promise<{ success: boolean }> {
    return window.electronAPI.clearDraft(key)
  },

  async getTasks(): Promise<Generation[]> {
    return window.electronAPI.getTasks()
  },

  // 历史记录
  async getHistory(filters: HistoryFilters = {}): Promise<HistoryList> {
    return window.electronAPI.getHistory(filters)
  },

  async getHistoryItem(id: string): Promise<Generation> {
    return window.electronAPI.getHistoryItem(id)
  },

  async deleteHistory(id: string): Promise<void> {
    return window.electronAPI.deleteHistory(id)
  },

  async toggleFavorite(id: string): Promise<{ id: string; is_favorite: boolean }> {
    return window.electronAPI.toggleFavorite(id)
  },

  async updateTags(id: string, tags: string[]): Promise<void> {
    return window.electronAPI.updateTags(id, tags)
  },

  async getStats(): Promise<Stats> {
    return window.electronAPI.getStats()
  },

  async getStorageStats(): Promise<StorageStats> {
    return window.electronAPI.getStorageStats()
  },

  async cleanupStorage(target: 'images' | 'videos' | 'thumbnails' | 'all'): Promise<{ success: boolean; basePath?: string; removedFiles?: number; freedBytes?: number; error?: string }> {
    return window.electronAPI.cleanupStorage(target)
  },

  async listStorageFiles(target: 'images' | 'videos' | 'thumbnails'): Promise<{ success: boolean; basePath?: string; dir?: string; files?: StorageFileItem[]; error?: string }> {
    return window.electronAPI.listStorageFiles(target)
  },

  async deleteStorageFiles(target: 'images' | 'videos' | 'thumbnails', filePaths: string[]): Promise<{ success: boolean; removedFiles?: number; freedBytes?: number; error?: string }> {
    return window.electronAPI.deleteStorageFiles(target, filePaths)
  },

  // 模板
  async getTemplates(): Promise<Template[]> {
    return window.electronAPI.getTemplates()
  },

  async getTemplate(id: number): Promise<Template> {
    return window.electronAPI.getTemplate(id)
  },

  async createTemplate(template: Partial<Template>): Promise<{ id: number }> {
    return window.electronAPI.createTemplate(template)
  },

  async updateTemplate(id: number, template: Partial<Template>): Promise<void> {
    return window.electronAPI.updateTemplate(id, template)
  },

  async deleteTemplate(id: number): Promise<void> {
    return window.electronAPI.deleteTemplate(id)
  },

  async toggleTemplateFavorite(id: number): Promise<{ id: number; is_favorite: boolean }> {
    return window.electronAPI.toggleTemplateFavorite(id)
  },

  async syncBuiltinTemplates(): Promise<{ success: boolean }> {
    return window.electronAPI.syncBuiltinTemplates()
  },

  // 文件
  async getFilePath(relativePath: string): Promise<string> {
    return window.electronAPI.getFilePath(relativePath)
  },

  async openFile(path: string): Promise<void> {
    return window.electronAPI.openFile(path)
  },

  async selectDirectory(): Promise<string | null> {
    return window.electronAPI.selectDirectory()
  },

  async deleteDirectory(path: string): Promise<{ success: boolean; error?: string }> {
    return window.electronAPI.deleteDirectory(path)
  },

  async saveFileAs(path: string, suggestedName?: string): Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }> {
    return window.electronAPI.saveFileAs(path, suggestedName)
  },

  async saveFilesToDirectory(
    dirPath: string,
    items: Array<{ sourcePath: string; fileName: string }>
  ): Promise<{ success: boolean; saved?: number; failed?: number; errors?: string[]; dirPath?: string; error?: string }> {
    return window.electronAPI.saveFilesToDirectory(dirPath, items)
  },

  async deleteLocalFile(pathOrUrl: string): Promise<{ success: boolean; freedBytes?: number; error?: string }> {
    return window.electronAPI.deleteLocalFile(pathOrUrl)
  },

  // 设置
  async getSettings(): Promise<Settings> {
    return window.electronAPI.getSettings()
  },

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    return window.electronAPI.saveSettings(settings)
  },

  // 应用信息
  async getAppInfo(): Promise<AppInfo> {
    return window.electronAPI.getAppInfo()
  },
}

// 获取静态文件 URL（本地文件）
export function getStaticUrl(path: string | null | undefined): string {
  if (!path) return ''
  const encodeLocalPath = (p: string) => {
    // Encode everything that could break URL parsing (notably '#' and '?'), while keeping slashes.
    return encodeURIComponent(p).replace(/%2F/g, '/').replace(/%5C/g, '/').replace(/%3A/g, ':')
  }
  // 如果已经是完整的本地协议路径，直接返回
  if (path.startsWith('local-file://')) {
    try {
      const url = new URL(path)
      // 兼容错误格式：local-file://c/Users/... （host=c 丢了盘符冒号）
      if (url.hostname && url.hostname.length === 1) {
        const drive = url.hostname.toUpperCase()
        const rest = decodeURIComponent(url.pathname).replace(/^\/+/, '')
        return `local-file:///${encodeLocalPath(`${drive}:/${rest}`)}`
      }
      if (path.includes('#') || path.includes('?')) {
        const rawPath = decodeURIComponent(url.pathname)
        const fixed = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath
        return `local-file:///${encodeLocalPath(fixed)}`
      }
      return path
    } catch {
      if (path.includes('#') || path.includes('?')) {
        return path.replace(/#/g, '%23').replace(/\?/g, '%3F')
      }
      return path
    }
  }
  // 如果已经是 file://，尽量转换到 local-file://（兼容旧数据）
  if (path.startsWith('file://')) {
    try {
      const url = new URL(path)
      // 兼容旧格式：file://C:/Users/...（host=C，pathname=/Users/...）
      if (url.hostname && url.hostname.length === 1) {
        const drive = url.hostname.toUpperCase()
        const rest = decodeURIComponent(url.pathname).replace(/^\/+/, '')
        return `local-file:///${encodeLocalPath(`${drive}:/${rest}`)}`
      }

      let p = decodeURIComponent(url.pathname)
      // Windows 下 file:///C:/... 会变成 /C:/...
      if (p.startsWith('/') && /^[A-Za-z]:/.test(p.slice(1))) {
        p = p.slice(1)
      }
      // 有些情况下可能出现多余的前导斜杠（例如 file:////C:/...）
      p = p.replace(/^\/+/, '')

      const normalized = p.replace(/\\/g, '/')
      return `local-file:///${encodeLocalPath(normalized)}`
    } catch {
      const raw = path.replace(/^file:\/\//, '')
      const normalized = raw.replace(/^\/+/, '').replace(/\\/g, '/')
      return `local-file:///${encodeLocalPath(normalized)}`
    }
  }
  // 如果是绝对路径，转换为 local-file:// 协议
  if (path.match(/^[A-Za-z]:\\/)) {
    return `local-file:///${encodeLocalPath(path.replace(/\\/g, '/'))}`
  }
  // 否则返回原路径
  return path
}

// 兼容性：空的 initApi 函数（Electron 不需要初始化）
export async function initApi(): Promise<void> {
  // Electron 不需要等待后端启动
  return Promise.resolve()
}

// 兼容性：API_BASE（Electron 中不使用）
export const API_BASE = ''

export default api
