import https from 'https'
import http from 'http'
import { downloadFile, saveFile, getDataPath } from './file'
import { createGeneration, updateGeneration } from './database'

const API_BASE_URL = 'https://api.tu-zi.com/v1'

interface RequestOptions {
  method: string
  headers: Record<string, string>
  body?: string
}

async function makeRequest(url: string, options: RequestOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
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

// 图片生成
export async function generateImage(params: {
  apiKey: string
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
  numImages?: number
  referenceImage?: ArrayBuffer
}): Promise<{
  id: string
  status: string
  images: string[]
}> {
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
    model: 'nano-banana-2-2k-vip',
    aspectRatio: params.aspectRatio,
  })
  
  try {
    // 调用 API
    const payload = {
      model: 'nano-banana-2-2k-vip',
      prompt: params.prompt,
      n: Math.min(params.numImages || 1, 10),
      size: size,
      response_format: 'url',
    }
    
    const result = await makeRequest(`${API_BASE_URL}/images/generations`, {
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
  imageData?: ArrayBuffer
}): Promise<{
  id: string
  taskId: string
  status: string
}> {
  // 创建数据库记录
  const generationId = createGeneration({
    type: 'video',
    prompt: params.prompt,
    systemContext: params.systemContext,
    storyboard: params.storyboard,
    negativePrompt: params.negativePrompt,
    model: 'veo-2',
    aspectRatio: params.aspectRatio,
    duration: params.duration,
  })
  
  try {
    // 构建请求
    const payload: any = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio || '16:9',
      duration: params.duration || 5,
    }
    
    if (params.systemContext) {
      payload.system_context = params.systemContext
    }
    if (params.storyboard) {
      payload.storyboard = params.storyboard
    }
    if (params.negativePrompt) {
      payload.negative_prompt = params.negativePrompt
    }
    
    // 如果有图片，转换为 base64
    if (params.imageData) {
      const buffer = Buffer.from(params.imageData)
      payload.image = buffer.toString('base64')
    }
    
    const result = await makeRequest(`${API_BASE_URL}/videos/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    const taskId = result.id || result.task_id
    
    // 更新数据库
    updateGeneration(generationId, {
      status: 'processing',
      taskId: taskId,
      apiResponse: result,
    })
    
    return {
      id: generationId,
      taskId: taskId,
      status: 'processing',
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
    const result = await makeRequest(`${API_BASE_URL}/videos/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })
    
    const status = result.status || 'unknown'
    const progress = result.progress || 0
    
    if (status === 'completed' && result.video_url) {
      // 下载视频
      const filename = `veo_${taskId}_${Date.now()}.mp4`
      const localPath = await downloadFile(result.video_url, filename, 'videos')
      
      return {
        status: 'completed',
        progress: 100,
        videoUrl: result.video_url,
        localPath: localPath,
      }
    }
    
    if (status === 'failed') {
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
