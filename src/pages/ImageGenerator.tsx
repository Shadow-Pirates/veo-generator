import { useState } from 'react'
import { Image as ImageIcon, Upload, Sparkles, Loader2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { api, getStaticUrl } from '@/lib/api'

interface ImageGeneratorProps {
  apiKey: string
  onApiKeyChange?: (key: string) => void
}

export default function ImageGenerator({ apiKey }: ImageGeneratorProps) {
  const { toast } = useToast()
  
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [numImages, setNumImages] = useState('1')
  
  const [refImage, setRefImage] = useState<File | null>(null)
  const [refPreview, setRefPreview] = useState<string>('')
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])

  const handleImageUpload = (file: File) => {
    setRefImage(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setRefPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
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

    if (!prompt.trim()) {
      toast({
        title: '错误',
        description: '请输入提示词',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setGeneratedImages([])

    try {
      // 如果有参考图片，读取为 ArrayBuffer
      let referenceImage: ArrayBuffer | undefined
      if (refImage) {
        referenceImage = await refImage.arrayBuffer()
      }

      const result = await api.generateImage({
        apiKey,
        prompt,
        aspectRatio,
        numImages: parseInt(numImages),
        referenceImage,
      })
      
      if (result.status === 'completed' && result.images.length > 0) {
        setGeneratedImages(result.images)
        toast({
          title: '生成成功',
          description: `成功生成 ${result.images.length} 张图片`,
        })
      } else {
        toast({
          title: '生成失败',
          description: '未能生成图片',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: '生成失败',
        description: error.message || '未知错误',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `imagen_${Date.now()}_${index}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">图片生成</h1>
        <span className="text-sm text-muted-foreground ml-2">Powered by Gemini Image</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：输入区域 */}
        <div className="space-y-4">
          {/* 提示词 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">提示词 (Prompt)</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="详细描述你想要生成的图片...\n\n提示：使用详细、具体的描述，包含风格、光线、构图等元素"
              rows={8}
            />
          </div>

          {/* 参数设置 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">图片比例</label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">1:1 方形</SelectItem>
                  <SelectItem value="16:9">16:9 横屏</SelectItem>
                  <SelectItem value="9:16">9:16 竖屏</SelectItem>
                  <SelectItem value="4:3">4:3 标准</SelectItem>
                  <SelectItem value="3:4">3:4 竖版</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">生成数量</label>
              <Select value={numImages} onValueChange={setNumImages}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 张</SelectItem>
                  <SelectItem value="2">2 张</SelectItem>
                  <SelectItem value="3">3 张</SelectItem>
                  <SelectItem value="4">4 张</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 参考图片 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">参考图片 (可选)</label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="ref-image"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleImageUpload(file)
                }
              }}
            />
            <label
              htmlFor="ref-image"
              className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
            >
              {refPreview ? (
                <img src={refPreview} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground mt-1">点击上传参考图</span>
                </>
              )}
            </label>
            {refImage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRefImage(null)
                  setRefPreview('')
                }}
              >
                移除参考图
              </Button>
            )}
          </div>

          {/* 生成按钮 */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !apiKey || !prompt.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                生成图片
              </>
            )}
          </Button>
        </div>

        {/* 右侧：结果区域 */}
        <div className="space-y-4">
          <label className="text-sm font-medium">生成结果</label>
          
          {generatedImages.length === 0 ? (
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>图片将在这里显示</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {generatedImages.map((imageUrl, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={getStaticUrl(imageUrl)}
                    alt={`Generated ${idx + 1}`}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(getStaticUrl(imageUrl), idx)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      下载
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 提示信息 */}
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <h4 className="font-medium mb-2">提示词建议</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>使用详细、具体的描述</li>
              <li>包含风格说明（如：电影感、写实、插画风格）</li>
              <li>指定光线和氛围（如：柔和的自然光、暖色调）</li>
              <li>描述构图和视角（如：特写、全景、俯视）</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
