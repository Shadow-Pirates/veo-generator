import { useEffect, useRef, useState } from 'react'
import { ListChecks, RefreshCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { api, type Generation, getStaticUrl } from '@/lib/api'
import GenerationDetailModal from '@/components/GenerationDetailModal'
import { formatDateShanghai } from '@/lib/datetime'

interface TasksProps {
  apiKey: string
}

export default function Tasks({ apiKey }: TasksProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Generation | null>(null)
  const hasLoadedOnceRef = useRef(false)
  const inFlightRef = useRef(false)

  const isDone = (st: string) => /^(completed|done|success|succeeded)$/i.test(String(st || ''))
  const isFailed = (st: string) => /^(failed|error)$/i.test(String(st || ''))
  const unfinishedCount = items.filter((x) => !isDone(String(x.status || '')) && !isFailed(String(x.status || ''))).length

  const getStatusBadge = (stRaw: string) => {
    const st = String(stRaw || '')
    if (isDone(st)) {
      return { label: '已完成', className: 'bg-green-600/90 text-white' }
    }
    if (isFailed(st)) {
      return { label: '失败', className: 'bg-red-600/90 text-white' }
    }
    if (!st || /^(processing|pending|running|queued)$/i.test(st)) {
      return { label: '处理中', className: 'bg-yellow-500/80 text-white' }
    }
    return { label: st, className: 'bg-yellow-500/80 text-white' }
  }

  const handleDelete = async (g: Generation) => {
    if (!confirm('确定要删除这个任务吗？')) return
    try {
      await api.deleteHistory(g.id)
      setItems(prev => prev.filter(x => x.id !== g.id))
      toast({ title: '删除成功' })
    } catch (e: any) {
      toast({ title: '删除失败', description: e?.message || '未知错误', variant: 'destructive' })
    }
  }

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
    } catch (e: any) {
      toast({ title: '下载失败', description: e?.message || '未知错误', variant: 'destructive' })
    }
  }

  const load = async (source: 'initial' | 'manual' | 'auto' = 'auto') => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    const isInitial = source === 'initial' || !hasLoadedOnceRef.current
    const startScrollY = window.scrollY
    let userScrolled = false
    const onScroll = () => {
      try {
        if (Math.abs(window.scrollY - startScrollY) > 2) {
          userScrolled = true
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    if (isInitial) {
      setLoading(true)
    } else if (source === 'manual') {
      setRefreshing(true)
    }
    try {
      const list = await api.getTasks()
      setItems(list)
      hasLoadedOnceRef.current = true
    } catch (e: any) {
      toast({ title: '加载失败', description: e?.message || '未知错误', variant: 'destructive' })
    } finally {
      try {
        window.removeEventListener('scroll', onScroll)
      } catch {
        // ignore
      }

      if (isInitial) {
        setLoading(false)
      } else if (source === 'manual') {
        setRefreshing(false)
      }

      // Preserve scroll position unless user actively scrolled during refresh.
      requestAnimationFrame(() => {
        try {
          if (!userScrolled) {
            window.scrollTo({ top: startScrollY, left: 0, behavior: 'instant' as ScrollBehavior })
          }
        } catch {
          // ignore
        }
      })

      inFlightRef.current = false
    }
  }

  useEffect(() => {
    load('initial')
    const t = window.setInterval(() => load('auto'), 2500)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">任务管理</h1>
          <span className="text-sm text-muted-foreground ml-2">未完成 {unfinishedCount} 个 / 共 {items.length} 个</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => load('manual')} disabled={refreshing}>
          <RefreshCcw className="h-4 w-4 mr-1" />
          {refreshing ? '刷新中...' : '刷新'}
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">暂无任务</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((g) => (
            <div key={g.id} className="rounded-lg border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{g.prompt}</div>
                  <div className="text-xs text-muted-foreground mt-1">{formatDateShanghai(g.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${getStatusBadge(String(g.status || '')).className}`}
                  >
                    {getStatusBadge(String(g.status || '')).label}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(g)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, g.progress || 0))}%` }} />
              </div>

              <div className="flex gap-2 mt-auto">
                <Button size="sm" variant="secondary" onClick={() => setSelected(g)}>
                  查看
                </Button>
                {g.type === 'video' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!apiKey || !g.task_id}
                    onClick={async () => {
                      try {
                        const res = await api.downloadVideo(String(g.task_id), apiKey)
                        if (res.status === 'completed' && res.localPath) {
                          toast({ title: '已下载到本地' })
                        } else if (res.status === 'failed') {
                          toast({ title: '下载失败', description: res.error || '未知错误', variant: 'destructive' })
                        } else {
                          toast({ title: '任务未完成', description: `当前状态: ${res.status}` })
                        }
                      } catch (e: any) {
                        toast({ title: '操作失败', description: e?.message || '未知错误', variant: 'destructive' })
                      }
                    }}
                  >
                    重试下载
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!g.result_path}
                    onClick={() => handleSaveAs(g.result_path, 'image')}
                  >
                    下载
                  </Button>
                )}
              </div>

              {g.result_path && (
                g.type === 'video' ? (
                  <video src={getStaticUrl(g.result_path)} className="w-full rounded-md bg-black" muted controls />
                ) : (
                  <img src={getStaticUrl(g.result_path)} className="w-full rounded-md bg-black" alt="" />
                )
              )}
            </div>
          ))}
        </div>
      )}

      <GenerationDetailModal gen={selected} onClose={() => setSelected(null)} onDownload={handleSaveAs} />
    </div>
  )
}
