import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'veo-studio.db')
  db = new Database(dbPath)
  
  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      system_context TEXT,
      storyboard TEXT,
      negative_prompt TEXT,
      model TEXT,
      aspect_ratio TEXT,
      duration INTEGER,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      task_id TEXT,
      result_path TEXT,
      result_url TEXT,
      thumbnail_path TEXT,
      api_response TEXT,
      error_message TEXT,
      tags TEXT DEFAULT '[]',
      is_favorite INTEGER DEFAULT 0,
      reference_images TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      system_context TEXT,
      storyboard TEXT,
      negative_prompt TEXT,
      is_favorite INTEGER DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
  `)
  
  console.log('Database initialized at:', dbPath)
  return db
}

// Generation 操作
export function createGeneration(data: {
  type: string
  prompt: string
  systemContext?: string
  storyboard?: string
  negativePrompt?: string
  model?: string
  aspectRatio?: string
  duration?: number
  referenceImages?: string[]
}) {
  const db = getDatabase()
  const id = uuidv4()
  
  const stmt = db.prepare(`
    INSERT INTO generations (id, type, prompt, system_context, storyboard, negative_prompt, model, aspect_ratio, duration, reference_images, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing')
  `)
  
  stmt.run(
    id,
    data.type,
    data.prompt,
    data.systemContext || null,
    data.storyboard || null,
    data.negativePrompt || null,
    data.model || null,
    data.aspectRatio || null,
    data.duration || null,
    JSON.stringify(data.referenceImages || [])
  )
  
  return id
}

export function updateGeneration(id: string, data: {
  status?: string
  progress?: number
  taskId?: string
  resultPath?: string
  resultUrl?: string
  thumbnailPath?: string
  apiResponse?: any
  errorMessage?: string
}) {
  const db = getDatabase()
  const updates: string[] = []
  const values: any[] = []
  
  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }
  if (data.progress !== undefined) {
    updates.push('progress = ?')
    values.push(data.progress)
  }
  if (data.taskId !== undefined) {
    updates.push('task_id = ?')
    values.push(data.taskId)
  }
  if (data.resultPath !== undefined) {
    updates.push('result_path = ?')
    values.push(data.resultPath)
  }
  if (data.resultUrl !== undefined) {
    updates.push('result_url = ?')
    values.push(data.resultUrl)
  }
  if (data.thumbnailPath !== undefined) {
    updates.push('thumbnail_path = ?')
    values.push(data.thumbnailPath)
  }
  if (data.apiResponse !== undefined) {
    updates.push('api_response = ?')
    values.push(JSON.stringify(data.apiResponse))
  }
  if (data.errorMessage !== undefined) {
    updates.push('error_message = ?')
    values.push(data.errorMessage)
  }
  
  updates.push("updated_at = datetime('now')")
  values.push(id)
  
  const stmt = db.prepare(`UPDATE generations SET ${updates.join(', ')} WHERE id = ?`)
  stmt.run(...values)
}

export function getGeneration(id: string) {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM generations WHERE id = ?').get(id) as any
  if (row) {
    return parseGenerationRow(row)
  }
  return null
}

export function listGenerations(filters: {
  type?: string
  status?: string
  isFavorite?: boolean
  search?: string
  page?: number
  pageSize?: number
}) {
  const db = getDatabase()
  const conditions: string[] = []
  const values: any[] = []
  
  if (filters.type) {
    conditions.push('type = ?')
    values.push(filters.type)
  }
  if (filters.status) {
    conditions.push('status = ?')
    values.push(filters.status)
  }
  if (filters.isFavorite !== undefined) {
    conditions.push('is_favorite = ?')
    values.push(filters.isFavorite ? 1 : 0)
  }
  if (filters.search) {
    conditions.push('prompt LIKE ?')
    values.push(`%${filters.search}%`)
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM generations ${whereClause}`).get(...values) as any
  const total = countRow.total
  
  const page = filters.page || 1
  const pageSize = filters.pageSize || 20
  const offset = (page - 1) * pageSize
  
  const rows = db.prepare(`
    SELECT * FROM generations ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...values, pageSize, offset) as any[]
  
  return {
    items: rows.map(parseGenerationRow),
    total,
    page,
    pageSize
  }
}

export function deleteGeneration(id: string) {
  const db = getDatabase()
  db.prepare('DELETE FROM generations WHERE id = ?').run(id)
}

export function toggleGenerationFavorite(id: string) {
  const db = getDatabase()
  const row = db.prepare('SELECT is_favorite FROM generations WHERE id = ?').get(id) as any
  if (row) {
    const newValue = row.is_favorite ? 0 : 1
    db.prepare('UPDATE generations SET is_favorite = ? WHERE id = ?').run(newValue, id)
    return newValue === 1
  }
  return false
}

export function updateGenerationTags(id: string, tags: string[]) {
  const db = getDatabase()
  db.prepare('UPDATE generations SET tags = ? WHERE id = ?').run(JSON.stringify(tags), id)
}

export function getStats() {
  const db = getDatabase()
  const stats = {
    total_videos: (db.prepare("SELECT COUNT(*) as c FROM generations WHERE type = 'video'").get() as any).c,
    total_images: (db.prepare("SELECT COUNT(*) as c FROM generations WHERE type = 'image'").get() as any).c,
    completed: (db.prepare("SELECT COUNT(*) as c FROM generations WHERE status = 'completed'").get() as any).c,
    favorites: (db.prepare("SELECT COUNT(*) as c FROM generations WHERE is_favorite = 1").get() as any).c,
  }
  return stats
}

function parseGenerationRow(row: any) {
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    system_context: row.system_context,
    storyboard: row.storyboard,
    negative_prompt: row.negative_prompt,
    model: row.model,
    aspect_ratio: row.aspect_ratio,
    duration: row.duration,
    status: row.status,
    progress: row.progress,
    task_id: row.task_id,
    result_path: row.result_path,
    result_url: row.result_url,
    thumbnail_path: row.thumbnail_path,
    api_response: row.api_response ? JSON.parse(row.api_response) : null,
    error_message: row.error_message,
    tags: row.tags ? JSON.parse(row.tags) : [],
    is_favorite: row.is_favorite === 1,
    reference_images: row.reference_images ? JSON.parse(row.reference_images) : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// Template 操作
export function listTemplates() {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM templates ORDER BY use_count DESC, created_at DESC').all() as any[]
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    system_context: row.system_context,
    storyboard: row.storyboard,
    negative_prompt: row.negative_prompt,
    is_favorite: row.is_favorite === 1,
    use_count: row.use_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))
}

export function getTemplate(id: number) {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any
  if (row) {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      system_context: row.system_context,
      storyboard: row.storyboard,
      negative_prompt: row.negative_prompt,
      is_favorite: row.is_favorite === 1,
      use_count: row.use_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }
  return null
}

export function createTemplate(data: {
  name: string
  category?: string
  systemContext?: string
  storyboard?: string
  negativePrompt?: string
}) {
  const db = getDatabase()
  const result = db.prepare(`
    INSERT INTO templates (name, category, system_context, storyboard, negative_prompt)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.name, data.category || null, data.systemContext || null, data.storyboard || null, data.negativePrompt || null)
  return result.lastInsertRowid
}

