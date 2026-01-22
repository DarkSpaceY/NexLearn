import { db } from './db'

export const preferencesStore = {
  getForUser(userId: string): any | null {
    const row = db
      .prepare('SELECT data FROM user_preferences WHERE user_id = ?')
      .get(userId) as { data: string } | undefined
    if (!row) return null
    try {
      return JSON.parse(row.data) as any
    } catch {
      return null
    }
  },

  saveForUser(userId: string, preferences: any): any {
    const now = new Date().toISOString()
    const data = JSON.stringify(preferences)

    db.prepare(`
      INSERT INTO user_preferences (user_id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run(userId, data, now)

    return preferences
  },
}
