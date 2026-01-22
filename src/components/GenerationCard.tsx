import { MoreVertical, Star, Trash2, Video, Image } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getStaticUrl, type Generation } from '@/lib/api'
import { makeSuggestedFileName } from '@/lib/downloadName'
import { parseDateAsUtc } from '@/lib/datetime'

interface GenerationCardProps {
  gen: Generation
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
  onPreview: (gen: Generation) => void
  onToggleFavorite: (id: string) => void
  onDelete: (gen: Generation) => void
  onDownload: (filePath: string | undefined, type: string, suggestedName?: string) => void
  formatDate: (dateStr: string) => string
}

export default function GenerationCard({
  gen,
  openMenuId,
  setOpenMenuId,
  onPreview,
  onToggleFavorite,
  onDelete,
  onDownload,
  formatDate,
}: GenerationCardProps) {
  const menuOpen = openMenuId === gen.id
  const imagePaths = useMemo(() => {
    if (gen.type !== 'image') return [] as string[]
    const raw = (gen as any)?.api_response?.image_paths
    const arr = Array.isArray(raw) ? raw.filter((x: any) => typeof x === 'string' && x) : []
    if (arr.length) return arr
    return gen.result_path ? [gen.result_path] : []
  }, [gen])
  const coverPath = gen.type === 'image' ? imagePaths[0] : gen.result_path
  const coverCount = gen.type === 'image' ? imagePaths.length : 0
  const downloadSuggestedName = useMemo(() => {
    if (!coverPath) return undefined
    const date = parseDateAsUtc(gen.created_at)
    const defaultBase = gen.type === 'video' ? 'video' : 'image'
    return makeSuggestedFileName({ prompt: gen.prompt, filePath: coverPath, date, defaultBase })
  }, [coverPath, gen.created_at, gen.prompt, gen.type])

  return (
    <div className="group relative rounded-lg border bg-card hover:shadow-lg transition-shadow overflow-visible">
      <div className="aspect-video bg-muted relative overflow-hidden rounded-t-lg">
        {coverPath ? (
          gen.type === 'video' ? (
            <video
              src={getStaticUrl(coverPath)}
              className="w-full h-full object-cover cursor-pointer"
              muted
              onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
              onMouseLeave={(e) => {
                const video = e.target as HTMLVideoElement
                video.pause()
                video.currentTime = 0
              }}
              onClick={() => onPreview(gen)}
            />
          ) : (
            <img
              src={getStaticUrl(coverPath)}
              alt=""
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => onPreview(gen)}
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center cursor-pointer" onClick={() => onPreview(gen)}>
            {gen.type === 'video' ? (
              <Video className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Image className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        )}

        {coverCount > 1 && (
          <div className="absolute bottom-2 left-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-black/60 text-white">x{coverCount}</span>
          </div>
        )}

        <div className="absolute top-2 left-2">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              gen.type === 'video' ? 'bg-blue-500/80 text-white' : 'bg-green-500/80 text-white'
            )}
          >
            {gen.type === 'video' ? '视频' : '图片'}
          </span>
        </div>

        {gen.status !== 'completed' && (
          <div className="absolute top-10 right-2">
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                gen.status === 'processing' ? 'bg-yellow-500/80 text-white' : 'bg-red-500/80 text-white'
              )}
            >
              {gen.status === 'processing' ? '处理中' : '失败'}
            </span>
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(gen.id)
          }}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background shadow"
          title={gen.is_favorite ? '取消收藏' : '收藏'}
        >
          <Star className={cn('h-4 w-4', gen.is_favorite && 'fill-yellow-400 text-yellow-400')} />
        </button>
      </div>

      <div className="p-3 relative flex flex-col min-h-[76px]">
        <p className="text-sm line-clamp-2">{gen.prompt.substring(0, 100)}...</p>

        <div className="mt-auto flex items-end justify-between pt-1">
          <p className="text-xs text-muted-foreground">{formatDate(gen.created_at)}</p>

          <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOpenMenuId(menuOpen ? null : gen.id)
            }}
            className="p-1.5 rounded-md hover:bg-accent"
            title="更多"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute bottom-8 right-0 z-20 w-36 rounded-md border bg-background shadow-lg overflow-hidden"
              onMouseLeave={() => setOpenMenuId(null)}
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenuId(null)
                  onPreview(gen)
                }}
              >
                <span>预览</span>
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenuId(null)
                  onDownload(coverPath, gen.type, downloadSuggestedName)
                }}
                disabled={!coverPath}
              >
                <span>下载</span>
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenuId(null)
                  onDelete(gen)
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span>删除</span>
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
