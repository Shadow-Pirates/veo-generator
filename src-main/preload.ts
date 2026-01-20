import { contextBridge, ipcRenderer } from 'electron'

// 定义暴露给渲染进程的 API
const electronAPI = {
  // 图片生成
  generateImage: (params: {
    apiKey: string
    prompt: string
    negativePrompt?: string
    aspectRatio?: string
    numImages?: number
    referenceImage?: ArrayBuffer
  }) => ipcRenderer.invoke('image:generate', params),

  // 视频生成
  generateVideo: (params: {
    apiKey: string
    prompt: string
    systemContext?: string
    storyboard?: string
    negativePrompt?: string
    aspectRatio?: string
    duration?: number
    imageData?: ArrayBuffer
  }) => ipcRenderer.invoke('video:generate', params),
  
  pollVideoStatus: (taskId: string, apiKey: string) => 
    ipcRenderer.invoke('video:poll-status', taskId, apiKey),

  // 历史记录
  getHistory: (filters: {
    type?: string
    status?: string
    isFavorite?: boolean
    search?: string
    page?: number
    pageSize?: number
  }) => ipcRenderer.invoke('history:list', filters),
  
  getHistoryItem: (id: string) => ipcRenderer.invoke('history:get', id),
  deleteHistory: (id: string) => ipcRenderer.invoke('history:delete', id),
  toggleFavorite: (id: string) => ipcRenderer.invoke('history:toggle-favorite', id),
  updateTags: (id: string, tags: string[]) => ipcRenderer.invoke('history:update-tags', id, tags),
  getStats: () => ipcRenderer.invoke('history:stats'),

  // 模板
  getTemplates: () => ipcRenderer.invoke('templates:list'),
  getTemplate: (id: number) => ipcRenderer.invoke('templates:get', id),
  createTemplate: (template: any) => ipcRenderer.invoke('templates:create', template),
  updateTemplate: (id: number, template: any) => ipcRenderer.invoke('templates:update', id, template),
  deleteTemplate: (id: number) => ipcRenderer.invoke('templates:delete', id),
  toggleTemplateFavorite: (id: number) => ipcRenderer.invoke('templates:toggle-favorite', id),

  // 文件操作
  getFilePath: (relativePath: string) => ipcRenderer.invoke('file:get-path', relativePath),
  openFile: (path: string) => ipcRenderer.invoke('file:open', path),
  selectDirectory: () => ipcRenderer.invoke('file:select-directory'),
  
  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),

  // 应用信息
  getAppInfo: () => ipcRenderer.invoke('app:info'),
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 类型定义
export type ElectronAPI = typeof electronAPI
