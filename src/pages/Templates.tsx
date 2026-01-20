import { useState, useEffect } from 'react'
import { FileText, Plus, Edit, Trash2, Star, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { api, type Template } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function Templates() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    system_context: '',
    storyboard: '',
    negative_prompt: '',
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const templates = await api.getTemplates()
      setTemplates(templates)
    } catch (error) {
      console.error('加载模板失败', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImportFromJson = async () => {
    try {
      // 导入功能暂不支持
      toast({
        title: '提示',
        description: 'Electron 版本暂不支持从 JSON 导入',
      })
      loadTemplates()
    } catch (error: any) {
      toast({
        title: '导入失败',
        description: error.response?.data?.detail || error.message,
        variant: 'destructive',
      })
    }
  }

  const handleExport = async () => {
    try {
      const templates = await api.getTemplates()
      const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'templates_export.json'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({
        title: '导出成功',
      })
    } catch (error) {
      toast({
        title: '导出失败',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      category: template.category || '',
      system_context: template.system_context || '',
      storyboard: template.storyboard || '',
      negative_prompt: template.negative_prompt || '',
    })
    setIsCreating(false)
  }

  const handleCreate = () => {
    setEditingTemplate(null)
    setFormData({
      name: '',
      category: '',
      system_context: '',
      storyboard: '',
      negative_prompt: '',
    })
    setIsCreating(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: '错误',
        description: '请输入模板名称',
        variant: 'destructive',
      })
      return
    }

    try {
      if (isCreating) {
        await api.createTemplate(formData)
        toast({ title: '创建成功' })
      } else if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, formData)
        toast({ title: '更新成功' })
      }
      loadTemplates()
      setEditingTemplate(null)
      setIsCreating(false)
    } catch (error: any) {
      toast({
        title: '保存失败',
        description: error.response?.data?.detail || error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个模板吗？')) return

    try {
      await api.deleteTemplate(id)
      toast({ title: '删除成功' })
      loadTemplates()
    } catch (error) {
      toast({
        title: '删除失败',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    setEditingTemplate(null)
    setIsCreating(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">模板管理</h1>
          <span className="text-sm text-muted-foreground ml-2">共 {templates.length} 个</span>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImportFromJson}>
            <Upload className="h-4 w-4 mr-1" />
            从 JSON 导入
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" />
            新建模板
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：模板列表 */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            [...Array(5)].map((_, idx) => (
              <div key={idx} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无模板</p>
              <Button variant="link" onClick={handleImportFromJson}>
                从配置文件导入
              </Button>
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors",
                  editingTemplate?.id === template.id && "bg-accent border-primary"
                )}
                onClick={() => handleEdit(template)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{template.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      使用 {template.use_count} 次
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {template.is_favorite && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(template.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 右侧：编辑区域 */}
        <div className="lg:col-span-2">
          {(editingTemplate || isCreating) ? (
            <div className="space-y-4 p-4 border rounded-lg">
              <h2 className="font-semibold">
                {isCreating ? '新建模板' : '编辑模板'}
              </h2>

              <div className="space-y-2">
                <label className="text-sm font-medium">模板名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="输入模板名称..."
                  className="w-full h-10 px-3 border rounded-md bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">分类</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="可选，如：冬日场景、商业广告..."
                  className="w-full h-10 px-3 border rounded-md bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">系统上下文 (System Context)</label>
                <Textarea
                  value={formData.system_context}
                  onChange={(e) => setFormData(prev => ({ ...prev, system_context: e.target.value }))}
                  placeholder="描述角色设定、视觉锚点、环境等..."
                  rows={8}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">动态故事板 (Storyboard)</label>
                <Textarea
                  value={formData.storyboard}
                  onChange={(e) => setFormData(prev => ({ ...prev, storyboard: e.target.value }))}
                  placeholder="描述具体的动作、镜头语言..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">负面提示词 (Negative Prompt)</label>
                <Textarea
                  value={formData.negative_prompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, negative_prompt: e.target.value }))}
                  placeholder="描述要避免的元素..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave}>
                  保存
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground border rounded-lg">
              <div className="text-center">
                <Edit className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>选择一个模板进行编辑，或创建新模板</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
