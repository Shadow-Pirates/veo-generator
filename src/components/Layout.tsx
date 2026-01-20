import { ReactNode, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Video, 
  Image, 
  History, 
  FileText, 
  Menu,
  X,
  Key,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface LayoutProps {
  children: ReactNode
  apiKey: string
  onApiKeyChange: (key: string) => void
}

const navItems = [
  { path: '/', label: '视频生成', icon: Video },
  { path: '/image', label: '图片生成', icon: Image },
  { path: '/history', label: '历史记录', icon: History },
  { path: '/templates', label: '模板管理', icon: FileText },
  { path: '/settings', label: '设置', icon: Settings },
]

export default function Layout({ children, apiKey, onApiKeyChange }: LayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [stats, setStats] = useState({ total_videos: 0, total_images: 0, completed: 0, favorites: 0 })

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await api.getStats()
        setStats(data)
      } catch (error) {
        console.error('Failed to load stats', error)
      }
    }
    loadStats()
    const interval = setInterval(loadStats, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-4 p-2 hover:bg-accent rounded-md lg:hidden"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className="flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Veo Studio</span>
          </div>

          <div className="flex-1" />

          {/* API Key Section */}
          <div className="flex items-center gap-2">
            {showApiKeyInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder="输入 API Key..."
                  className="h-8 w-64 px-3 text-sm border rounded-md bg-background"
                />
                <button
                  onClick={() => setShowApiKeyInput(false)}
                  className="p-1.5 hover:bg-accent rounded-md"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowApiKeyInput(true)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md",
                  apiKey ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                )}
              >
                <Key size={14} />
                {apiKey ? "API Key 已设置" : "设置 API Key"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 border-r bg-background transition-transform lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Stats */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-2">本地存储统计</p>
              <div className="flex justify-between text-sm mb-1">
                <span>视频</span>
                <span className="font-medium">{stats.total_videos}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>图片</span>
                <span className="font-medium">{stats.total_images}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>已完成</span>
                <span className="font-medium text-green-600">{stats.completed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>收藏</span>
                <span className="font-medium text-yellow-600">{stats.favorites}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={cn(
            "flex-1 transition-all",
            sidebarOpen ? "lg:ml-64" : ""
          )}
        >
          <div className="container py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
