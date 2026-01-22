import Database from 'better-sqlite3'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { getDataBasePath } from './file'

let db: Database.Database | null = null
let currentDbPath: string | null = null

export const generationEvents = new EventEmitter()

export function closeDatabase() {
  if (db) {
    try {
      db.close()
    } catch {
      // ignore
    }
    db = null
  }
}

export function rewriteGenerationPaths(oldBase: string, newBase: string) {
  if (!oldBase || !newBase) return
  if (oldBase === newBase) return

  const db = getDatabase()

  // normalize to Windows-style (stored paths are typically like C:\...)
  const oldWin = oldBase.replace(/\//g, '\\').replace(/\\+$/g, '')
  const newWin = newBase.replace(/\//g, '\\').replace(/\\+$/g, '')

  db.prepare(
    `UPDATE generations
     SET result_path = REPLACE(result_path, ?, ?)
     WHERE result_path IS NOT NULL AND result_path LIKE ?`
  ).run(oldWin, newWin, `${oldWin}%`)

  db.prepare(
    `UPDATE generations
     SET thumbnail_path = REPLACE(thumbnail_path, ?, ?)
     WHERE thumbnail_path IS NOT NULL AND thumbnail_path LIKE ?`
  ).run(oldWin, newWin, `${oldWin}%`)
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function initDatabase() {
  const dbPath = path.join(getDataBasePath(), 'veo-studio.db')
  const legacyDbPath = path.join(app.getPath('userData'), 'veo-studio.db')

  try {
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true })

      if (currentDbPath && currentDbPath !== dbPath && fs.existsSync(currentDbPath)) {
        fs.copyFileSync(currentDbPath, dbPath)
      } else if (legacyDbPath !== dbPath && fs.existsSync(legacyDbPath)) {
        fs.copyFileSync(legacyDbPath, dbPath)
      }
    }
  } catch {
    // ignore migration failures; we'll create a new db
  }

  closeDatabase()

  db = new Database(dbPath)
  currentDbPath = dbPath
  
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
      source TEXT DEFAULT 'user',
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

  ensureTemplatesSchema()
  importBuiltinTemplatesFromJson()
  
  console.log('Database initialized at:', dbPath)
  return db
}

export function syncBuiltinTemplates() {
  ensureTemplatesSchema()
  importBuiltinTemplatesFromJson()
  return { success: true }
}

function ensureTemplatesSchema() {
  const db = getDatabase()
  const cols = db.prepare("PRAGMA table_info(templates)").all() as any[]
  const hasSource = cols.some((c) => c.name === 'source')
  if (!hasSource) {
    db.exec("ALTER TABLE templates ADD COLUMN source TEXT DEFAULT 'user'")
  }
}

function resolveBuiltinTemplatesFilePath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'templates.json'),
    path.join(process.cwd(), 'template.json'),
    path.join(app.getAppPath(), 'templates.json'),
    path.join(app.getAppPath(), 'template.json'),
    path.join(process.resourcesPath || '', 'templates.json'),
    path.join(process.resourcesPath || '', 'template.json'),
  ]

  for (const p of candidates) {
    if (!p) continue
    try {
      if (fs.existsSync(p)) return p
    } catch {
      // ignore
    }
  }
  return null
}

function importBuiltinTemplatesFromJson() {
  const db = getDatabase()
  const jsonPath = resolveBuiltinTemplatesFilePath()
  if (!jsonPath) return

  let raw = ''
  try {
    raw = fs.readFileSync(jsonPath, 'utf-8')
  } catch {
    return
  }

  let items: any[] = []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) items = parsed
  } catch {
    return
  }

  const selectStmt = db.prepare("SELECT id FROM templates WHERE source = 'builtin' AND name = ?")
  const insertStmt = db.prepare(
    `INSERT INTO templates (name, category, system_context, storyboard, negative_prompt, source)
     VALUES (?, ?, ?, ?, ?, 'builtin')`
  )
  const updateStmt = db.prepare(
    `UPDATE templates
     SET category = ?, system_context = ?, storyboard = ?, negative_prompt = ?, updated_at = datetime('now')
     WHERE id = ?`
  )

  const tx = db.transaction((arr: any[]) => {
    for (const t of arr) {
      if (!t || typeof t.name !== 'string') continue
      const name = t.name.trim()
      if (!name) continue

      const category = typeof t.category === 'string' ? t.category : null
      const systemContext = typeof t.system_context === 'string' ? t.system_context : null
      const storyboard = typeof t.storyboard === 'string' ? t.storyboard : null
      const negativePrompt = typeof t.negative_prompt === 'string' ? t.negative_prompt : null

      const row = selectStmt.get(name) as any
      if (!row) {
        insertStmt.run(name, category, systemContext, storyboard, negativePrompt)
      } else {
        updateStmt.run(category, systemContext, storyboard, negativePrompt, row.id)
      }
    }
  })

  try {
    tx(items)
  } catch {
    // ignore
  }
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
  const prev = db.prepare('SELECT status, type, prompt FROM generations WHERE id = ?').get(id) as any
  const prevStatus = prev?.status
  const prevType = prev?.type
  const prevPrompt = prev?.prompt
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

  if (data.status === 'completed' && prevStatus !== 'completed') {
    generationEvents.emit('completed', {
      id,
      type: prevType,
      prompt: prevPrompt,
    })
  }
}

