import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, RefreshCw, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'

export default function Settings() {
  const [apiKey, setApiKey] = useState('')
  const [appInfo, setAppInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const fetchSettings = async () => {
    try {
      const settings = await api.getSettings()
      setApiKey(settings.apiKey || '')
      
      const info = await api.getAppInfo()
      setAppInfo(info)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await api.saveSettings({ apiKey })
      toast({
        title: '设置已保存',
        description: 'API Key 已更新',
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
        {/* API Key 设置 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <p className="text-xs text-muted-foreground">
            请输入您的 tu-zi.com API Key
          </p>
          <Input
            type="password"
            value={apiKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
            placeholder="输入 API Key"
            className="flex-1"
          />
        </div>

        {/* 应用信息 */}
        {appInfo && (
          <div className="space-y-2">
            <label className="text-sm font-medium">应用信息</label>
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">版本:</span>
                <span>{appInfo.version}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">数据目录:</span>
                <span className="text-xs break-all">{appInfo.dataPath}</span>
              </div>
            </div>
          </div>
        )}

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
    </div>
  )
}
