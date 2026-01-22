import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Settings as SettingsIcon, Save, RefreshCw, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { api, type StorageStats, type StorageFileItem } from '@/lib/api'

export default function Settings() {
  const [dataDir, setDataDir] = useState('')
  const [currentDataDir, setCurrentDataDir] = useState('')
  const [closeToTray, setCloseToTray] = useState(true)
  const [notifyTaskCompleted, setNotifyTaskCompleted] = useState(true)
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null)
  const [storageLoading, setStorageLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [fileManagerOpen, setFileManagerOpen] = useState(false)
  const [fileManagerTarget, setFileManagerTarget] = useState<'images' | 'videos'>('images')
  const [fileManagerLoading, setFileManagerLoading] = useState(false)
  const [fileManagerFiles, setFileManagerFiles] = useState<StorageFileItem[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [focusedFile, setFocusedFile] = useState<StorageFileItem | null>(null)
  const [dangerCleanupOpen, setDangerCleanupOpen] = useState(false)
  const [dangerCleanupText, setDangerCleanupText] = useState('')
  const { toast } = useToast()

  const fetchSettings = async () => {
    try {
      const settings = await api.getSettings()
      setDataDir(settings.dataDir || '')
      setCurrentDataDir(settings.dataDir || '')
      setCloseToTray(settings.closeToTray !== undefined ? Boolean(settings.closeToTray) : true)
      setNotifyTaskCompleted(settings.notifyTaskCompleted !== undefined ? Boolean(settings.notifyTaskCompleted) : true)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const v = bytes / Math.pow(1024, i)
    return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
  }

  const loadStorageStats = async () => {
    setStorageLoading(true)
    try {
      const s = await api.getStorageStats()
      setStorageStats(s)
    } catch (error) {
      toast({
        title: '加载存储统计失败',
        variant: 'destructive',
      })
    } finally {
      setStorageLoading(false)
    }
  }

  const loadFileManagerFiles = async (target: 'images' | 'videos') => {
    setFileManagerLoading(true)
    try {
      const res = await api.listStorageFiles(target)
      if (!res.success) {
        throw new Error(res.error || '加载失败')
      }
      const files = res.files || []
      setFileManagerFiles(files)
      setSelectedFiles([])
      setFocusedFile(files[0] || null)
    } catch (error: any) {
      toast({
        title: '加载文件列表失败',
        description: error?.message || '未知错误',
        variant: 'destructive',
      })
    } finally {
      setFileManagerLoading(false)
    }
  }

  const openFileManager = async (target: 'images' | 'videos') => {
    setFileManagerTarget(target)
    setFileManagerOpen(true)
    await loadFileManagerFiles(target)
  }

  const toggleSelected = (path: string) => {
    setSelectedFiles((prev) => {
      if (prev.includes(path)) return prev.filter((p) => p !== path)
      return [...prev, path]
    })
  }

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) return
    if (!confirm(`确定要删除选中的 ${selectedFiles.length} 个文件吗？`)) return

    try {
      const res = await api.deleteStorageFiles(fileManagerTarget, selectedFiles)
      if (!res.success) {
        throw new Error(res.error || '删除失败')
      }
      toast({
        title: '删除完成',
        description: `已删除 ${res.removedFiles || 0} 个文件，释放 ${formatBytes(res.freedBytes || 0)}`,
      })
      await loadFileManagerFiles(fileManagerTarget)
      await loadStorageStats()
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error?.message || '未知错误',
        variant: 'destructive',
      })
    }
  }

  const handleDangerCleanup = async () => {
    try {
      const res1 = await api.cleanupStorage('images')
      if (!res1.success) {
        throw new Error(res1.error || '清理失败')
      }
      const res2 = await api.cleanupStorage('videos')
      if (!res2.success) {
        throw new Error(res2.error || '清理失败')
      }
      const removedFiles = (res1.removedFiles || 0) + (res2.removedFiles || 0)
      const freedBytes = (res1.freedBytes || 0) + (res2.freedBytes || 0)
      toast({
        title: '清理完成',
        description: `已清理 ${removedFiles} 个文件，释放 ${formatBytes(freedBytes)}`,
      })
      setDangerCleanupOpen(false)
      setDangerCleanupText('')
      await loadStorageStats()
    } catch (error: any) {
      toast({
        title: '清理失败',
        description: error?.message || '未知错误',
        variant: 'destructive',
      })
    }
  }

  const handleSelectDataDir = async () => {
    try {
      const selected = await api.selectDirectory()
      if (selected) {
        setDataDir(selected)
        toast({
          title: '已选择数据目录',
          description: selected,
        })
      }
    } catch (error) {
      toast({
        title: '选择目录失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    fetchSettings()
    loadStorageStats()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)

    const oldDir = currentDataDir
    const newDir = dataDir
    const isDataDirChanged = (oldDir || '') !== (newDir || '')

    if (isDataDirChanged) {
      toast({
        title: '正在迁移数据...',
        description: '请稍候，迁移完成后会提示是否删除旧目录',
      })
    }

    try {
      await api.saveSettings({
        dataDir,
        closeToTray,
        notifyTaskCompleted,
      })

      await fetchSettings()
      await loadStorageStats()

      if (isDataDirChanged && oldDir) {
        const shouldDelete = confirm(`数据目录已切换。是否删除旧数据目录？\n\n旧目录：${oldDir}`)
        if (shouldDelete) {
          const res = await api.deleteDirectory(oldDir)
          if (res.success) {
            toast({
              title: '旧目录已删除',
            })
          } else {
            toast({
              title: '删除失败',
              description: res.error || '未知错误',
              variant: 'destructive',
            })
          }
        }
      }

      toast({
        title: '设置已保存',
        description: '设置已更新',
      })
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">设置</h1>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* 数据目录设置 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">数据目录</label>
          <p className="text-xs text-muted-foreground">
            图片、视频、数据库将存储在此目录。留空将使用默认目录。
          </p>
          <div className="flex gap-2">
            <Input
              value={dataDir}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDataDir(e.target.value)}
              placeholder="例如：D:\\veo-studio-data"
              className="flex-1"
            />
            <Button variant="outline" onClick={handleSelectDataDir}>
              选择...
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">行为与通知</label>
          <div className="space-y-3 rounded-lg border bg-background p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={closeToTray}
                onChange={(e) => setCloseToTray(e.target.checked)}
              />
              <div className="space-y-1">
                <div className="text-sm">关闭窗口时最小化到托盘</div>
                <div className="text-xs text-muted-foreground">开启后点击右上角关闭不会退出应用，可在托盘菜单中选择“退出”。</div>
              </div>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={notifyTaskCompleted}
                onChange={(e) => setNotifyTaskCompleted(e.target.checked)}
              />
              <div className="space-y-1">
                <div className="text-sm">任务完成时通知</div>
                <div className="text-xs text-muted-foreground">任务从进行中变为完成时在右下角弹出系统通知。</div>
              </div>
            </label>
          </div>
        </div>

        {/* 存储统计 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">存储统计</label>
            <Button variant="outline" size="sm" onClick={loadStorageStats} disabled={storageLoading}>
              {storageLoading ? '刷新中...' : '刷新'}
            </Button>
          </div>
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="text-xs text-muted-foreground break-all">
              目录：{storageStats?.basePath || currentDataDir || ''}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-md border bg-background p-3">
                <div className="text-sm font-medium">图片</div>
                <div className="text-xs text-muted-foreground mt-1">
                  数量：{storageStats?.images.fileCount ?? '-'}
                </div>
                <div className="text-xs text-muted-foreground">
                  大小：{storageStats ? formatBytes(storageStats.images.totalBytes) : '-'}
                </div>
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => openFileManager('images')}>管理文件</Button>
                </div>
              </div>

              <div className="rounded-md border bg-background p-3">
                <div className="text-sm font-medium">视频</div>
                <div className="text-xs text-muted-foreground mt-1">
                  数量：{storageStats?.videos.fileCount ?? '-'}
                </div>
                <div className="text-xs text-muted-foreground">
                  大小：{storageStats ? formatBytes(storageStats.videos.totalBytes) : '-'}
                </div>
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => openFileManager('videos')}>管理文件</Button>
                </div>
              </div>

              <div className="rounded-md border bg-background p-3">
                <div className="text-sm font-medium">总计</div>
                <div className="text-xs text-muted-foreground mt-1">
                  大小：{storageStats ? formatBytes((storageStats.images?.totalBytes || 0) + (storageStats.videos?.totalBytes || 0)) : '-'}
                </div>
                <div className="mt-2">
                  <Button variant="destructive" size="sm" onClick={() => { setDangerCleanupOpen(true); setDangerCleanupText('') }}>一键清理</Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? '保存中...' : '保存设置'}
          </Button>
          <Button variant="outline" onClick={fetchSettings}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>

        {/* 提示信息 */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="flex gap-2">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h3 className="font-medium mb-2">使用说明</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 生成的图片和视频将自动保存到数据目录</li>
                <li>• 可以在"历史记录"页面查看所有生成记录</li>
                <li>• API Key 加密保存在本地，不会上传到服务器</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {fileManagerOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-5xl rounded-lg border bg-background p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">
                  {fileManagerTarget === 'images' ? '图片文件' : '视频文件'}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadFileManagerFiles(fileManagerTarget)}
                    disabled={fileManagerLoading}
                  >
                    {fileManagerLoading ? '刷新中...' : '刷新'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFileManagerOpen(false)
                      setSelectedFiles([])
                      setFocusedFile(null)
                    }}
                  >
                    关闭
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 border rounded-md">
                  <div className="flex items-center justify-between p-3 border-b">
                    <div className="text-sm text-muted-foreground">
                      共 {fileManagerFiles.length} 个文件，已选择 {selectedFiles.length} 个
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFiles(fileManagerFiles.map(f => f.path))}
                        disabled={fileManagerFiles.length === 0}
                      >
                        全选
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFiles([])}
                        disabled={selectedFiles.length === 0}
                      >
                        清空
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSelected}
                        disabled={selectedFiles.length === 0}
                      >
                        删除选中
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-[60vh] overflow-auto">
                    {fileManagerFiles.map((f) => {
                      const checked = selectedFiles.includes(f.path)
                      return (
                        <div
                          key={f.path}
                          className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-accent/50"
                          onClick={() => setFocusedFile(f)}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelected(f.path)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm truncate">{f.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatBytes(f.size)} · {new Date(f.mtimeMs).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {!fileManagerLoading && fileManagerFiles.length === 0 && (
                      <div className="p-6 text-sm text-muted-foreground">暂无文件</div>
                    )}
                  </div>
                </div>

                <div className="border rounded-md p-3">
                  <div className="text-sm font-medium mb-2">预览</div>
                  {focusedFile ? (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground break-all">{focusedFile.name}</div>
                      {fileManagerTarget === 'videos' ? (
                        <video src={focusedFile.url} controls className="w-full rounded-md bg-black" />
                      ) : (
                        <img src={focusedFile.url} className="w-full rounded-md border" />
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">选择一个文件以预览</div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {dangerCleanupOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg border bg-background p-4">
              <div className="font-semibold mb-2">危险操作：一键清理</div>
              <div className="text-sm text-muted-foreground mb-4">
                此操作会删除图片 / 视频目录下的所有文件（生成素材），且无法恢复。
              </div>
              <div className="text-sm mb-2">
                请输入 <span className="font-mono">确认删除</span> 以确认删除：
              </div>
              <Input value={dangerCleanupText} onChange={(e) => setDangerCleanupText(e.target.value)} />
              <div className="flex gap-2 justify-end mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDangerCleanupOpen(false)
                    setDangerCleanupText('')
                  }}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  disabled={dangerCleanupText.trim() !== '确认删除'}
                  onClick={handleDangerCleanup}
                >
                  我已了解风险，确认清理
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
