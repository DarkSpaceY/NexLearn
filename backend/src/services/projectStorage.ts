import { db } from './db'

// 项目持久化记录结构（仅在后端使用，全部为可 JSON 序列化类型）
export interface PersistedProjectMetadata {
  createdAt: string
  updatedAt: string
  lastOpenedAt?: string
}

export interface PersistedProjectRecord {
  id: string
  userId: string
  name: string
  // nodes / edges 在后端不做结构校验，按原样存储和返回
  nodes: any[]
  edges: any[]
  settings: {
    theme: string
    defaultLanguage: string
    autoSave: boolean
    showGrid: boolean
    snapToGrid: boolean
    [key: string]: any
  }
  metadata: PersistedProjectMetadata
  [key: string]: any
}

export const projectStore = {
  // 获取用户全部项目
  getByUser(userId: string): PersistedProjectRecord[] {
    const rows = db
      .prepare('SELECT data FROM projects WHERE user_id = ?')
      .all(userId)
    const parsed = rows.map((row: any) => {
      try {
        return JSON.parse(row.data) as PersistedProjectRecord
      } catch {
        return null
      }
    })
    return parsed.filter((p: PersistedProjectRecord | null): p is PersistedProjectRecord => !!p)
  },

  // 获取用户“当前”项目：按 lastOpenedAt 或 updatedAt 排序取最新
  getCurrentForUser(userId: string): PersistedProjectRecord | null {
    const row = db
      .prepare(
        `SELECT data FROM projects
         WHERE user_id = ?
         ORDER BY COALESCE(last_opened_at, updated_at, created_at) DESC
         LIMIT 1`
      )
      .get(userId)

    if (!row) return null
    try {
      return JSON.parse((row as any).data) as PersistedProjectRecord
    } catch {
      return null
    }
  },

  // 保存或更新项目（按 id + userId 去重）
  saveForUser(
    userId: string,
    project: Omit<PersistedProjectRecord, 'userId' | 'metadata'> & { metadata?: Partial<PersistedProjectMetadata> }
  ): PersistedProjectRecord {
    const now = new Date().toISOString()
    const existing = db
      .prepare('SELECT created_at FROM projects WHERE id = ? AND user_id = ?')
      .get(project.id, userId) as { created_at: string } | undefined

    const createdAt =
      (project.metadata && typeof project.metadata.createdAt === 'string'
        ? project.metadata.createdAt
        : undefined) ||
      existing?.created_at ||
      now

    const record: PersistedProjectRecord = {
      ...(project as any),
      userId,
      metadata: {
        createdAt,
        updatedAt: now,
        lastOpenedAt: now,
      },
    }

    const data = JSON.stringify(record)

    if (existing) {
      db.prepare(
        `UPDATE projects
         SET data = ?, updated_at = ?, last_opened_at = ?
         WHERE id = ? AND user_id = ?`
      ).run(data, now, now, project.id, userId)
    } else {
      db.prepare(
        `INSERT INTO projects (id, user_id, data, created_at, updated_at, last_opened_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(project.id, userId, data, createdAt, now, now)
    }

    return record
  },
}