export function updateTemplate(id: number, data: {
  name?: string
  category?: string
  systemContext?: string
  storyboard?: string
  negativePrompt?: string
}) {
  const db = getDatabase()
  const updates: string[] = []
  const values: any[] = []
  
  if (data.name !== undefined) {
    updates.push('name = ?')
    values.push(data.name)
  }
  if (data.category !== undefined) {
    updates.push('category = ?')
    values.push(data.category)
  }
  if (data.systemContext !== undefined) {
    updates.push('system_context = ?')
    values.push(data.systemContext)
  }
  if (data.storyboard !== undefined) {
    updates.push('storyboard = ?')
    values.push(data.storyboard)
  }
  if (data.negativePrompt !== undefined) {
    updates.push('negative_prompt = ?')
    values.push(data.negativePrompt)
  }
  
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    values.push(id)
    db.prepare(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }
}

export function deleteTemplate(id: number) {
  const db = getDatabase()
  db.prepare('DELETE FROM templates WHERE id = ?').run(id)
}

export function toggleTemplateFavorite(id: number) {
  const db = getDatabase()
  const row = db.prepare('SELECT is_favorite FROM templates WHERE id = ?').get(id) as any
  if (row) {
    const newValue = row.is_favorite ? 0 : 1
    db.prepare('UPDATE templates SET is_favorite = ? WHERE id = ?').run(newValue, id)
    return newValue === 1
  }
  return false
}

export function incrementTemplateUseCount(id: number) {
  const db = getDatabase()
  db.prepare('UPDATE templates SET use_count = use_count + 1 WHERE id = ?').run(id)
}
