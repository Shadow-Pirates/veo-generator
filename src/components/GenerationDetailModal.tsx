import { Download, Image, Video, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { api, getStaticUrl, type Generation } from '@/lib/api'
import { formatDateShanghai, parseDateAsUtc } from '@/lib/datetime'
import ImageLightbox from '@/components/ImageLightbox'
import { makeSuggestedFileName } from '@/lib/downloadName'

interface GenerationDetailModalProps {
  gen: Generation | null
  onClose: () => void
  onDownload: (filePath: string | undefined, type: string, suggestedName?: string) => void
}

export default function GenerationDetailModal({ gen, onClose, onDownload }: GenerationDetailModalProps) {
  if (!gen) return null

  const { toast } = useToast()

  const imagePaths = useMemo(() => {
    if (gen.type !== 'image') return [] as string[]
    const raw = (gen as any)?.api_response?.image_paths
    const arr = Array.isArray(raw) ? raw.filter((x: any) => typeof x === 'string' && x) : []
    if (arr.length) return arr
    return gen.result_path ? [gen.result_path] : []
  }, [gen])
  const imageUrls = useMemo(() => imagePaths.map(p => getStaticUrl(p)), [imagePaths])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx)
    setLightboxOpen(true)
  }

  const createdDate = useMemo(() => parseDateAsUtc(gen.created_at), [gen.created_at])

  const handleDownloadAllImages = async () => {
    if (!imagePaths.length) return
    const dir = await api.selectDirectory()
    if (!dir) return
    const date = createdDate
    const items = imagePaths.map((p, i) => ({
      sourcePath: p,
      fileName: makeSuggestedFileName({
        prompt: gen.prompt,
        filePath: p,
        date,
        index: i,
        total: imagePaths.length,
        defaultBase: 'image',
      }),
    }))
    const res = await api.saveFilesToDirectory(dir, items)
    if (res.success) {
      toast({ title: '下载完成', description: `已保存 ${res.saved || 0} / ${items.length} 张` })
    } else {
      toast({ title: '下载失败', description: res.error || '未知错误', variant: 'destructive' })
    }
  }

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {gen.type === 'video' ? <Video className="h-5 w-5" /> : <Image className="h-5 w-5" />}
            <h2 className="text-lg font-semibold">{gen.type === 'video' ? '视频' : '图片'}生成详情</h2>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                gen.status === 'completed'
                  ? 'bg-green-500/80 text-white'
                  : gen.status === 'processing'
                    ? 'bg-yellow-500/80 text-white'
                    : 'bg-red-500/80 text-white'
              )}
            >
              {gen.status === 'completed' ? '已完成' : gen.status === 'processing' ? '处理中' : '失败'}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-muted rounded-lg overflow-hidden">
                {gen.type === 'video' && gen.result_path ? (
                  <div className="aspect-video">
                    <video
                      src={getStaticUrl(gen.result_path)}
                      className="w-full h-full object-contain"
                      controls
                      autoPlay
                      loop
                    />
                  </div>
                ) : gen.type === 'image' && imageUrls.length ? (
                  imageUrls.length === 1 ? (
                    <div className="aspect-video">
                      <img
                        src={imageUrls[0]}
                        alt=""
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={() => openLightbox(0)}
                      />
                    </div>
                  ) : (
                    <div className="p-3 max-h-[52vh] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-3">
                        {imageUrls.map((u, idx) => (
                          <button key={idx} className="block" onClick={() => openLightbox(idx)}>
                            <img src={u} alt="" className="w-full aspect-square object-cover rounded-md" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="aspect-video w-full flex items-center justify-center text-muted-foreground">无预览</div>
                )}
              </div>

              {gen.type === 'video' && gen.result_path && (
                <Button
                  className="w-full"
                  onClick={() =>
                    onDownload(
                      gen.result_path,
                      gen.type,
                      makeSuggestedFileName({
                        prompt: gen.prompt,
                        filePath: gen.result_path,
                        date: createdDate,
                        defaultBase: 'video',
                      })
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  下载视频
                </Button>
              )}

              {gen.type === 'image' && imagePaths.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() =>
                      onDownload(
                        imagePaths[0],
                        'image',
                        makeSuggestedFileName({
                          prompt: gen.prompt,
                          filePath: imagePaths[0],
                          date: createdDate,
                          total: imagePaths.length,
                          index: 0,
                          defaultBase: 'image',
                        })
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    下载图片
                  </Button>
                  {imagePaths.length > 1 && (
                    <Button variant="outline" className="flex-1" onClick={handleDownloadAllImages}>
                      下载全部
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                创建时间: {formatDateShanghai(gen.created_at)}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">模型</label>
                <div className="p-3 bg-muted rounded-lg text-sm">{gen.model || '未知'}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">比例</label>
                <div className="p-3 bg-muted rounded-lg text-sm">{gen.aspect_ratio || '1:1'}</div>
              </div>

              {gen.system_context && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">系统上下文</label>
                  <div className="p-3 bg-muted rounded-lg text-sm max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {gen.system_context}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">提示词 (Prompt)</label>
                <div className="p-3 bg-muted rounded-lg text-sm max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {gen.prompt}
                </div>
              </div>

              {gen.storyboard && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">故事板</label>
                  <div className="p-3 bg-muted rounded-lg text-sm max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {gen.storyboard}
                  </div>
                </div>
              )}

              {gen.negative_prompt && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">负面提示词</label>
                  <div className="p-3 bg-muted rounded-lg text-sm max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {gen.negative_prompt}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      <ImageLightbox
        open={lightboxOpen}
        images={imageUrls}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onDownload={(i) => {
          const p = imagePaths[i]
          if (!p) return
          onDownload(
            p,
            'image',
            makeSuggestedFileName({
              prompt: gen.prompt,
              filePath: p,
              date: createdDate,
              index: i,
              total: imagePaths.length,
              defaultBase: 'image',
            })
          )
        }}
      />
    </>,
    document.body
  )

  
}
