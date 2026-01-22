import https from 'https'
import http from 'http'
import fs from 'fs'
import { downloadFile, saveFile, getDataPath } from './file'
import { createGeneration, updateGeneration, updateGenerationByTaskId, getGenerationByTaskId, listPendingVideoTaskIds } from './database'

const DEFAULT_API_BASE_URL = 'https://api.tu-zi.com/v1'

function getApiBaseUrl(): string {
  const raw = (process.env.VEO_API_BASE_URL || DEFAULT_API_BASE_URL).trim()
  if (!raw) return DEFAULT_API_BASE_URL

  let base = raw
  if (!/^https?:\/\//i.test(base)) {
    // If someone accidentally set '/v1' or similar, fall back to default.
    if (base.startsWith('/')) {
      base = DEFAULT_API_BASE_URL
    } else {
      base = `https://${base}`
    }
  }

  return base.replace(/\/+$/g, '')
}

const API_BASE_URL = getApiBaseUrl()

const activeVideoPollers = new Map<string, NodeJS.Timeout>()
const activeVideoDownloads = new Map<string, Promise<string>>()

function sanitizeWindowsFilename(input: string) {
  const s = String(input || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F#]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()

  // Windows disallows trailing dots/spaces
  return s.replace(/[.\s]+$/g, '')
}

function formatTimestampForFilename(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${y}${m}${d}_${hh}${mm}${ss}`
}

function getVideoFilename(taskId: string) {
  try {
    const g = getGenerationByTaskId(taskId)
    const raw = String(g?.prompt || g?.storyboard || g?.system_context || '').trim()
    const prefixRaw = raw || String(taskId || 'video')
    const prefix = sanitizeWindowsFilename(prefixRaw).slice(0, 18) || 'video'
    const ts = formatTimestampForFilename()
    const base = `${prefix}_${ts}`
    return `${base.slice(0, 60)}.mp4`
  } catch {
    const prefix = sanitizeWindowsFilename(String(taskId || 'video')).slice(0, 18) || 'video'
    const ts = formatTimestampForFilename()
    const base = `${prefix}_${ts}`
    return `${base.slice(0, 60)}.mp4`
  }
}

function ensureBackgroundVideoPolling(taskId: string, apiKey: string) {
  if (!taskId) return
  if (activeVideoPollers.has(taskId)) return

  const timer = setInterval(async () => {
    try {
      const s = await pollVideoStatus(taskId, apiKey)
      if (s.status === 'completed' || s.status === 'failed') {
        const t = activeVideoPollers.get(taskId)
        if (t) clearInterval(t)
        activeVideoPollers.delete(taskId)
      }
    } catch {
      // ignore transient errors
    }
  }, 5000)

  activeVideoPollers.set(taskId, timer)
}

export function resumePendingVideoTasks(apiKey: string) {
  if (!apiKey) return
  const taskIds = listPendingVideoTaskIds(500)
  for (const id of taskIds) {
    ensureBackgroundVideoPolling(id, apiKey)
  }
}

function resolveApiUrl(pathOrUrl: string): string {
  const input = (pathOrUrl || '').trim()
  if (!input) {
    throw new Error('Empty request URL')
  }

  if (/^https?:\/\//i.test(input)) {
    return input
  }

  // Allow callers to pass '/v1/xxx' even if base already includes '/v1'
  let p = input.startsWith('/') ? input : `/${input}`
  if (p.startsWith('/v1/') && API_BASE_URL.endsWith('/v1')) {
    p = p.slice(3)
  }

  return `${API_BASE_URL}${p}`
}

function isServerInvalidUrlError(error: any): boolean {
  const msg = String(error?.message || '')
  return /Invalid URL/i.test(msg)
}

async function makeRequestWithFallback(urls: string[], options: RequestOptions): Promise<any> {
  let lastError: any
  for (const u of urls) {
    try {
      return await makeRequest(u, options)
    } catch (e: any) {
      lastError = e
      // If server says the endpoint is invalid, try next candidate.
      if (!isServerInvalidUrlError(e)) {
        throw e
      }
    }
  }
  throw lastError
}

interface RequestOptions {
  method: string
  headers: Record<string, string>
  body?: string | Buffer
}

async function makeRequest(url: string, options: RequestOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    let urlObj: URL
    try {
      urlObj = new URL(resolveApiUrl(url))
    } catch (e: any) {
      reject(
        new Error(
          `Invalid URL (base: ${API_BASE_URL}) (${options.method} ${url}): ${e?.message || String(e)}`
        )
      )
      return
    }
    const protocol = urlObj.protocol === 'https:' ? https : http
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: options.headers,
    }
    
    const req = protocol.request(reqOptions, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}`))
          } else {
            resolve(json)
          }
        } catch (e) {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          } else {
            resolve(data)
          }
        }
      })
    })
    
    req.on('error', reject)
    
    if (options.body) {
      req.write(options.body)
    }
    
    req.end()
  })
}

