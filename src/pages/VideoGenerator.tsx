import { useState, useEffect, useRef } from 'react'
import { Video, Upload, Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { api, getStaticUrl, type Template } from '@/lib/api'

interface VideoGeneratorProps {
  apiKey: string
  onApiKeyChange?: (key: string) => void
}

export default function VideoGenerator({ apiKey }: VideoGeneratorProps) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  
  const [systemContext, setSystemContext] = useState('')
  const [storyboard, setStoryboard] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  
  const [refImage1, setRefImage1] = useState<File | null>(null)
  const [refImage2, setRefImage2] = useState<File | null>(null)
  const [refPreview1, setRefPreview1] = useState<string>('')
  const [refPreview2, setRefPreview2] = useState<string>('')
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [_generationId, setGenerationId] = useState<string>('')
  const [_status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [log, setLog] = useState<string[]>([])
  
  const pollingRef = useRef<number | null>(null)

  useEffect(() => {
    loadTemplates()
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  const loadTemplates = async () => {
    try {
      const templateList = await api.getTemplates()
      setTemplates(templateList as Template[])
    } catch (error) {
      console.error('加载模板失败', error)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = templates.find(t => t.id.toString() === templateId)
    if (template) {
      setSystemContext(template.system_context || '')
      setStoryboard(template.storyboard || '')
      setNegativePrompt(template.negative_prompt || '')
    }
  }

  const handleImageUpload = (file: File, setImage: (f: File | null) => void, setPreview: (s: string) => void) => {
    setImage(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const addLog = (message: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const pollStatus = async (genId: string) => {
    try {
      const data = await api.pollVideoStatus(genId, apiKey)
      
      setStatus(data.status)
      setProgress(data.progress || 0)
      
      if (data.status === 'completed') {
        addLog('✅ 视频生成完成！')
        setVideoUrl(data.localPath || data.videoUrl || '')
        setIsGenerating(false)
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        toast({
          title: '生成完成',
          description: '视频已成功生成',
        })
      } else if (data.status === 'failed') {
        addLog(`❌ 生成失败: ${data.error}`)
        setIsGenerating(false)
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        toast({
          title: '生成失败',
          description: data.error || '未知错误',
          variant: 'destructive',
        })
      } else {
        addLog(`🔄 状态: ${data.status}, 进度: ${data.progress}%`)
      }
    } catch (error) {
      console.error('轮询状态失败', error)
    }
  }

  const handleGenerate = async () => {
    if (!apiKey) {
      toast({
        title: '错误',
        description: '请先设置 API Key',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setVideoUrl('')
    setLog([])
    setProgress(0)
    addLog('🚀 正在提交任务...')

    try {
      // 读取参考图片
      let imageData: ArrayBuffer | undefined
      if (refImage1) {
        imageData = await refImage1.arrayBuffer()
      }

      const result = await api.generateVideo({
        apiKey,
        prompt: storyboard,
        systemContext,
        storyboard,
        negativePrompt,
        aspectRatio,
        imageData,
      })
      
      setGenerationId(result.id)
      addLog(`✅ 任务已创建，ID: ${result.taskId}`)
      addLog('🔄 开始轮询状态...')
      
      // 开始轮询
      pollingRef.current = window.setInterval(() => {
        pollStatus(result.id)
      }, 5000)
      
    } catch (error: any) {
      addLog(`❌ 提交失败: ${error.message}`)
      setIsGenerating(false)
      toast({
        title: '提交失败',
        description: error.message || '未知错误',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Video className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">视频生成</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：输入区域 */}
        <div className="space-y-4">
          {/* 模板选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">选择模板</label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择一个模板..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 系统上下文 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">系统上下文 (System Context)</label>
            <Textarea
              value={systemContext}
              onChange={(e) => setSystemContext(e.target.value)}
              placeholder="描述角色设定、视觉锚点、环境等..."
              rows={6}
            />
          </div>

          {/* 故事板 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">动态故事板 (Storyboard)</label>
            <Textarea
              value={storyboard}
              onChange={(e) => setStoryboard(e.target.value)}
              placeholder="描述具体的动作、镜头语言..."
              rows={4}
            />
          </div>

          {/* 负面提示词 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">负面提示词 (Negative Prompt)</label>
            <Textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="描述要避免的元素..."
              rows={2}
            />
          </div>

          {/* 视频比例 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">视频比例</label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 横屏</SelectItem>
                <SelectItem value="9:16">9:16 竖屏</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 参考图片 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">参考图片</label>
            <div className="grid grid-cols-2 gap-4">
              {[
                { preview: refPreview1, setImage: setRefImage1, setPreview: setRefPreview1, label: '参考图 1' },
                { preview: refPreview2, setImage: setRefImage2, setPreview: setRefPreview2, label: '参考图 2' },
              ].map((item, idx) => (
                <div key={idx} className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id={`ref-image-${idx}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleImageUpload(file, item.setImage, item.setPreview)
                      }
                    }}
                  />
                  <label
                    htmlFor={`ref-image-${idx}`}
                    className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    {item.preview ? (
                      <img src={item.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground mt-1">{item.label}</span>
                      </>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* 生成按钮 */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !apiKey}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中... {progress}%
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                开始生成
              </>
            )}
          </Button>
        </div>

        {/* 右侧：结果区域 */}
        <div className="space-y-4">
          {/* 视频预览 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">生成结果</label>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              {videoUrl ? (
                <video
                  src={getStaticUrl(videoUrl)}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>视频将在这里显示</p>
                </div>
              )}
            </div>
          </div>

          {/* 进度条 */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>生成进度</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 日志 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">实时日志</label>
            <div className="h-48 bg-muted/50 rounded-lg p-3 overflow-y-auto font-mono text-xs space-y-1">
              {log.length === 0 ? (
                <p className="text-muted-foreground">日志将在这里显示...</p>
              ) : (
                log.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
