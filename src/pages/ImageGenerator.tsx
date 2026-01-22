import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { v4 as uuidv4 } from 'uuid'
import { Image as ImageIcon, Upload, Sparkles, Loader2, Download, Plus, X, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { api, getStaticUrl } from '@/lib/api'
import ImageLightbox from '@/components/ImageLightbox'
import { makeSuggestedFileName } from '@/lib/downloadName'

interface ImageGeneratorProps {
  apiKey: string
  onApiKeyChange?: (key: string) => void
}

export default function ImageGenerator({ apiKey }: ImageGeneratorProps) {
  const { toast } = useToast()
  const TABS_KEY = 'image.tabs.v1'
  const MAX_TABS = 10
  const DEFAULT_MODEL = 'gemini-3-pro-image-preview'
  const MODEL_OPTIONS: string[] = [
    'nano-banana-2',
    'nano-banana-2-2k-vip',
    'gemini-3-pro-image-preview',
    'gemini-3-pro-image-preview-2k-vip',
    'gpt-image-1.5',
  ]
  const [hydrated, setHydrated] = useState(false)
  const saveTimerRef = useRef<number | null>(null)
  const tabsSaveTimerRef = useRef<number | null>(null)
  const tabTitleTimerRef = useRef<number | null>(null)
  const activeTabIdRef = useRef<string>('')

  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const [tabs, setTabs] = useState<
    Array<{ id: string; title: string; createdAt: number; titleAuto?: boolean; status?: string }>
  >([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [tabHydrated, setTabHydrated] = useState(false)
  const [loadedTabId, setLoadedTabId] = useState<string>('')

  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [numImages, setNumImages] = useState('1')
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  
  const [refImage, setRefImage] = useState<File | null>(null)
  const [refPreview, setRefPreview] = useState<string>('')
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  useEffect(() => {
    activeTabIdRef.current = activeTabId
  }, [activeTabId])

  useEffect(() => {
    if (!contextMenu) return
    const close = (e?: Event) => {
      if (e && contextMenuRef.current) {
        const target = e.target as Node | null
        if (target && contextMenuRef.current.contains(target)) {
          return
        }
      }
      setContextMenu(null)
    }

    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
    }
  }, [contextMenu])

  useEffect(() => {
    ;(async () => {
      try {
        const saved = await api.getDraft(TABS_KEY)

        if (saved?.tabs?.length) {
          setTabs(saved.tabs)
          setActiveTabId(saved.activeTabId || saved.tabs[0].id)
          return
        }

        const legacy = await api.getDraft('image')
        const id = uuidv4()
        const initTabs = [{ id, title: '任务 1', createdAt: Date.now(), titleAuto: true }]
        setTabs(initTabs)
        setActiveTabId(id)

        if (legacy) {
          await api.setDraft(`image.tab.${id}`, legacy)
          await api.clearDraft('image')
        }

        await api.setDraft(TABS_KEY, { tabs: initTabs, activeTabId: id })
      } catch {
        const id = uuidv4()
        const initTabs = [{ id, title: '任务 1', createdAt: Date.now(), titleAuto: true }]
        setTabs(initTabs)
        setActiveTabId(id)
      } finally {
        setHydrated(true)
      }
    })()
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      if (tabsSaveTimerRef.current) {
        clearTimeout(tabsSaveTimerRef.current)
      }
      if (tabTitleTimerRef.current) {
        clearTimeout(tabTitleTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!tabs.length) return
    if (!activeTabId) return

    if (tabsSaveTimerRef.current) {
      clearTimeout(tabsSaveTimerRef.current)
    }
    tabsSaveTimerRef.current = window.setTimeout(() => {
      api.setDraft(TABS_KEY, { tabs, activeTabId }).catch(() => {
        // ignore
      })
    }, 300)
  }, [hydrated, tabs, activeTabId])

  useEffect(() => {
    if (!hydrated) return
    if (!activeTabId) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const switchingToTabId = activeTabId
    setRefImage(null)
    setLoadedTabId('')
    setTabHydrated(false)
    ;(async () => {
      try {
        const s = await api.getDraft(`image.tab.${switchingToTabId}`)
        if (s) {
          setPrompt(typeof s.prompt === 'string' ? s.prompt : '')
          setAspectRatio(typeof s.aspectRatio === 'string' ? s.aspectRatio : '1:1')
          setNumImages(typeof s.numImages === 'string' ? s.numImages : '1')
          setModel(typeof s.model === 'string' ? s.model : DEFAULT_MODEL)
          setRefPreview(typeof s.refPreview === 'string' ? s.refPreview : '')
          setGeneratedImages(
            Array.isArray(s.generatedImages) ? s.generatedImages.filter((x: any) => typeof x === 'string') : []
          )
          setIsGenerating(!!s.isGenerating)
        } else {
          setPrompt('')
          setAspectRatio('1:1')
          setNumImages('1')
          setModel(DEFAULT_MODEL)
          setRefPreview('')
          setGeneratedImages([])
          setIsGenerating(false)
        }
      } catch {
        // ignore
      } finally {
        if (activeTabIdRef.current === switchingToTabId) {
          setLoadedTabId(switchingToTabId)
          setTabHydrated(true)
        }
      }
    })()
  }, [hydrated, activeTabId])

  useEffect(() => {
    if (!tabHydrated) return
    try {
      const safeRefPreview = refPreview && refPreview.length < 10_000_000 ? refPreview : ''
      const payload = {
        prompt,
        aspectRatio,
        numImages,
        model,
        refPreview: safeRefPreview,
        generatedImages,
        isGenerating,
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = window.setTimeout(() => {
        api.setDraft(`image.tab.${activeTabId}`, payload).catch(() => {
          // ignore
        })
      }, 500)
    } catch {
      // ignore
    }
  }, [tabHydrated, activeTabId, prompt, aspectRatio, numImages, model, refPreview, generatedImages, isGenerating])

  useEffect(() => {
    if (!tabHydrated) return
    if (!activeTabId) return
    if (loadedTabId !== activeTabId) return
    setTabs(prev =>
      prev.map(t =>
        t.id === activeTabId
          ? {
              ...t,
              status: isGenerating ? 'processing' : generatedImages.length ? 'completed' : t.status,
            }
          : t
      )
    )
  }, [tabHydrated, loadedTabId, activeTabId, isGenerating, generatedImages.length])

  useEffect(() => {
    if (!tabHydrated) return
    if (!activeTabId) return
    const tab = tabs.find(t => t.id === activeTabId)
    if (!tab) return
    if (tab.titleAuto === false) return

    if (tabTitleTimerRef.current) {
      clearTimeout(tabTitleTimerRef.current)
    }
    tabTitleTimerRef.current = window.setTimeout(() => {
      const raw = String(prompt || '').trim().replace(/\s+/g, ' ')
      const auto = raw.slice(0, 10)
      if (!auto) return
      setTabs(prev => prev.map(t => (t.id === activeTabId ? { ...t, title: auto, titleAuto: true } : t)))
    }, 600)
  }, [tabHydrated, activeTabId, prompt, tabs])

  const handleNewGeneration = () => {
    setPrompt('')
    setAspectRatio('1:1')
    setNumImages('1')
    setModel(DEFAULT_MODEL)
    setRefImage(null)
    setRefPreview('')
    setGeneratedImages([])
    setIsGenerating(false)
    if (activeTabId) {
      api.clearDraft(`image.tab.${activeTabId}`).catch(() => {
        // ignore
      })
    }
  }

  const openRenameTab = (id: string) => {
    const t = tabs.find(x => x.id === id)
    setRenameTargetId(id)
    setRenameDraft(String(t?.title || ''))
  }

  const confirmRenameTab = () => {
    if (!renameTargetId) return
    const name = renameDraft.trim()
    if (!name) return
    setTabs(prev => prev.map(x => (x.id === renameTargetId ? { ...x, title: name.slice(0, 20), titleAuto: false } : x)))
    setRenameTargetId(null)
  }

  const handleCloseOthers = async (keepId: string) => {
    const keep = tabs.find(t => t.id === keepId)
    if (!keep) return
    const toRemove = tabs.filter(t => t.id !== keepId)
    setTabs([keep])
    setActiveTabId(keepId)
    setContextMenu(null)

    for (const t of toRemove) {
      try {
        await api.clearDraft(`image.tab.${t.id}`)
      } catch {
        // ignore
      }
    }
  }

  const handleCloseCompleted = async () => {
    const isDone = (st: string) => /^(completed|done|success|succeeded)$/i.test(String(st || ''))
    const toRemove = tabs.filter(t => isDone(String(t.status || '')))
    if (!toRemove.length) {
      setContextMenu(null)
      return
    }

    const remain = tabs.filter(t => !toRemove.includes(t))
    if (!remain.length) {
      const nid = uuidv4()
      const initTabs = [{ id: nid, title: '任务 1', createdAt: Date.now(), titleAuto: true }]
      setTabs(initTabs)
      setActiveTabId(nid)
    } else {
      setTabs(remain)
      if (toRemove.some(t => t.id === activeTabId)) {
        setActiveTabId(remain[0].id)
      }
    }

    setContextMenu(null)
    for (const t of toRemove) {
      try {
        await api.clearDraft(`image.tab.${t.id}`)
      } catch {
        // ignore
      }
    }
  }

  const handleAddTab = async () => {
    if (tabs.length >= MAX_TABS) {
      toast({ title: '页签数量已达上限', description: `最多 ${MAX_TABS} 个页签` })
      return
    }
    const id = uuidv4()
    const title = `任务 ${tabs.length + 1}`
    const nextTabs = [...tabs, { id, title, createdAt: Date.now(), titleAuto: true }]
    setTabs(nextTabs)
    setActiveTabId(id)
    try {
      await api.setDraft(`image.tab.${id}`, {
        prompt: '',
        aspectRatio: '1:1',
        numImages: '1',
        model: DEFAULT_MODEL,
        refPreview: '',
        generatedImages: [],
        isGenerating: false,
      })
    } catch {
      // ignore
    }
  }

  const handleCloseTab = async (tabId: string) => {
    if (tabs.length <= 1) {
      try {
        await api.clearDraft(`image.tab.${tabId}`)
      } catch {
        // ignore
      }

      const nid = uuidv4()
      const initTabs = [{ id: nid, title: '任务 1', createdAt: Date.now(), titleAuto: true }]
      setTabs(initTabs)
      setActiveTabId(nid)
      setContextMenu(null)
      setRenameTargetId(null)
      setRenameDraft('')

      setPrompt('')
      setAspectRatio('1:1')
      setNumImages('1')
      setModel(DEFAULT_MODEL)
      setRefImage(null)
      setRefPreview('')
      setGeneratedImages([])
      setIsGenerating(false)
      return
    }
    const idx = tabs.findIndex(t => t.id === tabId)
    const next = tabs.filter(t => t.id !== tabId)
    setTabs(next)
    if (activeTabId === tabId) {
      const nextActive = next[Math.max(0, idx - 1)]?.id || next[0].id
      setActiveTabId(nextActive)
    }
    try {
      await api.clearDraft(`image.tab.${tabId}`)
    } catch {
      // ignore
    }
  }

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

    const tabId = activeTabIdRef.current
    const snapshotPrompt = prompt
    const snapshotAspectRatio = aspectRatio
    const snapshotNumImages = numImages
    const snapshotModel = model
    const snapshotRefPreview = refPreview
    const snapshotRefImage = refImage
    setIsGenerating(true)
    setGeneratedImages([])
    setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, status: 'processing' } : t)))

    api
      .setDraft(`image.tab.${tabId}`, {
        prompt: snapshotPrompt,
        aspectRatio: snapshotAspectRatio,
        numImages: snapshotNumImages,
        model: snapshotModel,
        refPreview: snapshotRefPreview,
        generatedImages: [],
        isGenerating: true,
      })
      .catch(() => {
        // ignore
      })

    try {
      // 如果有参考图片，读取为 ArrayBuffer
      let referenceImage: ArrayBuffer | undefined
      if (snapshotRefImage) {
        referenceImage = await snapshotRefImage.arrayBuffer()
      }

      const result = await api.generateImage({
        apiKey,
        prompt: snapshotPrompt,
        aspectRatio: snapshotAspectRatio,
        numImages: parseInt(snapshotNumImages),
        model: snapshotModel,
        referenceImage,
      })
      
      if (result.status === 'completed' && result.images.length > 0) {
        if (activeTabIdRef.current === tabId) {
          setGeneratedImages(result.images)
          setIsGenerating(false)
        }
        setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, status: 'completed' } : t)))
        api
          .setDraft(`image.tab.${tabId}`, {
            prompt: snapshotPrompt,
            aspectRatio: snapshotAspectRatio,
            numImages: snapshotNumImages,
            model: snapshotModel,
            refPreview: snapshotRefPreview,
            generatedImages: result.images,
            isGenerating: false,
          })
          .catch(() => {
            // ignore
          })
        toast({
          title: '生成成功',
          description: `成功生成 ${result.images.length} 张图片`,
        })
      } else {
        setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, status: 'failed' } : t)))
        api
          .setDraft(`image.tab.${tabId}`, {
            prompt: snapshotPrompt,
            aspectRatio: snapshotAspectRatio,
            numImages: snapshotNumImages,
            model: snapshotModel,
            refPreview: snapshotRefPreview,
            isGenerating: false,
          })
          .catch(() => {
            // ignore
          })
        toast({
          title: '生成失败',
          description: `未能生成图片，建议切换模型重试（当前：${snapshotModel}）。`,
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, status: 'failed' } : t)))
      api
        .setDraft(`image.tab.${tabId}`, {
          prompt: snapshotPrompt,
          aspectRatio: snapshotAspectRatio,
          numImages: snapshotNumImages,
          model: snapshotModel,
          refPreview: snapshotRefPreview,
          isGenerating: false,
        })
        .catch(() => {
          // ignore
        })

      const rawMessage = String(error?.message || error || '')
      const lower = rawMessage.toLowerCase()
      let friendly = rawMessage || '未知错误'
      if (
        lower.includes('quota exceeded') ||
        lower.includes('exceeded your current quota') ||
        lower.includes('billing') ||
        /limit:\s*0/i.test(rawMessage)
      ) {
        friendly = '当前 API Key 的额度/配额不足（可能未开通计费或额度为 0）。请更换 API Key，或在服务商后台开通计费/充值后重试。'
      }
      if (
        lower.includes('model') ||
        lower.includes('unsupported') ||
        lower.includes('not found') ||
        lower.includes('invalid argument')
      ) {
        const prefix = friendly ? `${friendly} ` : ''
        friendly = `${prefix}建议切换模型重试（当前：${snapshotModel}）。`
      }
      toast({
        title: '生成失败',
        description: friendly,
        variant: 'destructive',
      })
    } finally {
      if (activeTabIdRef.current === tabId) {
        setIsGenerating(false)
      }
    }
  }

  const handleSaveAs = async (filePath: string | undefined, index?: number) => {
    if (!filePath) return
    try {
      const suggestedName = makeSuggestedFileName({
        prompt,
        filePath,
        date: new Date(),
        index,
        total: generatedImages.length,
        defaultBase: 'image',
      })
      const res = await api.saveFileAs(filePath, suggestedName)
      if (res.success && !res.canceled) {
        toast({ title: '下载成功', description: '图片已保存' })
      }
    } catch (error: any) {
      toast({ title: '下载失败', description: error?.message || '未知错误', variant: 'destructive' })
    }
  }

  const handleSaveAll = async () => {
    const list = generatedImages.filter(Boolean)
    if (!list.length) return
    const dir = await api.selectDirectory()
    if (!dir) return
    const date = new Date()
    const items = list.map((p, i) => ({
      sourcePath: p,
      fileName: makeSuggestedFileName({
        prompt,
        filePath: p,
        date,
        index: i,
        total: list.length,
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

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx)
    setLightboxOpen(true)
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <ImageIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">图片生成</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleAddTab}>
          <Plus className="h-4 w-4 mr-1" />
          新建页签
        </Button>
      </div>

      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="overflow-x-auto max-w-full">
          <div className="flex items-center gap-2 min-w-max py-2">
            {tabs.map((t) => {
              const active = t.id === activeTabId
              const status = String(t.status || '')
              return (
                <div
                  key={t.id}
                  title={t.title}
                  className={
                    'shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer select-none ' +
                    (active ? 'bg-accent' : 'bg-background hover:bg-accent/50')
                  }
                  onClick={() => setActiveTabId(t.id)}
                  onDoubleClick={() => openRenameTab(t.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ tabId: t.id, x: e.clientX, y: e.clientY })
                  }}
                >
                  <div className="text-sm font-medium max-w-[160px] truncate">{t.title}</div>
                  {status === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : status === 'completed' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : status === 'failed' ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : null}
                  <button
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCloseTab(t.id)
                    }}
                    aria-label="Close tab"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-44 rounded-md border bg-background shadow-lg overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            className="w-full px-3 py-2 text-sm hover:bg-accent text-left"
            onClick={() => {
              const id = contextMenu.tabId
              setContextMenu(null)
              openRenameTab(id)
            }}
          >
            重命名
          </button>
          <button
            className="w-full px-3 py-2 text-sm hover:bg-accent text-left"
            onClick={() => {
              const id = contextMenu.tabId
              setContextMenu(null)
              handleCloseTab(id)
            }}
          >
            关闭
          </button>
          <button
            className="w-full px-3 py-2 text-sm hover:bg-accent text-left"
            onClick={() => {
              handleCloseOthers(contextMenu.tabId)
            }}
          >
            关闭其他
          </button>
          <button
            className="w-full px-3 py-2 text-sm hover:bg-accent text-left"
            onClick={() => {
              handleCloseCompleted()
            }}
          >
            关闭已完成
          </button>
        </div>
      )}

      {renameTargetId &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRenameTargetId(null)}>
            <div className="w-full max-w-md rounded-lg border bg-background p-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-lg font-semibold">重命名页签</div>
              <input
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="请输入页签名称"
                maxLength={20}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRenameTab()
                  if (e.key === 'Escape') setRenameTargetId(null)
                }}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRenameTargetId(null)}>
                  取消
                </Button>
                <Button onClick={confirmRenameTab} disabled={!renameDraft.trim()}>
                  确定
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

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

            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium">模型</label>
              <Select
                value={model}
                onValueChange={(v) => {
                  if (!MODEL_OPTIONS.includes(v)) {
                    setModel(DEFAULT_MODEL)
                    return
                  }
                  setModel(v)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
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

          {generatedImages.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">共 {generatedImages.length} 张</div>
              <Button variant="outline" size="sm" onClick={handleSaveAll}>
                <Download className="h-4 w-4 mr-1" />
                下载全部
              </Button>
            </div>
          )}
          
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
                <div key={idx} className="space-y-2">
                  <button className="block w-full" onClick={() => openLightbox(idx)}>
                    <img
                      src={getStaticUrl(imageUrl)}
                      alt={`Generated ${idx + 1}`}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                  </button>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleSaveAs(imageUrl, idx)}>
                    <Download className="h-4 w-4 mr-1" />
                    下载
                  </Button>
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

      <ImageLightbox
        open={lightboxOpen}
        images={generatedImages.map((p) => getStaticUrl(p))}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onDownload={(i) => {
          const p = generatedImages[i]
          if (!p) return
          handleSaveAs(p, i)
        }}
      />
    </div>
  )
}