function buildMultipartFormData(params: {
  fields: Record<string, string>
  files?: Array<{ name: string; filename: string; contentType?: string; data: Buffer }>
}): { body: Buffer; contentType: string } {
  const boundary = `----veo-studio-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const chunks: Buffer[] = []

  const push = (s: string) => chunks.push(Buffer.from(s, 'utf8'))

  for (const [k, v] of Object.entries(params.fields)) {
    push(`--${boundary}\r\n`)
    push(`Content-Disposition: form-data; name="${k}"\r\n\r\n`)
    push(`${v}\r\n`)
  }

  for (const f of params.files || []) {
    push(`--${boundary}\r\n`)
    push(
      `Content-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\n`
    )
    push(`Content-Type: ${f.contentType || 'application/octet-stream'}\r\n\r\n`)
    chunks.push(f.data)
    push(`\r\n`)
  }

  push(`--${boundary}--\r\n`)
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

// 图片生成
export async function generateImage(params: {
  apiKey: string
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
  numImages?: number
  model?: string
  referenceImage?: ArrayBuffer
}): Promise<{
  id: string
  status: string
  images: string[]
}> {
  const allowedModels = new Set<string>([
    'nano-banana-2',
    'nano-banana-2-2k-vip',
    'gemini-3-pro-image-preview',
    'gemini-3-pro-image-preview-2k-vip',
    'gpt-image-1.5',
  ])
  const defaultModel = 'gemini-3-pro-image-preview'
  const selectedModel = allowedModels.has(String(params.model || '')) ? String(params.model) : defaultModel

  // 映射宽高比到尺寸
  const sizeMap: Record<string, string> = {
    '1:1': '1024x1024',
    '16:9': '1792x1024',
    '9:16': '1024x1792',
    '4:3': '1024x1024',
    '3:4': '1024x1024',
  }
  const size = sizeMap[params.aspectRatio || '1:1'] || '1024x1024'
  
  // 创建数据库记录
  const generationId = createGeneration({
    type: 'image',
    prompt: params.prompt,
    negativePrompt: params.negativePrompt,
    model: selectedModel,
    aspectRatio: params.aspectRatio,
  })
  
  try {
    // 调用 API
    const payload = {
      model: selectedModel,
      prompt: params.prompt,
      n: Math.min(params.numImages || 1, 10),
      size: size,
      response_format: 'url',
    }
    
    const result = await makeRequest('/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    console.log('API Response:', JSON.stringify(result, null, 2))
    
    // 处理图片
    const imagePaths: string[] = []
    const dataList = result.data || []
    
    for (let i = 0; i < dataList.length; i++) {
      const imageData = dataList[i]
      console.log(`Processing image ${i}, keys:`, Object.keys(imageData))
      
      // 尝试多种可能的字段名
      const imageUrl = imageData.url || imageData.image_url || imageData.image
      const base64Data = imageData.b64_json || imageData.base64 || imageData.image_base64
      
      if (imageUrl) {
        try {
          const filename = `imagen_${generationId}_${i}_${Date.now()}.png`
          const localPath = await downloadFile(imageUrl, filename, 'images')
          imagePaths.push(localPath)
          console.log(`Image ${i} saved from URL to:`, localPath)
        } catch (e) {
          console.error(`Failed to download image ${i}:`, e)
        }
      } else if (base64Data) {
        try {
          const buffer = Buffer.from(base64Data, 'base64')
          const filename = `imagen_${generationId}_${i}_${Date.now()}.png`
          const localPath = saveFile(buffer, filename, 'images')
          imagePaths.push(localPath)
          console.log(`Image ${i} saved from base64 to:`, localPath)
        } catch (e) {
          console.error(`Failed to save image ${i} from base64:`, e)
        }
      } else {
        console.warn(`Image ${i} has no valid url or base64 data. Available fields:`, imageData)
      }
    }
    
    // 更新数据库
    updateGeneration(generationId, {
      status: 'completed',
      resultPath: imagePaths[0] || undefined,
      apiResponse: { image_paths: imagePaths, count: imagePaths.length, raw: result },
    })
    
    return {
      id: generationId,
      status: 'completed',
      images: imagePaths,
    }
  } catch (error: any) {
    updateGeneration(generationId, {
      status: 'failed',
      errorMessage: error.message,
    })
    throw error
  }
}

// 视频生成
export async function generateVideo(params: {
  apiKey: string
  prompt: string
  systemContext?: string
  storyboard?: string
  negativePrompt?: string
  aspectRatio?: string
  duration?: number
  model?: string
  imageData?: ArrayBuffer
}): Promise<{
  id: string
  taskId: string
  status: string
}> {
  const model = String(params.model || 'veo3.1')
  // 创建数据库记录
  const generationId = createGeneration({
    type: 'video',
    prompt: params.prompt,
    systemContext: params.systemContext,
    storyboard: params.storyboard,
    negativePrompt: params.negativePrompt,
    model,
    aspectRatio: params.aspectRatio,
    duration: params.duration,
  })
  
  try {
    const size = (params.aspectRatio || '16:9') === '9:16' ? '720x1280' : '1280x720'
    const seconds = '8'

    // 统一把 systemContext/storyboard/negativePrompt 合并进 prompt（后端接口只接受 prompt）
    const combinedPrompt = [
      params.systemContext ? `System Context:\n${params.systemContext}` : '',
      params.storyboard ? `Storyboard:\n${params.storyboard}` : '',
      params.negativePrompt ? `Negative Prompt:\n${params.negativePrompt}` : '',
      params.prompt ? `Prompt:\n${params.prompt}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const files: Array<{ name: string; filename: string; contentType?: string; data: Buffer }> = []
    if (params.imageData) {
      files.push({
        name: 'input_reference',
        filename: 'input_reference.png',
        contentType: 'image/png',
        data: Buffer.from(params.imageData),
      })
    }

    const form = buildMultipartFormData({
      fields: {
        model,
        prompt: combinedPrompt,
        seconds,
        size,
        watermark: 'false',
      },
      files,
    })

    const result = await makeRequestWithFallback(['/videos', '/video'], {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.apiKey}`,
        'Content-Type': form.contentType,
        'Content-Length': String(form.body.length),
      },
      body: form.body,
    })
    
    const taskId = result.id || result.task_id
    
    // 更新数据库
    updateGeneration(generationId, {
      status: result.status || 'processing',
      progress: typeof result.progress === 'number' ? result.progress : 0,
      taskId: taskId,
      apiResponse: result,
    })

    // Start background polling so switching pages won't stop persistence.
    ensureBackgroundVideoPolling(taskId, params.apiKey)
    
    return {
      id: generationId,
      taskId: taskId,
      status: result.status || 'processing',
    }
  } catch (error: any) {
    updateGeneration(generationId, {
      status: 'failed',
      errorMessage: error.message,
    })
    throw error
  }
}

// 轮询视频状态
export async function pollVideoStatus(taskId: string, apiKey: string): Promise<{
  status: string
  progress?: number
  videoUrl?: string
  localPath?: string
  error?: string
}> {
  try {
    // If already completed and persisted, return from DB to avoid duplicate downloads.
    const existing = getGenerationByTaskId(taskId)
    if (existing?.status === 'completed' && existing.result_path) {
      try {
        const st = fs.statSync(existing.result_path)
        if (st.isFile() && st.size > 0) {
          return {
            status: 'completed',
            progress: 100,
            videoUrl: existing.result_url || undefined,
            localPath: existing.result_path,
          }
        }
      } catch {
        // fall through to re-download
      }
    }

    const result = await makeRequestWithFallback([`/videos/${taskId}`, `/video/${taskId}`], {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })
    
    const videoUrl = result.video_url || result.url || result.output_url

    const rawStatus = String(result.status || 'unknown')
    let status = /^(completed|succeeded|success|done)$/i.test(rawStatus)
      ? 'completed'
      : /^(failed|error|canceled|cancelled)$/i.test(rawStatus)
        ? 'failed'
        : rawStatus
    const progress = result.progress || 0

    if (videoUrl && status !== 'failed') {
      if (status !== 'completed' && Number(progress) >= 100) {
        status = 'completed'
      }
    }

    updateGenerationByTaskId(taskId, {
      status,
      progress,
      apiResponse: result,
    })
    
    if (status === 'completed' && videoUrl) {
      try {
        // 下载互斥：同一个 taskId 并发轮询只允许下载一次
        let p = activeVideoDownloads.get(taskId)
        if (!p) {
          p = (async () => {
            const existed2 = getGenerationByTaskId(taskId)
            if (existed2?.status === 'completed' && existed2.result_path) {
              try {
                const st = fs.statSync(existed2.result_path)
                if (st.isFile() && st.size > 0) {
                  return existed2.result_path
                }
              } catch {
                // continue
              }
            }

            const filename = getVideoFilename(taskId)
            const lp = await downloadFile(videoUrl, filename, 'videos')
            return lp
          })().finally(() => {
            activeVideoDownloads.delete(taskId)
          })
          activeVideoDownloads.set(taskId, p)
        }

        const localPath = await p

        console.log('[video] downloaded:', { taskId, videoUrl, localPath })

        updateGenerationByTaskId(taskId, {
          status: 'completed',
          progress: 100,
          resultUrl: videoUrl,
          resultPath: localPath,
          apiResponse: result,
        })
        
        return {
          status: 'completed',
          progress: 100,
          videoUrl,
          localPath: localPath,
        }
      } catch (e: any) {
        const msg = e?.message || String(e)
        console.error('[video] download failed:', { taskId, videoUrl, error: msg })

        updateGenerationByTaskId(taskId, {
          status: 'failed',
          errorMessage: `Download failed: ${msg}`,
          apiResponse: result,
        })

        return {
          status: 'failed',
          error: `下载失败: ${msg}`,
          progress,
          videoUrl,
        }
      }
    }
    
    if (status === 'failed') {
      updateGenerationByTaskId(taskId, {
        status: 'failed',
        errorMessage: result.error || '视频生成失败',
        apiResponse: result,
      })
      return {
        status: 'failed',
        error: result.error || '视频生成失败',
      }
    }
    
    return {
      status: status,
      progress: progress,
    }
  } catch (error: any) {
    return {
      status: 'error',
      error: error.message,
    }
  }
}
