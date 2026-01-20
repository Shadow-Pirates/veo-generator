// Electron API 封装
// 通过 preload 脚本暴露的 electronAPI 调用主进程服务

declare global {
  interface Window {
    electronAPI: {
      generateImage: (params: ImageGenParams) => Promise<ImageResult>
      generateVideo: (params: VideoGenParams) => Promise<VideoResult>
      pollVideoStatus: (taskId: string, apiKey: string) => Promise<VideoStatus>
      getHistory: (filters: HistoryFilters) => Promise<HistoryList>
      getHistoryItem: (id: string) => Promise<Generation>
      deleteHistory: (id: string) => Promise<void>
      toggleFavorite: (id: string) => Promise<{ id: string; is_favorite: boolean }>
      updateTags: (id: string, tags: string[]) => Promise<void>
      getStats: () => Promise<Stats>
      getTemplates: () => Promise<Template[]>
      getTemplate: (id: number) => Promise<Template>
      createTemplate: (template: Partial<Template>) => Promise<{ id: number }>
      updateTemplate: (id: number, template: Partial<Template>) => Promise<void>
      deleteTemplate: (id: number) => Promise<void>
      toggleTemplateFavorite: (id: number) => Promise<{ id: number; is_favorite: boolean }>
      getFilePath: (relativePath: string) => Promise<string>
      openFile: (path: string) => Promise<void>
      selectDirectory: () => Promise<string | null>
      getSettings: () => Promise<Settings>
      saveSettings: (settings: Partial<Settings>) => Promise<void>
      getAppInfo: () => Promise<AppInfo>
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

export interface Template {
  id: number
  name: string
  category?: string
  system_context?: string
  storyboard?: string
  negative_prompt?: string
  is_favorite: boolean
  use_count: number
  created_at: string
  updated_at?: string
}

export interface Settings {
  apiKey: string
  dataDir: string
  theme: string
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
  // 如果已经是完整的文件路径，直接返回 file:// 协议
  if (path.startsWith('file://')) {
    return path
  }
  // 如果是绝对路径，转换为 file:// 协议
  if (path.match(/^[A-Za-z]:\\/)) {
    return `file://${path.replace(/\\/g, '/')}`
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
