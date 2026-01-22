import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

// SQLite 数据库初始化，用于存储多用户共享的数据

const dataDir = path.join(process.cwd(), 'data')
const dbFile = path.join(dataDir, 'nexlearn.db')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 同步数据库连接，简化使用
export const db = new Database(dbFile)

// 基本配置，提升并发安全性
db.pragma('journal_mode = WAL')

// 初始化表结构（如果不存在则创建）
db.exec(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_opened_at TEXT
  );
`)

