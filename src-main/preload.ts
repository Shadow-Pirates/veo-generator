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
    model?: string
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

  downloadVideo: (taskId: string, apiKey: string) => 
    ipcRenderer.invoke('video:download', taskId, apiKey),

  getDraft: (key: string) => ipcRenderer.invoke('draft:get', key),
  setDraft: (key: string, value: any) => ipcRenderer.invoke('draft:set', key, value),
  clearDraft: (key: string) => ipcRenderer.invoke('draft:clear', key),

  getTasks: () => ipcRenderer.invoke('tasks:list'),

  // 历史记录
  getHistory: (filters: any) => ipcRenderer.invoke('history:list', filters),
  getHistoryItem: (id: string) => ipcRenderer.invoke('history:get', id),
  deleteHistory: (id: string) => ipcRenderer.invoke('history:delete', id),
  toggleFavorite: (id: string) => ipcRenderer.invoke('history:toggle-favorite', id),
  updateTags: (id: string, tags: string[]) => ipcRenderer.invoke('history:update-tags', id, tags),
  getStats: () => ipcRenderer.invoke('history:stats'),

  getStorageStats: () => ipcRenderer.invoke('storage:stats'),
  cleanupStorage: (target: string) => ipcRenderer.invoke('storage:cleanup', target),
  listStorageFiles: (target: string) => ipcRenderer.invoke('storage:list-files', target),
  deleteStorageFiles: (target: string, filePaths: string[]) => ipcRenderer.invoke('storage:delete-files', target, filePaths),

  // 模板
  getTemplates: () => ipcRenderer.invoke('templates:list'),
  getTemplate: (id: number) => ipcRenderer.invoke('templates:get', id),
  createTemplate: (template: any) => ipcRenderer.invoke('templates:create', template),
  updateTemplate: (id: number, template: any) => ipcRenderer.invoke('templates:update', id, template),
  deleteTemplate: (id: number) => ipcRenderer.invoke('templates:delete', id),
  toggleTemplateFavorite: (id: number) => ipcRenderer.invoke('templates:toggle-favorite', id),
  syncBuiltinTemplates: () => ipcRenderer.invoke('templates:sync-builtin'),

  // 文件操作
  getFilePath: (relativePath: string) => ipcRenderer.invoke('file:get-path', relativePath),
  openFile: (path: string) => ipcRenderer.invoke('file:open', path),
  selectDirectory: () => ipcRenderer.invoke('file:select-directory'),
  deleteDirectory: (path: string) => ipcRenderer.invoke('file:delete-directory', path),
  saveFileAs: (path: string, suggestedName?: string) => ipcRenderer.invoke('file:save-as', path, suggestedName),
  saveFilesToDirectory: (dirPath: string, items: Array<{ sourcePath: string; fileName: string }>) =>
    ipcRenderer.invoke('file:save-to-directory', dirPath, items),
  deleteLocalFile: (pathOrUrl: string) => ipcRenderer.invoke('file:delete-local', pathOrUrl),
  
  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),

  // 应用信息
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  appReady: () => ipcRenderer.send('app:ready'),
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 类型定义
export type ElectronAPI = typeof electronAPI
