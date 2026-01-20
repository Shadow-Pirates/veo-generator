import { ipcMain, app } from 'electron'
import Store from 'electron-store'
import {
  listGenerations,
  getGeneration,
  deleteGeneration,
  toggleGenerationFavorite,
  updateGenerationTags,
  getStats,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplateFavorite,
} from './database'
import { generateImage, generateVideo, pollVideoStatus } from './api'
import { getDataPath, openFile, selectDirectory, getLocalFileUrl } from './file'

const store = new Store()

export function setupIpcHandlers() {
  // ========== 图片生成 ==========
  ipcMain.handle('image:generate', async (_, params) => {
    return await generateImage(params)
  })

  // ========== 视频生成 ==========
  ipcMain.handle('video:generate', async (_, params) => {
    return await generateVideo(params)
  })

  ipcMain.handle('video:poll-status', async (_, taskId, apiKey) => {
    return await pollVideoStatus(taskId, apiKey)
  })

  // ========== 历史记录 ==========
  ipcMain.handle('history:list', async (_, filters) => {
    return listGenerations(filters)
  })

  ipcMain.handle('history:get', async (_, id) => {
    return getGeneration(id)
  })

  ipcMain.handle('history:delete', async (_, id) => {
    deleteGeneration(id)
    return { success: true }
  })

  ipcMain.handle('history:toggle-favorite', async (_, id) => {
    const isFavorite = toggleGenerationFavorite(id)
    return { id, is_favorite: isFavorite }
  })

  ipcMain.handle('history:update-tags', async (_, id, tags) => {
    updateGenerationTags(id, tags)
    return { id, tags }
  })

  ipcMain.handle('history:stats', async () => {
    return getStats()
  })

  // ========== 模板 ==========
  ipcMain.handle('templates:list', async () => {
    return listTemplates()
  })

  ipcMain.handle('templates:get', async (_, id) => {
    return getTemplate(id)
  })

  ipcMain.handle('templates:create', async (_, template) => {
    const id = createTemplate(template)
    return { id }
  })

  ipcMain.handle('templates:update', async (_, id, template) => {
    updateTemplate(id, template)
    return { success: true }
  })

  ipcMain.handle('templates:delete', async (_, id) => {
    deleteTemplate(id)
    return { success: true }
  })

  ipcMain.handle('templates:toggle-favorite', async (_, id) => {
    const isFavorite = toggleTemplateFavorite(id)
    return { id, is_favorite: isFavorite }
  })

  // ========== 文件操作 ==========
  ipcMain.handle('file:get-path', async (_, relativePath) => {
    const fullPath = getDataPath(relativePath)
    return getLocalFileUrl(fullPath)
  })

  ipcMain.handle('file:open', async (_, filePath) => {
    openFile(filePath)
    return { success: true }
  })

  ipcMain.handle('file:select-directory', async () => {
    return await selectDirectory()
  })

  // ========== 设置 ==========
  ipcMain.handle('settings:get', async () => {
    return {
      apiKey: store.get('apiKey', ''),
      dataDir: getDataPath(),
      theme: store.get('theme', 'system'),
    }
  })

  ipcMain.handle('settings:save', async (_, settings) => {
    if (settings.apiKey !== undefined) {
      store.set('apiKey', settings.apiKey)
    }
    if (settings.theme !== undefined) {
      store.set('theme', settings.theme)
    }
    return { success: true }
  })

  // ========== 应用信息 ==========
  ipcMain.handle('app:info', async () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      dataPath: getDataPath(),
    }
  })
}
