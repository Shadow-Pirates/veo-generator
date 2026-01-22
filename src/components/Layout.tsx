import { ReactNode, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { 
  Video, 
  Image, 
  ListChecks,
  History, 
  FileText, 
  Menu,
  Key,
  Star,
  Settings,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: ReactNode
  apiKey: string
  onApiKeyChange: (key: string) => void
}

const navItems = [
  { path: '/', label: '视频生成', icon: Video },
  { path: '/image', label: '图片生成', icon: Image },
  { path: '/tasks', label: '任务管理', icon: ListChecks },
  { path: '/history', label: '历史记录', icon: History },
  { path: '/favorites', label: '我的收藏', icon: Star },
  { path: '/templates', label: '模板管理', icon: FileText },
  { path: '/guide', label: '使用指南', icon: BookOpen },
  { path: '/settings', label: '设置', icon: Settings },
]

export default function Layout({ children, apiKey, onApiKeyChange }: LayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === '1'
    } catch {
      return false
    }
  })
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', sidebarCollapsed ? '1' : '0')
    } catch {
      // ignore
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    setApiKeyDraft(apiKey)
  }, [apiKey])

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setSidebarOpen(v => !v)}
        className="fixed top-3 left-3 z-50 p-2 rounded-md border bg-background hover:bg-accent lg:hidden"
      >
        <Menu size={18} />
      </button>

      <div
        className={cn(
          'flex min-h-screen overflow-x-hidden',
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background transition-transform lg:translate-x-0 flex flex-col",
            sidebarCollapsed ? "lg:w-16" : "lg:w-64",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Sidebar Header */}
          <div className={cn(
            "flex items-center gap-2 h-14 px-4 border-b",
            sidebarCollapsed && "lg:px-2 lg:justify-center"
          )}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-bold truncate">交绘AI</span>
              </div>
            )}

            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              className={cn(
                "hidden lg:flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent",
                sidebarCollapsed && "lg:mx-auto"
              )}
              aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <nav className={cn("flex flex-col gap-1 p-4 flex-1 overflow-y-auto", sidebarCollapsed && "lg:px-2")}>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    sidebarCollapsed && "lg:justify-center lg:px-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon size={18} />
                  <span className={cn(sidebarCollapsed && "lg:hidden")}>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className={cn("p-4 border-t", sidebarCollapsed && "lg:px-2")}>
            <button
              onClick={() => setShowApiKeyInput(true)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition-colors",
                sidebarCollapsed && "lg:justify-center lg:px-0",
                apiKey ? "bg-green-50 border-green-200 text-green-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"
              )}
            >
              <Key size={16} />
              <span className={cn(sidebarCollapsed && "lg:hidden")}>
                {apiKey ? 'API Key 已设置' : '设置 API Key'}
              </span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>

      {/* API Key Modal */}
      {showApiKeyInput &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg border bg-background p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">设置 API Key</div>
                <button
                  onClick={() => {
                    setShowApiKeyInput(false)
                    setApiKeyDraft(apiKey)
                  }}
                  className="p-1.5 rounded-md hover:bg-accent"
                  aria-label="关闭"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>
              <input
                type="password"
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                placeholder="输入 API Key"
                className="w-full h-10 px-3 border rounded-md bg-background"
                autoFocus
              />
              <div className="flex gap-2 justify-end mt-4">
                <button
                  onClick={() => {
                    setShowApiKeyInput(false)
                    setApiKeyDraft(apiKey)
                  }}
                  className="h-9 px-3 rounded-md border hover:bg-accent"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    onApiKeyChange(apiKeyDraft)
                    setShowApiKeyInput(false)
                  }}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  保存
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
