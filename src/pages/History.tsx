import { useState, useEffect } from 'react'
import { History as HistoryIcon, Video, Image, Star, Trash2, Search, Filter, X, Eye, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { api, getStaticUrl, type Generation } from '@/lib/api'
import { cn } from '@/lib/utils'

interface HistoryProps {
  apiKey: string
}

export default function History({ apiKey: _ }: HistoryProps) {
  const { toast } = useToast()
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedGen, setSelectedGen] = useState<Generation | null>(null)
  const pageSize = 12

  useEffect(() => {
    loadHistory()
  }, [typeFilter, statusFilter, page])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params: any = {
        page,
        page_size: pageSize,
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }
      if (search) {
        params.search = search
      }

      const response = await api.getHistory(params)
      setGenerations(response.items)
      setTotal(response.total)
    } catch (error) {
      console.error('加载历史记录失败', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadHistory()
  }

  const handleToggleFavorite = async (id: string) => {
    try {
      const response = await api.toggleFavorite(id)
      setGenerations(prev =>
        prev.map(g => (g.id === id ? { ...g, is_favorite: response.is_favorite } : g))
      )
    } catch (error) {
      toast({
        title: '操作失败',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条记录吗？')) return

    try {
      await api.deleteHistory(id)
      setGenerations(prev => prev.filter(g => g.id !== id))
      toast({
        title: '删除成功',
      })
    } catch (error) {
      toast({
        title: '删除失败',
        variant: 'destructive',
      })
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">历史记录</h1>
          <span className="text-sm text-muted-foreground ml-2">共 {total} 条</span>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="video">视频</SelectItem>
              <SelectItem value="image">图片</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
            <SelectItem value="processing">处理中</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索提示词..."
            className="flex-1 h-10 px-3 border rounded-md bg-background"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button variant="secondary" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, idx) => (
            <div key={idx} className="aspect-video bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : generations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <HistoryIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>暂无历史记录</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {generations.map((gen) => (
            <div
              key={gen.id}
              className="group relative rounded-lg overflow-hidden border bg-card hover:shadow-lg transition-shadow"
            >
              {/* 缩略图 */}
              <div className="aspect-video bg-muted relative">
                {gen.result_path ? (
                  gen.type === 'video' ? (
                    <video
                      src={getStaticUrl(gen.result_path)}
                      className="w-full h-full object-cover"
                      muted
                      onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseLeave={(e) => {
                        const video = e.target as HTMLVideoElement
                        video.pause()
                        video.currentTime = 0
                      }}
                    />
                  ) : (
                    <img
                      src={getStaticUrl(gen.result_path)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {gen.type === 'video' ? (
                      <Video className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      <Image className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                )}

                {/* 类型标签 */}
                <div className="absolute top-2 left-2">
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      gen.type === 'video'
                        ? "bg-blue-500/80 text-white"
                        : "bg-green-500/80 text-white"
                    )}
                  >
                    {gen.type === 'video' ? '视频' : '图片'}
                  </span>
                </div>

                {/* 状态标签 */}
                {gen.status !== 'completed' && (
                  <div className="absolute top-2 right-2">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        gen.status === 'processing'
                          ? "bg-yellow-500/80 text-white"
                          : "bg-red-500/80 text-white"
                      )}
                    >
                      {gen.status === 'processing' ? '处理中' : '失败'}
                    </span>
                  </div>
                )}

                {/* 悬浮操作 */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setSelectedGen(gen)}
                    title="查看详情"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => handleToggleFavorite(gen.id)}
                    title="收藏"
                  >
                    <Star
                      className={cn("h-4 w-4", gen.is_favorite && "fill-yellow-400 text-yellow-400")}
                    />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(gen.id)}
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 信息 */}
              <div className="p-3">
                <p className="text-sm line-clamp-2 mb-1">{gen.prompt.substring(0, 100)}...</p>
                <p className="text-xs text-muted-foreground">{formatDate(gen.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </Button>
          <span className="flex items-center px-4 text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 详情弹窗 */}
      {selectedGen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedGen(null)}>
          <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                {selectedGen.type === 'video' ? <Video className="h-5 w-5" /> : <Image className="h-5 w-5" />}
                <h2 className="text-lg font-semibold">
                  {selectedGen.type === 'video' ? '视频' : '图片'}生成详情
                </h2>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  selectedGen.status === 'completed' ? "bg-green-500/80 text-white" :
                  selectedGen.status === 'processing' ? "bg-yellow-500/80 text-white" : "bg-red-500/80 text-white"
                )}>
                  {selectedGen.status === 'completed' ? '已完成' : selectedGen.status === 'processing' ? '处理中' : '失败'}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedGen(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 左侧：预览 */}
                <div className="space-y-4">
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    {selectedGen.result_path ? (
                      selectedGen.type === 'video' ? (
                        <video
                          src={getStaticUrl(selectedGen.result_path)}
                          className="w-full h-full object-contain"
                          controls
                          autoPlay
                          loop
                        />
                      ) : (
                        <img
                          src={getStaticUrl(selectedGen.result_path)}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        无预览
                      </div>
                    )}
                  </div>
                  {selectedGen.result_path && (
                    <Button className="w-full" asChild>
                      <a href={getStaticUrl(selectedGen.result_path)} download>
                        <Download className="h-4 w-4 mr-2" />
                        下载{selectedGen.type === 'video' ? '视频' : '图片'}
                      </a>
                    </Button>
                  )}
                </div>

                {/* 右侧：提示词详情 */}
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    创建时间: {new Date(selectedGen.created_at).toLocaleString('zh-CN')}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">模型</label>
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      {selectedGen.model || '未知'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">比例</label>
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      {selectedGen.aspect_ratio || '1:1'}
                    </div>
                  </div>

                  {selectedGen.system_context && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">系统上下文</label>
                      <div className="p-3 bg-muted rounded-lg text-sm max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {selectedGen.system_context}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">提示词 (Prompt)</label>
                    <div className="p-3 bg-muted rounded-lg text-sm max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {selectedGen.prompt}
                    </div>
                  </div>

                  {selectedGen.storyboard && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">故事板</label>
                      <div className="p-3 bg-muted rounded-lg text-sm max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {selectedGen.storyboard}
                      </div>
                    </div>
                  )}

                  {selectedGen.negative_prompt && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">负面提示词</label>
                      <div className="p-3 bg-muted rounded-lg text-sm max-h-24 overflow-y-auto whitespace-pre-wrap">
                        {selectedGen.negative_prompt}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