export function updateGenerationByTaskId(taskId: string, data: {
  status?: string
  progress?: number
  resultPath?: string
  resultUrl?: string
  thumbnailPath?: string
  apiResponse?: any
  errorMessage?: string
}) {
  const db = getDatabase()
  const row = db
    .prepare('SELECT id FROM generations WHERE task_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(taskId) as any
  if (!row?.id) return false
  updateGeneration(row.id, data)
  return true
}

export function getGenerationByTaskId(taskId: string) {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM generations WHERE task_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(taskId) as any
  if (row) {
    return parseGenerationRow(row)
  }
  return null
}

export function listActiveGenerations(limit: number = 200) {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT * FROM generations
       WHERE status <> 'completed'
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as any[]
  return rows.map(parseGenerationRow)
}

export function listTaskGenerations(limit: number = 500) {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT * FROM generations
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as any[]
  return rows.map(parseGenerationRow)
}

export function listPendingVideoTaskIds(limit: number = 200): string[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT task_id FROM generations
       WHERE type = 'video'
         AND task_id IS NOT NULL
         AND task_id <> ''
         AND status <> 'completed'
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as any[]
  const ids = rows.map(r => String(r.task_id || '')).filter(Boolean)
  return Array.from(new Set(ids))
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
  startAt?: string
  endAt?: string
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

  if (filters.startAt) {
    conditions.push("datetime(created_at) >= datetime(?)")
    values.push(filters.startAt)
  }
  if (filters.endAt) {
    conditions.push("datetime(created_at) <= datetime(?)")
    values.push(filters.endAt)
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
  const rows = db
    .prepare(
      "SELECT * FROM templates ORDER BY CASE WHEN source = 'builtin' THEN 0 ELSE 1 END, use_count DESC, created_at DESC"
    )
    .all() as any[]
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    system_context: row.system_context,
    storyboard: row.storyboard,
    negative_prompt: row.negative_prompt,
    source: row.source || 'user',
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
      source: row.source || 'user',
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
  system_context?: string
  storyboard?: string
  negativePrompt?: string
  negative_prompt?: string
  source?: string
}) {
  const db = getDatabase()
  const source = data.source === 'builtin' ? 'builtin' : 'user'

  const systemContext = data.systemContext ?? data.system_context
  const negativePrompt = data.negativePrompt ?? data.negative_prompt
  const result = db.prepare(`
    INSERT INTO templates (name, category, system_context, storyboard, negative_prompt, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.category || null,
    systemContext || null,
    data.storyboard || null,
    negativePrompt || null,
    source
  )
  return result.lastInsertRowid
}

export function updateTemplate(id: number, data: {
  name?: string
  category?: string
  systemContext?: string
  system_context?: string
  storyboard?: string
  negativePrompt?: string
  negative_prompt?: string
}) {
  const db = getDatabase()
  const row = db.prepare('SELECT source FROM templates WHERE id = ?').get(id) as any
  if (row && row.source === 'builtin') {
    throw new Error('Builtin templates cannot be updated')
  }
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
  if (data.system_context !== undefined) {
    updates.push('system_context = ?')
    values.push(data.system_context)
  }
  if (data.storyboard !== undefined) {
    updates.push('storyboard = ?')
    values.push(data.storyboard)
  }
  if (data.negativePrompt !== undefined) {
    updates.push('negative_prompt = ?')
    values.push(data.negativePrompt)
  }
  if (data.negative_prompt !== undefined) {
    updates.push('negative_prompt = ?')
    values.push(data.negative_prompt)
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
