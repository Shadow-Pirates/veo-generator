import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { v4 as uuidv4 } from 'uuid'
import { Video, Sparkles, Loader2, Download, Plus, X, Check, AlertTriangle, Save, Upload, Play } from 'lucide-react'
import ReactPlayer from 'react-player'
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
  const TABS_KEY = 'video.tabs.v1'
  const MAX_TABS = 10
  const DEFAULT_MODEL = 'veo3.1'
  const MODEL_OPTIONS: string[] = ['sora-2', 'veo3.1', 'veo3.1-components']
  const tabTitleTimerRef = useRef<number | null>(null)
  const activeTabIdRef = useRef<string>('')
  const taskIdRef = useRef<string>('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [templateMode, setTemplateMode] = useState<'builtin' | 'user'>('builtin')
  const [templateSearch, setTemplateSearch] = useState('')
  const [hydrated, setHydrated] = useState(false)

  const [tabs, setTabs] = useState<Array<{ id: string; title: string; createdAt: number; titleAuto?: boolean; status?: string; progress?: number; taskId?: string }>>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [tabHydrated, setTabHydrated] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  
  const [systemContext, setSystemContext] = useState('')
  const [storyboard, setStoryboard] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  
  const [refImage1, setRefImage1] = useState<File | null>(null)
  const [refImage2, setRefImage2] = useState<File | null>(null)
  const [refPreview1, setRefPreview1] = useState<string>('')
  const [refPreview2, setRefPreview2] = useState<string>('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [_generationId, setGenerationId] = useState<string>('')
  const [taskId, setTaskId] = useState<string>('')
  const [_status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [log, setLog] = useState<string[]>([])
  
  const pollingRef = useRef<number | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const tabsSaveTimerRef = useRef<number | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const logContainerRef = useRef<HTMLDivElement | null>(null)
  const logShouldStickToBottomRef = useRef(true)

  useEffect(() => {
    activeTabIdRef.current = activeTabId
  }, [activeTabId])

  useEffect(() => {
    taskIdRef.current = taskId
  }, [taskId])

  useEffect(() => {
    const el = logContainerRef.current
    if (!el) return
    if (!logShouldStickToBottomRef.current) return
    el.scrollTop = el.scrollHeight
  }, [log.length])

  useEffect(() => {
    loadTemplates()
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
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

  const getAutoTitle = () => {
    const raw = String(storyboard || systemContext || '').trim()
    const singleLine = raw.replace(/\s+/g, ' ').trim()
    const base = singleLine.replace(/^Prompt:\s*/i, '').replace(/^Storyboard:\s*/i, '')
    return base.slice(0, 10)
  }

  useEffect(() => {
    ;(async () => {
      try {
        const saved = await api.getDraft(TABS_KEY)

        if (saved?.tabs?.length) {
          setTabs(saved.tabs)
          setActiveTabId(saved.activeTabId || saved.tabs[0].id)
          return
        }

        const legacy = await api.getDraft('video')
        const id = `t_${Date.now()}`
        const initTabs = [{ id, title: '任务 1', createdAt: Date.now(), titleAuto: true }]
        setTabs(initTabs)
        setActiveTabId(id)

        if (legacy) {
          await api.setDraft(`video.tab.${id}`, legacy)
          await api.clearDraft('video')
        }

        await api.setDraft(TABS_KEY, { tabs: initTabs, activeTabId: id })
      } catch {
        const id = `t_${Date.now()}`
        const initTabs = [{ id, title: '任务 1', createdAt: Date.now(), titleAuto: true }]
        setTabs(initTabs)
        setActiveTabId(id)
      } finally {
        setHydrated(true)
      }
    })()
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

    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    setIsSubmitting(false)
    setRefImage1(null)
    setRefImage2(null)

    setTabHydrated(false)
    ;(async () => {
      try {
        const s = await api.getDraft(`video.tab.${activeTabId}`)
        if (s) {
          setSelectedTemplate(typeof s.selectedTemplate === 'string' ? s.selectedTemplate : '')
          setSystemContext(typeof s.systemContext === 'string' ? s.systemContext : '')
          setStoryboard(typeof s.storyboard === 'string' ? s.storyboard : '')
          setNegativePrompt(typeof s.negativePrompt === 'string' ? s.negativePrompt : '')
          setAspectRatio(typeof s.aspectRatio === 'string' ? s.aspectRatio : '16:9')
          setModel(typeof s.model === 'string' ? s.model : DEFAULT_MODEL)
          setRefPreview1(typeof s.refPreview1 === 'string' ? s.refPreview1 : '')
          setRefPreview2(typeof s.refPreview2 === 'string' ? s.refPreview2 : '')
          setTaskId(typeof s.taskId === 'string' ? s.taskId : '')
          setStatus(typeof s.status === 'string' ? s.status : '')
          setProgress(typeof s.progress === 'number' ? s.progress : 0)
          setVideoUrl(typeof s.videoUrl === 'string' ? s.videoUrl : '')
          setLog(Array.isArray(s.log) ? s.log.filter((x: any) => typeof x === 'string') : [])
          setIsGenerating(!!s.isGenerating)
        } else {
          setSelectedTemplate('')
          setSystemContext('')
          setStoryboard('')
          setNegativePrompt('')
          setAspectRatio('16:9')
          setModel(DEFAULT_MODEL)
          setRefPreview1('')
          setRefPreview2('')
          setRefImage1(null)
          setRefImage2(null)
          setIsGenerating(false)
          setGenerationId('')
          setTaskId('')
          setStatus('')
          setProgress(0)
          setVideoUrl('')
          setLog([])
        }
      } catch {
        // ignore
      } finally {
        setTabHydrated(true)
      }
    })()
  }, [hydrated, activeTabId])

  useEffect(() => {
    if (!tabHydrated) return
    try {
      const safeRefPreview1 = refPreview1 && refPreview1.length < 10_000_000 ? refPreview1 : ''
      const safeRefPreview2 = refPreview2 && refPreview2.length < 10_000_000 ? refPreview2 : ''
      const safeLog = Array.isArray(log) ? log.slice(-200) : []
      const payload = {
        selectedTemplate,
        systemContext,
        storyboard,
        negativePrompt,
        aspectRatio,
        model,
        refPreview1: safeRefPreview1,
        refPreview2: safeRefPreview2,
        isGenerating,
        taskId,
        status: _status,
        progress,
        videoUrl,
        log: safeLog,
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      const key = `video.tab.${activeTabId}`
      saveTimerRef.current = window.setTimeout(() => {
        api.setDraft(key, payload).catch(() => {
          // ignore
        })
      }, 500)
    } catch {
      // ignore
    }
  }, [tabHydrated, activeTabId, selectedTemplate, systemContext, storyboard, negativePrompt, aspectRatio, model, refPreview1, refPreview2, isGenerating, taskId, _status, progress, videoUrl, log])

  useEffect(() => {
    if (!tabHydrated) return
    if (!activeTabId) return
    setTabs(prev =>
      prev.map(t =>
        t.id === activeTabId
          ? {
              ...t,
              status: _status || (isGenerating ? 'processing' : t.status),
              progress: typeof progress === 'number' ? progress : t.progress,
              taskId: taskId || t.taskId,
            }
          : t
      )
    )
  }, [tabHydrated, activeTabId, taskId, _status, progress, isGenerating])

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
      const auto = getAutoTitle()
      if (!auto) return
      setTabs(prev => prev.map(t => (t.id === activeTabId ? { ...t, title: auto, titleAuto: true } : t)))
    }, 600)
  }, [tabHydrated, activeTabId, storyboard, systemContext, tabs])

  useEffect(() => {
    if (!tabHydrated) return
    if (!apiKey) return
    if (!taskId) return
    if (['completed', 'failed'].includes(String(_status || ''))) return
    if (pollingRef.current) return

    setIsGenerating(true)
    const myTabId = activeTabId
    const myTaskId = taskId
    pollingRef.current = window.setInterval(() => {
      pollStatus(myTabId, myTaskId)
    }, 5000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabHydrated, apiKey, taskId, _status])

  const loadTemplates = async () => {
    try {
      const templateList = await api.getTemplates()
      setTemplates(templateList as Template[])
    } catch (error) {
      console.error('加载模板失败', error)
    }
  }

  const handleSaveAsTemplate = async () => {
    const name = prompt('请输入模板名称')
    if (!name) return
    if (!name.trim()) return

    try {
      const res = await api.createTemplate({
        name: name.trim(),
        system_context: systemContext,
        storyboard,
        negative_prompt: negativePrompt,
        source: 'user',
      })

      toast({
        title: '保存成功',
      })

      await loadTemplates()
      setSelectedTemplate(String(res.id))
    } catch (error: any) {
      toast({
        title: '保存失败',
        description: error?.message || '未知错误',
        variant: 'destructive',
      })
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

  const builtinTemplates = templates.filter(t => t.source === 'builtin')
  const userTemplates = templates.filter(t => t.source !== 'builtin')
  const filteredTemplates = (templateMode === 'builtin' ? builtinTemplates : userTemplates).filter(t => {
    const q = String(templateSearch || '').trim().toLowerCase()
    if (!q) return true
    return String(t.name || '').toLowerCase().includes(q) || String(t.category || '').toLowerCase().includes(q)
  })

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

  const handleNewGeneration = () => {
    if (tabs.length >= MAX_TABS) {
      toast({ title: '页签数量已达上限', description: `最多 ${MAX_TABS} 个页签` })
      return
    }
    const id = `t_${Date.now()}`
    const nextIndex = tabs.length + 1
    const next = { id, title: `任务 ${nextIndex}`, createdAt: Date.now(), titleAuto: true }
    setTabs(prev => [...prev, next])
    setActiveTabId(id)
    setRefImage1(null)
    setRefImage2(null)
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
        await api.clearDraft(`video.tab.${t.id}`)
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
      const nid = `t_${Date.now()}`
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
        await api.clearDraft(`video.tab.${t.id}`)
      } catch {
        // ignore
      }
    }
  }

  const reorderTabs = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setTabs(prev => {
      const fromIndex = prev.findIndex(t => t.id === fromId)
      const toIndex = prev.findIndex(t => t.id === toId)
      if (fromIndex < 0 || toIndex < 0) return prev
      const next = prev.slice()
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const handleCloseTab = async (id: string) => {
    if (!tabs.length) return
    const idx = tabs.findIndex(t => t.id === id)
    if (idx < 0) return

    const nextTabs = tabs.filter(t => t.id !== id)
    if (!nextTabs.length) {
      const nid = `t_${Date.now()}`
      const initTabs = [{ id: nid, title: '任务 1', createdAt: Date.now(), titleAuto: true }]
      setTabs(initTabs)
      setActiveTabId(nid)
    } else {
      setTabs(nextTabs)
      if (activeTabId === id) {
        const nextActive = nextTabs[Math.max(0, idx - 1)]?.id || nextTabs[0].id
        setActiveTabId(nextActive)
      }
    }

    try {
      await api.clearDraft(`video.tab.${id}`)
    } catch {
      // ignore
    }
  }

  const pollStatus = async (tabId: string, remoteTaskId: string) => {
    try {
      const data = await api.pollVideoStatus(remoteTaskId, apiKey)

      // If user already switched tabs / task, ignore late responses.
      if (activeTabIdRef.current !== tabId) return
      if (taskIdRef.current !== remoteTaskId) return
      
      setStatus(data.status)
      setProgress(data.progress || 0)
      
      if (data.status === 'completed') {
        addLog('✅ 视频生成完成！')
        setVideoUrl(data.localPath || data.videoUrl || '')
        if (data.localPath) {
          addLog(`💾 已保存到本地: ${data.localPath}`)
        }
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

    if (isSubmitting) return

    if (isGenerating && !['completed', 'failed'].includes(String(_status || ''))) return

    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    const submitTabId = activeTabId

    setIsGenerating(true)
    setIsSubmitting(true)
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
        model,
        imageData,
      })

      // If user already switched tabs during submission, don't contaminate current UI.
      if (activeTabIdRef.current !== submitTabId) {
        try {
          await api.setDraft(`video.tab.${submitTabId}`, {
            selectedTemplate,
            systemContext,
            storyboard,
            negativePrompt,
            aspectRatio,
            model,
            refPreview1,
            refPreview2,
            isGenerating: true,
            taskId: result.taskId,
            status: 'processing',
            progress: 0,
            videoUrl: '',
            log: [`[${new Date().toLocaleTimeString()}] ✅ 任务已创建，ID: ${result.taskId}`],
          })
        } catch {
          // ignore
        }
        setTabs(prev => prev.map(t => (t.id === submitTabId ? { ...t, taskId: result.taskId, status: 'processing', progress: 0 } : t)))
        return
      }
      
      setGenerationId(result.id)
      setTaskId(result.taskId)
      addLog(`✅ 任务已创建，ID: ${result.taskId}`)
      addLog('🔄 开始轮询状态...（你可以切换页面，后台会继续执行，可在「任务管理」查看所有任务）')
      
      // 开始轮询
      const myTabId = submitTabId
      const myTaskId = result.taskId
      pollingRef.current = window.setInterval(() => {
        pollStatus(myTabId, myTaskId)
      }, 5000)
      
    } catch (error: any) {
      addLog(`❌ 提交失败: ${error.message}`)
      setIsGenerating(false)
      toast({
        title: '提交失败',
        description: error.message || '未知错误',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">视频生成</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleNewGeneration}>
          <Plus className="h-4 w-4 mr-1" />
          新建页签
        </Button>
      </div>

      {hydrated && tabs.length > 0 && (
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="overflow-x-auto max-w-full">
            <div className="flex gap-2 min-w-max py-2">
              {tabs.map((t) => {
                const active = t.id === activeTabId
                const st = String(t.status || '')
                const pct = Math.max(0, Math.min(100, Number(t.progress || 0)))
                const pctText = `${Math.round(pct)}%`
                const isDone = /^(completed|done|success|succeeded)$/i.test(st)
                const isFailed = /^(failed|error)$/i.test(st)
                const isRunning = !isDone && !isFailed && (st || t.taskId)
                return (
                  <button
                    key={t.id}
                    title={t.title}
                    onClick={() => setActiveTabId(t.id)}
                    onDoubleClick={() => openRenameTab(t.id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({ tabId: t.id, x: e.clientX, y: e.clientY })
                    }}
                    draggable
                    onDragStart={(e) => {
                      setDraggingTabId(t.id)
                      try {
                        e.dataTransfer.setData('text/plain', t.id)
                        e.dataTransfer.effectAllowed = 'move'
                      } catch {
                        // ignore
                      }
                    }}
                    onDragEnd={() => {
                      setDraggingTabId(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const from = (() => {
                        try {
                          return e.dataTransfer.getData('text/plain')
                        } catch {
                          return draggingTabId || ''
                        }
                      })()
                      if (from) reorderTabs(from, t.id)
                      setDraggingTabId(null)
                    }}
                    className={
                      `shrink-0 relative flex items-center gap-2 px-3 h-9 rounded-md border text-sm whitespace-nowrap ` +
                      (active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent')
                    }
                  >
                    {isDone ? (
                      <span className={active ? 'text-primary-foreground/90' : 'text-green-600'}>
                        <Check className="h-4 w-4" />
                      </span>
                    ) : isFailed ? (
                      <span className={active ? 'text-primary-foreground/90' : 'text-red-600'}>
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    ) : isRunning ? (
                      <span className={active ? 'text-primary-foreground/90' : 'text-yellow-600'}>
                        <span className="inline-block h-2 w-2 rounded-full bg-current animate-pulse" />
                      </span>
                    ) : (
                      <span className={active ? 'text-primary-foreground/90' : 'text-muted-foreground'}>
                        <span className="inline-block h-2 w-2 rounded-full bg-current opacity-40" />
                      </span>
                    )}
                    <span className="max-w-[140px] truncate">{t.title}</span>

                    {isRunning && (
                      <span className={active ? 'text-primary-foreground/90' : 'text-muted-foreground'}>{pctText}</span>
                    )}

                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCloseTab(t.id)
                      }}
                      className={
                        `inline-flex items-center justify-center h-5 w-5 rounded hover:bg-black/10 ` +
                        (active ? 'hover:bg-white/20' : '')
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>

                    {isRunning && (
                      <span
                        className={
                          `absolute left-0 bottom-0 h-[2px] ` +
                          (active ? 'bg-primary-foreground/80' : isFailed ? 'bg-red-500' : 'bg-primary')
                        }
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

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
                className="mt-3 w-full h-10 px-3 border rounded-md bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmRenameTab()
                  }
                  if (e.key === 'Escape') {
                    setRenameTargetId(null)
                  }
                }}
              />
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRenameTargetId(null)}>
                  取消
                </Button>
                <Button onClick={confirmRenameTab}>
                  保存
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：输入区域 */}
        <div className="space-y-4">
          {/* 模板选择 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">选择模板</label>
              <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
                <Save className="h-4 w-4 mr-1" />
                保存为模板
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant={templateMode === 'builtin' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setTemplateMode('builtin')}
                className="flex-1"
              >
                内置
              </Button>
              <Button
                variant={templateMode === 'user' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setTemplateMode('user')}
                className="flex-1"
              >
                我的
              </Button>
            </div>

            <input
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="搜索模板名称/分类..."
              className="w-full h-10 px-3 border rounded-md bg-background"
            />

            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择一个模板..." />
              </SelectTrigger>
              <SelectContent>
                {filteredTemplates.map(t => (
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
          <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <label className="text-sm font-medium">模型</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-56">
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
            disabled={!apiKey || isSubmitting || (isGenerating && !['completed', 'failed'].includes(String(_status || '')))}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中...
              </>
            ) : isGenerating ? (
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
                <ReactPlayer
                  url={getStaticUrl(videoUrl)}
                  width="100%"
                  height="100%"
                  controls
                  playing
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>视频将在这里显示</p>
                </div>
              )}
            </div>

            {taskId && apiKey && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    addLog('⬇️ 正在尝试下载到本地...')
                    try {
                      const s = await api.downloadVideo(taskId, apiKey)
                      if (s.status === 'completed' && s.localPath) {
                        setVideoUrl(s.localPath)
                        addLog(`💾 已保存到本地: ${s.localPath}`)
                        toast({ title: '下载成功' })
                      } else if (s.status === 'failed') {
                        addLog(`❌ 下载失败: ${s.error || '未知错误'}`)
                        toast({ title: '下载失败', description: s.error || '未知错误', variant: 'destructive' })
                      } else {
                        addLog(`⏳ 当前状态: ${s.status}，稍后再试`) 
                      }
                    } catch (e: any) {
                      addLog(`❌ 下载失败: ${e?.message || String(e)}`)
                      toast({ title: '下载失败', description: e?.message || '未知错误', variant: 'destructive' })
                    }
                  }}
                >
                  下载到本地
                </Button>
              </div>
            )}
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
            <div
              ref={logContainerRef}
              className="h-72 bg-muted/50 rounded-lg p-3 overflow-y-auto font-mono text-xs space-y-1"
              onScroll={(e) => {
                const el = e.currentTarget
                const threshold = 40
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
                logShouldStickToBottomRef.current = atBottom
              }}
            >
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
