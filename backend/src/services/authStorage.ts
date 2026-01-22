import fs from 'fs'
import path from 'path'

export interface PersistedUserRecord {
  id: string
  email: string
  passwordHash: string
  displayName?: string
  createdAt: string
  updatedAt: string
}

export interface PersistedSessionRecord {
  id: string
  userId: string
  createdAt: string
  expiresAt: string
}

export interface PersistedAuthState {
  users: PersistedUserRecord[]
  sessions: PersistedSessionRecord[]
}

const dataDir = path.join(process.cwd(), 'data')
const dataFile = path.join(dataDir, 'auth.json')

const ensureDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

const parseState = (raw?: string | null): PersistedAuthState => {
  if (!raw) return { users: [], sessions: [] }
  try {
    const parsed = JSON.parse(raw)
    const users = Array.isArray(parsed?.users) ? parsed.users : []
    const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : []
    return { users, sessions }
  } catch {
    return { users: [], sessions: [] }
  }
}

const loadAuthState = (): PersistedAuthState => {
  if (!fs.existsSync(dataFile)) return { users: [], sessions: [] }
  const raw = fs.readFileSync(dataFile, 'utf-8')
  return parseState(raw)
}

const authState: PersistedAuthState = loadAuthState()

export const getAuthState = () => authState

export const saveAuthState = () => {
  ensureDir()
  fs.writeFileSync(dataFile, JSON.stringify(authState, null, 2))
}
