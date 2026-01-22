import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import VideoGenerator from './pages/VideoGenerator'
import ImageGenerator from './pages/ImageGenerator'
import Tasks from './pages/Tasks'
import History from './pages/History'
import Favorites from './pages/Favorites'
import Templates from './pages/Templates'
import Settings from './pages/Settings'
import Guide from './pages/Guide'
import { Toaster } from './components/ui/toaster'

function App() {
  const [apiKey, setApiKey] = useState<string>('')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // 从 Electron store 加载 API Key
    window.electronAPI?.getSettings().then((settings) => {
      if (settings.apiKey) {
        setApiKey(settings.apiKey)
      }
      setIsReady(true)
    }).catch(() => {
      setIsReady(true)
    })
  }, [])

  useEffect(() => {
    if (!isReady) return
    try {
      window.electronAPI?.appReady?.()
    } catch {
    }
  }, [isReady])

  const handleApiKeyChange = (key: string) => {
    setApiKey(key)
    window.electronAPI?.saveSettings({ apiKey: key })
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <Layout apiKey={apiKey} onApiKeyChange={handleApiKeyChange}>
      <Routes>
        <Route path="/" element={<VideoGenerator apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />} />
        <Route path="/image" element={<ImageGenerator apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />} />
        <Route path="/tasks" element={<Tasks apiKey={apiKey} />} />
        <Route path="/history" element={<History apiKey={apiKey} />} />
        <Route path="/favorites" element={<Favorites apiKey={apiKey} />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/guide" element={<Guide />} />
      </Routes>
      <Toaster />
    </Layout>
  )
}

export default App
