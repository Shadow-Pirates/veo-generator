import { useState, useEffect } from 'react'
import { Star as StarIcon, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { api, type Generation } from '@/lib/api'
import GenerationCard from '@/components/GenerationCard'
import GenerationDetailModal from '@/components/GenerationDetailModal'
import { formatDateShanghai } from '@/lib/datetime'

interface FavoritesProps {
  apiKey: string
}

export default function Favorites({ apiKey: _ }: FavoritesProps) {
  const { toast } = useToast()
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedGen, setSelectedGen] = useState<Generation | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const pageSize = 12

  useEffect(() => {
    loadFavorites()
  }, [typeFilter, statusFilter, page, appliedSearch])

  const loadFavorites = async () => {
    setLoading(true)
    try {
      const params: any = {
        page,
        pageSize,
        isFavorite: true,
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }
      if (appliedSearch) {
        params.search = appliedSearch
      }

      const response = await api.getHistory(params)
      setGenerations(response.items)
      setTotal(response.total)
    } catch (error) {
      console.error('加载收藏失败', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    setAppliedSearch(search)
    loadFavorites()
  }

  const handleToggleFavorite = async (id: string) => {
    try {
      const response = await api.toggleFavorite(id)
      if (!response.is_favorite) {
        setGenerations(prev => prev.filter(g => g.id !== id))
        setTotal(prev => Math.max(0, prev - 1))
      } else {
        setGenerations(prev => prev.map(g => (g.id === id ? { ...g, is_favorite: true } : g)))
      }
    } catch {
      toast({
        title: '操作失败',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (gen: Generation) => {
    if (!confirm('确定要删除这条记录吗？')) return
    const shouldDeleteSource = confirm('是否同时删除源文件？')

    try {
      if (shouldDeleteSource) {
        const candidates = [gen.result_path, gen.thumbnail_path, ...(gen.reference_images || [])]
        for (const p of candidates) {
          if (!p) continue
          await api.deleteLocalFile(p)
        }
      }

      await api.deleteHistory(gen.id)
      setGenerations(prev => prev.filter(g => g.id !== gen.id))
      toast({
        title: '删除成功',
      })
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error?.message || '未知错误',
        variant: 'destructive',
      })
    }
  }

  const formatDate = (dateStr: string) =>
    formatDateShanghai(dateStr, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  const handleSaveAs = async (filePath: string | undefined, type: string, suggestedName?: string) => {
    if (!filePath) return
    try {
      const res = await api.saveFileAs(filePath, suggestedName)
      if (res.success && !res.canceled) {
        toast({
          title: '下载成功',
          description: type === 'video' ? '视频已保存' : '图片已保存',
        })
      }
    } catch (error: any) {
      toast({
        title: '下载失败',
        description: error?.message || '未知错误',
        variant: 'destructive',
      })
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">我的收藏</h1>
          <span className="text-sm text-muted-foreground ml-2">共 {total} 条</span>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
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
          <StarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>暂无收藏</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {generations.map((gen) => (
            <GenerationCard
              key={gen.id}
              gen={gen}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              onPreview={setSelectedGen}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDelete}
              onDownload={handleSaveAs}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

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

      <GenerationDetailModal gen={selectedGen} onClose={() => setSelectedGen(null)} onDownload={handleSaveAs} />
    </div>
  )
}
