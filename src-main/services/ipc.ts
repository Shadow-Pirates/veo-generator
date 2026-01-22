import { ipcMain, app } from 'electron'
import Store from 'electron-store'
import {
  listGenerations,
  getGeneration,
  deleteGeneration,
  toggleGenerationFavorite,
  updateGenerationTags,
  getStats,
  listActiveGenerations,
  listTaskGenerations,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplateFavorite,
  initDatabase,
  syncBuiltinTemplates,
  rewriteGenerationPaths,
} from './database'
import { generateImage, generateVideo, pollVideoStatus, resumePendingVideoTasks } from './api'
import { getDataBasePath, getDataPath, openFile, selectDirectory, getLocalFileUrl, ensureDirectories, migrateDataDirectory, deleteDirectory, saveFileAs, saveFilesToDirectory, getStorageStats, cleanupStorage, listStorageFiles, deleteStorageFiles, deleteLocalFileUnderDataDir } from './file'

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

  ipcMain.handle('video:download', async (_, taskId, apiKey) => {
    return await pollVideoStatus(taskId, apiKey)
  })

  ipcMain.handle('draft:get', async (_, key: string) => {
    return store.get(`draft.${key}`, null)
  })

  ipcMain.handle('draft:set', async (_, key: string, value: any) => {
    store.set(`draft.${key}`, value)
    return { success: true }
  })

  ipcMain.handle('draft:clear', async (_, key: string) => {
    store.delete(`draft.${key}`)
    return { success: true }
  })

  ipcMain.handle('tasks:list', async () => {
    return listTaskGenerations(500)
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

  ipcMain.handle('storage:stats', async () => {
    return getStorageStats()
  })

  ipcMain.handle('storage:cleanup', async (_, target) => {
    return cleanupStorage(target)
  })

  ipcMain.handle('storage:list-files', async (_, target) => {
    if (target !== 'images' && target !== 'videos' && target !== 'thumbnails') {
      return { success: false, error: 'Invalid target' }
    }
    return listStorageFiles(target)
  })

  ipcMain.handle('storage:delete-files', async (_, target, filePaths) => {
    if (target !== 'images' && target !== 'videos' && target !== 'thumbnails') {
      return { success: false, error: 'Invalid target' }
    }
    return deleteStorageFiles(target, filePaths)
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

  ipcMain.handle('templates:sync-builtin', async () => {
    return syncBuiltinTemplates()
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

  ipcMain.handle('file:delete-directory', async (_, dirPath) => {
    return deleteDirectory(dirPath)
  })

  ipcMain.handle('file:save-as', async (_, sourcePath, suggestedName) => {
    return await saveFileAs(sourcePath, suggestedName)
  })

  ipcMain.handle('file:save-to-directory', async (_, dirPath, items) => {
    return await saveFilesToDirectory(dirPath, items)
  })

  ipcMain.handle('file:delete-local', async (_, pathOrUrl) => {
    return deleteLocalFileUnderDataDir(pathOrUrl)
  })

  // ========== 设置 ==========
  ipcMain.handle('settings:get', async () => {
    return {
      apiKey: store.get('apiKey', ''),
      dataDir: getDataBasePath(),
      theme: store.get('theme', 'system'),
      closeToTray: store.get('closeToTray', true),
      notifyTaskCompleted: store.get('notifyTaskCompleted', true),
    }
  })

  ipcMain.handle('settings:save', async (_, settings) => {
    if (settings.apiKey !== undefined) {
      store.set('apiKey', settings.apiKey)
      try {
        resumePendingVideoTasks(String(settings.apiKey || ''))
      } catch {
        // ignore
      }
    }
    if (settings.theme !== undefined) {
      store.set('theme', settings.theme)
    }
    if (settings.closeToTray !== undefined) {
      store.set('closeToTray', Boolean(settings.closeToTray))
    }
    if (settings.notifyTaskCompleted !== undefined) {
      store.set('notifyTaskCompleted', Boolean(settings.notifyTaskCompleted))
    }
    if (settings.dataDir !== undefined) {
      const oldBase = getDataBasePath()
      store.set('dataDir', settings.dataDir)
      const newBase = getDataBasePath()

      // 尽力迁移文件与数据库（不阻塞失败）
      migrateDataDirectory(oldBase, newBase)
      ensureDirectories()
      initDatabase()

      // 修正历史记录中旧的绝对路径前缀（避免切换目录后预览丢失）
      rewriteGenerationPaths(oldBase, newBase)
    }
    return { success: true }
  })

  // ========== 应用信息 ==========
  ipcMain.handle('app:info', async () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      dataPath: getDataBasePath(),
    }
  })
}
